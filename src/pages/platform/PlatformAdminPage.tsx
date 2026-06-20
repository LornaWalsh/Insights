import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Building2, Plus, X, Pencil, Trash2 } from 'lucide-react'

interface AdminProfile {
  email: string | null
  invited_at: string | null
  last_sign_in_at: string | null
}

interface OrgRow {
  id: string
  name: string
  phone: string | null
  billing_contact_name: string | null
  billing_contact_email: string | null
  description: string | null
  channel_count: number | null
  channel_description: string | null
  created_at: string
  admin?: AdminProfile
}

function inviteStatus(admin?: AdminProfile) {
  if (!admin?.last_sign_in_at) return { label: 'Invite pending', colour: 'text-amber-600' }
  const date = new Date(admin.last_sign_in_at).toLocaleDateString('en-GB')
  return { label: `Active — last seen ${date}`, colour: 'text-green-600' }
}

function useOrganisations() {
  return useQuery({
    queryKey: ['platform-orgs'],
    queryFn: async () => {
      const { data: orgs, error } = await supabase
        .from('organisations')
        .select('id, name, phone, billing_contact_name, billing_contact_email, description, channel_count, channel_description, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error

      // Fetch admin profile for each org
      const { data: admins } = await supabase
        .from('profiles')
        .select('organisation_id, email, invited_at, last_sign_in_at')
        .eq('role', 'admin')

      return (orgs as OrgRow[]).map(org => ({
        ...org,
        admin: admins?.find(a => a.organisation_id === org.id) as AdminProfile | undefined,
      }))
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

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? ''
}

async function callFunction(name: string, body: object) {
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

export default function PlatformAdminPage() {
  const qc = useQueryClient()
  const { data: orgs, isLoading } = useOrganisations()

  const [showCreate, setShowCreate] = useState(false)
  const [editOrg, setEditOrg] = useState<OrgRow | null>(null)
  const [deleteOrg, setDeleteOrg] = useState<OrgRow | null>(null)

  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function set(field: keyof typeof emptyForm, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function openEdit(org: OrgRow) {
    setEditOrg(org)
    setError('')
  }

  function openDelete(org: OrgRow) {
    setDeleteOrg(org)
    setError('')
  }

  // ── Create ────────────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.firm_name.trim() || !form.admin_email.trim()) {
      setError('Firm name and admin email are required.')
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')

    const { ok, json } = await callFunction('invite-user', {
      firm_name: form.firm_name.trim(),
      description: form.description.trim() || null,
      channel_count: form.channel_count ? parseInt(form.channel_count) : null,
      channel_description: form.channel_description.trim() || null,
      phone: form.phone.trim() || null,
      billing_contact_name: form.billing_contact_name.trim() || null,
      billing_contact_email: form.billing_contact_email.trim() || null,
      admin_email: form.admin_email.trim(),
    })

    if (!ok) {
      setError(json.error ?? 'Something went wrong.')
      setSaving(false)
      return
    }

    setSuccess(`${form.firm_name} created. Invite email sent to ${form.admin_email}.`)
    setForm(emptyForm)
    setShowCreate(false)
    setSaving(false)
    qc.invalidateQueries({ queryKey: ['platform-orgs'] })
  }

  // ── Edit ─────────────────────────────────────────────────────────────────
  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editOrg) return
    setSaving(true)
    setError('')

    const { error: err } = await supabase
      .from('organisations')
      .update({
        name: editOrg.name,
        description: editOrg.description,
        channel_count: editOrg.channel_count,
        channel_description: editOrg.channel_description,
        phone: editOrg.phone,
        billing_contact_name: editOrg.billing_contact_name,
        billing_contact_email: editOrg.billing_contact_email,
      })
      .eq('id', editOrg.id)

    if (err) { setError(err.message); setSaving(false); return }

    setEditOrg(null)
    setSaving(false)
    qc.invalidateQueries({ queryKey: ['platform-orgs'] })
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteOrg) return
    setDeleting(true)
    setError('')

    const { ok, json } = await callFunction('delete-org', { organisation_id: deleteOrg.id })

    if (!ok) { setError(json.error ?? 'Delete failed.'); setDeleting(false); return }

    setDeleteOrg(null)
    setDeleting(false)
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
          onClick={() => { setShowCreate(true); setSuccess(''); setError('') }}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} /> New organisation
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg px-4 py-3 flex items-center justify-between">
            {success}
            <button onClick={() => setSuccess('')}><X size={14} /></button>
          </div>
        )}

        {/* ── Create form ── */}
        {showCreate && (
          <div className="bg-card border rounded-lg p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">New organisation</h2>
              <button onClick={() => { setShowCreate(false); setError('') }} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
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
                <button type="button" onClick={() => { setShowCreate(false); setError('') }} className="px-4 py-2 text-sm rounded-md border hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  {saving ? 'Creating...' : 'Create & send invite'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Edit form ── */}
        {editOrg && (
          <div className="bg-card border rounded-lg p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Edit — {editOrg.name}</h2>
              <button onClick={() => { setEditOrg(null); setError('') }} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Firm name *" value={editOrg.name} onChange={v => setEditOrg(o => o ? { ...o, name: v } : o)} />
                <Field label="Phone" value={editOrg.phone ?? ''} onChange={v => setEditOrg(o => o ? { ...o, phone: v } : o)} />
                <Field label="Billing contact name" value={editOrg.billing_contact_name ?? ''} onChange={v => setEditOrg(o => o ? { ...o, billing_contact_name: v } : o)} />
                <Field label="Billing contact email" value={editOrg.billing_contact_email ?? ''} onChange={v => setEditOrg(o => o ? { ...o, billing_contact_email: v } : o)} type="email" />
                <Field label="Number of channels" value={editOrg.channel_count?.toString() ?? ''} onChange={v => setEditOrg(o => o ? { ...o, channel_count: parseInt(v) || null } : o)} type="number" />
              </div>
              <Field label="Description" value={editOrg.description ?? ''} onChange={v => setEditOrg(o => o ? { ...o, description: v } : o)} />
              <Field label="Channel description" value={editOrg.channel_description ?? ''} onChange={v => setEditOrg(o => o ? { ...o, channel_description: v } : o)} />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setEditOrg(null); setError('') }} className="px-4 py-2 text-sm rounded-md border hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Delete confirm ── */}
        {deleteOrg && (
          <div className="bg-card border border-destructive/30 rounded-lg p-6 space-y-4">
            <h2 className="font-semibold text-foreground">Delete {deleteOrg.name}?</h2>
            <p className="text-sm text-muted-foreground">
              This will permanently delete the organisation, all its channels, data, and user accounts. This cannot be undone.
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setDeleteOrg(null); setError('') }} className="px-4 py-2 text-sm rounded-md border hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition-colors">
                {deleting ? 'Deleting...' : 'Yes, delete everything'}
              </button>
            </div>
          </div>
        )}

        {/* ── Org list ── */}
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b">
            <h2 className="text-sm font-semibold text-foreground">Organisations {orgs ? `(${orgs.length})` : ''}</h2>
          </div>
          {isLoading ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">Loading...</div>
          ) : orgs?.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Building2 size={32} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No organisations yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-5 py-2.5 font-medium text-muted-foreground">Firm name</th>
                  <th className="text-left px-5 py-2.5 font-medium text-muted-foreground">Admin email</th>
                  <th className="text-left px-5 py-2.5 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-5 py-2.5 font-medium text-muted-foreground">Created</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {orgs?.map(org => {
                  const status = inviteStatus(org.admin)
                  return (
                    <tr key={org.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-5 py-3 font-medium text-foreground">{org.name}</td>
                      <td className="px-5 py-3 text-muted-foreground">{org.admin?.email ?? '—'}</td>
                      <td className={`px-5 py-3 text-sm font-medium ${status.colour}`}>{status.label}</td>
                      <td className="px-5 py-3 text-muted-foreground">{new Date(org.created_at).toLocaleDateString('en-GB')}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEdit(org)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => openDelete(org)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
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
