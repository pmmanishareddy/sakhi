import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getUser } from '../_shared/auth.ts'
import { callClaude, parseJsonResponse } from '../_shared/claude.ts'

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

## OCCASION → ACCEPTABLE FORMALITY

Office → Smart Casual, Semi-Formal, Formal
Casual → Casual, Smart Casual
Party → Smart Casual, Semi-Formal, Formal
Wedding → Formal, Ethnic
Date Night → Smart Casual, Semi-Formal
Festival → Ethnic, Casual, Semi-Formal

Travel → Casual, Smart Casual
Brunch → Casual, Smart Casual

Prefer items whose "formality" matches. If nothing matches perfectly, use the closest available and note it.

## COLOR RULES

Neutrals (pair with anything): Black, White, Cream, Beige, Navy, Grey, Brown, Tan, Olive, Khaki
Metallics (neutral for accessories only): Gold, Silver, Rose Gold

1. Max 3 non-neutral colors per outfit
2. Bold anchor piece → keep everything else neutral
3. Patterned anchor → other pieces use colors FROM the pattern, or neutrals
4. Monochrome (same color family, different shades) always works
5. Avoid: red+orange, red+pink (unless tonal), multiple competing prints

## HARD CONSTRAINTS — any violation = bad outfit

1. NEVER suggest underwear, sports bras, bralettes, or innerwear as tops — scan item names for these keywords
2. NEVER use a Saree Blouse as a standalone top — a saree blouse can ONLY appear in an ETHNIC SAREE outfit paired with a saree, never with pants, jeans, or skirts
3. NEVER combine two one-pieces (no Dress + Saree, no Jumpsuit + Dress)
4. NEVER add a separate top or bottom with a Dress, Jumpsuit, or Saree
5. NEVER mix Saree with western pieces (no Saree + Jeans, no Saree + T-Shirt)
6. NEVER pair Sneakers with Saree or formal ethnic wear
7. NEVER suggest two items in the same required role (no two tops, no two bottoms)
8. NEVER use items with laundry_status = "in_laundry"
9. NEVER invent items — every id must come from the provided inventory
10. AVOID repeating item combinations from the recent outfits list

## PINNED ITEMS

When items are pinned:
- Identify each pinned item's role and style direction
- If pinned items conflict (e.g. Saree + western Dress), use the FIRST pinned item, skip conflicting ones
- Build the entire outfit direction around the pinned item(s)

## WEATHER

You are told the current month and her location. Dress for it: in hot months prefer breathable fabrics (cotton, linen, chiffon) and skip heavy layering. Only suggest jackets, blazers, or sweaters in cooler months or when the occasion demands it (e.g. formal office).

## STYLING NOTES — be specific, never generic

Speak directly to her in styling_note and why — always "you/your", never "the user".

GOOD: "Roll the sleeves on the linen shirt and half-tuck into the trousers for a relaxed office look"
GOOD: "Drape the dupatta over one shoulder — the gold embroidery pops against the teal kurta"
GOOD: "The saree border matches the blouse — keep jewelry minimal, just gold studs"
BAD: "A striking combination!" / "You'll look amazing!" / "Perfect for the occasion!"

Tell her HOW to wear or style the pieces. Reference specific colors, fabrics, or techniques.

## EDGE CASES

- Fewer than 3 clean items: build the best possible outfit, note the limitation in "why"
- No footwear available: suggest the outfit without shoes, mention it in styling_note
- All items in laundry: return {"items": [], "styling_note": "All your clothes are in the wash! Time for laundry day.", "why": "No clean items available"}
- No occasion-matching items: use closest available, note the compromise in "why"

## OUTPUT — return ONLY this JSON, no markdown, no code fences
Do NOT write any reasoning, preamble, or commentary. Your response must start with { and end with }.

