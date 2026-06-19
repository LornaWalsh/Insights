import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | null | undefined, currency = 'GBP'): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date))
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value == null) return '—'
  return `${value.toFixed(decimals)}%`
}

export function today(): string {
  return new Date().toISOString().split('T')[0]
}

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}
