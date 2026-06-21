export interface ReportDef {
  id: string
  label: string
  group: string
  description: string
  needsLY: boolean        // requires last year data
  needsForecast: boolean  // requires daily_forecasts
  needsTargets: boolean   // requires forecast_targets
}

export const REPORT_GROUPS = ['Core', 'Performance', 'Year-to-Date', 'Operational', 'Marketing'] as const

export const REPORTS: ReportDef[] = [
  // Core
  {
    id: 'daily_actuals',
    label: 'Daily Actuals',
    group: 'Core',
    description: 'All daily performance rows for the selected period — raw data as entered.',
    needsLY: false, needsForecast: false, needsTargets: false,
  },
  {
    id: 'forecast_data',
    label: 'Forecast Data',
    group: 'Core',
    description: 'Monthly revenue targets and generated daily forecast totals per channel.',
    needsLY: false, needsForecast: true, needsTargets: true,
  },
  {
    id: 'actuals_vs_forecast',
    label: 'Actuals vs Forecast',
    group: 'Core',
    description: 'Actual sales alongside forecast by channel and month, with variance £ and %.',
    needsLY: false, needsForecast: true, needsTargets: false,
  },
  // Performance
  {
    id: 'summary_kpis',
    label: 'Summary KPIs',
    group: 'Performance',
    description: 'High-level KPI snapshot per channel for the period: sales, orders, AOV, returns, footfall.',
    needsLY: false, needsForecast: false, needsTargets: false,
  },
  {
    id: 'channel_mtd_performance',
    label: 'Channel MTD Performance',
    group: 'Performance',
    description: 'Month-to-date actuals vs monthly forecast target per channel, with variance.',
    needsLY: false, needsForecast: false, needsTargets: true,
  },
  {
    id: 'channel_mtd_vs_ly',
    label: 'Channel MTD vs Last Year',
    group: 'Performance',
    description: 'MTD actuals this period vs the same period last year per channel.',
    needsLY: true, needsForecast: false, needsTargets: false,
  },
  // Year-to-Date
  {
    id: 'channel_ytd_vs_forecast',
    label: 'Channel YTD vs Forecast',
    group: 'Year-to-Date',
    description: 'Year-to-date actual revenue vs full-year forecast target per channel.',
    needsLY: false, needsForecast: false, needsTargets: true,
  },
  {
    id: 'channel_ytd_vs_ly',
    label: 'Channel YTD vs Last Year',
    group: 'Year-to-Date',
    description: 'Year-to-date actuals this year vs the same period last year per channel.',
    needsLY: true, needsForecast: false, needsTargets: false,
  },
  // Operational
  {
    id: 'ops_mtd_summary',
    label: 'Ops MTD Summary',
    group: 'Operational',
    description: 'Granular month-to-date operational detail per channel: sales, orders, AOV, returns, footfall, conversion.',
    needsLY: false, needsForecast: false, needsTargets: false,
  },
  {
    id: 'context_sales_comparisons',
    label: 'Context Sales Comparisons',
    group: 'Operational',
    description: 'One-row-per-channel executive summary: actual vs forecast and vs last year in a single view.',
    needsLY: true, needsForecast: true, needsTargets: false,
  },
  // Marketing
  {
    id: 'marketing_monthly_spend',
    label: 'Marketing Monthly Spend',
    group: 'Marketing',
    description: 'Monthly Facebook, Google and other ad spend breakdown per channel.',
    needsLY: false, needsForecast: false, needsTargets: false,
  },
  {
    id: 'marketing_monthly_kpis',
    label: 'Marketing Monthly KPIs',
    group: 'Marketing',
    description: 'Monthly ad spend alongside outcome metrics: traffic, conversion, returning customers, signups.',
    needsLY: false, needsForecast: false, needsTargets: false,
  },
  {
    id: 'marketing_headlines',
    label: 'Marketing Headlines',
    group: 'Marketing',
    description: 'Aggregate spend, ROAS, cost per order, blended conversion rate and AOV for the period.',
    needsLY: false, needsForecast: false, needsTargets: false,
  },
]
