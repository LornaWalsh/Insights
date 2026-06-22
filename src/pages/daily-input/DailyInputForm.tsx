import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrency } from '@/lib/utils'
import type { DailyPerformance } from '@/types'

interface Props {
  organisationId: string
  channelId: string
  performanceDate: string
  existing: DailyPerformance | null
  isReadOnly: boolean // staff viewing existing record
  onSaved: () => void
  currency: string
}

function getCurrencySymbol(currency: string) {
  return (0).toLocaleString('en', { style: 'currency', currency, minimumFractionDigits: 0 }).replace(/\d/g, '').trim()
}

interface FormState {
  sales: string
  orders: string
  returns_value: string
  returns_count: string
  footfall: string
  conversion_rate: string
  conversion_rate_overridden: boolean
  returning_customers: string
  signups: string
  discounted_orders: string
  facebook_ad_spend: string
  google_ad_spend: string
  other_ad_spend: string
  other_ad_spend_notes: string
}

function toStr(val: number | null | undefined): string {
  return val != null ? String(val) : ''
}

function initForm(existing: DailyPerformance | null): FormState {
  if (!existing) {
    return {
      sales: '', orders: '', returns_value: '', returns_count: '',
      footfall: '', conversion_rate: '', conversion_rate_overridden: false,
      returning_customers: '', signups: '', discounted_orders: '',
      facebook_ad_spend: '', google_ad_spend: '', other_ad_spend: '',
      other_ad_spend_notes: '',
    }
  }
  return {
    sales: toStr(existing.sales),
    orders: toStr(existing.orders),
    returns_value: toStr(existing.returns_value),
    returns_count: toStr(existing.returns_count),
    footfall: toStr(existing.footfall),
    conversion_rate: toStr(existing.conversion_rate),
    conversion_rate_overridden: existing.conversion_rate_overridden,
    returning_customers: toStr(existing.returning_customers),
    signups: toStr(existing.signups),
    discounted_orders: toStr(existing.discounted_orders),
    facebook_ad_spend: toStr(existing.facebook_ad_spend),
    google_ad_spend: toStr(existing.google_ad_spend),
    other_ad_spend: toStr(existing.other_ad_spend),
    other_ad_spend_notes: existing.other_ad_spend_notes ?? '',
  }
}

function numericInput(
  label: string,
  field: keyof FormState,
  form: FormState,
  setForm: React.Dispatch<React.SetStateAction<FormState>>,
  opts: { prefix?: string; suffix?: string; step?: string; readOnly?: boolean; required?: boolean }
) {
  const { prefix, suffix, step = '0.01', readOnly = false, required = false } = opts
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-foreground">
        {label}{required && <span className="text-destructive ml-1">*</span>}
      </label>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-sm text-muted-foreground">{prefix}</span>}
        <input
          type="number"
          min="0"
          step={step}
          value={form[field] as string}
          readOnly={readOnly}
          onChange={e => !readOnly && setForm(f => ({ ...f, [field]: e.target.value }))}
          className={`w-full px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-ring ${
            readOnly ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-background'
          }`}
          placeholder="0"
        />
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border rounded-lg p-4 space-y-4">
      <p className="text-sm font-semibold text-foreground border-b pb-2">{title}</p>
      {children}
    </div>
  )
}

