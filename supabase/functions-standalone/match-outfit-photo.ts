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
    body: JSON.stringify({ model: options.model || 'claude-sonnet-4-6', max_tokens: options.maxTokens || 4096, system: options.system, messages: options.messages }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(`Claude API error: ${response.status} ${JSON.stringify(data)}`)
  const textBlock = data.content?.find((b: any) => b.type === 'text')
  if (!textBlock?.text) throw new Error('No text in Claude response')
  return textBlock.text
}

function parseJson(text: string) {
  if (!text) throw new Error('Empty response from Claude')
  return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
}

const SYSTEM_PROMPT = `You are Sakhi, a wardrobe AI. Given an outfit photo and the user's wardrobe inventory, identify visible clothing, footwear, bags, and jewelry the person is wearing.

DETECT: tops, bottoms, dresses, jumpsuits, outerwear, sarees, kurtas, dupattas, footwear, bags, and jewelry.
IGNORE: belts, sunglasses, watches, scarves, hats, and other small accessories.
Describe only the garments — never the person wearing them, their body, or their appearance.

You receive the wardrobe as a pipe-delimited list: id|name|category|color|pattern|fabric

## MATCHING PROCESS — for each visible item in the photo:

1. Describe to yourself what you see: category (e.g. flats, jeans, kurta, saree), color, pattern, material
2. Decide its GARMENT FAMILY (see below)
3. Scan the wardrobe ONLY within that same family for a color match
4. Use pattern and fabric as tiebreakers if several items match family + color

## GARMENT FAMILY IS A HARD BOUNDARY — never match across families
A photo item may only match a wardrobe item in the SAME family. Color or fabric agreement NEVER overrides a family mismatch.
- SAREE is a single 5-6 metre draped garment. A saree matches ONLY a "Saree". NEVER match a saree to a top, blouse, skirt, kurta, or dress — and NEVER match a top, blouse, skirt, or any two-piece garment to a saree.
- ONE-PIECE (Dress, Jumpsuit) never matches a separate top or bottom, and never a saree.
- TOPS (T-Shirt, Top, Shirt, Blouse, Saree Blouse, Crop Top, Kurta, Sweater, Hoodie) match only other tops.
- BOTTOMS (Pants, Jeans, Shorts, Skirt, Leggings) match only other bottoms.
- OUTERWEAR (Jacket, Blazer) match only outerwear.
- FOOTWEAR subtypes (Heels, Flats, Sandals, Sneakers, Boots) are DIFFERENT families and never cross-match. Photo shows black heels, wardrobe has only "Black Flats" → NOT a match.
- Dupatta, Bags, and Jewelry each match only their own kind.
If the right family is not in the wardrobe, add the item to new_items.

## CONFIDENCE (only after family agrees):
- Name match: photo shows black flats → item named "Black Flats" = HIGH
- Family + color agree = HIGH
- Family agrees, color hard to tell from photo = MEDIUM
- Nothing in the right family fits → new_items

## PREFER A MISSED PIECE OVER A WRONG MATCH
- Match only when the family AND the color both line up. A wrong match (e.g. a plain top matched to an unrelated saree) is worse than a missing one — the user can add anything Sakhi missed by hand.
- Never return more matched items than the number of garments you actually see in the photo.
- Within the correct family, still prefer matching an existing item over creating a duplicate (owns "Black Flats", photo shows black flats → match it, don't add a new one).
- When unsure whether a piece is in the wardrobe, add it to new_items rather than forcing a match.

## SAREE BLOUSE vs BLOUSE — critical for new_items
- "Saree Blouse" = short/cropped fitted blouse worn with a saree (ends at or above the waist, often back hooks, silk/brocade/zari work). Style "ethnic". NEVER label it "Blouse" or "Top".
- "Blouse" = hip-length western dressy top. Style "western" or "versatile".
- Ethnic garments (saree, saree blouse, kurta, dupatta) → style "ethnic". Neutral pieces that work with both ethnic and western outfits (plain sandals, jewelry, plain bags) → style "versatile".

Return JSON:
{
  "matched_items": [{"wardrobe_item_id": "uuid", "confidence": "high"|"medium"}],
  "new_items": [{"name": "descriptive name", "category": "one of: T-Shirt, Top, Shirt, Blouse, Saree Blouse, Crop Top, Saree, Dress, Jumpsuit, Pants, Jeans, Shorts, Skirt, Leggings, Jacket, Blazer, Sweater, Hoodie, Kurta, Dupatta, Jewelry, Shoes, Sandals, Heels, Sneakers, Bags", "style": "western"|"ethnic"|"versatile", "description": "brief description"}]
}
No markdown, no explanation.`

serve(async (req) => {
  const corsHeaders = makeCorsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')!
    const { user, supabase } = await getUser(authHeader)

    const { image_base64, image_content_type } = await req.json()
    if (typeof image_base64 !== 'string' || !image_base64 || image_base64.length > 7_000_000) {
      return new Response(JSON.stringify({ success: false, error: 'That photo is too large. Try a smaller one.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: items } = await supabase
      .from('wardrobe_items')
      .select('id, name, category, subcategory, primary_color, pattern, fabric, image_url')
      .eq('user_id', user.id)
      .eq('status', 'active')

    const pipeItems = (items || []).map((i: any) =>
      `${i.id}|${i.name}|${i.subcategory || i.category}|${i.primary_color}|${i.pattern}|${i.fabric || ''}`
    ).join('\n')

    const text = await callClaude({
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: image_content_type, data: image_base64 } },
          { type: 'text', text: `Match visible items against my wardrobe (${items?.length || 0} items — id|name|category|color|pattern|fabric):\n${pipeItems}` },
        ],
      }],
      maxTokens: 1024,
    })

    const result = parseJson(text)

    const itemMap = new Map((items || []).map((i: any) => [i.id, i]))
    if (result.matched_items?.length) {
      result.matched_items = result.matched_items.map((m: any) => ({
        id: m.wardrobe_item_id,
        name: itemMap.get(m.wardrobe_item_id)?.name || 'Unknown',
        image_url: itemMap.get(m.wardrobe_item_id)?.image_url || '',
        confidence: m.confidence,
      }))
    }

    return new Response(JSON.stringify({ success: true, matches: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
