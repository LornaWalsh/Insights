interface Props {
  monthProgressPct: number
  targetProgressPct: number
  monthLabel: string // e.g. "Day 14 of 30"
  targetLabel: string // e.g. "£8,400 of £20,000"
}

function Bar({ pct, colour }: { pct: number; colour: string }) {
  return (
    <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${colour}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  )
}

export function ProgressBars({ monthProgressPct, targetProgressPct, monthLabel, targetLabel }: Props) {
  const behind = targetProgressPct < monthProgressPct - 5 // >5% behind counts as behind

  return (
    <div className="bg-card border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
        <span className="font-medium text-foreground">Progress</span>
        {behind && (
          <span className="text-amber-600 font-medium">Behind pace</span>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Month</span>
          <span>{monthLabel} — {monthProgressPct.toFixed(0)}%</span>
        </div>
        <Bar pct={monthProgressPct} colour="bg-blue-400" />
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Target</span>
          <span>{targetLabel} — {targetProgressPct.toFixed(0)}%</span>
        </div>
        <Bar pct={targetProgressPct} colour={behind ? 'bg-amber-400' : 'bg-green-500'} />
      </div>
    </div>
  )
}
