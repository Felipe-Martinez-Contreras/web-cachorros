import type { matchPeriod } from '@/db/schema/enums'

type Period = (typeof matchPeriod.enumValues)[number]

export type MatchMinute = { minute: number; stoppage: number }

type ClockInput = {
  period: Period
  periodStartedAt: Date | string | null
  /** Duración de cada tiempo en la serie (`series.half_length_minutes`). */
  halfLengthMinutes: number
}

const MINUTE_MS = 60_000

/**
 * Minuto sugerido del partido (especificación 7.3), a partir del inicio del período y de la duración del
 * tiempo de la serie. Pasado el tiempo reglamentario se expresa como adición (`45+2'`). Siempre es
 * editable en la consola: es una sugerencia, no un reloj oficial.
 */
export function suggestedMinute(input: ClockInput, now: Date): MatchMinute | null {
  if (!input.periodStartedAt) return null
  const half = input.halfLengthMinutes
  const elapsed = Math.floor((now.getTime() - new Date(input.periodStartedAt).getTime()) / MINUTE_MS) + 1
  const played = Math.max(1, elapsed)

  switch (input.period) {
    case 'primer_tiempo':
      return clamp(played, 0, half)
    case 'segundo_tiempo':
      return clamp(played, half, half)
    case 'alargue':
      return { minute: half * 2 + played, stoppage: 0 }
    default:
      return null
  }
}

function clamp(played: number, base: number, length: number): MatchMinute {
  if (played <= length) return { minute: base + played, stoppage: 0 }
  return { minute: base + length, stoppage: played - length }
}

/** «23'» o «45+2'». */
export function formatMinute(minute: number | null, stoppage?: number | null): string {
  if (minute === null) return ''
  return stoppage ? `${minute}+${stoppage}'` : `${minute}'`
}

/** Orden cronológico de los eventos: período, minuto, adición y, por último, orden de registro. */
const PERIOD_ORDER: Record<Period, number> = {
  previa: 0,
  primer_tiempo: 1,
  entretiempo: 2,
  segundo_tiempo: 3,
  alargue: 4,
  penales: 5,
  terminado: 6,
}

type Timed = {
  period: Period
  minute: number | null
  stoppageMinute: number | null
  createdAt: Date | string
}

export function compareEvents(a: Timed, b: Timed): number {
  return (
    PERIOD_ORDER[a.period] - PERIOD_ORDER[b.period] ||
    (a.minute ?? 0) - (b.minute ?? 0) ||
    (a.stoppageMinute ?? 0) - (b.stoppageMinute ?? 0) ||
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
}
