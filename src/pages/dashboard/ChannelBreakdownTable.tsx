import { formatCurrency, formatPercent } from '@/lib/utils'
import type { ChannelRow } from '@/lib/dashboardCalcs'

interface Props {
  rows: ChannelRow[]
  currency: string
}

export function ChannelBreakdownTable({ rows, currency }: Props) {
  if (rows.length === 0) return null

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b">
        <p className="text-sm font-semibold text-foreground">Channel Breakdown</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Channel</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Actual Sales</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Monthly Target</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Variance (£)</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Variance (%)</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Days Recorded</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const varColour = row.varianceValue > 0
                ? 'text-green-600'
                : row.varianceValue < 0 ? 'text-red-600' : 'text-foreground'

              return (
                <tr key={row.channelId} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium text-foreground">{row.channelName}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(row.actualSales, currency)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(row.monthlyTarget, currency)}</td>
                  <td className={`px-4 py-3 text-right font-medium ${varColour}`}>
                    {formatCurrency(row.varianceValue, currency)}
                  </td>
                  <td className={`px-4 py-3 text-right ${varColour}`}>
                    {formatPercent(row.variancePct)}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {row.daysRecorded} of {row.tradingDaysElapsed} trading {row.tradingDaysElapsed === 1 ? 'day' : 'days'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
