import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import type { ChartPoint } from '@/lib/dashboardCalcs'

interface Props {
  data: ChartPoint[]
  currency: string
}

function getCurrencySymbol(currency: string) {
  return (0).toLocaleString('en', { style: 'currency', currency, minimumFractionDigits: 0 }).replace(/\d/g, '').trim()
}

function formatY(value: number, symbol: string) {
  if (value >= 1000) return `${symbol}${(value / 1000).toFixed(1)}k`
  return `${symbol}${value.toFixed(0)}`
}

function formatAxisDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDate()
  const mon = d.toLocaleDateString('en-GB', { month: 'short' })
  return day === 1 ? `1 ${mon}` : String(day)
}

function formatTooltipDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function ActualVsForecastChart({ data, currency }: Props) {
  const symbol = getCurrencySymbol(currency)
  // Show a tick every 5 days to avoid crowding
  const tickDates = data
    .filter(p => p.day === 1 || p.day % 5 === 0)
    .map(p => p.date)

  return (
    <div className="bg-card border rounded-lg p-4">
      <p className="text-sm font-semibold text-foreground mb-4">Actual vs Forecast</p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            ticks={tickDates}
            tickFormatter={formatAxisDate}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={(v) => formatY(v, symbol)}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            formatter={(value, name) => [
              `${symbol}${(value as number).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
              name as string,
            ]}
            labelFormatter={(date) => formatTooltipDate(date as string)}
            contentStyle={{
              fontSize: 12,
              borderRadius: 6,
              border: '1px solid hsl(var(--border))',
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />

          {/* Forecast — solid blue */}
          <Line
            type="monotone"
            dataKey="forecast"
            name="Forecast"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />

          {/* Actual — solid green, gaps where no data */}
          <Line
            type="monotone"
            dataKey="actual"
            name="Actual"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls={false}
          />

          {/* Required daily pace — dashed orange, future only */}
          <Line
            type="monotone"
            dataKey="requiredPace"
            name="Required pace"
            stroke="#f97316"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 3 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
