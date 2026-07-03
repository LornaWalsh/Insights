import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { StepChannels } from './StepChannels'
import { StepForecasts } from './StepForecasts'
import type { SalesChannel } from '@/types'

const STEPS = ['Set up your channels', 'Set forecast targets']

export default function OnboardingPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [channels, setChannels] = useState<SalesChannel[]>([])

  function handleChannelsDone(saved: SalesChannel[]) {
    setChannels(saved)
    setStep(1)
  }

  function handleForecastsDone() {
    navigate('/dashboard', { replace: true })
  }

  function handleSkipForecasts() {
    navigate('/dashboard', { replace: true })
  }

  function handleBackToChannels() {
    setStep(0)
  }

  return (
    <div className="min-h-screen bg-muted flex flex-col items-center justify-start pt-12 px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-foreground">Welcome to Planfore</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Let's get {profile?.full_name?.split(' ')[0] ?? 'you'} set up — this only takes a few minutes.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-colors ${
              i < step ? 'bg-primary text-primary-foreground'
              : i === step ? 'bg-primary text-primary-foreground'
              : 'bg-muted-foreground/20 text-muted-foreground'
            }`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`text-sm hidden sm:inline ${i === step ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-px mx-1 ${i < step ? 'bg-primary' : 'bg-border'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="w-full max-w-2xl">
        {step === 0 && (
          <StepChannels onDone={handleChannelsDone} />
        )}
        {step === 1 && (
          <StepForecasts
            channels={channels}
            onDone={handleForecastsDone}
            onSkip={handleSkipForecasts}
            onBack={handleBackToChannels}
          />
        )}
      </div>
    </div>
  )
}
