import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { today, formatCurrency } from '@/lib/utils'
import { computeDashboard, getDaysInMonth } from '@/lib/dashboardCalcs'
import type { ClosedDate } from '@/lib/dashboardCalcs'
import type { SalesChannel, DailyPerformance, ForecastTarget } from '@/types'
import { KpiCards } from './KpiCards'
import { ProgressBars } from './ProgressBars'
import { ActualVsForecastChart } from './ActualVsForecastChart'
import { MissingDataAlert } from './MissingDataAlert'
import { ChannelBreakdownTable } from './ChannelBreakdownTable'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function DashboardPage() {
  const { profile } = useAuth()
  const orgId = profile?.organisation_id
  const isManager = profile?.role === 'manager'
  const todayStr = today()
  const now = new Date()

  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  // Managers are locked to their channel; admins start with all channels
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    isManager ? (profile?.channel_id ?? null) : null
  )

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
  const canGoNext = !isCurrentMonth // can't navigate into the future

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: org } = useQuery<{ created_at: string }>({
    queryKey: ['org', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organisations')
        .select('created_at')
        .eq('id', orgId!)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })

  // Data start date — missing days are only flagged from this date onwards.
  // Uses org created_at date so clients who sign up mid-month aren't alerted
  // about days before they joined.
  const dataStartDate = org ? org.created_at.split('T')[0] : todayStr

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

  const { data: closedDates = [] } = useQuery<ClosedDate[]>({
    queryKey: ['closedDates', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('channel_closed_dates')
        .select('channel_id, closed_date')
        .eq('organisation_id', orgId!)
      if (error) throw error
      return (data ?? []) as ClosedDate[]
    },
    enabled: !!orgId,
  })

  // First and last day of selected month for date range queries
  const allDays = getDaysInMonth(year, month)
  const firstDay = allDays[0]
  const lastDay = allDays[allDays.length - 1]

  const { data: performance = [], isLoading: perfLoading } = useQuery<DailyPerformance[]>({
    queryKey: ['daily_performance', orgId, year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_performance')
        .select('*')
        .eq('organisation_id', orgId!)
        .gte('performance_date', firstDay)
        .lte('performance_date', lastDay)
      if (error) throw error
      return data ?? []
    },
    enabled: !!orgId,
  })

  const { data: targets = [], isLoading: targetsLoading } = useQuery<ForecastTarget[]>({
    queryKey: ['forecast_targets', orgId, year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forecast_targets')
        .select('*')
        .eq('organisation_id', orgId!)
        .eq('year', year)
        .eq('month', month)
      if (error) throw error
      return data ?? []
    },
    enabled: !!orgId,
  })

  // ── Computation ──────────────────────────────────────────────────────────────

  const dashData = useMemo(() => {
    if (!channels.length || !org) return null
    return computeDashboard(
      year, month, channels, closedDates,
      performance, targets, selectedChannelId, todayStr, dataStartDate
    )
  }, [year, month, channels, closedDates, performance, targets, selectedChannelId, todayStr])

  // Currency comes from org settings — default GBP until Settings page is built
  const currency = 'GBP'

  // ── Progress bar labels ───────────────────────────────────────────────────────
  const daysInMonth = allDays.length
  const dayOfMonth = isCurrentMonth ? now.getDate() : daysInMonth
  const monthLabel = `Day ${dayOfMonth} of ${daysInMonth}`
  const targetLabel = dashData
    ? `${formatCurrency(dashData.mtdSales, currency)} of ${formatCurrency(dashData.monthlyTarget, currency)}`
    : '—'

  const loading = perfLoading || targetsLoading

  if (!orgId) return null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {MONTH_NAMES[month - 1]} {year}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Channel filter — admin only */}
          {!isManager && channels.length > 1 && (
            <select
              value={selectedChannelId ?? ''}
              onChange={e => setSelectedChannelId(e.target.value || null)}
              className="px-3 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Channels</option>
              {channels.map(ch => (
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              ))}
            </select>
          )}

          {/* Month navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium w-28 text-center">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <button
              onClick={nextMonth}
              disabled={canGoNext === false}
              className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}

      {!loading && dashData && (
        <>
          {/* Missing data alert — admin only */}
          {profile?.role === 'admin' && (
            <MissingDataAlert missingDays={dashData.missingDays} />
          )}

          {/* KPI cards */}
          <KpiCards data={dashData} currency={currency} />

          {/* Progress bars */}
          <ProgressBars
            monthProgressPct={dashData.monthProgressPct}
            targetProgressPct={dashData.targetProgressPct}
            monthLabel={monthLabel}
            targetLabel={targetLabel}
          />

          {/* Chart */}
          <ActualVsForecastChart data={dashData.chartData} currency={currency} />

          {/* Channel breakdown — only shown when "All Channels" selected */}
          {!selectedChannelId && (
            <ChannelBreakdownTable rows={dashData.channelBreakdown} currency={currency} />
          )}
        </>
      )}

      {!loading && !dashData && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No channels found. Complete onboarding to get started.
        </div>
      )}
    </div>
  )
}
