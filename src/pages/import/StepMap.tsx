import type { ColumnMapping } from './importTypes'
import { FIELD_LABELS, REQUIRED_FIELDS } from './importTypes'

interface Props {
  csvHeaders: string[]
  mapping: ColumnMapping
  onChange: (mapping: ColumnMapping) => void
}

export function StepMap({ csvHeaders, mapping, onChange }: Props) {
  const options = ['', ...csvHeaders]

  function set(field: keyof ColumnMapping, value: string) {
    onChange({ ...mapping, [field]: value })
  }

  const fields = Object.keys(FIELD_LABELS) as (keyof ColumnMapping)[]

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Match each system field to the corresponding column from your CSV.
        Required fields must be mapped before you can continue.
      </p>

      <div className="divide-y border rounded-lg overflow-hidden">
        {fields.map(field => {
          const isRequired = REQUIRED_FIELDS.includes(field)
          const value = mapping[field]
          const missing = isRequired && !value

          return (
            <div key={field} className={`flex items-center gap-4 px-4 py-3 bg-card ${missing ? 'bg-destructive/5' : ''}`}>
              <div className="w-48 shrink-0">
                <span className="text-sm font-medium text-foreground">{FIELD_LABELS[field]}</span>
                {isRequired && <span className="text-destructive ml-1 text-xs">*</span>}
              </div>
              <select
                value={value}
                onChange={e => set(field, e.target.value)}
                className={`flex-1 px-3 py-1.5 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background ${
                  missing ? 'border-destructive' : ''
                }`}
              >
                {options.map(opt => (
                  <option key={opt} value={opt}>{opt || '— not mapped —'}</option>
                ))}
              </select>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        <span className="text-destructive">*</span> Required fields
      </p>
    </div>
  )
}
