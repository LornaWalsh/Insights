import { AlertTriangle, ArrowRight, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { MissingDay } from '@/lib/dashboardCalcs'

interface Props {
  missingDays: MissingDay[]
}

const STORAGE_KEY = 'insight_hub_dismissed_alerts'

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function saveDismissed(dismissed: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...dismissed]))
}

function alertKey(day: MissingDay) {
  return `${day.channelId}|${day.date}`
}

export function MissingDataAlert({ missingDays }: Props) {
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed)

  // Persist dismissals to localStorage whenever they change
  useEffect(() => {
    saveDismissed(dismissed)
  }, [dismissed])

  const visible = missingDays.filter(d => !dismissed.has(alertKey(d)))

  if (visible.length === 0) return null

  // Group by channel for display
  const byChannel = new Map<string, { name: string; days: MissingDay[] }>()
  for (const d of visible) {
    if (!byChannel.has(d.channelId)) byChannel.set(d.channelId, { name: d.channelName, days: [] })
    byChannel.get(d.channelId)!.days.push(d)
  }

  function dismiss(day: MissingDay) {
    setDismissed(prev => new Set([...prev, alertKey(day)]))
  }

  function dismissAll() {
    setDismissed(prev => new Set([...prev, ...missingDays.map(alertKey)]))
  }

  function goToInput(day: MissingDay) {
    navigate(`/daily-input?date=${day.date}&channel=${day.channelId}`)
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={15} className="text-amber-600 shrink-0" />
          <p className="text-sm font-semibold text-amber-800">
            Missing data — {visible.length} trading {visible.length === 1 ? 'day' : 'days'} with no entry
          </p>
        </div>
        <button
          onClick={dismissAll}
          className="text-xs text-amber-600 hover:text-amber-800 underline shrink-0"
        >
          Dismiss all
        </button>
      </div>

      {/* Rows grouped by channel */}
      <div className="space-y-3">
        {[...byChannel.values()].map(ch => (
          <div key={ch.name} className="space-y-1">
            <p className="text-xs font-semibold text-amber-700">{ch.name}</p>
            <div className="space-y-1">
              {ch.days.map(day => {
                const date = new Date(day.date + 'T12:00:00')
                const label = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
                return (
                  <div key={day.date} className="flex items-center justify-between gap-2 bg-amber-100/60 rounded px-3 py-1.5">
                    <button
                      onClick={() => goToInput(day)}
                      className="flex items-center gap-2 text-xs text-amber-800 hover:text-amber-900 font-medium group"
                    >
                      <span>{label}</span>
                      <ArrowRight size={12} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                    <button
                      onClick={() => dismiss(day)}
                      aria-label="Dismiss"
                      className="text-amber-500 hover:text-amber-700 shrink-0"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
