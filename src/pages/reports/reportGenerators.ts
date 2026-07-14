import type { DailyPerformance, SalesChannel, ForecastTarget } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

function row(...cells: (string | number | null | undefined)[]): string {
  return cells.map(esc).join(',')
}

function toCSV(header: string[], rows: (string | number | null | undefined)[][]): string {
  return [header.join(','), ...rows.map(r => row(...r))].join('\r\n')
}

function pct(a: number, b: number): string {
  if (b === 0) return ''
  return ((a / b) * 100).toFixed(2)
}

function variance(actual: number, forecast: number) {
  const vGBP = actual - forecast
  const vPct = forecast !== 0 ? ((actual - forecast) / forecast) * 100 : null
  return { vGBP, vPct: vPct !== null ? parseFloat(vPct.toFixed(2)) : null }
}

// Group performance rows by channel then by YYYY-MM key
function byChannelMonth(rows: DailyPerformance[]) {
  const map = new Map<string, Map<string, DailyPerformance[]>>()
  for (const r of rows) {
    if (!map.has(r.channel_id)) map.set(r.channel_id, new Map())
    const ym = r.performance_date.slice(0, 7)
    const inner = map.get(r.channel_id)!
    if (!inner.has(ym)) inner.set(ym, [])
    inner.get(ym)!.push(r)
  }
  return map
}

function sumField(rows: DailyPerformance[], field: keyof DailyPerformance): number {
  return rows.reduce((s, r) => s + (Number(r[field]) || 0), 0)
}

function avgField(rows: DailyPerformance[], field: keyof DailyPerformance): number {
  const vals = rows.map(r => Number(r[field])).filter(v => !isNaN(v) && v !== 0)
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
}

function channelName(channelId: string, channels: SalesChannel[]): string {
  return channels.find(c => c.id === channelId)?.name ?? channelId
}

// ── 1. Daily Actuals ──────────────────────────────────────────────────────────
export function generateDailyActuals(rows: DailyPerformance[], channels: SalesChannel[]): string {
  const header = [
    'Date', 'Channel', 'Sales', 'Orders', 'AOV',
    'Returns Value', 'Returns Count', 'Returns Rate %',
    'Footfall', 'Conversion Rate', 'Returning Customers', 'Signups',
    'Discounted Orders', 'Discounted Value', 'Facebook Ad Spend', 'Google Ad Spend',
    'Other Ad Spend', 'Other Ad Spend Notes',
  ]
  const data = rows.map(r => {
    const returnsRate = r.sales > 0 ? pct(r.returns_value ?? 0, r.sales) : ''
    return [
      r.performance_date,
      channelName(r.channel_id, channels),
      r.sales, r.orders, r.aov,
      r.returns_value, r.returns_count, returnsRate,
      r.footfall, r.conversion_rate,
      r.returning_customers, r.signups, r.discounted_orders, r.discounted_value,
      r.facebook_ad_spend, r.google_ad_spend,
      r.other_ad_spend, r.other_ad_spend_notes,
    ]
  })
  return toCSV(header, data)
}

// ── 2. Forecast Data ──────────────────────────────────────────────────────────
interface DailyForecastRow { channel_id: string; forecast_date: string; forecast_revenue: number }

export function generateForecastData(
  channels: SalesChannel[],
  targets: ForecastTarget[],
  dailyForecasts: DailyForecastRow[],
): string {
  const header = ['Year', 'Month', 'Channel', 'Monthly Target', 'Forecast Days Generated', 'Total Forecast Revenue']

  // Group daily forecasts by channel + year-month
  const fcMap = new Map<string, number>()
  const fcDaysMap = new Map<string, number>()
  for (const f of dailyForecasts) {
    const ym = f.forecast_date.slice(0, 7)
    const key = `${f.channel_id}|${ym}`
    fcMap.set(key, (fcMap.get(key) ?? 0) + f.forecast_revenue)
    if (f.forecast_revenue > 0) fcDaysMap.set(key, (fcDaysMap.get(key) ?? 0) + 1)
  }

  const data = targets.map(t => {
    const ym = `${t.year}-${String(t.month).padStart(2, '0')}`
    const key = `${t.channel_id}|${ym}`
    return [
      t.year,
      String(t.month).padStart(2, '0'),
      channelName(t.channel_id, channels),
      t.target_revenue,
      fcDaysMap.get(key) ?? 0,
      (fcMap.get(key) ?? 0).toFixed(2),
    ]
  })

  return toCSV(header, data)
}

