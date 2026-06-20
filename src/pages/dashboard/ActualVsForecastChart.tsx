import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import type { ChartPoint } from '@/lib/dashboardCalcs'

interface Props {
  data: ChartPoint[]
  currency: string
}

function formatY(value: number) {
  if (value >= 1000) return `£${(value / 1000).toFixed(1)}k`
  return `£${value.toFixed(0)}`
}

export function ActualVsForecastChart({ data, currency: _currency }: Props) {
  return (
    <div className="bg-card border rounded-lg p-4">
      <p className="text-sm font-semibold text-foreground mb-4">Actual vs Forecast</p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={formatY}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              `£${value.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
              name,
            ]}
            labelFormatter={(day: number) => `Day ${day}`}
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
