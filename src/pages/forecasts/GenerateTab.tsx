import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, ChevronRight, AlertTriangle, Info, Loader2 } from 'lucide-react'
import type { SalesChannel, ForecastTarget } from '@/types'
import { generateForecast } from './forecastEngine'
import type { ChannelPreview } from './forecastEngine'

interface Props {
  orgId: string
  channels: SalesChannel[]
  currency: string
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function fmt(n: number, currency: string) {
  return n.toLocaleString('en-GB', { style: 'currency', currency, minimumFractionDigits: 2 })
}

export function GenerateTab({ orgId, channels, currency }: Props) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [previews, setPreviews] = useState<ChannelPreview[] | null>(null)
  const [generating, setGenerating] = useState(false)
  const [done, setDone] = useState(false)
  const [genError, setGenError] = useState('')

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
    setPreviews(null); setDone(false); setGenError('')
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
    setPreviews(null); setDone(false); setGenError('')
  }

  const { data: targets = [] } = useQuery<ForecastTarget[]>({
    queryKey: ['forecast_targets', orgId, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forecast_targets')
        .select('*')
        .eq('organisation_id', orgId)
        .eq('year', year)
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })

  const { data: existingCount = 0 } = useQuery<number>({
    queryKey: ['daily_forecasts_count', orgId, year, month],
    queryFn: async () => {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = new Date(year, month, 0).toISOString().slice(0, 10)
      const { count, error } = await supabase
        .from('daily_forecasts')
        .select('id', { count: 'exact', head: true })
        .eq('organisation_id', orgId)
        .gte('forecast_date', startDate)
        .lte('forecast_date', endDate)
      if (error) throw error
      return count ?? 0
    },
    enabled: !!orgId,
  })

  // Channels missing a target for this month
  const targetMap = new Map(
    targets.filter(t => t.month === month).map(t => [t.channel_id, t.target_revenue])
  )
  const missingTargets = channels.filter(ch => !targetMap.has(ch.id) || (targetMap.get(ch.id) ?? 0) === 0)

  async function handlePreview() {
    setPreviews(null)
    setGenError('')

    // Fetch closed dates for this month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = new Date(year, month, 0).toISOString().slice(0, 10)

    const { data: closedData, error } = await supabase
      .from('channel_closed_dates')
      .select('channel_id, closed_date')
      .eq('organisation_id', orgId)
      .gte('closed_date', startDate)
      .lte('closed_date', endDate)

    if (error) { setGenError(error.message); return }

    const closedDates = new Map<string, Set<string>>()
    for (const row of closedData ?? []) {
      if (!closedDates.has(row.channel_id)) closedDates.set(row.channel_id, new Set())
      closedDates.get(row.channel_id)!.add(row.closed_date)
    }

    const channelsWithTarget = channels.filter(ch => targetMap.has(ch.id))
    const { previews: p } = generateForecast(year, month, channelsWithTarget, targetMap, closedDates)
    setPreviews(p)
  }

  async function handleGenerate() {
    if (!previews) return
    setGenerating(true)
    setGenError('')

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = new Date(year, month, 0).toISOString().slice(0, 10)

    // Fetch closed dates again (preview may be stale if settings changed)
    const { data: closedData, error: cdErr } = await supabase
      .from('channel_closed_dates')
      .select('channel_id, closed_date')
      .eq('organisation_id', orgId)
      .gte('closed_date', startDate)
      .lte('closed_date', endDate)

    if (cdErr) { setGenError(cdErr.message); setGenerating(false); return }

    const closedDates = new Map<string, Set<string>>()
    for (const row of closedData ?? []) {
      if (!closedDates.has(row.channel_id)) closedDates.set(row.channel_id, new Set())
      closedDates.get(row.channel_id)!.add(row.closed_date)
    }

    const channelsWithTarget = channels.filter(ch => targetMap.has(ch.id))
    const { rows } = generateForecast(year, month, channelsWithTarget, targetMap, closedDates)

    // Delete existing forecasts for this month first (overwrite)
    const { error: delErr } = await supabase
      .from('daily_forecasts')
      .delete()
      .eq('organisation_id', orgId)
      .gte('forecast_date', startDate)
      .lte('forecast_date', endDate)

    if (delErr) { setGenError(delErr.message); setGenerating(false); return }

    // Insert in batches of 100
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100).map(r => ({ ...r, organisation_id: orgId }))
      const { error: insErr } = await supabase.from('daily_forecasts').insert(batch)
      if (insErr) { setGenError(insErr.message); setGenerating(false); return }
    }

    setGenerating(false)
    setDone(true)
  }

  return (
    <div className="space-y-6">
      {/* Month selector */}
      <div className="flex items-center gap-3">
        <button onClick={prevMonth} className="p-1.5 rounded-md hover:bg-muted border">
          <ChevronLeft size={16} />
        </button>
        <span className="text-base font-semibold text-foreground w-36 text-center">
          {MONTH_NAMES[month - 1]} {year}
        </span>
        <button onClick={nextMonth} className="p-1.5 rounded-md hover:bg-muted border">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* How the engine works */}
      <div className="bg-muted/40 border rounded-lg px-4 py-3 space-y-1.5">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Info size={14} className="shrink-0" />
          How the forecast engine works
        </div>
        <ul className="text-xs text-muted-foreground space-y-1 ml-5 list-disc">
          <li><span className="font-medium">Online Store channels:</span> monthly target ÷ every calendar day in the month</li>
          <li><span className="font-medium">All other channels:</span> monthly target ÷ trading days only (your weekday schedule, minus any closed dates)</li>
          <li>Non-trading days and closed dates receive £0</li>
          <li>Pence-level arithmetic ensures the daily figures sum exactly to the monthly target</li>
        </ul>
      </div>

      {/* Missing targets warning */}
      {missingTargets.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
            <AlertTriangle size={14} className="shrink-0" />
            {missingTargets.length} channel{missingTargets.length > 1 ? 's have' : ' has'} no target for {MONTH_NAMES[month - 1]} {year}
          </div>
          <ul className="text-xs text-amber-600 ml-5 list-disc">
            {missingTargets.map(ch => <li key={ch.id}>{ch.name}</li>)}
          </ul>
          <p className="text-xs text-amber-600">These channels will be excluded from the forecast. Set targets in the Targets tab first.</p>
        </div>
      )}

      {/* Existing forecast warning */}
      {existingCount > 0 && !done && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
          A forecast already exists for {MONTH_NAMES[month - 1]} {year}. Generating will overwrite it.
        </div>
      )}

      {/* Preview results */}
      {previews && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Channel</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Monthly target</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Trading days</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Daily avg</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {previews.map(p => (
                <tr key={p.channelId} className="bg-card">
                  <td className="px-4 py-2 font-medium text-foreground">{p.channelName}</td>
                  <td className="px-4 py-2 text-right text-foreground">{fmt(p.target, currency)}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{p.tradingDays}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{fmt(p.dailyAmount, currency)}</td>
                </tr>
              ))}
              <tr className="bg-muted/30 font-semibold">
                <td className="px-4 py-2 text-foreground">Total</td>
                <td className="px-4 py-2 text-right text-foreground">
                  {fmt(previews.reduce((s, p) => s + p.target, 0), currency)}
                </td>
                <td className="px-4 py-2" />
                <td className="px-4 py-2" />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {done && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700 font-medium">
          Forecast generated for {MONTH_NAMES[month - 1]} {year}.
        </div>
      )}

      {genError && (
        <p className="text-sm text-destructive">{genError}</p>
      )}

      {/* Actions */}
      {channels.length > 0 && (
        <div className="flex gap-3">
          <button
            onClick={handlePreview}
            disabled={generating || channels.filter(ch => targetMap.has(ch.id)).length === 0}
            className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            Preview forecast
          </button>
          {previews && !done && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {generating && <Loader2 size={14} className="animate-spin" />}
              {generating ? 'Generating…' : existingCount > 0 ? 'Regenerate forecast' : 'Generate forecast'}
            </button>
          )}
          {done && (
            <button
              onClick={() => { setPreviews(null); setDone(false) }}
              className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-muted"
            >
              Generate another month
            </button>
          )}
        </div>
      )}
    </div>
  )
}
