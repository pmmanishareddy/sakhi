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
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: options.model || 'claude-sonnet-4-6',
      max_tokens: options.maxTokens || 4096,
      system: options.system,
      messages: options.messages,
    }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(`Claude API error: ${response.status} ${JSON.stringify(data)}`)
  const textBlock = data.content?.find((b: any) => b.type === 'text')
  if (!textBlock?.text) throw new Error(`Claude returned no text. Stop reason: ${data?.stop_reason || 'unknown'}`)
  const text = textBlock.text
  return text
}

function parseJson(text: string) {
  if (!text) throw new Error('Empty response from Claude')
  return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
}

// Claude reaches for em dashes no matter what the prompt says. Strip them
// from every string so the app voice stays clean.
function stripEmDashes(v: any): any {
  if (typeof v === 'string') return v.replace(/\s*[—–]\s*/g, ', ')
  if (Array.isArray(v)) return v.map(stripEmDashes)
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, stripEmDashes(x)]))
  return v
}

const SYSTEM_PROMPT = `You are Sakhi, a wardrobe intelligence AI for an Indian wardrobe. Analyze the user's wardrobe and identify gaps based on their ACTUAL lifestyle — not aspirational or generic advice. In every card body, talk directly to the user — always say "you/your", never "the user/she/her". Never comment on the user's body, size, shape, or attractiveness.
Never use em dashes (—) in anything you write. Short natural sentences, like a friend talking, not marketing copy.

You receive the inventory as a pipe-delimited list (#index|name|category|color|pattern|formality|occasions|fabric|worn|price). The #index numbers let you reference specific items.

CRITICAL RULES:
- Prioritize occasions the user FREQUENTLY dresses for. If they rarely go to work, do NOT suggest work items.
- Respect the user's style identity and avoids list. Never suggest items they'd avoid.
- Reference specific items and counts from the inventory.
- Factor in the user's location/climate when relevant.
- If they prefer "fewer, better pieces," suggest quality upgrades. If they love variety, suggest range expansion.

Consider:
- Category balance relative to the user's lifestyle frequency
- Color distribution gaps that limit outfit combinations
- Occasion coverage weighted by how often the user actually dresses for each
- Ethnic vs western coverage — check both wardrobes are complete for the user's life (e.g. sarees without matching blouses, kurtas without bottoms, wedding/festival occasions with nothing to wear)
- Wear frequency (which categories get the most use? which are neglected?)
- Pairing potential (what single addition would unlock the most new outfit combinations?)

Return a JSON array of exactly 4 gap cards:
[{
  "kind": "buy" | "wear" | "fix",
  "title": "short noun phrase, max 5 words",
  "headline": "the hook with real numbers, max 8 words, e.g. '6 sarees. Only 2 blouses.'",
  "body": "2 short sentences, under 25 words total, with specifics, addressing the user as you",
  "evidence_refs": [12, 4],
  "evidence_label": "caption for those items, e.g. '6 sarees'",
  "ghost_label": "the missing item in 2-3 words, or null unless kind is buy",
  "unlocks_refs": [7, 19],
  "gap": { "role": "saree blouse", "occasions": ["wedding"], "colors": ["gold", "cream"], "price_band": [1500, 3000] }
}]

Card kinds: "buy" is a real purchase gap. "wear" means the user already owns the answer and should wear it more. "fix" is a data cleanup (missing colors, wrong category). Include at least one wear or fix card when honest to do so. Buying nothing is a good outcome.
evidence_refs: the #index numbers of 1-6 inventory items that PROVE the gap, most relevant first. unlocks_refs: 0-4 #index numbers the fix would pair with. Only use #index numbers that exist.
"gap" is null unless kind is buy. price_band is two numbers in the user's currency, grounded near prices of comparable items they own.

Categories in the stats are pre-normalized, and the garment role counts are authoritative — use those exact numbers for any counting claims (e.g. total sarees, total bottoms). Never recount from the raw list.

Be specific — reference actual items and counts from the inventory. Return ONLY valid JSON, no markdown.`

