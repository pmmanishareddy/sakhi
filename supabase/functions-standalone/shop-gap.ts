import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Finds real, currently purchasable options for a buy-gap using Claude's
// web search tool. Every option carries a `sponsored` flag: false for organic
// results today, true for labeled brand-collab placements later.

const ALLOWED_ORIGINS = new Set([
  'https://sakhi-550.netlify.app',
  'http://localhost:5173',
  'http://localhost:4173',
])

function makeCorsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://sakhi-550.netlify.app',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

async function getUser(authHeader: string) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Unauthorized')
  return { user, supabase }
}

function stripEmDashes(v: any): any {
  if (typeof v === 'string') return v.replace(/\s*[—–]\s*/g, ', ')
  if (Array.isArray(v)) return v.map(stripEmDashes)
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, stripEmDashes(x)]))
  return v
}

function parseJson(text: string) {
  if (!text) throw new Error('Empty response from Claude')
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const start = cleaned.search(/[{[]/)
  const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'))
  if (start >= 0 && end > start) cleaned = cleaned.slice(start, end + 1)
  return JSON.parse(cleaned)
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

    const currency = (profile as any)?.currency || 'INR'
    const location = (profile as any)?.location || 'India'

    const userMessage = `Find shopping options for this wardrobe gap:
- Item: ${gap.role}
- Preferred colors: ${(gap.colors || []).join(', ') || 'any'}
- For occasions: ${(gap.occasions || []).join(', ') || 'everyday'}
- Price band: ${gap.price_band?.[0] || ''} to ${gap.price_band?.[1] || ''} ${currency}
- User is in: ${location}`

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
      }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(`Claude API error: ${response.status} ${JSON.stringify(data)}`)

    // Search responses interleave tool blocks with text; the JSON is in the text
    const text = (data.content || [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('')

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
