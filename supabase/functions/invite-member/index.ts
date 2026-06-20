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

    // Caller client — uses the org admin's JWT, respects RLS
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // Service role client — used only for auth.admin operations and profile insert
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
    if (callerProfile.role !== 'admin') return error('Only org admins can invite members', 403)
    if (!callerProfile.organisation_id) return error('Caller has no organisation', 403)

    const orgId = callerProfile.organisation_id

    // ── Parse and validate body ────────────────────────────────────────────────
    const body = await req.json()
    const { full_name, email, role, channel_id } = body

    if (!full_name?.trim()) return error('full_name is required', 400)
    if (!email?.trim())     return error('email is required', 400)
    if (!role)              return error('role is required', 400)
    if (!channel_id)        return error('channel_id is required', 400)

    // Only manager and staff may be invited via this function — never admin
    if (!['manager', 'staff'].includes(role)) {
      return error('Role must be manager or staff', 400)
    }

    // ── Verify channel belongs to caller's org ─────────────────────────────────
    // Uses callerClient so RLS enforces org isolation on the SELECT
    const { data: channel } = await callerClient
      .from('sales_channels')
      .select('id, organisation_id')
      .eq('id', channel_id)
      .eq('organisation_id', orgId)
      .single()

    if (!channel) return error('Channel not found or does not belong to your organisation', 403)

    // ── Invite the user via Supabase auth ──────────────────────────────────────
    const { data: invited, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
      email.trim(),
      {
        data: { full_name: full_name.trim() },
        redirectTo: `${req.headers.get('origin') ?? 'http://localhost:5174'}/accept-invite`,
      }
    )

    if (inviteErr) return error(inviteErr.message, 500)

    // ── Create profile directly via service role ───────────────────────────────
    const { error: profileErr } = await adminClient
      .from('profiles')
      .upsert({
        id: invited.user.id,
        organisation_id: orgId,
        role,
        full_name: full_name.trim(),
        email: email.trim(),
        channel_id,
        invited_at: new Date().toISOString(),
        is_platform_admin: false,
      }, { onConflict: 'id' })

    if (profileErr) {
      // Roll back the auth user if profile creation fails
      await adminClient.auth.admin.deleteUser(invited.user.id)
      return error(profileErr.message, 500)
    }

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
