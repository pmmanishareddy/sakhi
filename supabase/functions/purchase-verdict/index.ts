import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getUser } from '../_shared/auth.ts'
import { callClaude, parseJsonResponse } from '../_shared/claude.ts'

const SYSTEM_PROMPT = `You are Sakhi, a friendly wardrobe advisor for an Indian woman's closet. Talk directly to her — always say "you/your", never "the user/she/her".

You receive her full wardrobe as a pipe-delimited list (name|category|color|pattern|formality|occasions|price|style) plus her profile. The style column is authoritative: W = western, E = ethnic, V = versatile. Ground EVERY claim in this list — never invent items, counts, or numbers.

## ETHNIC vs WESTERN — never cross the boundary
Ethnic pieces (sarees, saree blouses, kurtas, dupattas) and western pieces are NEVER overlap or substitutes for each other. A saree blouse is not a top and not a dress alternative. Overlap requires the SAME garment role AND the same style direction (or V). The same applies to pairings: a western dress does not pair with saree blouses or dupattas.

If an image is attached, use it to identify the item being considered.

## VERDICT CRITERIA — have an opinion; "maybe" is a last resort, not a safe default
- skip: 2+ existing pieces already fill the same role (same garment role AND style direction, similar color/formality), or it's on her avoids list, or it serves an occasion she rarely dresses for
- buy: fills a real gap for an occasion she frequently dresses for, or pairs with many existing pieces to unlock new outfits
- maybe: genuinely borderline, or the wardrobe is too small to judge

## GROUNDED NUMBERS
- overlap: name the actual similar items you counted (e.g. "You already own 3 black tops: Silk Cami, Ribbed Tank, Zara Crop"), or null if none
- pairings_count: count the specific wardrobe items this would genuinely pair with — count them, don't guess
- estimated_cpw: price ÷ realistic wears over 2 years, given how often she dresses for this item's occasions. Same currency as the given price (assume INR if unlabeled). 0 if no price given.

Be concise. 1-2 sentences for the reason. Max 2 evidence points, each under 15 words.

Return JSON:
{
  "verdict": "buy" | "skip" | "maybe",
  "title": "e.g. Skip This One or Great Addition",
  "reason": "1-2 sentence summary addressing her as you",
  "overlap": "e.g. You already own 3 similar black tops: <names>" or null,
  "pairings_count": number,
  "estimated_cpw": number,
  "evidence": [{ "label": "short label", "text": "under 15 words" }]
}

Return ONLY valid JSON, no markdown.`

const ETHNIC_CATEGORIES = new Set(['Saree', 'Saree Blouse', 'Kurta', 'Dupatta'])
const WESTERN_CATEGORIES = new Set(['T-Shirt', 'Shirt', 'Crop Top', 'Dress', 'Jumpsuit', 'Jeans', 'Shorts', 'Hoodie', 'Blazer', 'Sweater', 'Sneakers'])
const ETHNIC_KEYWORDS = /saree|sari\b|kurta|kurti|lehenga|anarkali|salwar|churidar|dupatta|choli|sharara|zari|warli|bandhani|banarasi|kanjeevaram|jhumka|kolhapuri|mojari|juttis?\b/

// W = western-only, E = ethnic-only, V = versatile (works with either)
function styleOf(i: { name: string; category: string; style_tags?: string[] | null }): 'W' | 'E' | 'V' {
  const text = `${i.name} ${i.category} ${(i.style_tags || []).join(' ')}`.toLowerCase()
  if (ETHNIC_CATEGORIES.has(i.category) || ETHNIC_KEYWORDS.test(text) || i.style_tags?.includes('ethnic')) return 'E'
  if (WESTERN_CATEGORIES.has(i.category)) return 'W'
  return 'V'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')!
    const { user, supabase } = await getUser(authHeader)

    const body = await req.json()
    const { image_base64, image_content_type, source_url, item_name, item_price } = body

    const [{ data: items }, { data: profile }] = await Promise.all([
      supabase
        .from('wardrobe_items')
        .select('name, category, primary_color, pattern, formality, occasions, style_tags, price')
        .eq('user_id', user.id)
        .eq('status', 'active'),
      supabase
        .from('profiles')
        .select('occasions, style_preferences, location')
        .eq('id', user.id)
        .single(),
    ])

    let userMessage = `Item being considered: ${item_name || 'See attached image'}`
    if (item_price) userMessage += `\nPrice: ${item_price}`
    if (source_url) userMessage += `\nSource: ${source_url}`

    const prefs = profile?.style_preferences || {}

    userMessage += '\n\nYour profile:'
    if (profile?.location) userMessage += `\n- Based in: ${profile.location}`
    if (prefs.style_words?.length) userMessage += `\n- Style identity: ${prefs.style_words.join(', ')}`

    if (prefs.occasion_frequency) {
      userMessage += `\n- Occasion frequency: ${JSON.stringify(prefs.occasion_frequency)}`
    }

    if (prefs.shopping_mindset) {
      const m = prefs.shopping_mindset
      const traits = []
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

    if (profile?.occasions?.length) {
      userMessage += `\n- Occasions: ${profile.occasions.join(', ')}`
    }

    const pipeItems = (items || []).map(i =>
      `${i.name}|${i.category}|${i.primary_color}|${i.pattern || ''}|${i.formality}|${(i.occasions || []).join('/')}|${i.price ?? ''}|${styleOf(i)}`
    ).join('\n')
    userMessage += `\n\nWardrobe (${items?.length || 0} items — name|category|color|pattern|formality|occasions|price|style[W=western,E=ethnic,V=versatile]):\n${pipeItems}`

    const messageContent: Array<{ type: string; [key: string]: unknown }> = []
    if (image_base64) {
      messageContent.push({
        type: 'image',
        source: { type: 'base64', media_type: image_content_type, data: image_base64 },
      })
    }
    messageContent.push({ type: 'text', text: userMessage })

    const text = await callClaude({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: messageContent }],
      maxTokens: 1024,
    })

    const verdict = parseJsonResponse(text)

    return new Response(JSON.stringify({ success: true, verdict }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