export function DailyInputForm({ organisationId, channelId, performanceDate, existing, isReadOnly, onSaved, currency }: Props) {
  const { profile } = useAuth()
  const currencySymbol = getCurrencySymbol(currency)
  const [form, setForm] = useState<FormState>(() => initForm(existing))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Re-initialise form when the record or date/channel changes
  useEffect(() => {
    setForm(initForm(existing))
    setError('')
  }, [existing, channelId, performanceDate])

  // ── Auto-calculations ──────────────────────────────────────────────────────
  const salesNum = parseFloat(form.sales)
  const ordersNum = parseInt(form.orders)
  const footfallNum = parseFloat(form.footfall)

  const aov = !isNaN(salesNum) && !isNaN(ordersNum) && ordersNum > 0
    ? salesNum / ordersNum
    : null

  // Recalculate conversion rate when orders/footfall change, unless overridden
  useEffect(() => {
    if (form.conversion_rate_overridden) return
    if (!isNaN(ordersNum) && !isNaN(footfallNum) && footfallNum > 0) {
      const calc = (ordersNum / footfallNum) * 100
      setForm(f => ({ ...f, conversion_rate: calc.toFixed(2) }))
    } else {
      setForm(f => ({ ...f, conversion_rate: '' }))
    }
  }, [form.orders, form.footfall, form.conversion_rate_overridden])

  function handleConversionRateChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(f => ({
      ...f,
      conversion_rate: e.target.value,
      conversion_rate_overridden: e.target.value !== '',
    }))
  }

  function resetConversionRate() {
    setForm(f => ({ ...f, conversion_rate_overridden: false }))
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.sales.trim()) { setError('Sales is required.'); return }
    if (!form.orders.trim()) { setError('Orders is required.'); return }

    const salesVal = parseFloat(form.sales)
    const ordersVal = parseInt(form.orders)

    if (isNaN(salesVal) || salesVal < 0) { setError('Sales must be a valid positive number.'); return }
    if (isNaN(ordersVal) || ordersVal < 0) { setError('Orders must be a valid positive number.'); return }

    setSaving(true)

    const row = {
      organisation_id: organisationId,
      channel_id: channelId,
      performance_date: performanceDate,
      sales: salesVal,
      orders: ordersVal,
      aov: aov,
      returns_value: form.returns_value !== '' ? parseFloat(form.returns_value) : null,
      returns_count: form.returns_count !== '' ? parseInt(form.returns_count) : null,
      footfall: form.footfall !== '' ? parseFloat(form.footfall) : null,
      conversion_rate: form.conversion_rate !== '' ? parseFloat(form.conversion_rate) : null,
      conversion_rate_overridden: form.conversion_rate_overridden,
      returning_customers: form.returning_customers !== '' ? parseInt(form.returning_customers) : null,
      signups: form.signups !== '' ? parseInt(form.signups) : null,
      discounted_orders: form.discounted_orders !== '' ? parseInt(form.discounted_orders) : null,
      facebook_ad_spend: form.facebook_ad_spend !== '' ? parseFloat(form.facebook_ad_spend) : null,
      google_ad_spend: form.google_ad_spend !== '' ? parseFloat(form.google_ad_spend) : null,
      other_ad_spend: form.other_ad_spend !== '' ? parseFloat(form.other_ad_spend) : null,
      other_ad_spend_notes: form.other_ad_spend_notes || null,
    }

    let err
    if (existing) {
      ;({ error: err } = await supabase
        .from('daily_performance')
        .update(row)
        .eq('id', existing.id))
    } else {
      ;({ error: err } = await supabase
        .from('daily_performance')
        .insert({ ...row, created_by: profile!.id }))
    }

    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  if (isReadOnly && existing) {
    return (
      <div className="bg-card border rounded-lg p-4 space-y-2">
        <p className="text-sm font-semibold text-foreground">Entry for {performanceDate}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div><p className="text-muted-foreground text-xs">Sales</p><p className="font-medium">{formatCurrency(existing.sales)}</p></div>
          <div><p className="text-muted-foreground text-xs">Orders</p><p className="font-medium">{existing.orders}</p></div>
          <div><p className="text-muted-foreground text-xs">AOV</p><p className="font-medium">{formatCurrency(existing.aov)}</p></div>
          {existing.footfall != null && <div><p className="text-muted-foreground text-xs">Footfall</p><p className="font-medium">{existing.footfall}</p></div>}
          {existing.conversion_rate != null && <div><p className="text-muted-foreground text-xs">Conversion</p><p className="font-medium">{existing.conversion_rate.toFixed(1)}%</p></div>}
          {existing.returns_value != null && <div><p className="text-muted-foreground text-xs">Returns</p><p className="font-medium">{formatCurrency(existing.returns_value)}</p></div>}
        </div>
        <p className="text-xs text-muted-foreground pt-1">Contact your admin to amend this entry.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {existing && (
        <p className="text-xs text-amber-600 font-medium bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Updating existing entry for {performanceDate}
        </p>
      )}

      {/* Core Trading */}
      <SectionCard title="Core Trading">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {numericInput('Sales', 'sales', form, setForm, { prefix: currencySymbol, step: '0.01', required: true })}
          {numericInput('Orders', 'orders', form, setForm, { step: '1', required: true })}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">AOV <span className="text-xs text-muted-foreground font-normal">(auto)</span></label>
            <input
              type="text"
              readOnly
              value={aov != null ? formatCurrency(aov) : '—'}
              className="w-full px-3 py-2 rounded-md border bg-muted text-sm text-muted-foreground cursor-not-allowed"
            />
          </div>
        </div>
      </SectionCard>

      {/* Returns */}
      <SectionCard title="Returns (optional)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {numericInput('Returns value', 'returns_value', form, setForm, { prefix: currencySymbol })}
          {numericInput('Returns count', 'returns_count', form, setForm, { step: '1' })}
        </div>
      </SectionCard>

      {/* Traffic & Conversion */}
      <SectionCard title="Traffic & Conversion (optional)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {numericInput('Footfall / Sessions', 'footfall', form, setForm, { step: '1' })}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                Conversion rate <span className="text-xs text-muted-foreground font-normal">{form.conversion_rate_overridden ? '(manual)' : '(auto)'}</span>
              </label>
              {form.conversion_rate_overridden && (
                <button type="button" onClick={resetConversionRate} className="text-xs text-primary hover:underline">
                  Reset to auto
                </button>
              )}
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.conversion_rate}
                onChange={handleConversionRateChange}
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Engagement */}
      <SectionCard title="Engagement (optional)">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {numericInput('Returning customers', 'returning_customers', form, setForm, { step: '1' })}
          {numericInput('New signups', 'signups', form, setForm, { step: '1' })}
          {numericInput('Discounted orders', 'discounted_orders', form, setForm, { step: '1' })}
        </div>
      </SectionCard>

      {/* Ad Spend */}
      <SectionCard title="Ad Spend (optional)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {numericInput('Facebook / Meta', 'facebook_ad_spend', form, setForm, { prefix: currencySymbol })}
          {numericInput('Google', 'google_ad_spend', form, setForm, { prefix: currencySymbol })}
          {numericInput('Other', 'other_ad_spend', form, setForm, { prefix: currencySymbol })}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Other ad spend notes</label>
            <input
              type="text"
              value={form.other_ad_spend_notes}
              onChange={e => setForm(f => ({ ...f, other_ad_spend_notes: e.target.value }))}
              placeholder="e.g. TikTok, influencer"
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </SectionCard>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : existing ? 'Update entry' : 'Save entry'}
        </button>
      </div>
    </form>
  )
}
