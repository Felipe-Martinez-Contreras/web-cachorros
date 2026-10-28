import type { matchStatus } from '@/db/schema/enums'
import type { ScheduleSnapshot } from '@/db/schema/publishing'
import { santiagoWallTime } from '@/features/matches/lib/schedule'
import { addDays } from '@/features/share/lib/cards'
import { formatLongDateTime, toIsoDate } from '@/lib/format'

// Publicaciones programadas de una jornada o un partido. Lógica pura: las horas se razonan en Santiago.

type MatchStatus = (typeof matchStatus.enumValues)[number]

/** El tick corre cada 5 minutos: una programada puede salir hasta 5 minutos después de su hora. */
export const SCHEDULE_LEAD_MS = 5 * 60_000
/** Hora sugerida: el día anterior a la jornada a esta hora de Santiago. */
export const DEFAULT_SCHEDULE_TIME = '10:00'
const HOUR_MS = 60 * 60_000

export type ScheduleCheck = { ok: true } | { ok: false; message: string }

/** La hora elegida debe estar al menos 5 minutos en el futuro y antes del inicio del primer partido. */
export function validateScheduledAt(input: { at: Date; now: Date; firstKickoff: Date }): ScheduleCheck {
  const { at, now, firstKickoff } = input
  if (Number.isNaN(at.getTime())) return { ok: false, message: 'Escribe una fecha y una hora válidas.' }
  if (at.getTime() < now.getTime() + SCHEDULE_LEAD_MS) {
    return { ok: false, message: 'Elige una hora al menos 5 minutos en el futuro.' }
  }
  if (at >= firstKickoff) {
    return {
      ok: false,
      message: `Elige una hora anterior al inicio del partido (${formatLongDateTime(firstKickoff)}).`,
    }
  }
  return { ok: true }
}

/**
 * Hora que se precarga al programar: el día anterior al partido a las 10:00 de Santiago, si todavía está al
 * menos 5 minutos en el futuro; si no, la próxima hora en punto que lo esté. Siempre antes del inicio: `null`
 * si ya no queda ninguna. (Santiago tiene horas enteras de diferencia con UTC: una hora en punto lo es en ambas.)
 */
export function defaultScheduleAt(input: { firstKickoff: Date; now: Date }): Date | null {
  const { firstKickoff, now } = input
  const earliest = now.getTime() + SCHEDULE_LEAD_MS
  const dayBefore = santiagoWallTime(addDays(toIsoDate(firstKickoff), -1), DEFAULT_SCHEDULE_TIME)
  if (dayBefore.getTime() >= earliest && dayBefore < firstKickoff) return dayBefore
  const nextHour = new Date(Math.ceil(earliest / HOUR_MS) * HOUR_MS)
  return nextHour < firstKickoff ? nextHour : null
}

/** Rival de un partido del club según el lado en que juega. */
export function rivalOf(match: { clubSide: string; homeTeamId: string; awayTeamId: string }): string {
  return (match.clubSide === 'visita' ? match.homeTeamId : match.awayTeamId).toLowerCase()
}

/** Lo que se guarda al programar: el día y el rival de la jornada, y los partidos de la tarjeta con su hora. */
export function scheduleSnapshot(
  rivalId: string,
  matches: readonly { id: string; kickoffAt: Date | string }[],
): ScheduleSnapshot {
  const ordered = [...matches].sort(
    (a, b) => Date.parse(String(a.kickoffAt)) - Date.parse(String(b.kickoffAt)),
  )
  const first = ordered[0]
  return {
    day: first ? toIsoDate(first.kickoffAt) : '',
    rivalId: rivalId.toLowerCase(),
    matches: ordered.map((match) => ({ id: match.id, kickoffAt: new Date(match.kickoffAt).toISOString() })),
  }
}

/** Primer inicio de una lista de partidos (`null` si está vacía). */
export function firstKickoffOf(matches: readonly { kickoffAt: Date | string }[]): Date | null {
  let first: number | null = null
  for (const match of matches) {
    const time = new Date(match.kickoffAt).getTime()
    if (first === null || time < first) first = time
  }
  return first === null ? null : new Date(first)
}

export type GuardMatch = { id: string; kickoffAt: Date; status: MatchStatus; rivalId: string }

