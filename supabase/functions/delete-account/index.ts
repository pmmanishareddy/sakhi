import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { getUser } from '../_shared/auth.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')!
    const { user } = await getUser(authHeader)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Remove the user's stored images (item photos + outfit photos)
    for (const folder of [`${user.id}/items`, `${user.id}/outfits`]) {
      const { data: files } = await admin.storage.from('wardrobe-images').list(folder, { limit: 1000 })
      const paths = (files || []).filter(f => f.id).map(f => `${folder}/${f.name}`)
      if (paths.length) await admin.storage.from('wardrobe-images').remove(paths)
    }

    // Deleting the auth user cascades: profile → wardrobe items, outfits, verdicts, circles
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) throw error

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
