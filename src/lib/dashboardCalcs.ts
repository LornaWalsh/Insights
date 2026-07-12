import type { SalesChannel, DailyPerformance, ForecastTarget } from '@/types'

export interface ClosedDate {
  channel_id: string
  closed_date: string // YYYY-MM-DD
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns all calendar days in a month as YYYY-MM-DD strings */
export function getDaysInMonth(year: number, month: number): string[] {
  const days: string[] = []
  const d = new Date(year, month - 1, 1)
  while (d.getMonth() === month - 1) {
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    days.push(`${d.getFullYear()}-${mm}-${dd}`)
    d.setDate(d.getDate() + 1)
  }
  return days
}

// Online store and marketplace forecast spreads across every calendar day.
// Physical shop, market/pop-up, wholesale spread across trading days only.
const CALENDAR_DAY_TYPES: SalesChannel['channel_type'][] = ['online_store', 'marketplace']

function isTradingDay(dateStr: string, ch: SalesChannel, closed: ClosedDate[]): boolean {
  const dow = new Date(dateStr + 'T12:00:00').getDay() // T12 avoids DST edge cases
  if (!ch.trading_days.includes(dow)) return false
  return !closed.some(c => c.channel_id === ch.id && c.closed_date === dateStr)
}

function countTradingDays(days: string[], ch: SalesChannel, closed: ClosedDate[]): number {
  return days.filter(d => isTradingDay(d, ch, closed)).length
}

/** Daily forecast allocation for one channel on one specific day */
function dailyForecastForChannel(
  dateStr: string,
  ch: SalesChannel,
  monthlyTarget: number,
  allDays: string[],
  closed: ClosedDate[]
): number {
  if (monthlyTarget === 0) return 0
  if (CALENDAR_DAY_TYPES.includes(ch.channel_type)) {
    return monthlyTarget / allDays.length
  }
  const td = countTradingDays(allDays, ch, closed)
  if (td === 0 || !isTradingDay(dateStr, ch, closed)) return 0
  return monthlyTarget / td
}

// ── Output types ──────────────────────────────────────────────────────────────

export interface ChartPoint {
  day: number           // 1–31
  date: string          // YYYY-MM-DD — used for tooltip and axis labels
  forecast: number      // cumulative forecast to this day
  actual: number | null // cumulative actual (null = gap — no data entered)
  requiredPace: number | null // straight line from today's actual to monthly target
}

export interface ChannelRow {
  channelId: string
  channelName: string
  actualSales: number
  monthlyTarget: number
  varianceValue: number
  variancePct: number | null
  daysRecorded: number
  tradingDaysElapsed: number
}

export interface MissingDay {
  channelId: string
  channelName: string
  date: string // YYYY-MM-DD
}

export interface DashboardData {
  // KPI cards
  mtdSales: number
  monthlyTarget: number
  proRataTarget: number  // monthly target scaled to elapsedCount / daysInMonth
  mtdForecast: number
  varianceValue: number
  variancePct: number | null
  actualDailyAvg: number | null
  requiredDailyAvg: number | null
  // Progress bars
  monthProgressPct: number
  targetProgressPct: number
  // Chart
  chartData: ChartPoint[]
  // Alert
  missingDays: MissingDay[]
  // Table
  channelBreakdown: ChannelRow[]
}

// ── Main computation ──────────────────────────────────────────────────────────

export function computeDashboard(
  year: number,
  month: number,
  channels: SalesChannel[],         // active channels for the org (or just selected one)
  closedDates: ClosedDate[],
  performance: DailyPerformance[],  // all rows for this month (all channels)
  targets: ForecastTarget[],        // all rows for this year/month (all channels)
  selectedChannelId: string | null, // null = all channels
  todayStr: string,                 // YYYY-MM-DD — actual today, used for pace line
  dataStartDate: string,            // YYYY-MM-DD — org created_at date, missing days not flagged before this
  cutoffDate?: string               // YYYY-MM-DD — if set, MTD calculations cut off at this date instead of today
): DashboardData {
  const allDays = getDaysInMonth(year, month)
  const todayIdx = allDays.indexOf(todayStr)
  const isCurrentMonth = todayIdx >= 0

  // Use cutoffDate for MTD window if provided; otherwise fall back to today
  const effectiveCutoff = cutoffDate ?? todayStr
  const cutoffIdx = allDays.indexOf(effectiveCutoff)

  // Days up to and including the cutoff (or all days for past months)
  const elapsedCount = cutoffIdx >= 0 ? cutoffIdx + 1 : allDays.length
  const elapsedDays = allDays.slice(0, elapsedCount)

  // Active channels for the selected filter
  const activeChannels = selectedChannelId
    ? channels.filter(c => c.id === selectedChannelId)
    : channels

  // Monthly target per channel
  const targetByChannel: Record<string, number> = {}
  for (const t of targets) {
    targetByChannel[t.channel_id] = (targetByChannel[t.channel_id] ?? 0) + t.target_revenue
  }

  // Performance lookup: "channelId|date" → sales
  const perfMap: Record<string, number> = {}
  for (const p of performance) {
    if (p.performance_date <= effectiveCutoff) { // guard against future-dated entries
      perfMap[`${p.channel_id}|${p.performance_date}`] = p.sales
    }
  }

  // ── Chart data ──────────────────────────────────────────────────────────────
  let cumulativeForecast = 0
  let cumulativeActual = 0
  const chartData: ChartPoint[] = []

  for (const dateStr of allDays) {
    const dayNum = parseInt(dateStr.split('-')[2])
    const isPastOrToday = dateStr <= effectiveCutoff

    // Cumulative forecast for this day
    for (const ch of activeChannels) {
      cumulativeForecast += dailyForecastForChannel(
        dateStr, ch, targetByChannel[ch.id] ?? 0, allDays, closedDates
      )
    }

    if (isPastOrToday) {
      // Sum sales across all active channels for this day
      let dayActual: number | null = null
      for (const ch of activeChannels) {
        const val = perfMap[`${ch.id}|${dateStr}`]
        if (val !== undefined) dayActual = (dayActual ?? 0) + val
      }
      if (dayActual !== null) cumulativeActual += dayActual
      chartData.push({
        day: dayNum,
        date: dateStr,
        forecast: cumulativeForecast,
        actual: dayActual !== null ? cumulativeActual : null,
        requiredPace: null,
      })
    } else {
      chartData.push({ day: dayNum, date: dateStr, forecast: cumulativeForecast, actual: null, requiredPace: null })
    }
  }

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const mtdSales = cumulativeActual
  const monthlyTarget = activeChannels.reduce((sum, ch) => sum + (targetByChannel[ch.id] ?? 0), 0)
  const proRataTarget = allDays.length > 0 ? (monthlyTarget * elapsedCount) / allDays.length : 0
  const mtdForecast = elapsedCount > 0 ? (chartData[elapsedCount - 1]?.forecast ?? 0) : 0

  const varianceValue = mtdSales - mtdForecast
  const variancePct = mtdForecast !== 0 ? (varianceValue / mtdForecast) * 100 : null

  const daysWithEntries = elapsedDays.filter(d =>
    activeChannels.some(ch => perfMap[`${ch.id}|${d}`] !== undefined)
  ).length

  const actualDailyAvg = daysWithEntries > 0 ? mtdSales / daysWithEntries : null

  // Remaining trading days after today (current month only)
  let remainingTradingDays = 0
  if (isCurrentMonth) {
    const futureDays = allDays.slice(elapsedCount)
    for (const dateStr of futureDays) {
      const opensOnThisDay = activeChannels.some(ch => isTradingDay(dateStr, ch, closedDates))
      if (opensOnThisDay) remainingTradingDays++
    }
  }
  const requiredDailyAvg =
    isCurrentMonth && remainingTradingDays > 0 && mtdSales < monthlyTarget
      ? (monthlyTarget - mtdSales) / remainingTradingDays
      : null

  // ── Required pace line ───────────────────────────────────────────────────────
  // Straight line from today's cumulative actual to monthlyTarget at end of month
  if (isCurrentMonth && mtdSales < monthlyTarget && monthlyTarget > 0) {
    const remainingDays = allDays.length - elapsedCount
    const revenueNeeded = monthlyTarget - mtdSales
    // Anchor at today
    if (elapsedCount > 0) chartData[elapsedCount - 1].requiredPace = mtdSales
    // Project forward
    for (let i = elapsedCount; i < allDays.length; i++) {
      const daysFromToday = i - elapsedCount + 1
      chartData[i].requiredPace = remainingDays > 0
        ? mtdSales + (revenueNeeded * daysFromToday / remainingDays)
        : monthlyTarget
    }
  }

  // ── Progress bars ────────────────────────────────────────────────────────────
  const monthProgressPct = isCurrentMonth
    ? (elapsedCount / allDays.length) * 100
    : 100
  const targetProgressPct = monthlyTarget > 0
    ? Math.min((mtdSales / monthlyTarget) * 100, 100)
    : 0

  // ── Missing days alert (admin only — caller decides whether to render) ───────
  const missingDays: MissingDay[] = []
  for (const ch of activeChannels) {
    for (const dateStr of elapsedDays) {
      if (dateStr >= todayStr) continue // don't flag today
      if (dateStr < dataStartDate) continue // don't flag days before org was created
      if (!isTradingDay(dateStr, ch, closedDates)) continue
      if (perfMap[`${ch.id}|${dateStr}`] === undefined) {
        missingDays.push({ channelId: ch.id, channelName: ch.name, date: dateStr })
      }
    }
  }

  // ── Channel breakdown table ──────────────────────────────────────────────────
  const channelBreakdown: ChannelRow[] = activeChannels.map(ch => {
    const target = targetByChannel[ch.id] ?? 0
    const actual = elapsedDays.reduce(
      (sum, d) => sum + (perfMap[`${ch.id}|${d}`] ?? 0), 0
    )
    let chForecastToDate = 0
    for (const d of elapsedDays) {
      chForecastToDate += dailyForecastForChannel(d, ch, target, allDays, closedDates)
    }
    const chVariance = actual - chForecastToDate
    const chVariancePct = chForecastToDate !== 0 ? (chVariance / chForecastToDate) * 100 : null
    const daysRecorded = elapsedDays.filter(d => perfMap[`${ch.id}|${d}`] !== undefined).length
    const tradingDaysElapsed = countTradingDays(elapsedDays, ch, closedDates)

    return {
      channelId: ch.id,
      channelName: ch.name,
      actualSales: actual,
      monthlyTarget: target,
      varianceValue: chVariance,
      variancePct: chVariancePct,
      daysRecorded,
      tradingDaysElapsed,
    }
  })

  return {
    mtdSales,
    monthlyTarget,
    proRataTarget,
    mtdForecast,
    varianceValue,
    variancePct,
    actualDailyAvg,
    requiredDailyAvg,
    monthProgressPct,
    targetProgressPct,
    chartData,
    missingDays,
    channelBreakdown,
  }
}
