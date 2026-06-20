import { AlertTriangle } from 'lucide-react'
import type { MissingDay } from '@/lib/dashboardCalcs'

interface Props {
  missingDays: MissingDay[]
}

export function MissingDataAlert({ missingDays }: Props) {
  if (missingDays.length === 0) return null

  // Group by channel
  const byChannel: Record<string, { name: string; dates: string[] }> = {}
  for (const m of missingDays) {
    if (!byChannel[m.channelId]) byChannel[m.channelId] = { name: m.channelName, dates: [] }
    byChannel[m.channelId].dates.push(m.date)
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
        <div className="space-y-2 min-w-0">
          <p className="text-sm font-semibold text-amber-800">
            Missing data — {missingDays.length} trading {missingDays.length === 1 ? 'day' : 'days'} with no entry
          </p>
          {Object.values(byChannel).map(ch => (
            <div key={ch.name}>
              <p className="text-xs font-medium text-amber-700">{ch.name}</p>
              <p className="text-xs text-amber-600">
                {ch.dates.map(d => {
                  const date = new Date(d + 'T12:00:00')
                  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                }).join(', ')}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
