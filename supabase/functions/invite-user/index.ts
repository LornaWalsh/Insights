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
    const serviceKey  = Deno.env.get('SERVICE_ROLE_KEY')!
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!

    // Caller client — uses platform admin's JWT, respects RLS
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // Verify caller is platform admin
    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) return error('Unauthorized', 401)

    const { data: callerProfile } = await callerClient
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', caller.id)
      .single()

    if (!callerProfile?.is_platform_admin) return error('Forbidden', 403)

    const body = await req.json()
    const {
      firm_name, description, channel_count, channel_description,
      phone, billing_contact_name, billing_contact_email, admin_email,
    } = body

    if (!firm_name || !admin_email) return error('firm_name and admin_email are required', 400)

    const adminClient = createClient(supabaseUrl, serviceKey)
    const fullName = billing_contact_name || admin_email

    // 1. Create org using caller JWT (platform admin RLS allows insert)
    const { data: org, error: orgErr } = await callerClient
      .from('organisations')
      .insert({
        name: firm_name,
        description: description || null,
        channel_count: channel_count || null,
        channel_description: channel_description || null,
        phone: phone || null,
        billing_contact_name: billing_contact_name || null,
        billing_contact_email: billing_contact_email || null,
      })
      .select()
      .single()

    if (orgErr) return error(orgErr.message, 500)

    // 2. Invite user — requires service role (admin auth API)
    const { data: invited, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
      admin_email,
      {
        data: { full_name: fullName },
        redirectTo: `${req.headers.get('origin') ?? 'http://localhost:5174'}/accept-invite`,
      }
    )

    if (inviteErr) {
      await adminClient.from('organisations').delete().eq('id', org.id)
      return error(inviteErr.message, 500)
    }

    // 3. Create or update the profile directly via service role — do not rely on
    //    the handle_new_user trigger which may not exist or may be slow.
    const { error: profileErr } = await adminClient
      .from('profiles')
      .upsert({
        id: invited.user.id,
        organisation_id: org.id,
        role: 'admin',
        full_name: fullName,
        email: admin_email,
        invited_at: new Date().toISOString(),
        is_platform_admin: false,
      }, { onConflict: 'id' })

    if (profileErr) {
      await adminClient.auth.admin.deleteUser(invited.user.id)
      await adminClient.from('organisations').delete().eq('id', org.id)
      return error(profileErr.message, 500)
    }

    return new Response(
      JSON.stringify({ success: true, organisation_id: org.id }),
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
