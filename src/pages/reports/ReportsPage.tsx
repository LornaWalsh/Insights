import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Download, Clock } from 'lucide-react'
import type { SalesChannel, DailyPerformance, ForecastTarget } from '@/types'
import { REPORTS, REPORT_GROUPS, type ReportDef } from './reportTypes'
import {
  generateDailyActuals, generateForecastData, generateActualsVsForecast,
  generateSummaryKPIs, generateChannelMTDPerformance, generateChannelMTDvsLY,
  generateChannelYTDvsForecast, generateChannelYTDvsLY,
  generateOpsMTDSummary, generateContextSalesComparisons,
  generateMarketingMonthlySpend, generateMarketingMonthlyKPIs,
  generateMarketingHeadlines, downloadCSV,
} from './reportGenerators'

interface DailyForecastRow { channel_id: string; forecast_date: string; forecast_revenue: number }
interface ExportLog { id: string; report_type: string; date_from: string; date_to: string; channel_count: number; exported_at: string }

function today() { return new Date().toISOString().slice(0, 10) }
function monthStart() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }
function fmtDateTime(iso: string) { return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }

export default function ReportsPage() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const orgId = profile?.organisation_id ?? ''
  const userId = profile?.id ?? ''
  const isManager = profile?.role === 'manager'
  const managerChannelId = profile?.channel_id ?? null

  const [reportId, setReportId] = useState(REPORTS[0].id)
  const [dateFrom, setDateFrom] = useState(monthStart())
  const [dateTo, setDateTo] = useState(today())
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set())
  const [allChannels, setAllChannels] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const report = REPORTS.find(r => r.id === reportId)!

  const { data: channels = [] } = useQuery<SalesChannel[]>({
    queryKey: ['channels', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_channels')
        .select('*')
        .eq('organisation_id', orgId)
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      // Default: all selected (admin), or locked to manager's channel
      const ids = isManager && managerChannelId
        ? [managerChannelId]
        : data.map((c: SalesChannel) => c.id)
      setSelectedChannels(new Set(ids))
      return data
    },
    enabled: !!orgId,
  })

  const { data: exportLogs = [] } = useQuery<ExportLog[]>({
    queryKey: ['export_logs', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('export_logs')
        .select('id, report_type, date_from, date_to, channel_count, exported_at')
        .eq('organisation_id', orgId)
        .order('exported_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })

  function toggleChannel(id: string) {
    const next = new Set(selectedChannels)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelectedChannels(next)
    setAllChannels(next.size === channels.length)
  }

  function toggleAll() {
    if (allChannels) {
      setSelectedChannels(new Set())
      setAllChannels(false)
    } else {
      setSelectedChannels(new Set(channels.map(c => c.id)))
      setAllChannels(true)
    }
  }

  const channelIds = isManager && managerChannelId
    ? [managerChannelId]
    : allChannels ? channels.map(c => c.id) : [...selectedChannels]

  async function handleDownload() {
    if (channelIds.length === 0) { setError('Select at least one channel.'); return }
    setError('')
    setLoading(true)

    try {
      // Always fetch actuals for the date range + selected channels
      const { data: actuals, error: actErr } = await supabase
        .from('daily_performance')
        .select('*')
        .eq('organisation_id', orgId)
        .gte('performance_date', dateFrom)
        .lte('performance_date', dateTo)
        .in('channel_id', channelIds)
        .order('performance_date')
      if (actErr) throw actErr
      const rows = (actuals ?? []) as DailyPerformance[]

      // Date range for LY queries
      const lyFrom = `${parseInt(dateFrom) - 1}${dateFrom.slice(4)}`
      const lyTo   = `${parseInt(dateTo) - 1}${dateTo.slice(4)}`

      const year  = parseInt(dateFrom.slice(0, 4))
      const month = parseInt(dateFrom.slice(5, 7))

      // Conditional fetches
      let lyRows: DailyPerformance[] = []
      if (report.needsLY) {
        const { data: ly, error: lyErr } = await supabase
          .from('daily_performance')
          .select('*')
          .eq('organisation_id', orgId)
          .gte('performance_date', lyFrom)
          .lte('performance_date', lyTo)
          .in('channel_id', channelIds)
        if (lyErr) throw lyErr
        lyRows = (ly ?? []) as DailyPerformance[]
      }

      let dailyForecasts: DailyForecastRow[] = []
      if (report.needsForecast) {
        const { data: fc, error: fcErr } = await supabase
          .from('daily_forecasts')
          .select('channel_id, forecast_date, forecast_revenue')
          .eq('organisation_id', orgId)
          .gte('forecast_date', dateFrom)
          .lte('forecast_date', dateTo)
          .in('channel_id', channelIds)
        if (fcErr) throw fcErr
        dailyForecasts = (fc ?? []) as DailyForecastRow[]
      }

      let targets: ForecastTarget[] = []
      if (report.needsTargets) {
        const { data: tg, error: tgErr } = await supabase
          .from('forecast_targets')
          .select('*')
          .eq('organisation_id', orgId)
          .in('channel_id', channelIds)
        if (tgErr) throw tgErr
        targets = (tg ?? []) as ForecastTarget[]
      }

      const filteredChannels = channels.filter(c => channelIds.includes(c.id))
      const filename = `${reportId}_${dateFrom}_${dateTo}.csv`

      let csv = ''
      switch (reportId) {
        case 'daily_actuals':             csv = generateDailyActuals(rows, filteredChannels); break
        case 'forecast_data':             csv = generateForecastData(filteredChannels, targets, dailyForecasts); break
        case 'actuals_vs_forecast':       csv = generateActualsVsForecast(rows, filteredChannels, dailyForecasts); break
        case 'summary_kpis':              csv = generateSummaryKPIs(rows, filteredChannels); break
        case 'channel_mtd_performance':   csv = generateChannelMTDPerformance(rows, filteredChannels, targets, year, month); break
        case 'channel_mtd_vs_ly':         csv = generateChannelMTDvsLY(rows, lyRows, filteredChannels); break
        case 'channel_ytd_vs_forecast':   csv = generateChannelYTDvsForecast(rows, filteredChannels, targets, year); break
        case 'channel_ytd_vs_ly':         csv = generateChannelYTDvsLY(rows, lyRows, filteredChannels); break
        case 'ops_mtd_summary':           csv = generateOpsMTDSummary(rows, filteredChannels); break
        case 'context_sales_comparisons': csv = generateContextSalesComparisons(rows, lyRows, filteredChannels, dailyForecasts); break
        case 'marketing_monthly_spend':   csv = generateMarketingMonthlySpend(rows, filteredChannels); break
        case 'marketing_monthly_kpis':    csv = generateMarketingMonthlyKPIs(rows, filteredChannels); break
        case 'marketing_headlines':       csv = generateMarketingHeadlines(rows); break
      }

      downloadCSV(csv, filename)

      // Log the export
      await supabase.from('export_logs').insert({
        organisation_id: orgId,
        user_id: userId,
        report_type: report.label,
        date_from: dateFrom,
        date_to: dateTo,
        channel_count: channelIds.length,
      })
      queryClient.invalidateQueries({ queryKey: ['export_logs', orgId] })

    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">Generate and download CSV exports for your data.</p>
      </div>

      <div className="border rounded-xl bg-card p-6 space-y-5">
        {/* Report selector */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Report type</label>
          <select
            value={reportId}
            onChange={e => setReportId(e.target.value)}
            className="w-full px-3 py-2 rounded-md border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {REPORT_GROUPS.map(group => {
              const groupReports = REPORTS.filter(r => r.group === group)
              if (!groupReports.length) return null
              return (
                <optgroup key={group} label={group}>
                  {groupReports.map(r => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </optgroup>
              )
            })}
          </select>
          <p className="text-xs text-muted-foreground">{report.description}</p>
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-md border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full px-3 py-2 rounded-md border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Channel selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Channels</label>
          {isManager ? (
            <input
              type="text"
              readOnly
              value={channels.find(c => c.id === managerChannelId)?.name ?? '…'}
              className="w-full px-3 py-2 rounded-md border bg-muted text-sm text-muted-foreground cursor-not-allowed"
            />
          ) : (
            <div className="border rounded-lg overflow-hidden divide-y">
              <label className="flex items-center gap-3 px-4 py-2.5 bg-muted/40 cursor-pointer hover:bg-muted/60">
                <input type="checkbox" checked={allChannels} onChange={toggleAll} className="rounded" />
                <span className="text-sm font-medium text-foreground">All channels</span>
              </label>
              {channels.map(ch => (
                <label key={ch.id} className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-muted/30 bg-card">
                  <input
                    type="checkbox"
                    checked={selectedChannels.has(ch.id)}
                    onChange={() => toggleChannel(ch.id)}
                    className="rounded"
                  />
                  <span className="text-sm text-foreground">{ch.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto capitalize">{ch.channel_type.replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          onClick={handleDownload}
          disabled={loading || channelIds.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          <Download size={15} />
          {loading ? 'Generating…' : 'Download CSV'}
        </button>
      </div>

      {/* Export history */}
      {exportLogs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Clock size={14} />
            Export history
          </div>
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Report</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Date range</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Channels</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Exported</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {exportLogs.map(log => (
                  <tr key={log.id} className="bg-card">
                    <td className="px-4 py-2 text-foreground">{log.report_type}</td>
                    <td className="px-4 py-2 text-muted-foreground">{fmtDate(log.date_from)} – {fmtDate(log.date_to)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{log.channel_count}</td>
                    <td className="px-4 py-2 text-muted-foreground">{fmtDateTime(log.exported_at)}</td>
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
