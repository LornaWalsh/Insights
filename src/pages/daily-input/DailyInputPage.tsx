import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { today, formatCurrency } from '@/lib/utils'
import type { SalesChannel, DailyPerformance } from '@/types'
import { DailyInputForm } from './DailyInputForm'

export default function DailyInputPage() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const orgId = profile?.organisation_id
  const isStaff = profile?.role === 'staff'
  const canEdit = profile?.role === 'admin' || profile?.role === 'manager'
  const todayStr = today()
  const [searchParams] = useSearchParams()

  const urlDate = searchParams.get('date')
  const urlChannel = searchParams.get('channel')

  const [selectedDate, setSelectedDate] = useState(urlDate ?? todayStr)
  const [selectedChannelId, setSelectedChannelId] = useState<string>(
    urlChannel ?? profile?.channel_id ?? ''
  )

  // ── Channels ────────────────────────────────────────────────────────────────
  const { data: channels = [] } = useQuery<SalesChannel[]>({
    queryKey: ['channels', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_channels')
        .select('*')
        .eq('organisation_id', orgId!)
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data ?? []
    },
    enabled: !!orgId,
  })

  // Set default channel once channels load — skip if URL param or profile already set it
  useEffect(() => {
    if (!selectedChannelId && channels.length > 0) {
      setSelectedChannelId(channels[0].id)
    }
  }, [channels]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Existing record for selected date + channel ─────────────────────────────
  const { data: existingRecord = null } = useQuery<DailyPerformance | null>({
    queryKey: ['daily_performance_single', orgId, selectedDate, selectedChannelId],
    queryFn: async () => {
      const { data } = await supabase
        .from('daily_performance')
        .select('*')
        .eq('organisation_id', orgId!)
        .eq('channel_id', selectedChannelId)
        .eq('performance_date', selectedDate)
        .maybeSingle()
      return data ?? null
    },
    enabled: !!orgId && !!selectedChannelId,
  })

  // ── Recent history (last 30 days for selected channel) ──────────────────────
  const { data: history = [] } = useQuery<DailyPerformance[]>({
    queryKey: ['daily_performance_history', orgId, selectedChannelId],
    queryFn: async () => {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const fromDate = thirtyDaysAgo.toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('daily_performance')
        .select('id, performance_date, sales, orders, aov')
        .eq('organisation_id', orgId!)
        .eq('channel_id', selectedChannelId)
        .gte('performance_date', fromDate)
        .order('performance_date', { ascending: false })
      if (error) throw error
      return (data ?? []) as DailyPerformance[]
    },
    enabled: !!orgId && !!selectedChannelId,
  })

  function handleSaved() {
    // Invalidate queries so dashboard and history both refresh
    queryClient.invalidateQueries({ queryKey: ['daily_performance_single', orgId, selectedDate, selectedChannelId] })
    queryClient.invalidateQueries({ queryKey: ['daily_performance_history', orgId, selectedChannelId] })
    queryClient.invalidateQueries({ queryKey: ['daily_performance', orgId] })
  }

  const selectedChannel = channels.find(c => c.id === selectedChannelId)

  // Staff viewing an existing record they cannot amend
  const isReadOnly = isStaff && existingRecord !== null

  if (!orgId) return null

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Daily Input</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Enter your trading data for a specific day.</p>
      </div>

      {/* Date + Channel selector */}
      <div className="bg-card border rounded-lg p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Date</label>
            <input
              type="date"
              value={selectedDate}
              max={todayStr}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Channel</label>
            {isStaff || (channels.length === 1) ? (
              // Staff or single channel — show locked field
              <input
                type="text"
                readOnly
                value={selectedChannel?.name ?? '…'}
                className="w-full px-3 py-2 rounded-md border bg-muted text-sm text-muted-foreground cursor-not-allowed"
              />
            ) : (
              <select
                value={selectedChannelId}
                onChange={e => setSelectedChannelId(e.target.value)}
                className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {channels.map(ch => (
                  <option key={ch.id} value={ch.id}>{ch.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Form — only render once a channel is selected */}
      {selectedChannelId && (
        <DailyInputForm
          organisationId={orgId}
          channelId={selectedChannelId}
          performanceDate={selectedDate}
          existing={existingRecord}
          isReadOnly={isReadOnly}
          onSaved={handleSaved}
        />
      )}

      {/* Recent entries */}
      {history.length > 0 && (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b">
            <p className="text-sm font-semibold text-foreground">Recent entries — {selectedChannel?.name}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Date</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Sales</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Orders</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">AOV</th>
                  {canEdit && <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground"></th>}
                </tr>
              </thead>
              <tbody>
                {history.map(row => (
                  <tr
                    key={row.id}
                    className={`border-b last:border-0 ${canEdit ? 'hover:bg-muted/20 cursor-pointer' : ''} ${row.performance_date === selectedDate ? 'bg-primary/5' : ''}`}
                    onClick={() => canEdit && setSelectedDate(row.performance_date)}
                  >
                    <td className="px-4 py-2.5 text-foreground">
                      {new Date(row.performance_date + 'T12:00:00').toLocaleDateString('en-GB', {
                        weekday: 'short', day: 'numeric', month: 'short'
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(row.sales)}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{row.orders}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{formatCurrency(row.aov)}</td>
                    {canEdit && (
                      <td className="px-4 py-2.5 text-right text-xs text-primary">
                        {row.performance_date === selectedDate ? 'Selected' : 'Edit'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
