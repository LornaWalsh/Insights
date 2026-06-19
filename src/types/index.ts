export type UserRole = 'platform_admin' | 'admin' | 'manager' | 'staff'

export type ChannelType = 'online_store' | 'physical_shop' | 'market_popup' | 'wholesale' | 'marketplace'

export interface Organisation {
  id: string
  name: string
  currency: string
  created_at: string
}

export interface Profile {
  id: string
  organisation_id: string | null
  role: UserRole
  full_name: string
  channel_id: string | null
  is_platform_admin: boolean
  created_at: string
}

export interface SalesChannel {
  id: string
  organisation_id: string
  name: string
  channel_type: ChannelType
  trading_days: number[] // 0=Sun, 1=Mon ... 6=Sat
  is_active: boolean
  created_at: string
}

export interface ForecastTarget {
  id: string
  organisation_id: string
  channel_id: string
  year: number
  month: number // 1–12
  target_revenue: number
  created_at: string
}

export interface DailyPerformance {
  id: string
  organisation_id: string
  channel_id: string
  performance_date: string
  sales: number
  orders: number
  aov: number | null
  returns_value: number | null
  returns_count: number | null
  footfall: number | null
  conversion_rate: number | null
  conversion_rate_overridden: boolean
  returning_customers_pct: number | null
  signups: number | null
  discounted_orders: number | null
  facebook_ad_spend: number | null
  google_ad_spend: number | null
  other_ad_spend: number | null
  other_ad_spend_notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}
