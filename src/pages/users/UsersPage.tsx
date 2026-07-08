import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { callFunction } from '@/lib/callFunction'
import { UserPlus, Pencil, Trash2, X, Check } from 'lucide-react'
import type { SalesChannel } from '@/types'

type MemberRole = 'manager' | 'staff'

interface Member {
  id: string
  full_name: string
  email: string | null
  role: string
  channel_id: string | null
  invited_at: string | null
  last_sign_in_at: string | null
}

const ROLE_LABELS: Record<string, string> = {
  admin:   'Admin',
  manager: 'Manager',
  staff:   'Staff',
}

function statusBadge(member: Member) {
  if (member.last_sign_in_at) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Active</span>
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">Invite pending</span>
}

export default function UsersPage() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const orgId = profile?.organisation_id

  const [showInvite, setShowInvite] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editChannelId, setEditChannelId] = useState<string>('')
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

  // Invite form state
  const [inviteForm, setInviteForm] = useState({ full_name: '', email: '', role: 'staff' as MemberRole, channel_id: '' })
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')

  // Remove state
  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState('')

  // Edit channel state
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: members = [], isLoading } = useQuery<Member[]>({
    queryKey: ['org-users', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, channel_id, invited_at, last_sign_in_at')
        .eq('organisation_id', orgId!)
        .neq('role', 'admin')
        .order('role')
        .order('full_name')
      if (error) throw error
      return (data ?? []) as Member[]
    },
    enabled: !!orgId,
  })

  const { data: channels = [] } = useQuery<SalesChannel[]>({
    queryKey: ['channels', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_channels')
        .select('*')
        .eq('organisation_id', orgId!)
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data ?? []
    },
    enabled: !!orgId,
  })

  function channelName(channelId: string | null) {
    if (!channelId) return '—'
    return channels.find(c => c.id === channelId)?.name ?? '—'
  }

  function invalidateUsers() {
    queryClient.invalidateQueries({ queryKey: ['org-users', orgId] })
  }

  // ── Invite member ──────────────────────────────────────────────────────────
  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError('')
    setInviteSuccess('')

    if (!inviteForm.full_name.trim()) { setInviteError('Name is required.'); return }
    if (!inviteForm.email.trim())     { setInviteError('Email is required.'); return }
    if (!inviteForm.channel_id)       { setInviteError('Channel assignment is required.'); return }

    setInviting(true)
    const { ok, json } = await callFunction('invite-member', {
      full_name:  inviteForm.full_name.trim(),
      email:      inviteForm.email.trim(),
      role:       inviteForm.role,
      channel_id: inviteForm.channel_id,
    })
    setInviting(false)

    if (!ok) {
      setInviteError((json.error as string) ?? 'Something went wrong.')
      return
    }

    setInviteSuccess(`Invite sent to ${inviteForm.email.trim()}.`)
    setInviteForm({ full_name: '', email: '', role: 'staff', channel_id: '' })
    invalidateUsers()
    setTimeout(() => { setInviteSuccess(''); setShowInvite(false) }, 2500)
  }

  // ── Edit channel assignment ────────────────────────────────────────────────
  function startEdit(member: Member) {
    setEditingId(member.id)
    setEditChannelId(member.channel_id ?? '')
    setEditError('')
  }

  async function saveEdit(memberId: string) {
    setEditError('')
    if (!editChannelId) { setEditError('Select a channel.'); return }
    setSavingEdit(true)
    const { error } = await supabase
      .from('profiles')
      .update({ channel_id: editChannelId })
      .eq('id', memberId)
      .eq('organisation_id', orgId!)
    setSavingEdit(false)
    if (error) { setEditError(error.message); return }
    setEditingId(null)
    invalidateUsers()
  }

  // ── Remove member ──────────────────────────────────────────────────────────
  async function handleRemove(userId: string) {
    setRemoveError('')
    setRemoving(true)
    const { ok, json } = await callFunction('remove-member', { user_id: userId })
    setRemoving(false)
    if (!ok) {
      setRemoveError((json.error as string) ?? 'Something went wrong.')
      return
    }
    setConfirmRemoveId(null)
    invalidateUsers()
  }

  if (!orgId) return null

  // Separate admin row from the rest — admin is always shown first, no actions
  const adminMember = members.find(m => m.role === 'admin')
  const teamMembers = members.filter(m => m.role !== 'admin')

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage who has access to your organisation.</p>
        </div>
        {!showInvite && (
          <button
            onClick={() => { setShowInvite(true); setInviteError(''); setInviteSuccess('') }}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <UserPlus size={15} />
            Invite member
          </button>
        )}
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="bg-card border rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <p className="text-sm font-semibold text-foreground">Invite a new member</p>
            <button onClick={() => setShowInvite(false)} className="text-muted-foreground hover:text-foreground">
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleInvite} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Full name</label>
                <input
                  type="text"
                  value={inviteForm.full_name}
                  onChange={e => setInviteForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="Jane Smith"
                  className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Email address</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="jane@example.com"
                  className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Role</label>
                <select
                  value={inviteForm.role}
                  onChange={e => setInviteForm(f => ({ ...f, role: e.target.value as MemberRole }))}
                  className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  {inviteForm.role === 'manager'
                    ? 'Can view dashboard, enter and amend data for their channel.'
                    : 'Can enter data for their channel only. Cannot amend existing entries.'}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Channel</label>
                <select
                  value={inviteForm.channel_id}
                  onChange={e => setInviteForm(f => ({ ...f, channel_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select a channel…</option>
                  {channels.map(ch => (
                    <option key={ch.id} value={ch.id}>{ch.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
            {inviteSuccess && <p className="text-sm text-green-600">{inviteSuccess}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowInvite(false)} className="px-4 py-2 rounded-md border text-sm hover:bg-muted transition-colors">
                Cancel
              </button>
              <button
                type="submit"
                disabled={inviting}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {inviting ? 'Sending invite…' : 'Send invite'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users table */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="bg-card border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Role</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Channel</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {/* Admin row — no actions */}
              {adminMember && (
                <tr className="border-b bg-muted/20">
                  <td className="px-4 py-3 font-medium text-foreground">{adminMember.full_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{adminMember.email ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{ROLE_LABELS[adminMember.role]}</td>
                  <td className="px-4 py-3 text-muted-foreground">—</td>
                  <td className="px-4 py-3">{statusBadge(adminMember)}</td>
                  <td className="px-4 py-3"></td>
                </tr>
              )}

              {/* Team members */}
              {teamMembers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground text-sm">
                    No team members yet. Use "Invite member" to add staff or managers.
                  </td>
                </tr>
              )}
              {teamMembers.map(member => (
                <tr key={member.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{member.full_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{member.email ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{ROLE_LABELS[member.role] ?? member.role}</td>

                  {/* Channel — inline edit */}
                  <td className="px-4 py-3">
                    {editingId === member.id ? (
                      <div className="flex items-center gap-1">
                        <select
                          value={editChannelId}
                          onChange={e => setEditChannelId(e.target.value)}
                          className="px-2 py-1 rounded border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="">Select…</option>
                          {channels.map(ch => (
                            <option key={ch.id} value={ch.id}>{ch.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => saveEdit(member.id)}
                          disabled={savingEdit}
                          className="p-1 rounded hover:bg-muted text-green-600 disabled:opacity-50"
                          title="Save"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground"
                          title="Cancel"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">{channelName(member.channel_id)}</span>
                    )}
                    {editingId === member.id && editError && (
                      <p className="text-xs text-destructive mt-1">{editError}</p>
                    )}
                  </td>

                  <td className="px-4 py-3">{statusBadge(member)}</td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    {confirmRemoveId === member.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-destructive">Remove?</span>
                        <button
                          onClick={() => handleRemove(member.id)}
                          disabled={removing}
                          className="text-xs text-destructive font-medium hover:underline disabled:opacity-50"
                        >
                          {removing ? 'Removing…' : 'Yes'}
                        </button>
                        <button
                          onClick={() => setConfirmRemoveId(null)}
                          className="text-xs text-muted-foreground hover:underline"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEdit(member)}
                          disabled={editingId !== null}
                          title="Edit channel"
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => { setConfirmRemoveId(member.id); setRemoveError('') }}
                          title="Remove user"
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {removeError && (
            <div className="px-4 py-2 border-t">
              <p className="text-xs text-destructive">{removeError}</p>
            </div>
          )}
        </div>
      )}

      <div className="bg-muted/50 border rounded-md px-4 py-3 text-xs text-muted-foreground leading-relaxed">
        To change an admin account or recover lost admin access, contact <span className="font-medium">info@planfore.app</span>.
      </div>
    </div>
  )
}
