import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { SalesChannel } from '@/types'
import { formatCurrency } from '@/lib/utils'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface Props {
  channels: SalesChannel[]
  onDone: () => void
  onSkip: () => void
}

type TargetGrid = Record<string, number[]> // channelId -> [12 monthly values]

function initGrid(channels: SalesChannel[]): TargetGrid {
  const grid: TargetGrid = {}
  for (const ch of channels) {
    grid[ch.id] = Array(12).fill(0)
  }
  return grid
}

export function StepForecasts({ channels, onDone, onSkip }: Props) {
  const { profile } = useAuth()
  const year = new Date().getFullYear()
  const [grid, setGrid] = useState<TargetGrid>(initGrid(channels))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function setValue(channelId: string, monthIndex: number, raw: string) {
    const val = parseFloat(raw) || 0
    setGrid(g => ({
      ...g,
      [channelId]: g[channelId].map((v, i) => (i === monthIndex ? val : v)),
    }))
  }

  function channelTotal(channelId: string) {
    return grid[channelId].reduce((a, b) => a + b, 0)
  }

  function quarterTotal(channelId: string, q: number) {
    return grid[channelId].slice(q * 3, q * 3 + 3).reduce((a, b) => a + b, 0)
  }

  function businessTotal() {
    return channels.reduce((sum, ch) => sum + channelTotal(ch.id), 0)
  }

  async function handleSave() {
    if (!profile?.organisation_id) {
      setError('Your account is not linked to an organisation. Please contact support.')
      return
    }
    setSaving(true)
    setError('')

    const rows = channels.flatMap(ch =>
      grid[ch.id].map((target_revenue, i) => ({
        organisation_id: profile.organisation_id,
        channel_id: ch.id,
        year,
        month: i + 1,
        target_revenue,
      }))
    )

    const { error: err } = await supabase.from('forecast_targets').insert(rows)

    if (err) {
      setError(err.message)
      setSaving(false)
      return
    }

    onDone()
  }

  const currency = 'GBP'

  return (
    <div className="space-y-6">
      <div className="bg-card border rounded-lg p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Business total ({year})</p>
          <p className="text-2xl font-bold text-foreground mt-0.5">{formatCurrency(businessTotal(), currency)}</p>
        </div>
        <p className="text-xs text-muted-foreground text-right max-w-xs">
          Sum of all channels. Updates as you fill in figures below.
        </p>
      </div>

      {channels.map(ch => (
        <div key={ch.id} className="bg-card border rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-foreground">{ch.name}</p>
            <p className="text-sm text-muted-foreground">
              Annual: <span className="font-medium text-foreground">{formatCurrency(channelTotal(ch.id), currency)}</span>
            </p>
          </div>

          {/* Quarterly totals */}
          <div className="grid grid-cols-4 gap-2 text-center">
            {[0, 1, 2, 3].map(q => (
              <div key={q} className="bg-muted rounded p-2">
                <p className="text-xs text-muted-foreground">Q{q + 1}</p>
                <p className="text-sm font-medium">{formatCurrency(quarterTotal(ch.id, q), currency)}</p>
              </div>
            ))}
          </div>

          {/* Monthly grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {MONTHS.map((month, i) => (
              <div key={i} className="space-y-1">
                <label className="text-xs text-muted-foreground">{month}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={grid[ch.id][i] === 0 ? '' : grid[ch.id][i]}
                  onChange={e => setValue(ch.id, i, e.target.value)}
                  placeholder="0"
                  className="w-full px-2 py-1.5 rounded border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip for now — I'll set targets later
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save targets and go to dashboard'}
        </button>
      </div>
    </div>
  )
}