{
  "items": [{ "id": "<item UUID from inventory>", "role": "top|bottom|one-piece|outerwear|shoes|bag|accessory" }],
  "styling_note": "<1-2 sentences: specific, actionable styling advice for THIS outfit>",
  "why": "<1 sentence: why these pieces work — mention colors, style direction, or occasion fit>"
}`

interface WardrobeItem {
  id: string
  name: string
  category: string
  primary_color: string
  pattern: string
  formality: string
  occasions: string[] | null
  style_tags: string[] | null
  fabric: string | null
  laundry_status: string
  image_url: string
}

const ETHNIC_CATEGORIES = new Set(['Saree', 'Saree Blouse', 'Kurta', 'Dupatta'])
const WESTERN_CATEGORIES = new Set(['T-Shirt', 'Shirt', 'Crop Top', 'Dress', 'Jumpsuit', 'Jeans', 'Shorts', 'Hoodie', 'Blazer', 'Sweater', 'Sneakers'])
const ETHNIC_KEYWORDS = /saree|sari\b|kurta|kurti|lehenga|anarkali|salwar|churidar|dupatta|choli|sharara|zari|warli|bandhani|banarasi|kanjeevaram|jhumka|kolhapuri|mojari|juttis?\b/

function itemText(i: WardrobeItem): string {
  return `${i.name} ${i.category} ${(i.style_tags || []).join(' ')}`.toLowerCase()
}

// W = western-only, E = ethnic-only, V = versatile (works with either)
function styleOf(i: WardrobeItem): 'W' | 'E' | 'V' {
  const text = itemText(i)
  if (ETHNIC_CATEGORIES.has(i.category) || ETHNIC_KEYWORDS.test(text) || i.style_tags?.includes('ethnic')) return 'E'
  if (WESTERN_CATEGORIES.has(i.category)) return 'W'
  return 'V'
}

function isSareeBlouse(i: WardrobeItem): boolean {
  const text = itemText(i)
  return i.category === 'Saree Blouse' || /saree blouse|choli/.test(text) ||
    (i.category === 'Blouse' && styleOf(i) === 'E')
}

function isSaree(i: WardrobeItem): boolean {
  return !isSareeBlouse(i) && (i.category === 'Saree' || /saree|\bsari\b/.test(itemText(i)))
}

const ONE_PIECE_CATEGORIES = new Set(['Dress', 'Jumpsuit', 'Saree'])

// Deterministic check of the ethnic/western hard rules Claude sometimes breaks
function findViolations(chosen: WardrobeItem[]): string[] {
  const violations: string[] = []
  const sareeBlouses = chosen.filter(isSareeBlouse)
  const sarees = chosen.filter(isSaree)

  if (sareeBlouses.length > 0 && sarees.length === 0) {
    violations.push(`"${sareeBlouses[0].name}" is a saree blouse but there is no saree in the outfit. Saree blouses are never standalone tops.`)
  }
  if (sarees.length > 0) {
    const western = chosen.filter(i => styleOf(i) === 'W')
    if (western.length > 0) {
      violations.push(`A saree cannot be mixed with western pieces: ${western.map(i => `"${i.name}"`).join(', ')}.`)
    }
  }
  const onePieces = chosen.filter(i => ONE_PIECE_CATEGORIES.has(i.category) || isSaree(i))
  if (onePieces.length > 1) {
    violations.push(`Outfit contains two one-pieces: ${onePieces.map(i => `"${i.name}"`).join(', ')}. Only one allowed.`)
  }
  return violations
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

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

    const cleanItems = (items || []).filter(i => i.laundry_status === 'clean')
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

    // Roles that are always needed for complete outfits
    const alwaysInclude = new Set(['Shoes', 'Sandals', 'Heels', 'Sneakers', 'Bags', 'Jewelry', 'Dupatta', 'Sunglasses', 'Watch', 'Belt', 'Scarf', 'Hat'])

    let filtered = cleanItems.filter(i =>
      pinnedSet.has(i.id) ||
      alwaysInclude.has(i.category) ||
      i.occasions?.includes(occasion) ||
      acceptableFormality.has(i.formality)
    )

    // A saree blouse without a clean saree can never form a valid outfit — drop it before Claude sees it
    if (!filtered.some(isSaree)) {
      filtered = filtered.filter(i => pinnedSet.has(i.id) || !isSareeBlouse(i))
    }

    const pipeItems = filtered.map(i =>
      `${i.id}|${i.name}|${i.category}|${i.primary_color}|${i.pattern}|${i.formality}|${i.fabric || ''}|${styleOf(i)}`
    ).join('\n')

    let userMessage = `Occasion: ${occasion}\nCurrent month: ${new Date().toLocaleString('en-US', { month: 'long' })}\n\nWardrobe (${filtered.length} items — id|name|category|color|pattern|formality|fabric|style[W=western,E=ethnic,V=versatile]):\n${pipeItems}`

    if (pinned_item_ids?.length) {
      userMessage += `\n\nUser wants to include these items: ${pinned_item_ids.join(', ')}`
    }

    if (recentOutfits?.length) {
      const recentCombos = recentOutfits.map(o =>
        o.outfit_items.map((i: any) => i.wardrobe_item_id).join(',')
      )
      userMessage += `\n\nRecent combos to avoid (item IDs):\n${recentCombos.join('\n')}`
    }

    const prefs = profile?.style_preferences || {}
    if (prefs.style_words?.length || prefs.avoids?.length || prefs.shopping_mindset?.repeat_comfort || profile?.location) {
      userMessage += '\n\nUser preferences:'
      if (profile?.location) userMessage += `\n- Based in: ${profile.location}`
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
      const previousNames = cleanItems.filter(i => excludeSet.has(i.id)).map(i => `${i.name} (${i.id})`).join(', ')
      const notPrevious = cleanItems.filter(i => !excludeSet.has(i.id) && anchorCategories.has(i.category))
      const occasionMatched = notPrevious.filter(i => i.occasions?.includes(occasion))
      const alternateAnchors = occasionMatched.length > 0 ? occasionMatched : notPrevious

      userMessage += `\n\n## MANDATORY — DIFFERENT OUTFIT REQUIRED`
      userMessage += `\nThe previous outfit used these items: ${previousNames}`
      userMessage += `\nYou MUST NOT use any of those as the anchor piece.`

      if (alternateAnchors.length > 0) {
        const forced = alternateAnchors[Math.floor(Math.random() * alternateAnchors.length)]
        userMessage += `\nBuild this outfit around: "${forced.name}" (id: ${forced.id}) as the ANCHOR piece. This is non-negotiable.`
      }
    }

    const itemMap = new Map(cleanItems.map(i => [i.id, i]))

    // No assistant prefill — the model rejects it; parseJsonResponse strips any preamble.
    // If the model reasons out loud and truncates the JSON, ask it once to reformat.
    let text = await callClaude({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 1500,
    })
    let suggestion
    try {
      suggestion = parseJsonResponse(text)
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
      suggestion = parseJsonResponse(text)
    }

    // Deterministic guard: if Claude broke an ethnic/western hard rule or invented
    // an item id, retry once with the violation named
    const idViolations = (items: { id: string }[]) => {
      const fake = items.filter(i => !itemMap.has(i.id)).map(i => i.id)
      return fake.length > 0 ? [`These ids do not exist in the wardrobe inventory: ${fake.join(', ')} — use ONLY exact ids from the inventory list`] : []
    }
    let chosen = suggestion.items.map((i: { id: string }) => itemMap.get(i.id)).filter(Boolean) as WardrobeItem[]
    let violations = [...findViolations(chosen), ...idViolations(suggestion.items)]
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
      suggestion = parseJsonResponse(text)
      chosen = suggestion.items.map((i: { id: string }) => itemMap.get(i.id)).filter(Boolean) as WardrobeItem[]
      violations = [...findViolations(chosen), ...idViolations(suggestion.items)]
      if (violations.length > 0) {
        // Still invalid — strip saree-family pieces so the outfit degrades safely instead of showing a bad combo
        const hasSaree = chosen.some(isSaree)
        suggestion.items = suggestion.items.filter((i: { id: string }) => {
          const item = itemMap.get(i.id)
          if (!item) return false
          if (isSareeBlouse(item) && !hasSaree) return false
          if (hasSaree && styleOf(item) === 'W') return false
          return true
        })
      }
    }

    // Drop any id that still isn't real — never show an "Unknown" piece
    suggestion.items = suggestion.items
      .filter((i: { id: string }) => itemMap.has(i.id))
      .map((i: { id: string; role: string }) => ({
        ...i,
        name: itemMap.get(i.id)!.name,
        image_url: itemMap.get(i.id)!.image_url || '',
      }))

    return new Response(JSON.stringify({ success: true, outfit: suggestion }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
