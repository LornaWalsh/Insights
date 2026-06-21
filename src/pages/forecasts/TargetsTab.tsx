import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, ChevronRight, Save } from 'lucide-react'
import type { SalesChannel, ForecastTarget } from '@/types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface Props {
  orgId: string
  channels: SalesChannel[]
}

type TargetMap = Record<string, Record<number, string>> // channelId → month(1-12) → string value

function quarter(months: string[]): number {
  const vals = months.map(v => parseFloat(v) || 0)
  return vals.reduce((s, v) => s + v, 0)
}

function fmt(n: number) {
  return n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function TargetsTab({ orgId, channels }: Props) {
  const queryClient = useQueryClient()
  const [year, setYear] = useState(new Date().getFullYear())
  const [targets, setTargets] = useState<TargetMap>({})
  const [saved, setSaved] = useState(false)

  const { data: existingTargets = [] } = useQuery<ForecastTarget[]>({
    queryKey: ['forecast_targets', orgId, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forecast_targets')
        .select('*')
        .eq('organisation_id', orgId)
        .eq('year', year)
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })

  // Populate local state when DB data loads
  useEffect(() => {
    const map: TargetMap = {}
    for (const ch of channels) {
      map[ch.id] = {}
      for (let m = 1; m <= 12; m++) {
        const found = existingTargets.find(t => t.channel_id === ch.id && t.month === m)
        map[ch.id][m] = found ? String(found.target_revenue) : ''
      }
    }
    setTargets(map)
    setSaved(false)
  }, [existingTargets, channels])

  const mutation = useMutation({
    mutationFn: async () => {
      const upserts = []
      for (const ch of channels) {
        for (let m = 1; m <= 12; m++) {
          const raw = targets[ch.id]?.[m] ?? ''
          const val = parseFloat(raw) || 0
          upserts.push({
            organisation_id: orgId,
            channel_id: ch.id,
            year,
            month: m,
            target_revenue: val,
          })
        }
      }
      const { error } = await supabase
        .from('forecast_targets')
        .upsert(upserts, { onConflict: 'organisation_id,channel_id,year,month' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forecast_targets', orgId, year] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  function setVal(channelId: string, month: number, value: string) {
    setTargets(prev => ({
      ...prev,
      [channelId]: { ...prev[channelId], [month]: value },
    }))
    setSaved(false)
  }

  // Business totals per month
  const monthlyBusinessTotals = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    return channels.reduce((s, ch) => s + (parseFloat(targets[ch.id]?.[m] ?? '') || 0), 0)
  })

  return (
    <div className="space-y-5">
      {/* Year navigation */}
      <div className="flex items-center gap-3">
        <button onClick={() => setYear(y => y - 1)} className="p-1.5 rounded-md hover:bg-muted border">
          <ChevronLeft size={16} />
        </button>
        <span className="text-base font-semibold text-foreground w-12 text-center">{year}</span>
        <button onClick={() => setYear(y => y + 1)} className="p-1.5 rounded-md hover:bg-muted border">
          <ChevronRight size={16} />
        </button>
      </div>

      {channels.length === 0 && (
        <p className="text-sm text-muted-foreground">No active channels. Add channels in Settings first.</p>
      )}

      {channels.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap border rounded-tl-md">Channel</th>
                {MONTHS.map(m => (
                  <th key={m} className="px-2 py-2 font-medium text-muted-foreground text-center border min-w-[80px]">{m}</th>
                ))}
                <th className="px-2 py-2 font-medium text-muted-foreground text-center border">Q1</th>
                <th className="px-2 py-2 font-medium text-muted-foreground text-center border">Q2</th>
                <th className="px-2 py-2 font-medium text-muted-foreground text-center border">Q3</th>
                <th className="px-2 py-2 font-medium text-muted-foreground text-center border">Q4</th>
                <th className="px-2 py-2 font-medium text-muted-foreground text-center border rounded-tr-md">Annual</th>
              </tr>
            </thead>
            <tbody>
              {channels.map(ch => {
                const vals = Array.from({ length: 12 }, (_, i) => targets[ch.id]?.[i + 1] ?? '')
                const nums = vals.map(v => parseFloat(v) || 0)
                const q1 = quarter(vals.slice(0, 3))
                const q2 = quarter(vals.slice(3, 6))
                const q3 = quarter(vals.slice(6, 9))
                const q4 = quarter(vals.slice(9, 12))
                const annual = nums.reduce((s, v) => s + v, 0)

                return (
                  <tr key={ch.id} className="hover:bg-muted/20 border-b">
                    <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap border-x">{ch.name}</td>
                    {vals.map((val, i) => (
                      <td key={i} className="px-1 py-1 border-x">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={val}
                          onChange={e => setVal(ch.id, i + 1, e.target.value)}
                          onFocus={e => e.target.select()}
                          placeholder="0"
                          className="w-full px-2 py-1 text-right text-sm border rounded focus:outline-none focus:ring-1 focus:ring-ring bg-background [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-2 text-right text-muted-foreground border-x">{fmt(q1)}</td>
                    <td className="px-2 py-2 text-right text-muted-foreground border-x">{fmt(q2)}</td>
                    <td className="px-2 py-2 text-right text-muted-foreground border-x">{fmt(q3)}</td>
                    <td className="px-2 py-2 text-right text-muted-foreground border-x">{fmt(q4)}</td>
                    <td className="px-2 py-2 text-right font-semibold text-foreground border-x">{fmt(annual)}</td>
                  </tr>
                )
              })}
              {/* Business totals row */}
              <tr className="bg-muted/40 font-semibold border-t-2">
                <td className="px-3 py-2 text-foreground border-x">Business total</td>
                {monthlyBusinessTotals.map((t, i) => (
                  <td key={i} className="px-2 py-2 text-right text-foreground border-x">{fmt(t)}</td>
                ))}
                <td className="px-2 py-2 text-right text-foreground border-x">
                  {fmt(monthlyBusinessTotals.slice(0, 3).reduce((s, v) => s + v, 0))}
                </td>
                <td className="px-2 py-2 text-right text-foreground border-x">
                  {fmt(monthlyBusinessTotals.slice(3, 6).reduce((s, v) => s + v, 0))}
                </td>
                <td className="px-2 py-2 text-right text-foreground border-x">
                  {fmt(monthlyBusinessTotals.slice(6, 9).reduce((s, v) => s + v, 0))}
                </td>
                <td className="px-2 py-2 text-right text-foreground border-x">
                  {fmt(monthlyBusinessTotals.slice(9, 12).reduce((s, v) => s + v, 0))}
                </td>
                <td className="px-2 py-2 text-right text-foreground border-x">
                  {fmt(monthlyBusinessTotals.reduce((s, v) => s + v, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {channels.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            <Save size={14} />
            {mutation.isPending ? 'Saving…' : 'Save targets'}
          </button>
          {saved && <span className="text-sm text-green-600">Saved</span>}
          {mutation.isError && (
            <span className="text-sm text-destructive">Failed to save — try again</span>
          )}
        </div>
      )}
    </div>
  )
}
