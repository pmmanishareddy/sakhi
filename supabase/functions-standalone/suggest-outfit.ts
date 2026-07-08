import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  if (!textBlock?.text) throw new Error(`Claude returned no text. Stop: ${data?.stop_reason || 'unknown'}`)
  return textBlock.text
}

function parseJson(text: string) {
  if (!text) throw new Error('Empty response from Claude')
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  // Tolerate prose around the JSON — extract from first bracket to last
  const start = cleaned.search(/[{[]/)
  const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'))
  if (start >= 0 && end > start) cleaned = cleaned.slice(start, end + 1)
  return JSON.parse(cleaned)
}

const ETHNIC_CATEGORIES = new Set(['Saree', 'Saree Blouse', 'Kurta', 'Dupatta'])
const WESTERN_CATEGORIES = new Set(['T-Shirt', 'Shirt', 'Crop Top', 'Dress', 'Jumpsuit', 'Jeans', 'Shorts', 'Hoodie', 'Blazer', 'Sweater', 'Sneakers'])
const ETHNIC_KEYWORDS = /saree|sari\b|kurta|kurti|lehenga|anarkali|salwar|churidar|dupatta|choli|sharara|zari|warli|bandhani|banarasi|kanjeevaram|jhumka|kolhapuri|mojari|juttis?\b/

function itemText(i: any): string {
  return `${i.name} ${i.category} ${(i.style_tags || []).join(' ')}`.toLowerCase()
}

// W = western-only, E = ethnic-only, V = versatile (works with either)
function styleOf(i: any): 'W' | 'E' | 'V' {
  const text = itemText(i)
  if (ETHNIC_CATEGORIES.has(i.category) || ETHNIC_KEYWORDS.test(text) || i.style_tags?.includes('ethnic')) return 'E'
  if (WESTERN_CATEGORIES.has(i.category)) return 'W'
  return 'V'
}

function isSareeBlouse(i: any): boolean {
  const text = itemText(i)
  return i.category === 'Saree Blouse' || /saree blouse|choli/.test(text) ||
    (i.category === 'Blouse' && styleOf(i) === 'E')
}

function isSaree(i: any): boolean {
  return !isSareeBlouse(i) && (i.category === 'Saree' || /saree|\bsari\b/.test(itemText(i)))
}

const ONE_PIECE_CATEGORIES = new Set(['Dress', 'Jumpsuit', 'Saree'])

// Deterministic check of the ethnic/western hard rules Claude sometimes breaks
function findViolations(chosen: any[]): string[] {
  const violations: string[] = []
  const sareeBlouses = chosen.filter(isSareeBlouse)
  const sarees = chosen.filter(isSaree)

  if (sareeBlouses.length > 0 && sarees.length === 0) {
    violations.push(`"${sareeBlouses[0].name}" is a saree blouse but there is no saree in the outfit. Saree blouses are never standalone tops.`)
  }
  if (sarees.length > 0) {
    const western = chosen.filter((i: any) => styleOf(i) === 'W')
    if (western.length > 0) {
      violations.push(`A saree cannot be mixed with western pieces: ${western.map((i: any) => `"${i.name}"`).join(', ')}.`)
    }
  }
  const onePieces = chosen.filter((i: any) => ONE_PIECE_CATEGORIES.has(i.category) || isSaree(i))
  if (onePieces.length > 1) {
    violations.push(`Outfit contains two one-pieces: ${onePieces.map((i: any) => `"${i.name}"`).join(', ')}. Only one allowed.`)
  }
  return violations
}

const SYSTEM_PROMPT = `You are Sakhi, an expert personal stylist AI for an Indian woman's wardrobe app. You build complete, coherent outfits from the user's wardrobe inventory for a specific occasion.

You receive a pipe-delimited list of wardrobe items (id|name|category|color|pattern|formality|fabric|style) pre-filtered for the occasion. The style column is authoritative: W = western-only, E = ethnic-only, V = versatile (works with either). Return exactly one outfit using ONLY items from the list.

## THINKING PROCESS — follow in order before outputting

STEP 1 — CHOOSE ONE STYLE DIRECTION (never mix):
- WESTERN: only W and V items. Zero E items allowed.
- ETHNIC: only E and V items. Zero W items allowed.
- INDO-WESTERN: kurta (E) + jeans/pants (W/V), or ethnic accessories with western silhouettes. NEVER saree pieces.
Once chosen, every item must belong to that direction. Trust the style column over your own guess.

STEP 2 — SELECT THE ANCHOR PIECE:
Pick one hero garment that sets the outfit's tone and color palette.
If the user pinned items, the pinned item IS the anchor.

STEP 3 — BUILD USING THE CORRECT FORMULA (see below).

STEP 4 — VERIFY COLOR HARMONY (see rules below). Swap clashing pieces.

STEP 5 — VALIDATE against hard constraints. Fix any violation before returning.

## OUTFIT FORMULAS (* = required)

WESTERN CASUAL:
  *Top (T-Shirt/Top/Crop Top) + *Bottom (Jeans/Shorts/Skirt) + *Footwear (Sneakers/Sandals)
  Optional: Hoodie/Jacket, Bag, Sunglasses

WESTERN SMART CASUAL:
  *Shirt/Blouse/Top + *Pants/Jeans/Skirt + *Footwear (Shoes/Sandals/Heels)
  Optional: Blazer, Bag, Watch, Belt

WESTERN DRESSY:
  *Dress OR (*Blouse/Top + *Skirt/Pants) + *Footwear (Heels/Sandals)
  Optional: Blazer/Jacket, Clutch/Bag, Jewelry

JUMPSUIT:
  *Jumpsuit + *Footwear — no separate top or bottom
  Optional: Jacket/Blazer, Bag, Jewelry, Belt

ETHNIC SAREE:
  *Saree + *Saree Blouse + *Footwear (Heels/Sandals, NEVER Sneakers)
  Optional: Jewelry, Bag — NOTHING else. No extra tops, bottoms, or western layers.

ETHNIC KURTA:
  *Kurta + *Bottom (Leggings/Pants) + *Footwear (Sandals/Heels)
  Optional: Dupatta, Jewelry, Bag

## CATEGORY → ROLE MAP

Determine each item's role from its "category" field (or "name" if category is broad like "Tops"):
- TOP: T-Shirt, Top, Shirt, Blouse, Crop Top, Sweater, Hoodie
- BOTTOM: Pants, Jeans, Shorts, Skirt, Leggings
- ONE-PIECE: Dress, Jumpsuit, Saree
- ETHNIC TOP: Kurta, Saree Blouse
- OUTERWEAR: Jacket, Blazer
- FOOTWEAR: Shoes, Sandals, Heels, Sneakers
- BAG: Bags
- ACCESSORY: Jewelry, Dupatta, Sunglasses, Watch, Belt, Scarf, Hat

## COLOR RULES

Neutrals (pair with anything): Black, White, Cream, Beige, Navy, Grey, Brown, Tan, Olive, Khaki
Metallics (neutral for accessories only): Gold, Silver, Rose Gold

1. Max 3 non-neutral colors per outfit
2. Bold anchor piece → keep everything else neutral
3. Patterned anchor → other pieces use colors FROM the pattern, or neutrals
4. Monochrome (same color family, different shades) always works
5. Avoid: red+orange, red+pink (unless tonal), multiple competing prints

## HARD CONSTRAINTS — any violation = bad outfit

1. NEVER suggest underwear, sports bras, bralettes, or innerwear as tops
2. NEVER use a Saree Blouse as a standalone top — only in ETHNIC SAREE outfits paired with a saree, never with pants, jeans, or skirts
3. NEVER combine two one-pieces
4. NEVER add a separate top or bottom with a Dress, Jumpsuit, or Saree
5. NEVER mix Saree with western pieces
6. NEVER pair Sneakers with Saree or formal ethnic wear
7. NEVER suggest two items in the same required role
8. NEVER invent items — every id must come from the provided list
9. AVOID repeating item combinations from the recent outfits list

## PINNED ITEMS

When items are pinned:
- Build the entire outfit direction around the pinned item(s)
- If pinned items conflict, use the FIRST pinned item

## WEATHER

You are told the current month and her location. Dress for it: in hot months prefer breathable fabrics (cotton, linen, chiffon) and skip heavy layering. Only suggest jackets, blazers, or sweaters in cooler months or when the occasion demands it (e.g. formal office).

## STYLING NOTES — be specific, never generic

Speak directly to her in styling_note and why — always "you/your", never "the user".

GOOD: "Roll the sleeves on the linen shirt and half-tuck into the trousers for a relaxed office look"
BAD: "A striking combination!" / "You'll look amazing!"

Tell her HOW to wear or style the pieces. Reference specific colors, fabrics, or techniques.

## OUTPUT — return ONLY this JSON, no markdown, no code fences
Do NOT write any reasoning, preamble, or commentary. Your response must start with { and end with }.

{
  "items": [{ "id": "<item UUID from inventory>", "role": "top|bottom|one-piece|outerwear|shoes|bag|accessory" }],
  "styling_note": "<1-2 sentences: specific, actionable styling advice for THIS outfit>",
  "why": "<1 sentence: why these pieces work — mention colors, style direction, or occasion fit>"
}`

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')!
    const { user, supabase } = await getUser(authHeader)

    const { occasion, pinned_item_ids, exclude_item_ids } = await req.json()

    const [{ data: items }, { data: recentOutfits }, { data: profile }] = await Promise.all([
      supabase.from('wardrobe_items')
        .select('id, name, category, primary_color, pattern, formality, occasions, style_tags, fabric, laundry_status, image_url')
        .eq('user_id', user.id)
        .eq('status', 'active'),
      supabase.from('outfits')
        .select('id, occasion, outfit_items(wardrobe_item_id)')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(10),
      supabase.from('profiles')
        .select('style_preferences, location')
        .eq('id', user.id)
        .single(),
    ])

    const cleanItems = (items || []).filter((i: any) => i.laundry_status === 'clean')
    const excludeSet = new Set(exclude_item_ids || [])
    const pinnedSet = new Set(pinned_item_ids || [])

    // Occasion → acceptable formality mapping
    const formalityMap: Record<string, string[]> = {
      'Office': ['Smart Casual', 'Semi-Formal', 'Formal'],
      'Casual': ['Casual', 'Smart Casual'],
      'Party': ['Smart Casual', 'Semi-Formal', 'Formal'],
      'Wedding': ['Formal', 'Ethnic'],
      'Date Night': ['Smart Casual', 'Semi-Formal'],
      'Festival': ['Ethnic', 'Casual', 'Semi-Formal'],
      'Travel': ['Casual', 'Smart Casual'],
      'Brunch': ['Casual', 'Smart Casual'],
    }
    const acceptableFormality = new Set(formalityMap[occasion] || ['Casual', 'Smart Casual'])

    const alwaysInclude = new Set(['Shoes', 'Sandals', 'Heels', 'Sneakers', 'Bags', 'Jewelry', 'Dupatta', 'Sunglasses', 'Watch', 'Belt', 'Scarf', 'Hat'])

    let filtered = cleanItems.filter((i: any) =>
      pinnedSet.has(i.id) ||
      alwaysInclude.has(i.category) ||
      i.occasions?.includes(occasion) ||
      acceptableFormality.has(i.formality)
    )

    // A saree blouse without a clean saree can never form a valid outfit — drop it before Claude sees it
    if (!filtered.some(isSaree)) {
      filtered = filtered.filter((i: any) => pinnedSet.has(i.id) || !isSareeBlouse(i))
    }

    const pipeItems = filtered.map((i: any) =>
      `${i.id}|${i.name}|${i.category}|${i.primary_color}|${i.pattern}|${i.formality}|${i.fabric || ''}|${styleOf(i)}`
    ).join('\n')

    let userMessage = `Occasion: ${occasion}\nCurrent month: ${new Date().toLocaleString('en-US', { month: 'long' })}\n\nWardrobe (${filtered.length} items — id|name|category|color|pattern|formality|fabric|style[W=western,E=ethnic,V=versatile]):\n${pipeItems}`

    if (pinned_item_ids?.length) {
      userMessage += `\n\nUser wants to include these items: ${pinned_item_ids.join(', ')}`
    }

    if (recentOutfits?.length) {
      const recentCombos = (recentOutfits as any[]).map((o: any) =>
        o.outfit_items.map((i: any) => i.wardrobe_item_id).join(',')
      )
      userMessage += `\n\nRecent combos to avoid (item IDs):\n${recentCombos.join('\n')}`
    }

    const prefs = (profile as any)?.style_preferences || {}
    if (prefs.style_words?.length || prefs.avoids?.length || prefs.shopping_mindset?.repeat_comfort || (profile as any)?.location) {
      userMessage += '\n\nUser preferences:'
      if ((profile as any)?.location) userMessage += `\n- Based in: ${(profile as any).location}`
      if (prefs.style_words?.length) userMessage += `\n- Style identity: ${prefs.style_words.join(', ')} — styling notes should reflect this aesthetic`
      if (prefs.shopping_mindset?.repeat_comfort === 'avoids_repeats') {
        userMessage += '\n- Hates repeating outfits — heavily penalize recent combinations'
      }
      if (prefs.avoids?.length) {
        userMessage += `\n- NEVER build outfits around: ${prefs.avoids.join(', ')}`
      }
      if (prefs.avoids_note) {
        userMessage += ` (also: ${prefs.avoids_note})`
      }
    }

    if (excludeSet.size > 0) {
      const anchorCategories = new Set(['T-Shirt', 'Top', 'Shirt', 'Blouse', 'Crop Top', 'Sweater', 'Hoodie', 'Kurta', 'Pants', 'Jeans', 'Shorts', 'Skirt', 'Leggings', 'Dress', 'Jumpsuit', 'Saree'])
      const previousNames = cleanItems.filter((i: any) => excludeSet.has(i.id)).map((i: any) => `${i.name} (${i.id})`).join(', ')
      const notPrevious = cleanItems.filter((i: any) => !excludeSet.has(i.id) && anchorCategories.has(i.category))
      const occasionMatched = notPrevious.filter((i: any) => i.occasions?.includes(occasion))
      const alternateAnchors = occasionMatched.length > 0 ? occasionMatched : notPrevious

      userMessage += `\n\n## MANDATORY — DIFFERENT OUTFIT REQUIRED`
      userMessage += `\nThe previous outfit used these items: ${previousNames}`
      userMessage += `\nYou MUST NOT use any of those as the anchor piece.`

      if (alternateAnchors.length > 0) {
        const forced = alternateAnchors[Math.floor(Math.random() * alternateAnchors.length)]
        userMessage += `\nBuild this outfit around: "${forced.name}" (id: ${forced.id}) as the ANCHOR piece. This is non-negotiable.`
      }
    }

    const itemMap = new Map(cleanItems.map((i: any) => [i.id, i]))

    // No assistant prefill — the model rejects it; parseJson strips any preamble.
    // If the model reasons out loud and truncates the JSON, ask it once to reformat.
    let text = await callClaude({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 1500,
    })
    let suggestion
    try {
      suggestion = parseJson(text)
    } catch {
      text = await callClaude({
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: userMessage },
          { role: 'assistant', content: text },
          { role: 'user', content: 'Return ONLY the complete JSON object — no reasoning, no preamble. Start with { and end with }.' },
        ],
        maxTokens: 1500,
      })
      suggestion = parseJson(text)
    }

    // Deterministic guard: if Claude broke an ethnic/western hard rule, retry once with the violation named
    let chosen = suggestion.items.map((i: any) => itemMap.get(i.id)).filter(Boolean)
    let violations = findViolations(chosen)
    if (violations.length > 0) {
      text = await callClaude({
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: userMessage },
          { role: 'assistant', content: text },
          { role: 'user', content: `Your outfit breaks hard constraints:\n- ${violations.join('\n- ')}\n\nFix these and return the corrected JSON only.` },
        ],
        maxTokens: 1500,
      })
      suggestion = parseJson(text)
      chosen = suggestion.items.map((i: any) => itemMap.get(i.id)).filter(Boolean)
      violations = findViolations(chosen)
      if (violations.length > 0) {
        // Still invalid — strip saree-family pieces so the outfit degrades safely instead of showing a bad combo
        const hasSaree = chosen.some(isSaree)
        suggestion.items = suggestion.items.filter((i: any) => {
          const item = itemMap.get(i.id)
          if (!item) return false
          if (isSareeBlouse(item) && !hasSaree) return false
          if (hasSaree && styleOf(item) === 'W') return false
          return true
        })
      }
    }

    suggestion.items = suggestion.items.map((i: any) => ({
      ...i,
      name: itemMap.get(i.id)?.name || 'Unknown',
      image_url: itemMap.get(i.id)?.image_url || '',
    }))

    return new Response(JSON.stringify({ success: true, outfit: suggestion }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
