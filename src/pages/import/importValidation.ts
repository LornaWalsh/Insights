import type { ParsedRow, ColumnMapping, ValidatedRow } from './importTypes'
import type { SalesChannel } from '@/types'

// Accepts YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY
export function parseDate(raw: string): string | null {
  const s = raw.trim()

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + 'T12:00:00')
    return isNaN(d.getTime()) ? null : s
  }

  // DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) {
    const [, dd, mm, yyyy] = dmy
    const iso = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
    const d = new Date(iso + 'T12:00:00')
    return isNaN(d.getTime()) ? null : iso
  }

  // MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdy) {
    const [, mm, dd, yyyy] = mdy
    const iso = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
    const d = new Date(iso + 'T12:00:00')
    return isNaN(d.getTime()) ? null : iso
  }

  return null
}

function parsePositiveNumber(raw: string): number | null {
  if (!raw.trim()) return null
  const n = parseFloat(raw.replace(/,/g, ''))
  return isNaN(n) || n < 0 ? null : n
}

function parsePositiveInt(raw: string): number | null {
  if (!raw.trim()) return null
  const n = parseInt(raw.replace(/,/g, ''))
  return isNaN(n) || n < 0 ? null : n
}

function get(row: Record<string, string>, col: string): string {
  return col ? (row[col] ?? '') : ''
}

export function validateRows(
  rows: ParsedRow[],
  mapping: ColumnMapping,
  channels: SalesChannel[]
): ValidatedRow[] {
  // Build case-insensitive channel name lookup
  const channelByName = new Map<string, string>()
  for (const ch of channels) {
    channelByName.set(ch.name.toLowerCase().trim(), ch.id)
  }

  return rows.map(row => {
    const errors: string[] = []

    // Date
    const rawDate = get(row.raw, mapping.date)
    const performance_date = parseDate(rawDate)
    if (!rawDate.trim()) errors.push('Date is missing')
    else if (!performance_date) errors.push(`Date "${rawDate}" is not a recognised format (use YYYY-MM-DD or DD/MM/YYYY)`)

    // Channel
    const rawChannel = get(row.raw, mapping.channel).toLowerCase().trim()
    const channel_id = channelByName.get(rawChannel)
    if (!get(row.raw, mapping.channel).trim()) errors.push('Channel is missing')
    else if (!channel_id) errors.push(`Channel "${get(row.raw, mapping.channel)}" not found — check it matches a channel name exactly`)

    // Sales
    const rawSales = get(row.raw, mapping.sales)
    const sales = parsePositiveNumber(rawSales)
    if (!rawSales.trim()) errors.push('Sales is missing')
    else if (sales === null) errors.push(`Sales "${rawSales}" is not a valid number`)

    // Orders
    const rawOrders = get(row.raw, mapping.orders)
    const orders = parsePositiveInt(rawOrders)
    if (!rawOrders.trim()) errors.push('Orders is missing')
    else if (orders === null) errors.push(`Orders "${rawOrders}" is not a valid whole number`)

    // Optional numeric fields
    const returns_value    = mapping.returns_value    ? parsePositiveNumber(get(row.raw, mapping.returns_value))    : null
    const returns_count    = mapping.returns_count    ? parsePositiveInt(get(row.raw, mapping.returns_count))        : null
    const footfall         = mapping.footfall         ? parsePositiveInt(get(row.raw, mapping.footfall))             : null
    const conversion_rate  = mapping.conversion_rate  ? parsePositiveNumber(get(row.raw, mapping.conversion_rate))  : null
    const returning_customers = mapping.returning_customers ? parsePositiveInt(get(row.raw, mapping.returning_customers)) : null
    const signups          = mapping.signups          ? parsePositiveInt(get(row.raw, mapping.signups))              : null
    const discounted_orders = mapping.discounted_orders ? parsePositiveInt(get(row.raw, mapping.discounted_orders)) : null
    const facebook_ad_spend = mapping.facebook_ad_spend ? parsePositiveNumber(get(row.raw, mapping.facebook_ad_spend)) : null
    const google_ad_spend  = mapping.google_ad_spend  ? parsePositiveNumber(get(row.raw, mapping.google_ad_spend))  : null
    const other_ad_spend   = mapping.other_ad_spend   ? parsePositiveNumber(get(row.raw, mapping.other_ad_spend))   : null
    const other_ad_spend_notes = mapping.other_ad_spend_notes ? get(row.raw, mapping.other_ad_spend_notes) || null : null

    const valid = errors.length === 0

    return {
      rowNumber: row.rowNumber,
      raw: row.raw,
      valid,
      errors,
      ...(valid ? {
        performance_date: performance_date!,
        channel_id: channel_id!,
        sales: sales!,
        orders: orders!,
        returns_value,
        returns_count,
        footfall,
        conversion_rate,
        returning_customers,
        signups,
        discounted_orders,
        facebook_ad_spend,
        google_ad_spend,
        other_ad_spend,
        other_ad_spend_notes,
      } : {}),
    }
  })
}
