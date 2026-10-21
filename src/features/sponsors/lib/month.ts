import { systemClock } from '@/lib/clock'
import { toIsoDate } from '@/lib/format'

/** Mes del reporte de clics (`AAAA-MM`): el pedido si es válido; si no, el mes actual en Chile. */
export function reportMonth(value: string | null | undefined, now = systemClock.now()): string {
  if (value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value
  return toIsoDate(now).slice(0, 7)
}

/** El mes anterior y el siguiente, para navegar el reporte. */
export function adjacentMonths(month: string): { previous: string; next: string } {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number]
  const shift = (delta: number) => {
    const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1))
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
  }
  return { previous: shift(-1), next: shift(1) }
}

/** «Octubre de 2026» */
export function monthLabel(month: string): string {
  const text = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${month}-15T12:00:00Z`),
  )
  return text.charAt(0).toUpperCase() + text.slice(1)
}
