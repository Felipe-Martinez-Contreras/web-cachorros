import { santiagoWallTime } from '@/features/matches/lib/schedule'
import { addDays, weekendOf } from '@/features/share/lib/cards'
import { toIsoDate } from '@/lib/format'

// Cuándo sale la programación automática del fin de semana. Lógica pura: todo en hora de pared de
// Santiago (los cambios de horario los resuelve `santiagoWallTime`).

/**
 * Instante en que se publica la programación del fin de semana que empieza el sábado `saturday`:
 * el día `weekday` (1 = lunes … 6 = sábado) de esa misma semana, a la hora `time` de Santiago.
 */
export function scheduledAtFor(saturday: string, weekday: number, time: string): Date {
  return santiagoWallTime(addDays(saturday, weekday - 6), time)
}

/** El fin de semana (su sábado) que corresponde publicar en la semana de `now`. */
export function upcomingWeekend(now: Date): string {
  return weekendOf(toIsoDate(now))
}

export type WeeklyDecision =
  | { publish: true; saturday: string; scheduledAt: Date }
  | { publish: false; reason: 'antes_de_la_hora' | 'activada_despues' | 'ya_empezo' | 'sin_partidos' }

/**
 * ¿Toca publicar ahora la programación? Solo desde la hora programada hasta el primer partido del fin de
 * semana (después ya no sirve), si hay partidos y si la publicación estaba activa a esa hora.
 */
export function weeklyDecision(input: {
  now: Date
  weekday: number
  time: string
  enabledAt: string | undefined
  /** Primer partido del fin de semana que no está cancelado, o `null` si no hay. */
  firstKickoff: Date | null
}): WeeklyDecision {
  const saturday = upcomingWeekend(input.now)
  const scheduledAt = scheduledAtFor(saturday, input.weekday, input.time)
  if (input.now < scheduledAt) return { publish: false, reason: 'antes_de_la_hora' }
  if (!input.enabledAt || Date.parse(input.enabledAt) > scheduledAt.getTime()) {
    return { publish: false, reason: 'activada_despues' }
  }
  if (!input.firstKickoff) return { publish: false, reason: 'sin_partidos' }
  if (input.now >= input.firstKickoff) return { publish: false, reason: 'ya_empezo' }
  return { publish: true, saturday, scheduledAt }
}
