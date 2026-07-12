import { formatCurrency, formatPercent } from '@/lib/utils'
import type { DashboardData } from '@/lib/dashboardCalcs'

interface Props {
  data: DashboardData
  currency: string
  cutoffDay: number
  daysInMonth: number
}

interface CardProps {
  label: string
  value: string
  sub?: string
  highlight?: 'positive' | 'negative' | 'neutral'
}

function KpiCard({ label, value, sub, highlight }: CardProps) {
  const valueColour =
    highlight === 'positive' ? 'text-green-600'
    : highlight === 'negative' ? 'text-red-600'
    : 'text-foreground'

  return (
    <div className="bg-card border rounded-lg p-4 space-y-1">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold ${valueColour}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

export function KpiCards({ data, currency, cutoffDay, daysInMonth }: Props) {
  const {
    mtdSales, monthlyTarget, proRataTarget, mtdForecast,
    varianceValue, variancePct,
    actualDailyAvg, requiredDailyAvg,
  } = data

  const isPartialMonth = cutoffDay < daysInMonth

  const varianceHighlight: CardProps['highlight'] =
    varianceValue > 0 ? 'positive' : varianceValue < 0 ? 'negative' : 'neutral'

  const paceHighlight: CardProps['highlight'] =
    actualDailyAvg !== null && requiredDailyAvg !== null
      ? actualDailyAvg >= requiredDailyAvg ? 'positive' : 'negative'
      : 'neutral'

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      <KpiCard
        label={isPartialMonth ? `Sales to Day ${cutoffDay}` : 'MTD Sales'}
        value={formatCurrency(mtdSales, currency)}
      />
      <KpiCard
        label={isPartialMonth ? `Target to Day ${cutoffDay}` : 'Monthly Target'}
        value={formatCurrency(isPartialMonth ? proRataTarget : monthlyTarget, currency)}
        sub={isPartialMonth ? `Full month: ${formatCurrency(monthlyTarget, currency)}` : undefined}
      />
      <KpiCard
        label="Variance"
        value={formatCurrency(varianceValue, currency)}
        highlight={varianceHighlight}
      />
      <KpiCard
        label="Variance (%)"
        value={formatPercent(variancePct)}
        sub={`vs forecast to date (${formatCurrency(mtdForecast, currency)})`}
        highlight={varianceHighlight}
      />
      <KpiCard
        label="Actual Daily Avg"
        value={formatCurrency(actualDailyAvg, currency)}
        sub="average per day entered"
      />
      <KpiCard
        label="Required Daily Avg"
        value={formatCurrency(requiredDailyAvg, currency)}
        sub="needed per trading day to hit target"
        highlight={paceHighlight}
      />
    </div>
  )
}
