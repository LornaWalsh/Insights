import { AlertTriangle, ArrowRight, X, RotateCcw } from 'lucide-react'
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
  const [showDismissed, setShowDismissed] = useState(false)

  useEffect(() => {
    saveDismissed(dismissed)
  }, [dismissed])

  const visible = missingDays.filter(d => !dismissed.has(alertKey(d)))
  const hiddenCount = missingDays.filter(d => dismissed.has(alertKey(d))).length

  if (visible.length === 0 && hiddenCount === 0) return null

  function dismiss(day: MissingDay) {
    setDismissed(prev => new Set([...prev, alertKey(day)]))
  }

  function dismissAll() {
    setDismissed(prev => new Set([...prev, ...missingDays.map(alertKey)]))
  }

  function restoreAll() {
    const keys = new Set(dismissed)
    missingDays.forEach(d => keys.delete(alertKey(d)))
    setDismissed(keys)
    setShowDismissed(false)
  }

  function goToInput(day: MissingDay) {
    navigate(`/daily-input?date=${day.date}&channel=${day.channelId}`)
  }

  // Group visible days by channel
  const byChannel = new Map<string, { name: string; days: MissingDay[] }>()
  for (const d of visible) {
    if (!byChannel.has(d.channelId)) byChannel.set(d.channelId, { name: d.channelName, days: [] })
    byChannel.get(d.channelId)!.days.push(d)
  }

  if (visible.length === 0) {
    // All dismissed — show a subtle restore prompt
    return (
      <div className="flex items-center justify-end">
        <button
          onClick={restoreAll}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw size={11} />
          {hiddenCount} missing {hiddenCount === 1 ? 'day' : 'days'} hidden — restore
        </button>
      </div>
    )
  }

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-amber-50/60">
        <div className="flex items-center gap-2">
          <AlertTriangle size={13} className="text-amber-500 shrink-0" />
          <span className="text-xs font-semibold text-amber-800">
            {visible.length} missing trading {visible.length === 1 ? 'day' : 'days'} — click a date to fill it in
          </span>
        </div>
        <div className="flex items-center gap-3">
          {hiddenCount > 0 && (
            <button
              onClick={() => setShowDismissed(v => !v)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {hiddenCount} hidden
            </button>
          )}
          <button
            onClick={dismissAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Dismiss all
          </button>
        </div>
      </div>

      {/* Missing day rows */}
      <div className="divide-y">
        {[...byChannel.values()].map(ch => (
          <div key={ch.name} className="px-4 py-2 flex items-center gap-3 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground w-24 shrink-0">{ch.name}</span>
            <div className="flex flex-wrap gap-2 flex-1">
              {ch.days.map(day => {
                const date = new Date(day.date + 'T12:00:00')
                const label = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
                return (
                  <button
                    key={day.date}
                    onClick={() => goToInput(day)}
                    className="flex items-center gap-1 text-xs text-primary hover:underline font-medium group"
                  >
                    {label}
                    <ArrowRight size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )
              })}
            </div>
            <div className="flex gap-2 ml-auto">
              {ch.days.map(day => (
                <button
                  key={day.date}
                  onClick={() => dismiss(day)}
                  aria-label="Dismiss"
                  className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  <X size={13} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Restore dismissed */}
      {showDismissed && hiddenCount > 0 && (
        <div className="px-4 py-2 border-t bg-muted/30 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{hiddenCount} dismissed</span>
          <button onClick={restoreAll} className="text-xs text-primary hover:underline">Restore all</button>
        </div>
      )}
    </div>
  )
}
