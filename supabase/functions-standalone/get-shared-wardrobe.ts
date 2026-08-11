import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// STANDALONE COPY — this is what runs in production (pasted into the Supabase
// dashboard). Keep it in lockstep with functions/get-shared-wardrobe/index.ts.

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

function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

// The only public endpoint in the app: no JWT, the token IS the credential.
// It runs on the service-role key because an anonymous viewer can neither pass
// RLS nor sign an image URL. Everything a viewer must not see is filtered here.

// Mirror of groupOf() in src/lib/categories.ts. Kept in sync by hand so a
// shared page sections items exactly the way the owner's wardrobe does.
const GROUPS: { label: string; cats: string[] }[] = [
  { label: 'Sarees', cats: ['Saree'] },
  { label: 'Blouses', cats: ['Saree Blouse'] },
  { label: 'Tops', cats: ['Top', 'T-Shirt', 'Shirt', 'Blouse', 'Crop Top'] },
  { label: 'Dresses', cats: ['Dress', 'Jumpsuit'] },
  { label: 'Bottoms', cats: ['Pants', 'Jeans', 'Shorts', 'Skirt', 'Leggings'] },
  { label: 'Ethnic', cats: ['Kurta', 'Dupatta'] },
  { label: 'Outerwear', cats: ['Jacket', 'Blazer', 'Sweater', 'Hoodie'] },
  { label: 'Footwear', cats: ['Shoes', 'Sandals', 'Heels', 'Sneakers'] },
  { label: 'Bags', cats: ['Bags'] },
  { label: 'Accessories', cats: ['Jewelry', 'Sunglasses', 'Watch', 'Belt', 'Scarf', 'Hat'] },
]

const norm = (s: string) => (s || '').trim().toLowerCase()
const CAT_TO_GROUP = new Map<string, string>()
for (const g of GROUPS) for (const c of g.cats) CAT_TO_GROUP.set(norm(c), g.label)

function groupOf(category: string): string {
  const n = norm(category)
  const direct = CAT_TO_GROUP.get(n)
  if (direct) return direct
  if (n.includes('saree blouse') || (n.includes('blouse') && n.includes('saree'))) return 'Blouses'
  if (n.includes('saree')) return 'Sarees'
  if (n.includes('dress') || n.includes('gown') || n.includes('jumpsuit')) return 'Dresses'
  if (n.includes('kurt') || n.includes('dupatta') || n.includes('lehenga') || n.includes('anarkali') || n.includes('salwar')) return 'Ethnic'
  if (n.includes('blouse') || n.includes('shirt') || n.includes('top')) return 'Tops'
  if (n.includes('jean') || n.includes('pant') || n.includes('trouser') || n.includes('skirt') || n.includes('short') || n.includes('legging')) return 'Bottoms'
  if (n.includes('jacket') || n.includes('blazer') || n.includes('sweater') || n.includes('hoodie') || n.includes('coat')) return 'Outerwear'
  if (n.includes('shoe') || n.includes('sandal') || n.includes('heel') || n.includes('sneaker') || n.includes('boot') || n.includes('flat')) return 'Footwear'
  if (n.includes('bag') || n.includes('clutch') || n.includes('purse')) return 'Bags'
  return 'Accessories'
}

// Short-lived on purpose. The link itself can live for days, but the image URLs
// it hands out should not outlive the page view — so revoking a share stops
// working images within the hour rather than whenever a 7-day URL lapses.
const VIEW_SIGN_TTL_SECONDS = 3600

function storagePath(url: string | null | undefined): string | null {
  const m = url?.match(/\/storage\/v1\/object\/(?:public|sign)\/wardrobe-images\/([^?]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

serve(async (req) => {
  const corsHeaders = makeCorsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const fail = (error: string, status = 400) =>
    new Response(JSON.stringify({ success: false, error }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const { token } = await req.json()
    if (typeof token !== 'string' || !/^[A-Za-z0-9]{8,64}$/.test(token)) {
      return fail('not_found', 404)
    }

    const service = getServiceClient()

    const { data: share } = await service
      .from('wardrobe_shares')
      .select('user_id, groups, title, expires_at, revoked_at')
      .eq('token', token)
      .maybeSingle()

    if (!share) return fail('not_found', 404)
    if (share.revoked_at || new Date(share.expires_at) < new Date()) return fail('expired', 410)

    const [{ data: profile }, { data: allItems }] = await Promise.all([
      service.from('profiles').select('display_name').eq('id', share.user_id).single(),
      service
        .from('wardrobe_items')
        // Allowlist, never a blocklist: price, wear counts, laundry status,
        // size and ai_description must never reach a viewer.
        .select('id, name, category, primary_color, color_hex, pattern, fabric, brand, image_url')
        .eq('user_id', share.user_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
    ])

    const scope: string[] = share.groups || []
    const items = (allItems || []).filter(i => scope.length === 0 || scope.includes(groupOf(i.category)))

    // Sign only the paths of items in scope. Outfit selfies live in the same
    // bucket, so this filter is a privacy boundary and not a formality.
    const paths = [...new Set(items.map(i => storagePath(i.image_url)).filter(Boolean))] as string[]
    const signed = new Map<string, string>()
    if (paths.length) {
      const { data } = await service.storage
        .from('wardrobe-images')
        .createSignedUrls(paths, VIEW_SIGN_TTL_SECONDS)
      for (const d of data || []) {
        if (d.signedUrl && d.path) signed.set(d.path, d.signedUrl)
      }
    }

    const viewItems = items.map(i => {
      const path = storagePath(i.image_url)
      return { ...i, image_url: (path && signed.get(path)) || i.image_url, group: groupOf(i.category) }
    })

    // Best effort: a counter failure must never break the page.
    try {
      await service.rpc('increment_share_views', { share_token: token })
    } catch { /* view counts are decorative */ }

    return new Response(JSON.stringify({
      success: true,
      // First name only. A shared link never carries a surname or an email.
      owner_name: (profile?.display_name || '').trim().split(/\s+/)[0] || 'Someone',
      title: share.title || '',
      groups: scope,
      items: viewItems,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return fail(error.message)
  }
})