// ── 3. Actuals vs Forecast ────────────────────────────────────────────────────
export function generateActualsVsForecast(
  rows: DailyPerformance[],
  channels: SalesChannel[],
  dailyForecasts: DailyForecastRow[],
): string {
  const header = [
    'Year', 'Month', 'Channel',
    'Actual Sales', 'Forecast Revenue', 'Variance', 'Variance %',
  ]

  // Aggregate actuals by channel+month
  const actualMap = new Map<string, number>()
  for (const r of rows) {
    const key = `${r.channel_id}|${r.performance_date.slice(0, 7)}`
    actualMap.set(key, (actualMap.get(key) ?? 0) + r.sales)
  }

  // Aggregate forecasts by channel+month
  const fcMap = new Map<string, number>()
  for (const f of dailyForecasts) {
    const key = `${f.channel_id}|${f.forecast_date.slice(0, 7)}`
    fcMap.set(key, (fcMap.get(key) ?? 0) + f.forecast_revenue)
  }

  // Union all keys
  const allKeys = new Set([...actualMap.keys(), ...fcMap.keys()])
  const sortedKeys = [...allKeys].sort()

  const data = sortedKeys.map(key => {
    const [channelId, ym] = key.split('|')
    const [yr, mo] = ym.split('-')
    const actual = actualMap.get(key) ?? 0
    const forecast = fcMap.get(key) ?? 0
    const { vGBP, vPct } = variance(actual, forecast)
    return [yr, mo, channelName(channelId, channels), actual.toFixed(2), forecast.toFixed(2), vGBP.toFixed(2), vPct]
  })

  return toCSV(header, data)
}

// ── 4. Summary KPIs ───────────────────────────────────────────────────────────
export function generateSummaryKPIs(rows: DailyPerformance[], channels: SalesChannel[]): string {
  const header = [
    'Channel', 'Total Sales', 'Total Orders', 'AOV',
    'Total Returns Value', 'Returns Rate %', 'Total Footfall', 'Avg Conversion Rate %',
    'Total Returning Customers', 'Total Signups', 'Total Discounted Orders', 'Total Discounted Value',
  ]

  const byChannel = new Map<string, DailyPerformance[]>()
  for (const r of rows) {
    if (!byChannel.has(r.channel_id)) byChannel.set(r.channel_id, [])
    byChannel.get(r.channel_id)!.push(r)
  }

  const data = [...byChannel.entries()].map(([channelId, ch]) => {
    const sales = sumField(ch, 'sales')
    const orders = sumField(ch, 'orders')
    const aov = orders > 0 ? sales / orders : 0
    const returns = sumField(ch, 'returns_value')
    const returnsRate = sales > 0 ? pct(returns, sales) : ''
    return [
      channelName(channelId, channels),
      sales.toFixed(2), orders, aov.toFixed(2),
      returns.toFixed(2), returnsRate,
      sumField(ch, 'footfall'),
      avgField(ch, 'conversion_rate').toFixed(4),
      sumField(ch, 'returning_customers'),
      sumField(ch, 'signups'),
      sumField(ch, 'discounted_orders'),
      sumField(ch, 'discounted_value'),
    ]
  })

  return toCSV(header, data)
}

