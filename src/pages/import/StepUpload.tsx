import { useRef, useState } from 'react'
import Papa from 'papaparse'
import { Upload, Download, FileText } from 'lucide-react'
import type { ParsedRow } from './importTypes'

interface Props {
  onParsed: (headers: string[], rows: ParsedRow[]) => void
}

export function StepUpload({ onParsed }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')

  function processFile(file: File) {
    setError('')
    if (!file.name.endsWith('.csv')) {
      setError('Only CSV files are accepted.')
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('File must be under 15MB.')
      return
    }

    setFileName(file.name)

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results) => {
        const headers = results.meta.fields ?? []
        if (headers.length === 0) {
          setError('Could not read headers. Make sure the file has a header row.')
          return
        }
        const rows: ParsedRow[] = results.data.map((raw, i) => ({
          rowNumber: i + 2, // +2 because row 1 is header
          raw,
        }))
        if (rows.length === 0) {
          setError('The file contains no data rows.')
          return
        }
        onParsed(headers, rows)
      },
      error: (err) => {
        setError(`Could not parse file: ${err.message}`)
      },
    })
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  return (
    <div className="space-y-6">
      {/* Template download */}
      <div className="flex items-center justify-between bg-muted/50 border rounded-lg px-4 py-3">
        <div>
          <p className="text-sm font-medium text-foreground">Not sure of the format?</p>
          <p className="text-xs text-muted-foreground mt-0.5">Download our template with the correct headers and an example row.</p>
        </div>
        <a
          href="/import-template.csv"
          download="insight-hub-import-template.csv"
          className="flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium hover:bg-muted transition-colors shrink-0"
        >
          <Download size={14} />
          Download template
        </a>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
          dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary hover:bg-muted/30'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileInput}
        />
        {fileName ? (
          <div className="space-y-2">
            <FileText size={32} className="mx-auto text-primary" />
            <p className="text-sm font-medium text-foreground">{fileName}</p>
            <p className="text-xs text-muted-foreground">Click to choose a different file</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload size={32} className="mx-auto text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Drop your CSV here or click to browse</p>
            <p className="text-xs text-muted-foreground">CSV files only · Max 15MB · Must have a header row</p>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Expected format */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Required columns</p>
        <div className="flex flex-wrap gap-2">
          {['Date', 'Channel', 'Sales', 'Orders'].map(f => (
            <span key={f} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-medium">{f}</span>
          ))}
        </div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-3">Optional columns</p>
        <div className="flex flex-wrap gap-2">
          {['ReturnsValue', 'ReturnsCount', 'Footfall', 'ConversionRate', 'ReturningCustomers', 'Signups', 'DiscountedOrders', 'FacebookAdSpend', 'GoogleAdSpend', 'OtherAdSpend', 'OtherAdSpendNotes'].map(f => (
            <span key={f} className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">{f}</span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1">Your column names don't need to match exactly — you'll map them in the next step.</p>
      </div>
    </div>
  )
}
