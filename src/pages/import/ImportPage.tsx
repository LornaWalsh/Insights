import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { SalesChannel } from '@/types'
import type { ParsedRow, ColumnMapping, ValidatedRow, WizardStep } from './importTypes'
import { REQUIRED_FIELDS } from './importTypes'
import { validateRows } from './importValidation'
import { StepUpload } from './StepUpload'
import { StepMap } from './StepMap'
import { StepValidate } from './StepValidate'
import { StepImport } from './StepImport'

const EMPTY_MAPPING: ColumnMapping = {
  date: '', channel: '', sales: '', orders: '',
  returns_value: '', returns_count: '', footfall: '', conversion_rate: '',
  returning_customers: '', signups: '', discounted_orders: '',
  facebook_ad_spend: '', google_ad_spend: '', other_ad_spend: '', other_ad_spend_notes: '',
}

const STEP_LABELS: Record<WizardStep, string> = {
  upload:   '1. Upload',
  map:      '2. Map columns',
  validate: '3. Validate',
  import:   '4. Import',
}

const STEPS: WizardStep[] = ['upload', 'map', 'validate', 'import']

export default function ImportPage() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const orgId = profile?.organisation_id ?? ''
  const userId = profile?.id ?? ''

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
      return data
    },
    enabled: !!orgId,
  })

  const [step, setStep] = useState<WizardStep>('upload')
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>(EMPTY_MAPPING)
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([])

  function handleParsed(headers: string[], rows: ParsedRow[]) {
    setCsvHeaders(headers)
    setParsedRows(rows)
    // Auto-map headers that exactly match field keys or labels
    const autoMap = { ...EMPTY_MAPPING }
    const keys = Object.keys(EMPTY_MAPPING) as (keyof ColumnMapping)[]
    for (const key of keys) {
      const match = headers.find(h =>
        h.toLowerCase().replace(/[^a-z]/g, '') === key.toLowerCase().replace(/_/g, '')
      )
      if (match) autoMap[key] = match
    }
    setMapping(autoMap)
    setStep('map')
  }

  function canProceedMap() {
    return REQUIRED_FIELDS.every(f => mapping[f])
  }

  function handleValidate() {
    const results = validateRows(parsedRows, mapping, channels)
    setValidatedRows(results)
    setStep('validate')
  }

  function handleImportComplete() {
    queryClient.invalidateQueries({ queryKey: ['daily_performance', orgId] })
    // Reset wizard
    setStep('upload')
    setCsvHeaders([])
    setParsedRows([])
    setMapping(EMPTY_MAPPING)
    setValidatedRows([])
  }

  const currentIdx = STEPS.indexOf(step)

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Import historical data</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a CSV file to bulk-import past performance records. Existing records for the same date and channel will be overwritten.
        </p>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, idx) => {
          const done = idx < currentIdx
          const active = idx === currentIdx
          return (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                active ? 'bg-primary text-primary-foreground' :
                done   ? 'text-primary' : 'text-muted-foreground'
              }`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                  active ? 'bg-primary-foreground text-primary' :
                  done   ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>{idx + 1}</span>
                <span className="hidden sm:inline">{STEP_LABELS[s].slice(3)}</span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 ${done ? 'bg-primary' : 'bg-border'}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Step content */}
      <div className="border rounded-xl bg-card p-6">
        {step === 'upload' && <StepUpload onParsed={handleParsed} />}
        {step === 'map' && (
          <div className="space-y-5">
            <StepMap csvHeaders={csvHeaders} mapping={mapping} onChange={setMapping} />
            <div className="flex gap-3">
              <button onClick={() => setStep('upload')} className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-muted">Back</button>
              <button
                onClick={handleValidate}
                disabled={!canProceedMap()}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                Validate
              </button>
            </div>
          </div>
        )}
        {step === 'validate' && (
          <div className="space-y-5">
            <StepValidate rows={validatedRows} />
            <div className="flex gap-3">
              <button onClick={() => setStep('map')} className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-muted">Back</button>
              {validatedRows.some(r => r.valid) && (
                <button
                  onClick={() => setStep('import')}
                  className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
                >
                  Continue to import
                </button>
              )}
            </div>
          </div>
        )}
        {step === 'import' && (
          <StepImport
            rows={validatedRows}
            organisationId={orgId}
            userId={userId}
            onComplete={handleImportComplete}
          />
        )}
      </div>
    </div>
  )
}
