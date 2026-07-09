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
  // Web-search responses wrap the array in prose. Walk brackets to pull out
  // the first complete JSON array, string-aware.
  const s = cleaned.indexOf('[')
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
      if (depth === 0) return JSON.parse(cleaned.slice(s, i + 1))
    }
  }
  throw new Error('Unterminated JSON array in response')
}

const SYSTEM_PROMPT = `You are Sakhi's shopping scout. You are given a wardrobe gap (a garment role, preferred colors, occasions, and a price band) plus the user's city and currency. Use web search to find real products that are purchasable right now.

Rules:
- Find 3-5 options from reputable retailers that ship to the user's country. For India prefer Myntra, Ajio, Amazon.in, Nykaa Fashion, Tata CLiQ. For UAE prefer Namshi, Ounass, Amazon.ae, Noon, Level Shoes.
- Stay inside or near the price band. Match the requested colors and role closely.
- note: one short sentence on why this one fits the gap. Human voice. Never use em dashes.
- Only include products you actually found via search, with their real URLs. Never invent a product or URL.

After searching, return ONLY this JSON array, no other text:
[{ "title": "product name", "brand": "brand", "price": "1,999", "currency": "INR", "url": "https://...", "source": "myntra.com", "note": "why it fits" }]`

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

    // Web-search turns can end on pause_turn (continue the turn) or on prose
    // without the JSON (nudge once). Loop until we have an array to parse.
    let messages: any[] = [{ role: 'user', content: userMessage }]
    let text = ''
    for (let attempt = 0; attempt < 4; attempt++) {
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

      text = (data.content || [])
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('')

      if (data.stop_reason === 'pause_turn') {
        messages = [...messages, { role: 'assistant', content: data.content }]
        continue
      }
      if (text.includes('[')) break
      messages = [
        ...messages,
        { role: 'assistant', content: data.content },
        { role: 'user', content: 'Return ONLY the JSON array of options now. No other text.' },
      ]
    }

    const raw = parseJson(text)
    const options = (Array.isArray(raw) ? raw : [])
      .filter((o: any) => o && o.title && typeof o.url === 'string' && o.url.startsWith('http'))
      .slice(0, 5)
      .map((o: any) => ({
        title: String(o.title),
        brand: String(o.brand || ''),
        price: String(o.price || ''),
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