// Real data has drifted variants ("Dress"/"Dresses", "Saree"/"Sarees") — normalize
// before counting so the model never has to repair taxonomy and miscount
const CATEGORY_CANON: Record<string, string> = {
  'dresses': 'Dress', 'dress': 'Dress', 'jumpsuits': 'Jumpsuit', 'jumpsuit': 'Jumpsuit',
  'sarees': 'Saree', 'saree': 'Saree', 'sari': 'Saree',
  'saree blouses': 'Saree Blouse', 'saree blouse': 'Saree Blouse',
  'tops': 'Top', 'top': 'Top', 'shirts': 'Shirt', 'shirt': 'Shirt',
  't-shirts': 'T-Shirt', 't-shirt': 'T-Shirt', 'blouses': 'Blouse', 'blouse': 'Blouse',
  'bottoms': 'Pants', 'bottom': 'Pants', 'pants': 'Pants', 'trousers': 'Pants',
  'jeans': 'Jeans', 'skirts': 'Skirt', 'skirt': 'Skirt', 'shorts': 'Shorts', 'leggings': 'Leggings',
  'kurtas': 'Kurta', 'kurta': 'Kurta', 'dupattas': 'Dupatta', 'dupatta': 'Dupatta',
  'jackets': 'Jacket', 'jacket': 'Jacket', 'blazers': 'Blazer', 'blazer': 'Blazer',
  'shoes': 'Shoes', 'sneakers': 'Sneakers', 'sandals': 'Sandals', 'heels': 'Heels', 'flats': 'Flats',
  'bags': 'Bag', 'bag': 'Bag', 'jewelry': 'Jewelry', 'jewellery': 'Jewelry',
}

function canonCategory(raw: string): string {
  return CATEGORY_CANON[raw.trim().toLowerCase()] ?? raw.trim()
}

const ROLE_OF: Record<string, string> = {
  'Dress': 'dresses', 'Jumpsuit': 'dresses', 'Saree': 'sarees',
  'Top': 'tops', 'Shirt': 'tops', 'T-Shirt': 'tops', 'Blouse': 'tops',
  'Kurta': 'ethnic tops', 'Saree Blouse': 'saree blouses',
  'Pants': 'bottoms', 'Jeans': 'bottoms', 'Skirt': 'bottoms', 'Shorts': 'bottoms', 'Leggings': 'bottoms',
  'Jacket': 'outerwear', 'Blazer': 'outerwear',
  'Shoes': 'footwear', 'Sneakers': 'footwear', 'Sandals': 'footwear', 'Heels': 'footwear', 'Flats': 'footwear',
  'Bag': 'bags', 'Jewelry': 'accessories', 'Dupatta': 'accessories',
}

