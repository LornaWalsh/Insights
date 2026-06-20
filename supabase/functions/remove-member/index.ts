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

    // Caller client — uses org admin's JWT, respects RLS
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // Service role client — used only to delete the auth user
    const adminClient = createClient(supabaseUrl, serviceKey)

    // ── Verify caller identity and role ────────────────────────────────────────
    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) return error('Unauthorized', 401)

    const { data: callerProfile } = await callerClient
      .from('profiles')
      .select('role, organisation_id')
      .eq('id', caller.id)
      .single()

    if (!callerProfile) return error('Caller profile not found', 403)
    if (callerProfile.role !== 'admin') return error('Only org admins can remove members', 403)
    if (!callerProfile.organisation_id) return error('Caller has no organisation', 403)

    const orgId = callerProfile.organisation_id

    // ── Parse body ─────────────────────────────────────────────────────────────
    const body = await req.json()
    const { user_id } = body

    if (!user_id) return error('user_id is required', 400)

    // ── Prevent self-removal ───────────────────────────────────────────────────
    if (user_id === caller.id) return error('You cannot remove your own account', 400)

    // ── Verify target user belongs to caller's org ────────────────────────────
    // Uses callerClient (RLS) — profiles_select_org policy means this SELECT
    // only succeeds if the target is in the same org as the caller.
    const { data: targetProfile } = await callerClient
      .from('profiles')
      .select('id, organisation_id, role')
      .eq('id', user_id)
      .eq('organisation_id', orgId)
      .single()

    if (!targetProfile) return error('User not found or does not belong to your organisation', 403)

    // ── Prevent removing another admin ────────────────────────────────────────
    // There is one admin per firm. That account cannot be removed via this function.
    if (targetProfile.role === 'admin') return error('Admin accounts cannot be removed via this function. Contact Lorna.', 403)

    // ── Delete the Supabase auth user ─────────────────────────────────────────
    // The FK profiles.id → auth.users.id ON DELETE CASCADE means deleting
    // the auth user automatically cascades to the profile row.
    const { error: deleteErr } = await adminClient.auth.admin.deleteUser(user_id)

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
    { headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }, status }
  )
}
