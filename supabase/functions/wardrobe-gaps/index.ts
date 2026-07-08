import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getUser } from '../_shared/auth.ts'
import { callClaude, parseJsonResponse } from '../_shared/claude.ts'

const SYSTEM_PROMPT = `You are Sakhi, a wardrobe intelligence AI for an Indian woman's closet. Analyze her wardrobe and identify gaps based on her ACTUAL lifestyle — not aspirational or generic advice. In every card body, talk directly to her — always say "you/your", never "the user/she/her".

You receive her inventory as a pipe-delimited list (name|category|color|pattern|formality|occasions|fabric|worn|price).

CRITICAL RULES:
- Prioritize occasions she FREQUENTLY dresses for. If she rarely goes to work, do NOT suggest work items.
- Respect her style identity and avoids list. Never suggest items she'd avoid.
- Reference specific items and counts from her inventory.
- Factor in her location/climate when relevant.
- If she prefers "fewer, better pieces," suggest quality upgrades. If she loves variety, suggest range expansion.

Consider:
- Category balance relative to her lifestyle frequency
- Color distribution gaps that limit outfit combinations
- Occasion coverage weighted by how often she actually dresses for each
- Ethnic vs western coverage — check both wardrobes are complete for her life (e.g. sarees without matching blouses, kurtas without bottoms, wedding/festival occasions with nothing to wear)
- Wear frequency (which categories get the most use? which are neglected?)
- Pairing potential (what single addition would unlock the most new outfit combinations?)

Return a JSON array of 3-5 gap cards:
[{
  "icon": "emoji",
  "title": "short title",
  "body": "2-3 sentence explanation with specific numbers from her wardrobe, addressing her as you",
  "tags": ["relevant", "occasions"],
  "pairing": "optional - e.g. Would pair with 8 existing items"
}]

Be specific — reference actual items and counts from her inventory. Return ONLY valid JSON, no markdown.`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')!
    const { user, supabase } = await getUser(authHeader)

    const { data: items } = await supabase
      .from('wardrobe_items')
      .select('id, name, category, primary_color, pattern, formality, occasions, seasons, style_tags, fabric, times_worn, last_worn_at, price')
      .eq('user_id', user.id)
      .eq('status', 'active')

    const { data: profile } = await supabase
      .from('profiles')
      .select('occasions, style_preferences, location')
      .eq('id', user.id)
      .single()

    const { data: recentOutfits } = await supabase
      .from('outfits')
      .select('occasion, date')
      .eq('user_id', user.id)
      .gte('date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])

    // Compute stats
    const catCounts: Record<string, number> = {}
    const colorCounts: Record<string, number> = {}
    const formalityCounts: Record<string, number> = {}
    let totalWorn = 0

    for (const item of items || []) {
      catCounts[item.category] = (catCounts[item.category] || 0) + 1
      colorCounts[item.primary_color] = (colorCounts[item.primary_color] || 0) + 1
      formalityCounts[item.formality] = (formalityCounts[item.formality] || 0) + 1
      totalWorn += item.times_worn
    }

    // Compute outfit occasion frequency
    const occasionFreqActual: Record<string, number> = {}
    for (const outfit of recentOutfits || []) {
      occasionFreqActual[outfit.occasion] = (occasionFreqActual[outfit.occasion] || 0) + 1
    }

    let userMessage = `Wardrobe stats:
- Total items: ${items?.length || 0}
- Category distribution: ${Object.entries(catCounts).map(([k, v]) => `${k}: ${v}`).join(', ')}
- Color distribution: ${Object.entries(colorCounts).map(([k, v]) => `${k}: ${v}`).join(', ')}
- Formality distribution: ${Object.entries(formalityCounts).map(([k, v]) => `${k}: ${v}`).join(', ')}
- Average wear count: ${items?.length ? (totalWorn / items.length).toFixed(1) : 0}`

    // Profile context
    const prefs = profile?.style_preferences || {}

    if (profile?.location) {
      userMessage += `\n\nUser is based in: ${profile.location}`
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
      const traits = []
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

    if (profile?.occasions?.length) {
      userMessage += `\nOccasions in their life: ${profile.occasions.join(', ')}`
    }

    const pipeItems = (items || []).map(i =>
      `${i.name}|${i.category}|${i.primary_color}|${i.pattern || ''}|${i.formality}|${(i.occasions || []).join('/')}|${i.fabric || ''}|worn ${i.times_worn}x|${i.price ?? ''}`
    ).join('\n')
    userMessage += `\n\nFull inventory (name|category|color|pattern|formality|occasions|fabric|worn|price):\n${pipeItems}`

    const text = await callClaude({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 2048,
    })

    const gaps = parseJsonResponse(text)

    return new Response(JSON.stringify({ success: true, gaps }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
