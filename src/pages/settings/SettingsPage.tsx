import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Plus, Pencil, PowerOff } from 'lucide-react'
import type { SalesChannel } from '@/types'
import { ChannelEditor } from './ChannelEditor'

const CHANNEL_TYPE_LABELS: Record<string, string> = {
  online_store:   'Online Store',
  physical_shop:  'Physical Shop',
  market_popup:   'Market / Pop-up',
  wholesale:      'Wholesale',
  marketplace:    'Marketplace',
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const CURRENCIES = [
  { code: 'GBP', label: 'GBP — British Pound (£)' },
  { code: 'EUR', label: 'EUR — Euro (€)' },
  { code: 'USD', label: 'USD — US Dollar ($)' },
  { code: 'AUD', label: 'AUD — Australian Dollar (A$)' },
  { code: 'CAD', label: 'CAD — Canadian Dollar (C$)' },
]

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="px-5 py-4 space-y-4">{children}</div>
    </div>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  )
}

export default function SettingsPage() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const orgId = profile?.organisation_id

  // Editor state: null = closed, 'new' = adding, channel id = editing
  const [editorMode, setEditorMode] = useState<null | 'new' | string>(null)
  const [deactivating, setDeactivating] = useState<string | null>(null)
  const [deactivateError, setDeactivateError] = useState('')

  // Profile edit state
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState('')
  const [nameSaved, setNameSaved] = useState(false)

  // Password change state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaved, setPasswordSaved] = useState(false)

  // Currency state
  const [currencySaving, setCurrencySaving] = useState(false)
  const [currencyError, setCurrencyError] = useState('')
  const [currencySaved, setCurrencySaved] = useState(false)

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: org } = useQuery<{ name: string; currency: string; created_at: string }>({
    queryKey: ['org', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organisations')
        .select('name, currency, created_at')
        .eq('id', orgId!)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })

  const [selectedCurrency, setSelectedCurrency] = useState<string>('')
  // Sync currency selector once org loads
  const currency = selectedCurrency || org?.currency || 'GBP'

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

  const { data: closedDatesAll = [] } = useQuery<{ channel_id: string; closed_date: string }[]>({
    queryKey: ['closedDates', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('channel_closed_dates')
        .select('channel_id, closed_date')
        .eq('organisation_id', orgId!)
      if (error) throw error
      return data ?? []
    },
    enabled: !!orgId,
  })

  function closedDatesFor(channelId: string): string[] {
    return closedDatesAll.filter(r => r.channel_id === channelId).map(r => r.closed_date)
  }

  function invalidateChannels() {
    queryClient.invalidateQueries({ queryKey: ['channels', orgId] })
    queryClient.invalidateQueries({ queryKey: ['closedDates', orgId] })
    setEditorMode(null)
  }

  // ── Currency save ──────────────────────────────────────────────────────────

  async function saveCurrency() {
    setCurrencyError('')
    setCurrencySaving(true)
    const { error } = await supabase
      .from('organisations')
      .update({ currency })
      .eq('id', orgId!)
    setCurrencySaving(false)
    if (error) { setCurrencyError(error.message); return }
    queryClient.invalidateQueries({ queryKey: ['org', orgId] })
    setCurrencySaved(true)
    setTimeout(() => setCurrencySaved(false), 3000)
  }

  // ── Deactivate channel ─────────────────────────────────────────────────────

  async function deactivateChannel(ch: SalesChannel) {
    setDeactivateError('')
    setDeactivating(ch.id)
    const { error } = await supabase
      .from('sales_channels')
      .update({ is_active: false })
      .eq('id', ch.id)
    setDeactivating(null)
    if (error) { setDeactivateError(error.message); return }
    invalidateChannels()
  }

  // ── Profile name save ──────────────────────────────────────────────────────

  async function saveFullName() {
    setNameError('')
    if (!fullName.trim()) { setNameError('Name cannot be empty.'); return }
    setSavingName(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() })
      .eq('id', profile!.id)
    setSavingName(false)
    if (error) { setNameError(error.message); return }
    setNameSaved(true)
    setTimeout(() => setNameSaved(false), 3000)
  }

  // ── Password change ────────────────────────────────────────────────────────

  async function savePassword() {
    setPasswordError('')
    if (newPassword.length < 8) { setPasswordError('Password must be at least 8 characters.'); return }
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match.'); return }
    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)
    if (error) { setPasswordError(error.message); return }
    setNewPassword('')
    setConfirmPassword('')
    setPasswordSaved(true)
    setTimeout(() => setPasswordSaved(false), 3000)
  }

  if (!orgId || !org) return null

  const editingChannel = typeof editorMode === 'string' && editorMode !== 'new'
    ? channels.find(c => c.id === editorMode)
    : undefined

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your organisation and account.</p>
      </div>

      {/* ── Firm Profile ─────────────────────────────────────────────────── */}
      <SectionCard title="Firm Profile">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ReadOnlyField label="Organisation name" value={org.name} />
          <ReadOnlyField
            label="Date created"
            value={new Date(org.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          />
          <ReadOnlyField label="Your role" value="Admin" />
        </div>
        <div className="bg-muted/50 border rounded-md px-4 py-3 text-xs text-muted-foreground leading-relaxed">
          Your data is stored securely and is completely isolated from other organisations. Only members
          of your organisation can access your data. To change your organisation name, contact
          <span className="font-medium"> lorna@livingstonewalsh.com</span>.
        </div>
      </SectionCard>

      {/* ── Currency ─────────────────────────────────────────────────────── */}
      <SectionCard title="Currency">
        <p className="text-sm text-muted-foreground">
          Sets the currency symbol used throughout the app for all monetary values.
        </p>
        <div className="flex items-center gap-3">
          <select
            value={currency}
            onChange={e => { setSelectedCurrency(e.target.value); setCurrencySaved(false) }}
            className="flex-1 px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
          <button
            onClick={saveCurrency}
            disabled={currencySaving || currency === org.currency}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {currencySaving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {currencySaved && <p className="text-xs text-green-600">Currency updated.</p>}
        {currencyError && <p className="text-xs text-destructive">{currencyError}</p>}
      </SectionCard>

      {/* ── Channels ─────────────────────────────────────────────────────── */}
      <SectionCard title="Channels">
        <p className="text-sm text-muted-foreground">
          Deactivating a channel hides it from daily input and staff assignment. All historical data is preserved.
        </p>

        {/* Channel list */}
        {channels.length > 0 && editorMode === null && (
          <div className="divide-y border rounded-md overflow-hidden">
            {channels.map(ch => (
              <div key={ch.id} className="flex items-start justify-between gap-3 px-4 py-3 bg-card">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-sm font-medium text-foreground">{ch.name}</p>
                  <p className="text-xs text-muted-foreground">{CHANNEL_TYPE_LABELS[ch.channel_type]}</p>
                  {ch.trading_days.length < 7 && (
                    <p className="text-xs text-muted-foreground">
                      {ch.trading_days.map(d => DAYS[d]).join(', ')}
                    </p>
                  )}
                  {closedDatesFor(ch.id).length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {closedDatesFor(ch.id).length} closed date{closedDatesFor(ch.id).length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setEditorMode(ch.id)}
                    title="Edit channel"
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => deactivateChannel(ch)}
                    disabled={deactivating === ch.id}
                    title="Deactivate channel"
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                  >
                    <PowerOff size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {deactivateError && <p className="text-xs text-destructive">{deactivateError}</p>}

        {/* Editor — add or edit */}
        {editorMode !== null && (
          <ChannelEditor
            organisationId={orgId}
            channel={editingChannel}
            existingClosedDates={editingChannel ? closedDatesFor(editingChannel.id) : []}
            onSaved={invalidateChannels}
            onCancel={() => setEditorMode(null)}
          />
        )}

        {/* Add button — only shown when editor is closed */}
        {editorMode === null && (
          <button
            onClick={() => setEditorMode('new')}
            className="flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium hover:bg-muted transition-colors"
          >
            <Plus size={15} />
            Add channel
          </button>
        )}
      </SectionCard>

      {/* ── Your Profile ─────────────────────────────────────────────────── */}
      <SectionCard title="Your Profile">
        {/* Full name */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Full name</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={fullName}
              onChange={e => { setFullName(e.target.value); setNameSaved(false) }}
              className="flex-1 px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={saveFullName}
              disabled={savingName || fullName.trim() === (profile?.full_name ?? '')}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {savingName ? 'Saving…' : 'Save'}
            </button>
          </div>
          {nameSaved && <p className="text-xs text-green-600">Name updated.</p>}
          {nameError && <p className="text-xs text-destructive">{nameError}</p>}
        </div>

        {/* Password change */}
        <div className="space-y-3 pt-2 border-t">
          <p className="text-sm font-medium text-foreground pt-2">Change password</p>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => { setNewPassword(e.target.value); setPasswordSaved(false) }}
              placeholder="Minimum 8 characters"
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Confirm password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setPasswordSaved(false) }}
              placeholder="Repeat new password"
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
          {passwordSaved && <p className="text-xs text-green-600">Password updated.</p>}
          <div className="flex justify-end">
            <button
              onClick={savePassword}
              disabled={savingPassword || !newPassword || !confirmPassword}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {savingPassword ? 'Saving…' : 'Update password'}
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
