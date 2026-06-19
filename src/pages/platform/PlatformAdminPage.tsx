import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Building2, Plus, X } from 'lucide-react'

interface OrgRow {
  id: string
  name: string
  phone: string | null
  created_at: string
  admin_email?: string
}

function useOrganisations() {
  return useQuery({
    queryKey: ['platform-orgs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organisations')
        .select('id, name, phone, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as OrgRow[]
    },
  })
}

const emptyForm = {
  firm_name: '',
  description: '',
  channel_count: '',
  channel_description: '',
  phone: '',
  billing_contact_name: '',
  billing_contact_email: '',
  admin_email: '',
}

export default function PlatformAdminPage() {
  const qc = useQueryClient()
  const { data: orgs, isLoading } = useOrganisations()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function set(field: keyof typeof emptyForm, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.firm_name.trim() || !form.admin_email.trim()) {
      setError('Firm name and admin email are required.')
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')

    const { data: { session } } = await supabase.auth.getSession()

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-user`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          firm_name: form.firm_name.trim(),
          description: form.description.trim() || null,
          channel_count: form.channel_count ? parseInt(form.channel_count) : null,
          channel_description: form.channel_description.trim() || null,
          phone: form.phone.trim() || null,
          billing_contact_name: form.billing_contact_name.trim() || null,
          billing_contact_email: form.billing_contact_email.trim() || null,
          admin_email: form.admin_email.trim(),
        }),
      }
    )

    const json = await res.json()

    if (!res.ok) {
      setError(json.error ?? 'Something went wrong.')
      setSaving(false)
      return
    }

    setSuccess(`${form.firm_name} created. Invite email sent to ${form.admin_email}.`)
    setForm(emptyForm)
    setShowForm(false)
    setSaving(false)
    qc.invalidateQueries({ queryKey: ['platform-orgs'] })
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <div className="bg-card border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Platform Admin</h1>
          <p className="text-xs text-muted-foreground">Insight Hub — Lorna Walsh</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setSuccess('') }}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          New organisation
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg px-4 py-3">
            {success}
          </div>
        )}

        {/* Create form */}
        {showForm && (
          <div className="bg-card border rounded-lg p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">New organisation</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Firm name *" value={form.firm_name} onChange={v => set('firm_name', v)} placeholder="e.g. The Little Boutique" />
                <Field label="Admin email *" value={form.admin_email} onChange={v => set('admin_email', v)} type="email" placeholder="owner@theirbusiness.com" />
                <Field label="Phone" value={form.phone} onChange={v => set('phone', v)} placeholder="+44..." />
                <Field label="Billing contact name" value={form.billing_contact_name} onChange={v => set('billing_contact_name', v)} placeholder="Jane Smith" />
                <Field label="Billing contact email" value={form.billing_contact_email} onChange={v => set('billing_contact_email', v)} type="email" placeholder="accounts@..." />
                <Field label="Number of channels" value={form.channel_count} onChange={v => set('channel_count', v)} type="number" placeholder="e.g. 3" />
              </div>

              <Field label="Description" value={form.description} onChange={v => set('description', v)} placeholder="Brief description of the business" />
              <Field label="Channel description" value={form.channel_description} onChange={v => set('channel_description', v)} placeholder="e.g. 2 physical shops, 1 online store" />

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm rounded-md border hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  {saving ? 'Creating...' : 'Create & send invite'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Org list */}
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b">
            <h2 className="text-sm font-semibold text-foreground">
              Organisations {orgs ? `(${orgs.length})` : ''}
            </h2>
          </div>

          {isLoading ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">Loading...</div>
          ) : orgs?.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Building2 size={32} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No organisations yet. Create the first one above.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-5 py-2.5 font-medium text-muted-foreground">Firm name</th>
                  <th className="text-left px-5 py-2.5 font-medium text-muted-foreground">Phone</th>
                  <th className="text-left px-5 py-2.5 font-medium text-muted-foreground">Created</th>
                </tr>
              </thead>
              <tbody>
                {orgs?.map(org => (
                  <tr key={org.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-5 py-3 font-medium text-foreground">{org.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{org.phone ?? '—'}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {new Date(org.created_at).toLocaleDateString('en-GB')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({
  label, value, onChange, type = 'text', placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  )
}
