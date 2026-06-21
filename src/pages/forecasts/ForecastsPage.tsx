import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { SalesChannel, Organisation } from '@/types'
import { TargetsTab } from './TargetsTab'
import { GenerateTab } from './GenerateTab'

type Tab = 'targets' | 'generate'

export default function ForecastsPage() {
  const { profile } = useAuth()
  const orgId = profile?.organisation_id ?? ''
  const [tab, setTab] = useState<Tab>('targets')

  const { data: org } = useQuery<Organisation>({
    queryKey: ['org_forecasts', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organisations')
        .select('id, name, currency, created_at')
        .eq('id', orgId)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })

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

  const currency = org?.currency ?? 'GBP'

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Forecasts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Set monthly revenue targets per channel, then generate a daily forecast split.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b gap-0">
        {(['targets', 'generate'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'targets' ? 'Targets' : 'Generate'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === 'targets' && (
          <TargetsTab orgId={orgId} channels={channels} />
        )}
        {tab === 'generate' && (
          <GenerateTab orgId={orgId} channels={channels} currency={currency} />
        )}
      </div>
    </div>
  )
}
