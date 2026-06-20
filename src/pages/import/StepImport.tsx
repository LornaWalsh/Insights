import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import type { ValidatedRow } from './importTypes'

interface Props {
  rows: ValidatedRow[]
  organisationId: string
  userId: string
  onComplete: () => void
}

interface ImportResult {
  success: number
  skipped: number
  errors: { rowNumber: number; message: string }[]
}

export function StepImport({ rows, organisationId, userId, onComplete }: Props) {
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [progress, setProgress] = useState(0)

  const validRows = rows.filter(r => r.valid)

  async function runImport() {
    setStatus('running')
    setProgress(0)

    const errors: ImportResult['errors'] = []
    let success = 0

    const BATCH = 50
    for (let i = 0; i < validRows.length; i += BATCH) {
      const batch = validRows.slice(i, i + BATCH)

      const records = batch.map(row => ({
        organisation_id: organisationId,
        channel_id: row.channel_id!,
        performance_date: row.performance_date!,
        sales: row.sales!,
        orders: row.orders!,
        returns_value: row.returns_value ?? null,
        returns_count: row.returns_count ?? null,
        footfall: row.footfall ?? null,
        conversion_rate: row.conversion_rate ?? null,
        returning_customers: row.returning_customers ?? null,
        signups: row.signups ?? null,
        discounted_orders: row.discounted_orders ?? null,
        facebook_ad_spend: row.facebook_ad_spend ?? null,
        google_ad_spend: row.google_ad_spend ?? null,
        other_ad_spend: row.other_ad_spend ?? null,
        other_ad_spend_notes: row.other_ad_spend_notes ?? null,
        created_by: userId,
      }))

      const { error } = await supabase
        .from('daily_performance')
        .upsert(records, { onConflict: 'organisation_id,channel_id,performance_date', ignoreDuplicates: false })

      if (error) {
        batch.forEach(row => {
          errors.push({ rowNumber: row.rowNumber, message: error.message })
        })
      } else {
        success += batch.length
      }

      setProgress(Math.round(((i + batch.length) / validRows.length) * 100))
    }

    setResult({ success, skipped: rows.filter(r => !r.valid).length, errors })
    setStatus('done')
  }

  if (status === 'idle') {
    return (
      <div className="space-y-5">
        <div className="bg-muted/40 border rounded-lg px-4 py-4 space-y-2">
          <p className="text-sm font-medium text-foreground">Ready to import</p>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{validRows.length}</span> rows will be upserted.
            Existing records for the same date and channel will be overwritten.
          </p>
          {rows.filter(r => !r.valid).length > 0 && (
            <p className="text-sm text-amber-700">
              {rows.filter(r => !r.valid).length} invalid rows will be skipped.
            </p>
          )}
        </div>
        <button
          onClick={runImport}
          disabled={validRows.length === 0}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          Start import
        </button>
      </div>
    )
  }

  if (status === 'running') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Loader2 size={18} className="animate-spin text-primary" />
          <p className="text-sm text-foreground">Importing… {progress}%</p>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    )
  }

  // done
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-3">
          <CheckCircle size={20} className="text-green-600 shrink-0" />
          <div>
            <p className="text-lg font-bold text-green-700">{result!.success}</p>
            <p className="text-xs text-green-600">rows imported</p>
          </div>
        </div>
        <div className="bg-muted/40 border rounded-lg px-4 py-3 flex items-center gap-3">
          <XCircle size={20} className="text-muted-foreground shrink-0" />
          <div>
            <p className="text-lg font-bold text-muted-foreground">{result!.skipped + result!.errors.length}</p>
            <p className="text-xs text-muted-foreground">rows skipped</p>
          </div>
        </div>
      </div>

      {result!.errors.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-destructive">Import errors</p>
          <div className="border rounded-lg overflow-hidden divide-y max-h-48 overflow-y-auto">
            {result!.errors.slice(0, 20).map((e, i) => (
              <div key={i} className="px-4 py-2">
                <span className="text-xs text-muted-foreground">Row {e.rowNumber}: </span>
                <span className="text-sm text-destructive">{e.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onComplete}
        className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
      >
        Done
      </button>
    </div>
  )
}
