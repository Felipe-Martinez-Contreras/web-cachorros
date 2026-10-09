import { fromIsoDate, toIsoDate } from '@/lib/format'
import { startOfSantiagoDay } from './countdown'

/** Días hacia atrás en que un partido sin resultado sigue apareciendo en Inicio. */
export const PENDING_RESULT_DAYS = 7

/**
 * Ventana de partidos de Inicio del panel (especificación 7.2): desde hace una semana (para lo que quedó
 * sin resultado) hasta el final del domingo que viene, en días de Santiago.
 */
export function homeMatchWindow(now: Date): { from: Date; today: Date; tomorrow: Date; to: Date } {
  // Día de la semana en Santiago: 0 = domingo.
  const weekday = fromIsoDate(toIsoDate(now)).getUTCDay()
  const daysUntilSunday = (7 - weekday) % 7
  return {
    from: startOfSantiagoDay(now, -PENDING_RESULT_DAYS),
    today: startOfSantiagoDay(now),
    tomorrow: startOfSantiagoDay(now, 1),
    to: startOfSantiagoDay(now, daysUntilSunday + 1),
  }
}

type HomeMatch = { kickoffAt: Date; status: string }

/** Reparte los partidos de la ventana en lo que hay que hacer con cada uno. */
export function groupHomeMatches<T extends HomeMatch>(matches: readonly T[], now: Date) {
  const { today, tomorrow } = homeMatchWindow(now)
  const open = (match: T) => match.status !== 'finalizado' && match.status !== 'cancelado'
  return {
    /** Ya debieron jugarse (antes de hoy) y todavía no tienen resultado. */
    pending: matches.filter((match) => open(match) && match.kickoffAt < today),
    today: matches.filter((match) => match.kickoffAt >= today && match.kickoffAt < tomorrow),
    upcoming: matches.filter((match) => match.kickoffAt >= tomorrow),
  }
}