serve(async (req) => {
  const corsHeaders = makeCorsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')!
    const { user, supabase } = await getUser(authHeader)

    const [{ data: items }, { data: profile }, { data: recentOutfits }] = await Promise.all([
      supabase.from('wardrobe_items')
        .select('id, name, category, primary_color, pattern, formality, occasions, fabric, times_worn, price')
        .eq('user_id', user.id)
        .eq('status', 'active'),
      supabase.from('profiles')
        .select('occasions, style_preferences, location')
        .eq('id', user.id)
        .single(),
      supabase.from('outfits')
        .select('occasion')
        .eq('user_id', user.id)
        .gte('date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
    ])

    const catCounts: Record<string, number> = {}
    const roleCounts: Record<string, number> = {}
    const colorCounts: Record<string, number> = {}
    const formalityCounts: Record<string, number> = {}
    let totalWorn = 0
    let missingColor = 0

    for (const item of items || []) {
      const cat = canonCategory(item.category)
      catCounts[cat] = (catCounts[cat] || 0) + 1
      const role = ROLE_OF[cat] || 'other'
      roleCounts[role] = (roleCounts[role] || 0) + 1
      if (!item.primary_color || item.primary_color.toLowerCase() === 'unknown') {
        missingColor++
      } else {
        colorCounts[item.primary_color] = (colorCounts[item.primary_color] || 0) + 1
      }
      formalityCounts[item.formality] = (formalityCounts[item.formality] || 0) + 1
      totalWorn += item.times_worn
    }

    // Outfit occasion frequency
    const occasionFreqActual: Record<string, number> = {}
    for (const outfit of recentOutfits || []) {
      occasionFreqActual[outfit.occasion] = (occasionFreqActual[outfit.occasion] || 0) + 1
    }

    let userMessage = `Wardrobe stats:
- Total items: ${items?.length || 0}
- Garment role counts (authoritative): ${Object.entries(roleCounts).map(([k, v]) => `${k}: ${v}`).join(', ')}
- Category distribution: ${Object.entries(catCounts).map(([k, v]) => `${k}: ${v}`).join(', ')}
- Color distribution: ${Object.entries(colorCounts).map(([k, v]) => `${k}: ${v}`).join(', ')}${missingColor ? `\n- Items with no color recorded: ${missingColor} (excluded from color distribution — the user hasn't filled these in; "Unknown" is not a color)` : ''}
- Formality distribution: ${Object.entries(formalityCounts).map(([k, v]) => `${k}: ${v}`).join(', ')}
- Average wear count: ${items?.length ? (totalWorn / items.length).toFixed(1) : 0}`

    // Profile context
    const prefs = (profile as any)?.style_preferences || {}

    if ((profile as any)?.location) {
      userMessage += `\n\nUser is based in: ${(profile as any).location}`
    }

    if (prefs.style_words?.length) {
      userMessage += `\nStyle identity: ${prefs.style_words.join(', ')}`
    }

    if (prefs.occasion_frequency) {
      userMessage += `\nSelf-reported occasion frequency: ${JSON.stringify(prefs.occasion_frequency)}`
    }

    if (Object.keys(occasionFreqActual).length > 0) {
      userMessage += `\nActual outfits logged (last 90 days): ${Object.entries(occasionFreqActual).map(([k, v]) => `${k}: ${v} times`).join(', ')}`
    }

    if (prefs.shopping_mindset) {
      const m = prefs.shopping_mindset
      const traits: string[] = []
      if (m.quality_vs_variety) traits.push(m.quality_vs_variety === 'quality' ? 'Prefers fewer, better pieces' : 'Loves variety')
      if (m.repeat_comfort) traits.push(m.repeat_comfort === 'comfortable' ? 'Fine with repeating outfits' : 'Avoids repeating outfits')
      if (traits.length) userMessage += `\nShopping mindset: ${traits.join('. ')}`
    }

    if (prefs.avoids?.length) {
      userMessage += `\nUser avoids wearing: ${prefs.avoids.join(', ')}`
    }
    if (prefs.avoids_note) {
      userMessage += ` (also: ${prefs.avoids_note})`
    }

    if ((profile as any)?.occasions?.length) {
      userMessage += `\nOccasions in their life: ${(profile as any).occasions.join(', ')}`
    }

    // Short #index numbers keep uuids out of the prompt; map back after
    const indexed = items || []
    const pipeItems = indexed.map((i: any, n: number) =>
      `#${n}|${i.name}|${canonCategory(i.category)}|${i.primary_color?.toLowerCase() === 'unknown' ? '' : i.primary_color}|${i.pattern || ''}|${i.formality}|${(i.occasions || []).join('/')}|${i.fabric || ''}|worn ${i.times_worn}x|${i.price ?? ''}`
    ).join('\n')
    userMessage += `\n\nFull inventory (#index|name|category|color|pattern|formality|occasions|fabric|worn|price):\n${pipeItems}`

    const text = await callClaude({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const raw = parseJson(text)
    const refToId = (refs: unknown): string[] =>
      (Array.isArray(refs) ? refs : [])
        .map((r: any) => indexed[Number(r)]?.id)
        .filter(Boolean)

    const gaps = (Array.isArray(raw) ? raw : [])
      .filter((c: any) => c && ['buy', 'wear', 'fix'].includes(c.kind) && c.title && c.headline)
      .map((c: any) => ({
        kind: c.kind,
        title: c.title,
        headline: c.headline,
        body: c.body || '',
        evidence_ids: refToId(c.evidence_refs),
        evidence_label: c.evidence_label || '',
        ghost: c.kind === 'buy' && c.ghost_label ? { label: c.ghost_label } : null,
        unlocks_ids: refToId(c.unlocks_refs),
        gap: c.kind === 'buy' && c.gap?.role ? {
          role: c.gap.role,
          occasions: Array.isArray(c.gap.occasions) ? c.gap.occasions : [],
          colors: Array.isArray(c.gap.colors) ? c.gap.colors : [],
          price_band: Array.isArray(c.gap.price_band) && c.gap.price_band.length === 2 ? c.gap.price_band : [0, 0],
        } : null,
      }))

    const cleanGaps = stripEmDashes(gaps)

    // Store the result so the screen loads instantly next time.
    // Best-effort: a missing table must never fail the request.
    try {
      await supabase.from('gap_results').upsert({
        user_id: user.id,
        cards: cleanGaps,
        computed_at: new Date().toISOString(),
      })
    } catch { /* precompute storage is optional */ }

    return new Response(JSON.stringify({ success: true, gaps: cleanGaps }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
