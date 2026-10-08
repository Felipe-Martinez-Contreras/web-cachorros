import { TZDate } from '@date-fns/tz'
import type { matchPeriod } from '@/db/schema/enums'
import { TIME_ZONE } from '@/lib/clock'
import { slugify } from '@/lib/slug'

type Period = (typeof matchPeriod.enumValues)[number]

/**
 * Fecha (`AAAA-MM-DD`) y hora (`HH:MM`) de pared en Santiago → instante UTC. Es lo que escribe el
 * administrador («sábado a las 16:00»), sin importar la zona de su celular ni el cambio de horario.
 */
export function santiagoWallTime(date: string, time: string): Date {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
  const [hour = 0, minute = 0] = time.split(':').map(Number)
  return new Date(new TZDate(year, month - 1, day, hour, minute, TIME_ZONE).getTime())
}

const two = (value: number) => String(value).padStart(2, '0')

/** Instante → fecha y hora de pared en Santiago, para volver a llenar el formulario. */
export function toSantiagoWallTime(instant: Date | string): { date: string; time: string } {
  const local = new TZDate(new Date(instant).getTime(), TIME_ZONE)
  return {
    date: `${local.getFullYear()}-${two(local.getMonth() + 1)}-${two(local.getDate())}`,
    time: `${two(local.getHours())}:${two(local.getMinutes())}`,
  }
}

/** De qué lado juega el club en un partido (lo fija la app, especificación 8.4). */
export function clubSideOf(
  homeTeamId: string,
  awayTeamId: string,
  ownTeamId: string | null,
): 'local' | 'visita' | 'ninguno' {
  if (ownTeamId === homeTeamId) return 'local'
  if (ownTeamId === awayTeamId) return 'visita'
  return 'ninguno'
}

/** «Fecha 5» si no se escribió un rótulo propio («Semifinal»). */
export function roundLabelFor(roundNumber: number | null, custom: string | null): string | null {
  return custom ?? (roundNumber ? `Fecha ${roundNumber}` : null)
}

type SlugParts = {
  seriesSlug: string
  year: number
  roundNumber: number | null
  roundLabel: string | null
  homeShortName: string
  awayShortName: string
}

/** `honor-2026-fecha-5-cachorros-vs-los-litres`: estable y legible; la unicidad la resuelve la BD. */
export function matchSlugBase(parts: SlugParts): string {
  const round = parts.roundNumber ? `fecha-${parts.roundNumber}` : slugify(parts.roundLabel ?? '')
  return [
    parts.seriesSlug,
    String(parts.year),
    round,
    `${slugify(parts.homeShortName)}-vs-${slugify(parts.awayShortName)}`,
  ]
    .filter(Boolean)
    .join('-')
}

/**
 * Período al que pertenece un minuto al cargar el resultado después del partido: no hay reloj, así que
 * se deduce de la duración de cada tiempo en la serie. El minuto exacto del final de un tiempo (con o sin
 * adición) pertenece a ese tiempo.
 */
export function periodForMinute(minute: number | null, halfLengthMinutes: number): Period {
  if (minute === null || minute <= halfLengthMinutes) return 'primer_tiempo'
  if (minute <= halfLengthMinutes * 2) return 'segundo_tiempo'
  return 'alargue'
}
