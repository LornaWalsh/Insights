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
    // Verify caller is platform admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return error('Unauthorized', 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!

    // Verify caller's JWT
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) return error('Unauthorized', 401)

    const { data: callerProfile } = await callerClient
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', caller.id)
      .single()

    if (!callerProfile?.is_platform_admin) return error('Forbidden', 403)

    // Parse request body
    const body = await req.json()
    const {
      firm_name, description, channel_count, channel_description,
      phone, billing_contact_name, billing_contact_email, admin_email,
    } = body

    if (!firm_name || !admin_email) return error('firm_name and admin_email are required', 400)

    // Service role client for privileged operations
    const admin = createClient(supabaseUrl, serviceKey)

    // 1. Create the organisation
    const { data: org, error: orgErr } = await admin
      .from('organisations')
      .insert({
        name: firm_name,
        description,
        channel_count,
        channel_description,
        phone,
        billing_contact_name,
        billing_contact_email,
      })
      .select()
      .single()

    if (orgErr) return error(orgErr.message, 500)

    // 2. Invite the admin user (creates auth.users row + sends magic link email)
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
      admin_email,
      {
        data: { full_name: billing_contact_name ?? admin_email },
        redirectTo: `${req.headers.get('origin') ?? 'http://localhost:5174'}/onboarding`,
      }
    )

    if (inviteErr) {
      // Roll back org creation
      await admin.from('organisations').delete().eq('id', org.id)
      return error(inviteErr.message, 500)
    }

    // 3. Update the profile created by handle_new_user trigger
    //    Set role=admin, organisation_id, full_name
    const { error: profileErr } = await admin
      .from('profiles')
      .update({
        role: 'admin',
        organisation_id: org.id,
        full_name: billing_contact_name ?? admin_email,
      })
      .eq('id', invited.user.id)

    if (profileErr) return error(profileErr.message, 500)

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
