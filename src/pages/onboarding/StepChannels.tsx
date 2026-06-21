import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { SalesChannel, ChannelType } from '@/types'
import { X, Plus, ChevronRight } from 'lucide-react'

const CHANNEL_TYPE_LABELS: Record<ChannelType, string> = {
  online_store:   'Online Store',
  physical_shop:  'Physical Shop',
  market_popup:   'Market / Pop-up',
  wholesale:      'Wholesale',
  marketplace:    'Marketplace (Amazon, Etsy etc.)',
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const DEFAULT_TRADING_DAYS = [0, 1, 2, 3, 4, 5, 6]

interface ChannelDraft {
  name: string
  channel_type: ChannelType
  trading_days: number[]
  closed_dates: string[]
  newClosedDate: string
}

const emptyDraft = (): ChannelDraft => ({
  name: '',
  channel_type: 'online_store',
  trading_days: DEFAULT_TRADING_DAYS,
  closed_dates: [],
  newClosedDate: '',
})

interface Props {
  onDone: (channels: SalesChannel[]) => void
}

export function StepChannels({ onDone }: Props) {
  const { profile } = useAuth()
  const [saved, setSaved] = useState<SalesChannel[]>([])
  const [draft, setDraft] = useState<ChannelDraft>(emptyDraft())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const orgId = profile?.organisation_id

  // Load any channels already saved to DB (handles page refresh and re-entry)
  useEffect(() => {
    if (!orgId) return
    supabase
      .from('sales_channels')
      .select('*')
      .eq('organisation_id', orgId)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        if (data && data.length > 0) setSaved(data as SalesChannel[])
      })
  }, [orgId])

  function toggleDay(day: number) {
    setDraft(d => ({
      ...d,
      trading_days: d.trading_days.includes(day)
        ? d.trading_days.filter(x => x !== day)
        : [...d.trading_days, day].sort(),
    }))
  }

  function addClosedDate() {
    if (!draft.newClosedDate) return
    if (draft.closed_dates.includes(draft.newClosedDate)) return
    setDraft(d => ({
      ...d,
      closed_dates: [...d.closed_dates, d.newClosedDate].sort(),
      newClosedDate: '',
    }))
  }

  function removeClosedDate(date: string) {
    setDraft(d => ({ ...d, closed_dates: d.closed_dates.filter(x => x !== date) }))
  }

  async function saveClosedDates(channelId: string, dates: string[]) {
    if (dates.length === 0) return
    const { error: err } = await supabase.from('channel_closed_dates').insert(
      dates.map(d => ({ channel_id: channelId, organisation_id: orgId, closed_date: d }))
    )
    if (err) setError(`Channel saved but closed dates could not be saved: ${err.message}`)
  }

  async function addChannel() {
    if (!orgId) { setError('Your account is not linked to an organisation. Please contact support.'); return }
    if (!draft.name.trim()) { setError('Channel name is required.'); return }
    if (draft.trading_days.length === 0) { setError('Select at least one trading day.'); return }
    setError('')
    setSaving(true)

    const { data, error: err } = await supabase
      .from('sales_channels')
      .insert({
        organisation_id: orgId,
        name: draft.name.trim(),
        channel_type: draft.channel_type,
        trading_days: draft.trading_days,
      })
      .select()
      .single()

    if (err || !data) {
      setError(err?.message ?? 'Failed to save channel.')
      setSaving(false)
      return
    }

    await saveClosedDates(data.id, draft.closed_dates)
    setSaved(prev => [...prev, data as SalesChannel])
    setDraft(emptyDraft())
    setSaving(false)
  }

  async function removeChannel(id: string) {
    const { error: err } = await supabase.from('sales_channels').delete().eq('id', id)
    if (err) {
      setError('Failed to remove channel. Please try again.')
      return
    }
    setSaved(prev => prev.filter(c => c.id !== id))
  }

  async function handleNext() {
    if (!orgId) { setError('Your account is not linked to an organisation. Please contact support.'); return }

    // Auto-save the current draft if a name has been entered but not yet added
    if (draft.name.trim()) {
      if (draft.trading_days.length === 0) { setError('Select at least one trading day for the current channel.'); return }
      setSubmitting(true)

      const { data, error: err } = await supabase
        .from('sales_channels')
        .insert({
          organisation_id: orgId,
          name: draft.name.trim(),
          channel_type: draft.channel_type,
          trading_days: draft.trading_days,
        })
        .select()
        .single()

      if (err || !data) {
        setError(err?.message ?? 'Failed to save channel.')
        setSubmitting(false)
        return
      }

      await saveClosedDates(data.id, draft.closed_dates)
      onDone([...saved, data as SalesChannel])
      return
    }

    if (saved.length === 0) { setError('Add at least one channel before continuing.'); return }
    setSubmitting(true)
    onDone(saved)
  }

  const onlineTypes: ChannelType[] = ['online_store', 'marketplace']
  const showTradingDays = !onlineTypes.includes(draft.channel_type)

  return (
    <div className="space-y-6">
      {/* Saved channels */}
      {saved.length > 0 && (
        <div className="bg-card border rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium text-foreground">Channels added</p>
          {saved.map(ch => (
            <div key={ch.id} className="flex items-center justify-between text-sm py-1">
              <div>
                <span className="font-medium">{ch.name}</span>
                <span className="text-muted-foreground ml-2">{CHANNEL_TYPE_LABELS[ch.channel_type]}</span>
              </div>
              <button onClick={() => removeChannel(ch.id)} className="text-muted-foreground hover:text-destructive">
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add channel form */}
      <div className="bg-card border rounded-lg p-5 space-y-4">
        <p className="text-sm font-semibold text-foreground">
          {saved.length === 0 ? 'Add your first channel' : 'Add another channel'}
        </p>

        <div className="space-y-1">
          <label className="text-sm font-medium">Channel name</label>
          <input
            type="text"
            value={draft.name}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
            placeholder="e.g. Main Shop, Online Store, Amazon"
            className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Channel type</label>
          <select
            value={draft.channel_type}
            onChange={e => setDraft(d => ({ ...d, channel_type: e.target.value as ChannelType }))}
            className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {(Object.entries(CHANNEL_TYPE_LABELS) as [ChannelType, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            {onlineTypes.includes(draft.channel_type)
              ? 'Forecast will be spread across every calendar day of the month.'
              : 'Forecast will be spread across trading days only, excluding any closed dates.'}
          </p>
        </div>

        {showTradingDays && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Trading days</label>
            <div className="flex gap-2 flex-wrap">
              {DAYS.map((day, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`w-10 h-10 rounded-md text-xs font-medium border transition-colors ${
                    draft.trading_days.includes(i)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-primary'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Closed dates <span className="text-muted-foreground font-normal">(optional)</span></label>
          <div className="flex gap-2">
            <input
              type="date"
              value={draft.newClosedDate}
              onChange={e => setDraft(d => ({ ...d, newClosedDate: e.target.value }))}
              className="flex-1 px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={addClosedDate}
              className="px-3 py-2 rounded-md border text-sm hover:bg-muted transition-colors"
            >
              Add
            </button>
          </div>
          {draft.closed_dates.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {draft.closed_dates.map(d => (
                <span key={d} className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded">
                  {d}
                  <button onClick={() => removeClosedDate(d)} className="hover:text-destructive">
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="button"
          onClick={addChannel}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors"
        >
          <Plus size={16} />
          {saving ? 'Saving...' : 'Add channel'}
        </button>
      </div>

      {/* Next */}
      <div className="flex justify-end">
        <button
          onClick={handleNext}
          disabled={submitting || (saved.length === 0 && !draft.name.trim())}
          title={saved.length === 0 && !draft.name.trim() ? 'Add at least one channel to continue' : undefined}
          className="flex items-center gap-2 px-5 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          Next: Forecast targets
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
