import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { makeCorsHeaders } from '../_shared/cors.ts'
import { getUser } from '../_shared/auth.ts'
import { callClaude, parseJsonResponse } from '../_shared/claude.ts'

const SYSTEM_PROMPT = `You are Sakhi, a wardrobe AI. Given an outfit photo and the user's wardrobe inventory, identify visible clothing, footwear, bags, and jewelry the person is wearing.

DETECT: tops, bottoms, dresses, jumpsuits, outerwear, sarees, kurtas, dupattas, footwear, bags, and jewelry.
IGNORE: belts, sunglasses, watches, scarves, hats, and other small accessories.
Describe only the garments — never the person wearing them, their body, or their appearance.

You receive the wardrobe as a pipe-delimited list: id|name|category|color|pattern|fabric

## MATCHING PROCESS — for each visible item in the photo:

1. Describe to yourself what you see: category (e.g. flats, jeans, kurta), color, pattern, material
2. Scan the wardrobe list for candidates with the SAME category type
3. Among category matches, find the one whose color matches what you see
4. Use pattern and fabric as tiebreakers if multiple items match category+color

## MATCHING PRIORITIES (in order):
- Name match: photo shows black flats → item named "Black Flats" = HIGH confidence
- Category + Color: photo shows black footwear → "Shoes" + "Black" = HIGH confidence
- Category only: right type but color is hard to tell from photo = MEDIUM confidence
- No match: nothing in wardrobe fits → add to new_items

## IMPORTANT:
- Err on the side of MATCHING existing items rather than creating new ones
- If the user owns black flats and the photo shows black flats, match them — don't create a new "Black Flats"
- Only add to new_items if you're confident the item is NOT in the wardrobe

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

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
          {
            type: 'image',
            source: { type: 'base64', media_type: image_content_type, data: image_base64 },
          },
          { type: 'text', text: `Match visible items against my wardrobe (${items?.length || 0} items — id|name|category|color|pattern|fabric):\n${pipeItems}` },
        ],
      }],
      maxTokens: 1024,
    })

    const result = parseJsonResponse(text)

    const itemMap = new Map((items || []).map((i: any) => [i.id, i]))
    if (result.matched_items?.length) {
      result.matched_items = result.matched_items.map((m: { wardrobe_item_id: string; confidence: string }) => ({
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
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
