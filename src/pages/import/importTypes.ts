export interface ParsedRow {
  rowNumber: number
  raw: Record<string, string>
}

export interface ColumnMapping {
  date: string
  channel: string
  sales: string
  orders: string
  returns_value: string
  returns_count: string
  footfall: string
  conversion_rate: string
  returning_customers: string
  signups: string
  discounted_orders: string
  facebook_ad_spend: string
  google_ad_spend: string
  other_ad_spend: string
  other_ad_spend_notes: string
}

export const REQUIRED_FIELDS: (keyof ColumnMapping)[] = ['date', 'channel', 'sales', 'orders']

export const FIELD_LABELS: Record<keyof ColumnMapping, string> = {
  date:                 'Date',
  channel:              'Channel',
  sales:                'Sales',
  orders:               'Orders',
  returns_value:        'Returns Value',
  returns_count:        'Returns Count',
  footfall:             'Footfall / Sessions',
  conversion_rate:      'Conversion Rate',
  returning_customers:  'Returning Customers',
  signups:              'Signups',
  discounted_orders:    'Discounted Orders',
  facebook_ad_spend:    'Facebook Ad Spend',
  google_ad_spend:      'Google Ad Spend',
  other_ad_spend:       'Other Ad Spend',
  other_ad_spend_notes: 'Other Ad Spend Notes',
}

export interface ValidatedRow {
  rowNumber: number
  raw: Record<string, string>
  valid: boolean
  errors: string[]
  // Parsed values — only populated when valid
  performance_date?: string
  channel_id?: string
  sales?: number
  orders?: number
  returns_value?: number | null
  returns_count?: number | null
  footfall?: number | null
  conversion_rate?: number | null
  returning_customers?: number | null
  signups?: number | null
  discounted_orders?: number | null
  facebook_ad_spend?: number | null
  google_ad_spend?: number | null
  other_ad_spend?: number | null
  other_ad_spend_notes?: string | null
}

export type WizardStep = 'upload' | 'map' | 'validate' | 'import'
