import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

async function callClaude(options: { system: string; messages: any[]; model?: string; maxTokens?: number }): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const model = options.model || 'claude-sonnet-4-6'
  console.log(`[Claude] Calling model=${model}, maxTokens=${options.maxTokens || 4096}`)

  const startTime = Date.now()
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens || 4096,
      system: options.system,
      messages: options.messages,
    }),
  })

  const elapsed = Date.now() - startTime
  console.log(`[Claude] Response: status=${response.status}, took=${elapsed}ms`)

  const data = await response.json()

  if (!response.ok) {
    console.error(`[Claude] API error:`, JSON.stringify(data))
    throw new Error(`Claude API error: ${response.status} - ${data?.error?.message || JSON.stringify(data)}`)
  }

  console.log(`[Claude] stop_reason=${data.stop_reason}, content_types=${data.content?.map((b: any) => b.type).join(',')}`)

  const textBlock = data.content?.find((b: any) => b.type === 'text')
  if (!textBlock?.text) throw new Error(`Claude returned no text. Stop reason: ${data?.stop_reason || 'unknown'}`)
  return textBlock.text
}

function parseJson(text: string) {
  if (!text) throw new Error('Empty response from Claude')
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  // Tolerate prose around the JSON ("I can see...") — extract from first bracket to last
  const start = cleaned.search(/[{[]/)
  const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'))
  if (start >= 0 && end > start) cleaned = cleaned.slice(start, end + 1)
  try {
    return JSON.parse(cleaned)
  } catch (e) {
    console.error(`[Parse] Failed to parse JSON. First 200 chars:`, cleaned.substring(0, 200))
    throw new Error(`Failed to parse Claude response as JSON: ${(e as Error).message}`)
  }
}

// Claude reaches for em dashes no matter what the prompt says. Strip them
// from every string so the app voice stays clean.
function stripEmDashes(v: any): any {
  if (typeof v === 'string') return v.replace(/\s*[—–]\s*/g, ', ')
  if (Array.isArray(v)) return v.map(stripEmDashes)
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, stripEmDashes(x)]))
  return v
}

const SYSTEM_PROMPT = `You are Sakhi, a friendly wardrobe advisor for an Indian wardrobe. Talk directly to the user — always say "you/your", never "the user/she/her". Never comment on the user's body, size, shape, or attractiveness.
Never use em dashes (—) in anything you write. Short natural sentences, like a friend talking, not marketing copy.

You receive the full wardrobe as a pipe-delimited list (name|category|color|pattern|formality|occasions|price|style) plus their profile. The style column is authoritative: W = western, E = ethnic, V = versatile. Ground EVERY claim in this list — never invent items, counts, or numbers.

## ETHNIC vs WESTERN — never cross the boundary
Ethnic pieces (sarees, saree blouses, kurtas, dupattas) and western pieces are NEVER overlap or substitutes for each other. A saree blouse is not a top and not a dress alternative. Overlap requires the SAME garment role AND the same style direction (or V). The same applies to pairings: a western dress does not pair with saree blouses or dupattas.

If an image is attached, use it to identify the item being considered.

## VERDICT CRITERIA — have an opinion; "maybe" is a last resort, not a safe default
- skip: 2+ existing pieces already fill the same role (same garment role AND style direction, similar color/formality), or it's on the avoids list, or it serves an occasion the user rarely dresses for
- buy: fills a real gap for an occasion the user frequently dresses for, or pairs with many existing pieces to unlock new outfits
- maybe: genuinely borderline, or the wardrobe is too small to judge

## GROUNDED NUMBERS
- overlap: name the actual similar items you counted (e.g. "You already own 3 black tops: Silk Cami, Ribbed Tank, Zara Crop"), or null if none
- pairings_count: count the specific wardrobe items this would genuinely pair with — count them, don't guess
- estimated_cpw: price ÷ realistic wears over 2 years, given how often the user dresses for this item's occasions. Same currency as the given price (assume INR if unlabeled). 0 if no price given.

Be brief. The reason stays under 30 words, overlap under 15 words naming at most 3 items. Max 2 evidence points, each under 12 words.

Return JSON:
{
  "verdict": "buy" | "skip" | "maybe",
  "title": "e.g. Skip This One or Great Addition",
  "reason": "under 30 words, addressing the user as you",
  "overlap": "e.g. You already own 3 similar black tops: <names>" or null,
  "pairings_count": number,
  "estimated_cpw": number,
  "evidence": [{ "label": "short label", "text": "under 12 words" }]
}

Return ONLY valid JSON, no markdown.`

const ETHNIC_CATEGORIES = new Set(['Saree', 'Saree Blouse', 'Kurta', 'Dupatta'])
const WESTERN_CATEGORIES = new Set(['T-Shirt', 'Shirt', 'Crop Top', 'Dress', 'Jumpsuit', 'Jeans', 'Shorts', 'Hoodie', 'Blazer', 'Sweater', 'Sneakers'])
const ETHNIC_KEYWORDS = /saree|sari\b|kurta|kurti|lehenga|anarkali|salwar|churidar|dupatta|choli|sharara|zari|warli|bandhani|banarasi|kanjeevaram|jhumka|kolhapuri|mojari|juttis?\b/

// W = western-only, E = ethnic-only, V = versatile (works with either)
function styleOf(i: any): 'W' | 'E' | 'V' {
  const text = `${i.name} ${i.category} ${(i.style_tags || []).join(' ')}`.toLowerCase()
  if (ETHNIC_CATEGORIES.has(i.category) || ETHNIC_KEYWORDS.test(text) || i.style_tags?.includes('ethnic')) return 'E'
  if (WESTERN_CATEGORIES.has(i.category)) return 'W'
  return 'V'
}

