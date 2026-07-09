import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { makeCorsHeaders } from '../_shared/cors.ts'
import { getUser } from '../_shared/auth.ts'

// Finds real, currently purchasable options for a buy-gap using Claude's
// web search tool. Every option carries a `sponsored` flag: false for organic
// results today, true for labeled brand-collab placements later.

function stripEmDashes(v: any): any {
  if (typeof v === 'string') return v.replace(/\s*[—–]\s*/g, ', ')
  if (Array.isArray(v)) return v.map(stripEmDashes)
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, stripEmDashes(x)]))
  return v
}

function parseJson(text: string) {
  if (!text) throw new Error('Empty response from Claude')
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  // Web-search prose contains markdown citations like [source], so the first
  // bracket is not necessarily the array. Try every bracket until one parses.
  let from = 0
  while (true) {
    const s = cleaned.indexOf('[', from)
    if (s < 0) throw new Error('No JSON array in response')
    let depth = 0, inStr = false, esc = false
    for (let i = s; i < cleaned.length; i++) {
      const ch = cleaned[i]
      if (esc) { esc = false; continue }
      if (ch === '\\') { esc = true; continue }
      if (ch === '"') inStr = !inStr
      if (inStr) continue
      if (ch === '[') depth++
      else if (ch === ']') {
        depth--
        if (depth === 0) {
          try { return JSON.parse(cleaned.slice(s, i + 1)) } catch { break }
        }
      }
    }
    from = s + 1
  }
}

const SYSTEM_PROMPT = `You are Sakhi's shopping scout. You are given a wardrobe gap (a garment role, preferred colors, occasions, and a price band) plus the user's city and currency. Use web search to find real products that are purchasable right now.

Rules:
- Find 3-5 options from reputable retailers that ship to the user's country. For India prefer Myntra, Ajio, Amazon.in, Nykaa Fashion, Tata CLiQ. For UAE prefer Namshi, Ounass, Amazon.ae, Noon, Level Shoes.
- Stay inside or near the price band. Match the requested colors and role closely.
- Exact product pages are best. When you cannot pin down an exact product, a retailer's relevant filtered category or collection page is a perfectly good option: use its real URL and make the title describe what the user will find there (e.g. "Gold and cream saree blouses at Ounass").
- If you did not see a price, leave "price" as an empty string. Never write text like "visit site" in the price field.
- Always return the best 3-5 options your searches surfaced. Only URLs you actually saw in results; never invent URLs.
- note: one short sentence on why this one fits the gap. Human voice. Never use em dashes.

No markdown links or bracketed citations anywhere in your reply. After searching, return ONLY this JSON array, no other text:
[{ "title": "product or page name", "brand": "brand or retailer", "price": "1,999", "currency": "INR", "url": "https://...", "source": "myntra.com", "note": "why it fits" }]`

serve(async (req) => {
  const corsHeaders = makeCorsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')!
    const { user, supabase } = await getUser(authHeader)

    const { gap } = await req.json()
    if (!gap || typeof gap.role !== 'string' || !gap.role) {
      return new Response(JSON.stringify({ success: false, error: 'Missing gap details' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('location, currency')
      .eq('id', user.id)
      .single()

    const currency = profile?.currency || 'INR'
    const location = profile?.location || 'India'

    const userMessage = `Find shopping options for this wardrobe gap:
- Item: ${gap.role}
- Preferred colors: ${(gap.colors || []).join(', ') || 'any'}
- For occasions: ${(gap.occasions || []).join(', ') || 'everyday'}
- Price band: ${gap.price_band?.[0] || ''} to ${gap.price_band?.[1] || ''} ${currency}
- User is in: ${location}`

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

    // Rounds end on pause_turn (continue), prose without JSON, or an empty
    // array (the model being timid). Nudge and retry, three rounds max.
    let messages: any[] = [{ role: 'user', content: userMessage }]
    let raw: any[] = []
    for (let round = 0; round < 3; round++) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 3000,
          system: SYSTEM_PROMPT,
          messages,
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(`Claude API error: ${response.status} ${JSON.stringify(data)}`)

      const text = (data.content || [])
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('')

      if (data.stop_reason === 'pause_turn') {
        messages = [...messages, { role: 'assistant', content: data.content }]
        continue
      }
      if (/\[\s*\{/.test(text)) {
        try {
          const parsed = parseJson(text)
          if (Array.isArray(parsed) && parsed.length > 0) { raw = parsed; break }
        } catch { /* nudge below */ }
      }
      messages = [
        ...messages,
        { role: 'assistant', content: data.content },
        { role: 'user', content: 'Return the JSON array of the best options your searches surfaced. Category pages with real URLs are fine. JSON only, no other text.' },
      ]
    }
    if (raw.length === 0) throw new Error('No usable options found')

    const options = raw
      .filter((o: any) => o && o.title && typeof o.url === 'string' && o.url.startsWith('http'))
      .slice(0, 5)
      .map((o: any) => ({
        title: String(o.title),
        brand: String(o.brand || ''),
        price: /\d/.test(String(o.price || '')) ? String(o.price) : '',
        currency: String(o.currency || currency),
        url: o.url,
        source: String(o.source || new URL(o.url).hostname.replace('www.', '')),
        note: String(o.note || ''),
        sponsored: false,
      }))

    return new Response(JSON.stringify({ success: true, options: stripEmDashes(options) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