// ── 5. Channel MTD Performance ────────────────────────────────────────────────
export function generateChannelMTDPerformance(
  rows: DailyPerformance[],
  channels: SalesChannel[],
  targets: ForecastTarget[],
  year: number,
  month: number,
): string {
  const header = [
    'Channel', 'Actual Sales MTD', 'Monthly Target', 'Variance', 'Variance %',
    'Trading Days Recorded', 'Total Orders', 'AOV',
  ]

  const byChannel = new Map<string, DailyPerformance[]>()
  for (const r of rows) {
    if (!byChannel.has(r.channel_id)) byChannel.set(r.channel_id, [])
    byChannel.get(r.channel_id)!.push(r)
  }

  const data = channels.map(ch => {
    const chRows = byChannel.get(ch.id) ?? []
    const sales = sumField(chRows, 'sales')
    const orders = sumField(chRows, 'orders')
    const aov = orders > 0 ? sales / orders : 0
    const target = targets.find(t => t.channel_id === ch.id && t.year === year && t.month === month)
    const targetRev = target?.target_revenue ?? 0
    const { vGBP, vPct } = variance(sales, targetRev)
    return [
      ch.name, sales.toFixed(2), targetRev.toFixed(2),
      vGBP.toFixed(2), vPct,
      chRows.length, orders, aov.toFixed(2),
    ]
  })

  return toCSV(header, data)
}

// ── 6. Channel MTD vs Last Year ───────────────────────────────────────────────
export function generateChannelMTDvsLY(
  rows: DailyPerformance[],
  lyRows: DailyPerformance[],
  channels: SalesChannel[],
): string {
  const header = [
    'Channel', 'Actual Sales This Period', 'Actual Sales Same Period LY',
    'Variance', 'Variance %',
  ]

  const byChannel = (data: DailyPerformance[]) => {
    const m = new Map<string, number>()
    for (const r of data) m.set(r.channel_id, (m.get(r.channel_id) ?? 0) + r.sales)
    return m
  }

  const current = byChannel(rows)
  const ly = byChannel(lyRows)

  const data = channels.map(ch => {
    const cur = current.get(ch.id) ?? 0
    const last = ly.get(ch.id) ?? 0
    const { vGBP, vPct } = variance(cur, last)
    return [ch.name, cur.toFixed(2), last.toFixed(2), vGBP.toFixed(2), vPct]
  })

  return toCSV(header, data)
}

// ── 7. Channel YTD vs Forecast ────────────────────────────────────────────────
export function generateChannelYTDvsForecast(
  rows: DailyPerformance[],
  channels: SalesChannel[],
  targets: ForecastTarget[],
  year: number,
): string {
  const header = [
    'Channel', 'YTD Actual Sales', 'Full Year Forecast Target', 'YTD Forecast Target',
    'YTD Variance', 'YTD Variance %',
  ]

  // YTD = sum of monthly targets up to and including the latest month in rows
  const latestMonth = rows.reduce((max, r) => {
    const m = parseInt(r.performance_date.slice(5, 7))
    return m > max ? m : max
  }, 0)

  const byChannel = new Map<string, number>()
  for (const r of rows) byChannel.set(r.channel_id, (byChannel.get(r.channel_id) ?? 0) + r.sales)

  const data = channels.map(ch => {
    const actual = byChannel.get(ch.id) ?? 0
    const fullYearTarget = targets
      .filter(t => t.channel_id === ch.id && t.year === year)
      .reduce((s, t) => s + t.target_revenue, 0)
    const ytdTarget = targets
      .filter(t => t.channel_id === ch.id && t.year === year && t.month <= latestMonth)
      .reduce((s, t) => s + t.target_revenue, 0)
    const { vGBP, vPct } = variance(actual, ytdTarget)
    return [ch.name, actual.toFixed(2), fullYearTarget.toFixed(2), ytdTarget.toFixed(2), vGBP.toFixed(2), vPct]
  })

  return toCSV(header, data)
}

