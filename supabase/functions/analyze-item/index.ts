import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { makeCorsHeaders } from '../_shared/cors.ts'
import { getUser } from '../_shared/auth.ts'
import { callClaude, parseJsonResponse } from '../_shared/claude.ts'

const SYSTEM_PROMPT = `Analyze the clothing item in this image.

If the image does NOT clearly show a clothing item, footwear, bag, or fashion accessory, return exactly {"error": "not_clothing"} — never invent a garment.
If the image shows a person WEARING a full outfit (two or more distinct garments on the body, e.g. a top and a bottom), analyze the single most prominent garment AND set "multi_garment": true. For a single garment — worn alone, on a hanger, or laid flat — set "multi_garment": false.
Describe only the garments — never the person wearing them, their body, or their appearance.

Return ONLY a JSON object:
{
  "name": "concise name, e.g. Red Halter Dress",
  "category": "one of: T-Shirt, Top, Shirt, Blouse, Saree Blouse, Crop Top, Saree, Dress, Jumpsuit, Pants, Jeans, Shorts, Skirt, Leggings, Jacket, Blazer, Sweater, Hoodie, Kurta, Dupatta, Jewelry, Shoes, Sandals, Heels, Sneakers, Bags, Sunglasses, Watch, Belt, Scarf, Hat",
  "subcategory": "specific type, e.g. Banarasi Saree, Tote Bag",
  "primary_color": "dominant color name",
  "color_hex": "#hex",
  "secondary_color": "or null",
  "pattern": "Solid|Printed|Striped|Checked|Floral|Embroidered|Woven|Abstract|Lace",
  "formality": "Casual|Smart Casual|Semi-Formal|Formal|Ethnic",
  "occasions": ["from: Office, Casual, Party, Wedding, Date Night, Festival, Travel, Brunch"],
  "seasons": ["from: Summer, Winter, Spring, Fall, All"],
  "style_tags": ["FIRST tag MUST be exactly one of: western, ethnic, versatile — then others e.g. minimalist, boho, classic"],
  "fabric": "detected fabric type",
  "brand": "if visible, else null",
  "description": "one sentence style description",
  "multi_garment": true only if the photo shows a person wearing a full outfit of 2+ distinct garments, else false
}

CRITICAL — Saree Blouse vs Blouse:
- "Saree Blouse" = short/cropped fitted blouse worn under a saree — ends at or above the waist, often back hooks, sleeveless or short-sleeved, silk/brocade/zari work. Tag it ethnic.
- "Blouse" = western dressy top, hip-length. Tag it western or versatile.
- Never label a saree blouse as "Blouse" or "Top", and never label a western top as "Saree Blouse".

Ethnic garments (saree, saree blouse, kurta, kurti, lehenga, anarkali, salwar, dupatta) MUST have "ethnic" as first style tag. Neutral pieces that work with both ethnic and western outfits (plain sandals, jewelry, solid leggings, plain bags) get "versatile".
No markdown, no explanation.`

serve(async (req) => {
  const corsHeaders = makeCorsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')!
    await getUser(authHeader)

    const { image_base64, image_content_type } = await req.json()
    if (typeof image_base64 !== 'string' || !image_base64 || image_base64.length > 7_000_000) {
      return new Response(JSON.stringify({ success: false, error: 'That photo is too large. Try a smaller one.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const text = await callClaude({
      system: SYSTEM_PROMPT,
      model: 'claude-haiku-4-5',
      maxTokens: 512,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: image_content_type,
              data: image_base64,
            },
          },
          { type: 'text', text: 'Analyze this clothing item.' },
        ],
      }],
    })

    const analysis = parseJsonResponse(text)

    if (analysis.error) {
      return new Response(JSON.stringify({ success: false, error: "That doesn't look like a clothing item — try a clearer photo of one piece." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
