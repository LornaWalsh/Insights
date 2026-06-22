import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { X } from 'lucide-react'
import type { SalesChannel, ChannelType } from '@/types'

const CHANNEL_TYPE_LABELS: Record<ChannelType, string> = {
  online_store:   'Online Store',
  physical_shop:  'Physical Shop',
  market_popup:   'Market / Pop-up',
  wholesale:      'Wholesale',
  marketplace:    'Marketplace (Amazon, Etsy etc.)',
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const CALENDAR_DAY_TYPES: ChannelType[] = ['online_store', 'marketplace']

interface Props {
  organisationId: string
  channel?: SalesChannel        // present = edit mode, absent = add mode
  existingClosedDates?: string[]
  onSaved: () => void
  onCancel: () => void
}

export function ChannelEditor({ organisationId, channel, existingClosedDates = [], onSaved, onCancel }: Props) {
  const isEdit = !!channel

  const [name, setName] = useState(channel?.name ?? '')
  const [channelType, setChannelType] = useState<ChannelType>(channel?.channel_type ?? 'online_store')
  const [tradingDays, setTradingDays] = useState<number[]>(channel?.trading_days ?? [0,1,2,3,4,5,6])
  const [closedDates, setClosedDates] = useState<string[]>(existingClosedDates)
  const [newClosedDate, setNewClosedDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // When editing, re-sync if the passed channel changes
  useEffect(() => {
    if (channel) {
      setName(channel.name)
      setChannelType(channel.channel_type)
      setTradingDays(channel.trading_days)
    }
  }, [channel?.id])

  useEffect(() => {
    setClosedDates(existingClosedDates)
  }, [existingClosedDates.join(',')])

  const showTradingDays = !CALENDAR_DAY_TYPES.includes(channelType)

  function toggleDay(day: number) {
    setTradingDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    )
  }

  function addClosedDate() {
    if (!newClosedDate || closedDates.includes(newClosedDate)) return
    setClosedDates(prev => [...prev, newClosedDate].sort())
    setNewClosedDate('')
  }

  async function removeClosedDate(date: string) {
    if (isEdit && channel) {
      const { error: err } = await supabase
        .from('channel_closed_dates')
        .delete()
        .eq('channel_id', channel.id)
        .eq('closed_date', date)
      if (err) { setError('Failed to remove closed date.'); return }
    }
    setClosedDates(prev => prev.filter(d => d !== date))
  }

  async function handleSave() {
    setError('')
    if (!name.trim()) { setError('Channel name is required.'); return }
    if (showTradingDays && tradingDays.length === 0) { setError('Select at least one trading day.'); return }

    setSaving(true)

    if (isEdit && channel) {
      // Update channel
      const { error: err } = await supabase
        .from('sales_channels')
        .update({ name: name.trim(), channel_type: channelType, trading_days: tradingDays })
        .eq('id', channel.id)
      if (err) { setError(err.message); setSaving(false); return }

      // Sync closed dates: delete all then re-insert current set
      await supabase.from('channel_closed_dates').delete().eq('channel_id', channel.id)
      if (closedDates.length > 0) {
        const { error: dateErr } = await supabase.from('channel_closed_dates').insert(
          closedDates.map(d => ({ channel_id: channel.id, organisation_id: organisationId, closed_date: d }))
        )
        if (dateErr) setError(`Channel saved but some closed dates failed: ${dateErr.message}`)
      }
    } else {
      // Insert new channel
      const { data, error: err } = await supabase
        .from('sales_channels')
        .insert({ organisation_id: organisationId, name: name.trim(), channel_type: channelType, trading_days: tradingDays })
        .select()
        .single()
      if (err || !data) { setError(err?.message ?? 'Failed to save channel.'); setSaving(false); return }

      if (closedDates.length > 0) {
        await supabase.from('channel_closed_dates').insert(
          closedDates.map(d => ({ channel_id: data.id, organisation_id: organisationId, closed_date: d }))
        )
      }
    }

    setSaving(false)
    onSaved()
  }

  return (
    <div className="bg-card border rounded-lg p-5 space-y-4">
      <p className="text-sm font-semibold text-foreground border-b pb-2">
        {isEdit ? `Edit — ${channel!.name}` : 'Add channel'}
      </p>

      {/* Name */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Channel name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Main Shop, Online Store, Amazon"
          className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Type */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Channel type</label>
        <select
          value={channelType}
          onChange={e => setChannelType(e.target.value as ChannelType)}
          className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {(Object.entries(CHANNEL_TYPE_LABELS) as [ChannelType, string][]).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground mt-1">
          {CALENDAR_DAY_TYPES.includes(channelType)
            ? 'Forecast spread across every calendar day of the month.'
            : 'Forecast spread across trading days only, excluding closed dates.'}
        </p>
      </div>

      {/* Trading days */}
      {showTradingDays && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Trading days</label>
          <div className="flex gap-2 flex-wrap">
            {DAYS.map((day, i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggleDay(i)}
                className={`w-10 h-10 rounded-md text-xs font-medium border transition-colors ${
                  tradingDays.includes(i)
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

      {/* Closed dates */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          Closed dates <span className="text-muted-foreground font-normal">(optional — bank holidays, annual closure etc.)</span>
        </label>
        <div className="flex gap-2">
          <input
            type="date"
            value={newClosedDate}
            onChange={e => setNewClosedDate(e.target.value)}
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
        {closedDates.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {closedDates.map(d => (
              <span key={d} className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded">
                {new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                <button onClick={() => removeClosedDate(d)} className="hover:text-destructive ml-0.5">
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 justify-end pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-md border text-sm hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add channel'}
        </button>
      </div>
    </div>
  )
}