// ── 8. Channel YTD vs Last Year ───────────────────────────────────────────────
export function generateChannelYTDvsLY(
  rows: DailyPerformance[],
  lyRows: DailyPerformance[],
  channels: SalesChannel[],
): string {
  const header = [
    'Channel', 'YTD Actual This Year', 'YTD Actual Last Year',
    'Variance', 'Variance %',
  ]

  const sumByChannel = (data: DailyPerformance[]) => {
    const m = new Map<string, number>()
    for (const r of data) m.set(r.channel_id, (m.get(r.channel_id) ?? 0) + r.sales)
    return m
  }

  const current = sumByChannel(rows)
  const ly = sumByChannel(lyRows)

  const data = channels.map(ch => {
    const cur = current.get(ch.id) ?? 0
    const last = ly.get(ch.id) ?? 0
    const { vGBP, vPct } = variance(cur, last)
    return [ch.name, cur.toFixed(2), last.toFixed(2), vGBP.toFixed(2), vPct]
  })

  return toCSV(header, data)
}

// ── 9. Ops MTD Summary ────────────────────────────────────────────────────────
export function generateOpsMTDSummary(rows: DailyPerformance[], channels: SalesChannel[]): string {
  const header = [
    'Channel', 'Sales', 'Orders', 'AOV',
    'Returns Value', 'Returns Count', 'Returns Rate %',
    'Total Footfall', 'Avg Conversion Rate %',
    'Total Returning Customers', 'Total Signups', 'Total Discounted Orders', 'Total Discounted Value',
  ]

  const byChannel = new Map<string, DailyPerformance[]>()
  for (const r of rows) {
    if (!byChannel.has(r.channel_id)) byChannel.set(r.channel_id, [])
    byChannel.get(r.channel_id)!.push(r)
  }

  const data = channels.map(ch => {
    const chRows = byChannel.get(ch.id) ?? []
    const sales = sumField(chRows, 'sales')
    const orders = sumField(chRows, 'orders')
    const aov = orders > 0 ? sales / orders : 0
    const returns = sumField(chRows, 'returns_value')
    const returnsRate = sales > 0 ? pct(returns, sales) : ''
    return [
      ch.name, sales.toFixed(2), orders, aov.toFixed(2),
      returns.toFixed(2), sumField(chRows, 'returns_count'), returnsRate,
      sumField(chRows, 'footfall'),
      avgField(chRows, 'conversion_rate').toFixed(4),
      sumField(chRows, 'returning_customers'),
      sumField(chRows, 'signups'),
      sumField(chRows, 'discounted_orders'),
      sumField(chRows, 'discounted_value'),
    ]
  })

  return toCSV(header, data)
}

// ── 10. Context Sales Comparisons ─────────────────────────────────────────────
export function generateContextSalesComparisons(
  rows: DailyPerformance[],
  lyRows: DailyPerformance[],
  channels: SalesChannel[],
  dailyForecasts: DailyForecastRow[],
): string {
  const header = [
    'Channel',
    'Actual Sales', 'Forecast Sales', 'vs Forecast £', 'vs Forecast %',
    'Last Year Sales', 'vs Last Year £', 'vs Last Year %',
  ]

  const sumByChannel = (data: DailyPerformance[]) => {
    const m = new Map<string, number>()
    for (const r of data) m.set(r.channel_id, (m.get(r.channel_id) ?? 0) + r.sales)
    return m
  }

  const current = sumByChannel(rows)
  const ly = sumByChannel(lyRows)

  const fcByChannel = new Map<string, number>()
  for (const f of dailyForecasts) {
    fcByChannel.set(f.channel_id, (fcByChannel.get(f.channel_id) ?? 0) + f.forecast_revenue)
  }

  const data = channels.map(ch => {
    const actual = current.get(ch.id) ?? 0
    const forecast = fcByChannel.get(ch.id) ?? 0
    const last = ly.get(ch.id) ?? 0
    const vsFc = variance(actual, forecast)
    const vsLY = variance(actual, last)
    return [
      ch.name,
      actual.toFixed(2), forecast.toFixed(2), vsFc.vGBP.toFixed(2), vsFc.vPct,
      last.toFixed(2), vsLY.vGBP.toFixed(2), vsLY.vPct,
    ]
  })

  return toCSV(header, data)
}

