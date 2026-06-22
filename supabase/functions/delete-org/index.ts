import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return error('Unauthorized', 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // Verify platform admin
    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) return error('Unauthorized', 401)

    const { data: callerProfile } = await callerClient
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', caller.id)
      .single()

    if (!callerProfile?.is_platform_admin) return error('Forbidden', 403)

    const { organisation_id } = await req.json()
    if (!organisation_id) return error('organisation_id is required', 400)

    const adminClient = createClient(supabaseUrl, serviceKey)

    // 1. Get all auth user IDs in this org
    const { data: profiles } = await callerClient
      .from('profiles')
      .select('id')
      .eq('organisation_id', organisation_id)

    // 2. Delete auth users via service role (removes their profiles via FK cascade)
    if (profiles && profiles.length > 0) {
      for (const profile of profiles) {
        const { error: authErr } = await adminClient.auth.admin.deleteUser(profile.id)
        if (authErr) console.error(`Failed to delete auth user ${profile.id}:`, authErr.message)
      }
    }

    // 3. Delete any remaining profiles explicitly (in case auth delete didn't cascade in time)
    await adminClient
      .from('profiles')
      .delete()
      .eq('organisation_id', organisation_id)

    // 4. Delete the org (cascades to channels, daily_performance, etc. — no profiles left)
    const { error: deleteErr } = await adminClient
      .from('organisations')
      .delete()
      .eq('id', organisation_id)

    if (deleteErr) return error(deleteErr.message, 500)

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (e) {
    return error(e instanceof Error ? e.message : 'Unknown error', 500)
  }
})

function error(message: string, status: number) {
  return new Response(
    JSON.stringify({ error: message }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status }
  )
}