export type GuardResult =
  | { ok: true }
  | {
      ok: false
      code:
        | 'eliminado'
        | 'cancelado'
        | 'postergado'
        | 'empezo'
        | 'rival'
        | 'dia'
        | 'hora_texto'
        | 'hora_tarde'
      message: string
    }

/**
 * ¿Sigue valiendo una programada? Se compara lo guardado al programar con los partidos vigentes (`current`,
 * sin los eliminados). Si solo cambió la hora, el día es el mismo, el texto es el sugerido y el partido sigue
 * empezando después de la hora programada, se mantiene: la tarjeta y el texto salen con la hora nueva. Todo lo
 * demás la descarta con su motivo.
 */
export function scheduleGuard(input: {
  snapshot: ScheduleSnapshot
  current: readonly GuardMatch[]
  scheduledAt: Date
  /** El texto se escribió a mano (`message ≠ null`): con la hora cambiada ya no sirve. */
  messageEdited: boolean
  now: Date
}): GuardResult {
  const { snapshot, scheduledAt, now } = input
  const single = snapshot.matches.length === 1
  const what = single ? 'el partido' : 'un partido de la jornada'
  const ofWhat = single ? 'del partido' : 'de un partido de la jornada'
  const byId = new Map(input.current.map((match) => [match.id, match]))
  const pairs = snapshot.matches.map((saved) => ({ saved, current: byId.get(saved.id) }))

  if (pairs.length === 0 || pairs.some((pair) => !pair.current)) {
    return { ok: false, code: 'eliminado', message: `Se eliminó ${what}.` }
  }
  const current = pairs.flatMap((pair) => (pair.current ? [{ saved: pair.saved, now: pair.current }] : []))
  if (current.some((pair) => pair.now.status === 'cancelado')) {
    return { ok: false, code: 'cancelado', message: `Se canceló ${what}.` }
  }
  if (current.some((pair) => pair.now.status === 'postergado' || pair.now.status === 'suspendido')) {
    return { ok: false, code: 'postergado', message: `Se postergó ${what}.` }
  }
  const first = firstKickoffOf(current.map((pair) => pair.now))
  if (current.some((pair) => pair.now.status !== 'programado') || (first && now >= first)) {
    return { ok: false, code: 'empezo', message: 'El partido ya empezó.' }
  }
  if (current.some((pair) => pair.now.rivalId.toLowerCase() !== snapshot.rivalId)) {
    return { ok: false, code: 'rival', message: `Cambió el rival ${ofWhat}.` }
  }
  if (current.some((pair) => toIsoDate(pair.now.kickoffAt) !== snapshot.day)) {
    return { ok: false, code: 'dia', message: `Cambió el día ${ofWhat}.` }
  }
  const moved = current.some((pair) => pair.now.kickoffAt.getTime() !== Date.parse(pair.saved.kickoffAt))
  if (moved && input.messageEdited) {
    return {
      ok: false,
      code: 'hora_texto',
      message: `Cambió la hora ${ofWhat} y el texto se había escrito a mano: revísalo y vuelve a programarla.`,
    }
  }
  if (first && scheduledAt >= first) {
    return {
      ok: false,
      code: 'hora_tarde',
      message: `${single ? 'El partido' : 'La jornada'} ahora empieza antes de la hora programada.`,
    }
  }
  return { ok: true }
}

/** Motivo cuando el partido empezó con la publicación apagada: nunca sale tarde. */
export const STARTED_WHILE_DISABLED =
  'Facebook estaba desactivado a la hora programada y el partido ya empezó.'

/**
 * Fotos con las que sale una publicación ya preparada: si una de las elegidas se borró o se marcó «contiene
 * menores», ese panel usa la foto de respaldo de Ajustes en la misma posición (si sirve) o queda en gris. Un
 * hueco elegido a propósito (`null`) sigue en gris.
 */
export function withFallbackPhotos(
  chosen: readonly (string | null)[],
  defaults: readonly (string | null)[],
  usable: ReadonlySet<string>,
): { photos: (string | null)[]; replaced: number } {
  let replaced = 0
  const photos = [0, 1, 2].map((index) => {
    const photo = chosen[index] ?? null
    if (photo === null || usable.has(photo)) return photo
    replaced++
    const fallback = defaults[index] ?? null
    return fallback && usable.has(fallback) ? fallback : null
  })
  return { photos, replaced }
}