// ── 11. Marketing Monthly Spend ───────────────────────────────────────────────
export function generateMarketingMonthlySpend(rows: DailyPerformance[], channels: SalesChannel[]): string {
  const header = [
    'Year', 'Month', 'Channel',
    'Facebook Ad Spend', 'Google Ad Spend', 'Other Ad Spend', 'Total Ad Spend',
  ]

  const grouped = byChannelMonth(rows)
  const data: (string | number | null)[][] = []

  for (const [channelId, months] of [...grouped.entries()].sort()) {
    for (const [ym, chRows] of [...months.entries()].sort()) {
      const [yr, mo] = ym.split('-')
      const fb = sumField(chRows, 'facebook_ad_spend')
      const gg = sumField(chRows, 'google_ad_spend')
      const ot = sumField(chRows, 'other_ad_spend')
      data.push([yr, mo, channelName(channelId, channels), fb.toFixed(2), gg.toFixed(2), ot.toFixed(2), (fb + gg + ot).toFixed(2)])
    }
  }

  return toCSV(header, data)
}

// ── 12. Marketing Monthly KPIs ────────────────────────────────────────────────
export function generateMarketingMonthlyKPIs(rows: DailyPerformance[], channels: SalesChannel[]): string {
  const header = [
    'Year', 'Month', 'Channel',
    'Facebook Ad Spend', 'Google Ad Spend', 'Other Ad Spend', 'Total Ad Spend',
    'Traffic / Footfall', 'Avg Conversion Rate %',
    'Returning Customers', 'Signups', 'Discounted Orders', 'Discounted Value',
  ]

  const grouped = byChannelMonth(rows)
  const data: (string | number | null)[][] = []

  for (const [channelId, months] of [...grouped.entries()].sort()) {
    for (const [ym, chRows] of [...months.entries()].sort()) {
      const [yr, mo] = ym.split('-')
      const fb = sumField(chRows, 'facebook_ad_spend')
      const gg = sumField(chRows, 'google_ad_spend')
      const ot = sumField(chRows, 'other_ad_spend')
      data.push([
        yr, mo, channelName(channelId, channels),
        fb.toFixed(2), gg.toFixed(2), ot.toFixed(2), (fb + gg + ot).toFixed(2),
        sumField(chRows, 'footfall'),
        avgField(chRows, 'conversion_rate').toFixed(4),
        sumField(chRows, 'returning_customers'),
        sumField(chRows, 'signups'),
        sumField(chRows, 'discounted_orders'),
        sumField(chRows, 'discounted_value'),
      ])
    }
  }

  return toCSV(header, data)
}

// ── 13. Marketing Headlines ───────────────────────────────────────────────────
export function generateMarketingHeadlines(rows: DailyPerformance[]): string {
  const header = [
    'Total Facebook Ad Spend', 'Total Google Ad Spend', 'Total Other Ad Spend', 'Total Ad Spend',
    'Total Sales', 'ROAS', 'Total Orders', 'Cost per Order',
    'Total Traffic / Footfall', 'Blended Conversion Rate %', 'Overall AOV',
  ]

  const fb = sumField(rows, 'facebook_ad_spend')
  const gg = sumField(rows, 'google_ad_spend')
  const ot = sumField(rows, 'other_ad_spend')
  const totalSpend = fb + gg + ot
  const sales = sumField(rows, 'sales')
  const orders = sumField(rows, 'orders')
  const roas = totalSpend > 0 ? (sales / totalSpend).toFixed(2) : ''
  const costPerOrder = orders > 0 && totalSpend > 0 ? (totalSpend / orders).toFixed(2) : ''
  const aov = orders > 0 ? (sales / orders).toFixed(2) : ''
  const footfall = sumField(rows, 'footfall')
  const convRates = rows.map(r => Number(r.conversion_rate)).filter(v => v > 0)
  const blendedConv = convRates.length ? (convRates.reduce((s, v) => s + v, 0) / convRates.length).toFixed(4) : ''

  return toCSV(header, [[
    fb.toFixed(2), gg.toFixed(2), ot.toFixed(2), totalSpend.toFixed(2),
    sales.toFixed(2), roas, orders, costPerOrder,
    footfall, blendedConv, aov,
  ]])
}

// ── Download trigger ──────────────────────────────────────────────────────────
export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
