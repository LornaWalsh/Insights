import type { SalesChannel } from '@/types'

export interface DailyForecastRow {
  channel_id: string
  forecast_date: string   // YYYY-MM-DD
  forecast_revenue: number
}

export interface ChannelPreview {
  channelId: string
  channelName: string
  target: number
  tradingDays: number
  dailyAmount: number   // average per trading day (display only)
  total: number         // sum of all rows (should equal target)
}

/**
 * Returns all calendar days for the given year/month as YYYY-MM-DD strings.
 */
function daysInMonth(year: number, month: number): string[] {
  const days: string[] = []
  const date = new Date(year, month - 1, 1)
  while (date.getMonth() === month - 1) {
    days.push(date.toISOString().slice(0, 10))
    date.setDate(date.getDate() + 1)
  }
  return days
}

/**
 * Distributes targetPence exactly across tradingDayCount days using integer-cent
 * arithmetic. Returns an array of pence values (length = tradingDayCount).
 */
function distributeExact(targetPence: number, tradingDayCount: number): number[] {
  if (tradingDayCount === 0) return []
  const base = Math.floor(targetPence / tradingDayCount)
  const remainder = targetPence % tradingDayCount
  return Array.from({ length: tradingDayCount }, (_, i) =>
    i < remainder ? base + 1 : base
  )
}

/**
 * Generates daily forecast rows for all channels for a given year/month.
 * Online Store channels trade every calendar day.
 * All other channel types trade only on their trading_days weekdays, minus closed dates.
 */
export function generateForecast(
  year: number,
  month: number,
  channels: SalesChannel[],
  targets: Map<string, number>,         // channelId → target_revenue (£)
  closedDates: Map<string, Set<string>> // channelId → Set<'YYYY-MM-DD'>
): { rows: DailyForecastRow[]; previews: ChannelPreview[] } {
  const allDays = daysInMonth(year, month)
  const rows: DailyForecastRow[] = []
  const previews: ChannelPreview[] = []

  for (const channel of channels) {
    const target = targets.get(channel.id) ?? 0
    const closed = closedDates.get(channel.id) ?? new Set()

    // Determine trading days for this channel
    const isOnline = channel.channel_type === 'online_store'
    const tradingDaysList: string[] = []

    for (const day of allDays) {
      if (closed.has(day)) continue
      if (isOnline) {
        tradingDaysList.push(day)
      } else {
        const dow = new Date(day + 'T12:00:00').getDay() // 0=Sun
        if (channel.trading_days.includes(dow)) {
          tradingDaysList.push(day)
        }
      }
    }

    const targetPence = Math.round(target * 100)
    const amounts = distributeExact(targetPence, tradingDaysList.length)

    // Build rows for all days in month — non-trading days get £0
    const amountByDate = new Map<string, number>()
    tradingDaysList.forEach((d, i) => amountByDate.set(d, amounts[i]))

    for (const day of allDays) {
      rows.push({
        channel_id: channel.id,
        forecast_date: day,
        forecast_revenue: (amountByDate.get(day) ?? 0) / 100,
      })
    }

    const dailyAvg = tradingDaysList.length > 0 ? target / tradingDaysList.length : 0

    previews.push({
      channelId: channel.id,
      channelName: channel.name,
      target,
      tradingDays: tradingDaysList.length,
      dailyAmount: dailyAvg,
      total: amounts.reduce((s, v) => s + v, 0) / 100,
    })
  }

  return { rows, previews }
}
