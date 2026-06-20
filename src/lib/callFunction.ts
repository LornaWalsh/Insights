import { supabase } from '@/lib/supabase'

async function getToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? ''
}

export async function callFunction(name: string, body: object): Promise<{ ok: boolean; json: Record<string, unknown> }> {
  const token = await getToken()
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }
  )
  return { ok: res.ok, json: await res.json() }
}