serve(async (req) => {
  const corsHeaders = makeCorsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    console.log('[purchase-verdict] Starting request')

    const authHeader = req.headers.get('Authorization')!
    const { user, supabase } = await getUser(authHeader)
    console.log(`[purchase-verdict] Authenticated user=${user.id}`)

    const body = await req.json()
    const { image_base64, image_content_type, source_url, item_name, item_price } = body
    console.log(`[purchase-verdict] Input: hasImage=${!!image_base64}, name="${item_name || ''}", price=${item_price || 'none'}`)

    // Fetch wardrobe + profile in parallel
    console.log('[purchase-verdict] Fetching wardrobe and profile...')
    const [{ data: items, error: itemsErr }, { data: profile, error: profileErr }] = await Promise.all([
      supabase.from('wardrobe_items')
        .select('id, name, category, primary_color, pattern, formality, occasions, style_tags, price')
        .eq('user_id', user.id)
        .eq('status', 'active'),
      supabase.from('profiles')
        .select('occasions, style_preferences, location')
        .eq('id', user.id)
        .single(),
    ])

    if (itemsErr) console.error('[purchase-verdict] Wardrobe fetch error:', itemsErr.message)
    if (profileErr) console.error('[purchase-verdict] Profile fetch error:', profileErr.message)
    console.log(`[purchase-verdict] Wardrobe: ${items?.length || 0} items, profile: ${profile ? 'found' : 'missing'}`)

    // Build user message
    let userMessage = `Item being considered: ${item_name || 'See attached image'}`
    if (item_price) userMessage += `\nPrice: ${item_price}`
    if (source_url) userMessage += `\nSource: ${source_url}`

    const prefs = (profile as any)?.style_preferences || {}

    userMessage += '\n\nUser profile:'
    if ((profile as any)?.location) userMessage += `\n- Based in: ${(profile as any).location}`
    if (prefs.style_words?.length) userMessage += `\n- Style identity: ${prefs.style_words.join(', ')}`

    if (prefs.occasion_frequency) {
      userMessage += `\n- Occasion frequency: ${JSON.stringify(prefs.occasion_frequency)}`
    }

    if (prefs.shopping_mindset) {
      const m = prefs.shopping_mindset
      const traits: string[] = []
      if (m.quality_vs_variety) traits.push(m.quality_vs_variety === 'quality' ? 'Prefers fewer, better pieces' : 'Loves variety')
      if (m.planned_vs_impulse) traits.push(m.planned_vs_impulse === 'impulse' ? 'Tends to buy on impulse' : 'Plans purchases carefully')
      if (m.repeat_comfort) traits.push(m.repeat_comfort === 'comfortable' ? 'Fine with repeating outfits' : 'Avoids repeating outfits')
      if (traits.length) userMessage += `\n- Shopping mindset: ${traits.join('. ')}`
    }

    if (prefs.avoids?.length) {
      userMessage += `\n- Avoids wearing: ${prefs.avoids.join(', ')}`
    }
    if (prefs.avoids_note) {
      userMessage += ` (also: ${prefs.avoids_note})`
    }

    if ((profile as any)?.occasions?.length) {
      userMessage += `\n- Occasions: ${(profile as any).occasions.join(', ')}`
    }

    const pipeItems = (items || []).map((i: any) =>
      `${i.name}|${i.category}|${i.primary_color}|${i.pattern || ''}|${i.formality}|${(i.occasions || []).join('/')}|${i.price ?? ''}|${styleOf(i)}`
    ).join('\n')
    userMessage += `\n\nWardrobe (${items?.length || 0} items — name|category|color|pattern|formality|occasions|price|style[W=western,E=ethnic,V=versatile]):\n${pipeItems}`

    // Build message content with optional image
    const messageContent: any[] = []
    if (image_base64) {
      messageContent.push({
        type: 'image',
        source: { type: 'base64', media_type: image_content_type, data: image_base64 },
      })
      console.log(`[purchase-verdict] Including image: type=${image_content_type}, base64_length=${image_base64.length}`)
    }
    messageContent.push({ type: 'text', text: userMessage })

    console.log(`[purchase-verdict] Calling Claude for verdict (message length ~${userMessage.length} chars)`)
    let text = await callClaude({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: messageContent }],
      maxTokens: 1024,
    })

    console.log(`[purchase-verdict] Got Claude response, parsing JSON...`)
    // If the model narrated instead of returning JSON, ask it once to reformat
    let verdict
    try {
      verdict = parseJson(text)
    } catch {
      console.log('[purchase-verdict] Unparseable, asking for JSON-only reformat')
      text = await callClaude({
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: messageContent },
          { role: 'assistant', content: text },
          { role: 'user', content: 'Return ONLY the complete JSON object, no commentary. Start with { and end with }.' },
        ],
        maxTokens: 1024,
      })
      verdict = parseJson(text)
    }
    console.log(`[purchase-verdict] Verdict: ${verdict.verdict} - "${verdict.title}"`)

    console.log('[purchase-verdict] Success, returning verdict')
    return new Response(JSON.stringify({ success: true, verdict: stripEmDashes(verdict) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : ''
    console.error(`[purchase-verdict] ERROR: ${msg}`)
    console.error(`[purchase-verdict] Stack: ${stack}`)
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
