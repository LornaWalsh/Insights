import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import type { ValidatedRow } from './importTypes'

interface Props {
  rows: ValidatedRow[]
}

export function StepValidate({ rows }: Props) {
  const validCount = rows.filter(r => r.valid).length
  const errorCount = rows.filter(r => !r.valid).length
  const errorRows = rows.filter(r => !r.valid).slice(0, 30)

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-3">
          <CheckCircle size={20} className="text-green-600 shrink-0" />
          <div>
            <p className="text-lg font-bold text-green-700">{validCount}</p>
            <p className="text-xs text-green-600">rows ready to import</p>
          </div>
        </div>
        <div className={`border rounded-lg px-4 py-3 flex items-center gap-3 ${errorCount > 0 ? 'bg-red-50 border-red-200' : 'bg-muted/40 border-border'}`}>
          <XCircle size={20} className={errorCount > 0 ? 'text-destructive shrink-0' : 'text-muted-foreground shrink-0'} />
          <div>
            <p className={`text-lg font-bold ${errorCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{errorCount}</p>
            <p className={`text-xs ${errorCount > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>rows with errors (will be skipped)</p>
          </div>
        </div>
      </div>

      {validCount === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-amber-700">
          <AlertTriangle size={16} className="shrink-0" />
          No valid rows found. Fix the errors below and re-upload.
        </div>
      )}

      {errorCount > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">
            Errors {errorCount > 30 ? `(showing first 30 of ${errorCount})` : ''}
          </p>
          <div className="border rounded-lg overflow-hidden divide-y">
            {errorRows.map(row => (
              <div key={row.rowNumber} className="px-4 py-3 bg-card">
                <p className="text-xs font-medium text-muted-foreground mb-1">Row {row.rowNumber}</p>
                <ul className="space-y-0.5">
                  {row.errors.map((e, i) => (
                    <li key={i} className="text-sm text-destructive flex items-start gap-1.5">
                      <span className="mt-0.5 shrink-0">·</span>
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Error rows will be skipped. Only valid rows will be imported.
            {validCount > 0 ? ' You can still proceed with the valid rows.' : ''}
          </p>
        </div>
      )}
    </div>
  )
}
