import { toIsoDate } from '@/lib/format'

// Jornada: los partidos del club contra un mismo rival en un mismo día (fecha en America/Santiago). No tiene
// tabla propia: se arma desde los partidos. Su clave, `AAAA-MM-DD_<rivalId>`, es el id de la tarjeta
// «jornada» y el sujeto de su publicación (una por jornada). Lógica pura.

/** Lo que cabe en la tarjeta (y se puede marcar al publicarla). */
export const MAX_JORNADA_SERIES = 6

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const KEY = /^(\d{4}-\d{2}-\d{2})_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

export function jornadaKey(date: string, rivalId: string): string {
  return `${date}_${rivalId.toLowerCase()}`
}

/** Lee una clave de jornada; `null` si no corresponde (fecha inexistente o id inválido). */
export function parseJornadaKey(value: string): { date: string; rivalId: string } | null {
  const match = KEY.exec(value)
  if (!match?.[1] || !match[2]) return null
  const date = match[1]
  const parsed = new Date(`${date}T12:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || !parsed.toISOString().startsWith(date)) return null
  return { date, rivalId: match[2].toLowerCase() }
}

export type JornadaMatchRow = {
  id: string
  kickoffAt: Date | string
  rivalId: string
  seriesId: string
  /** Orden de la serie (desempata dos partidos a la misma hora). */
  seriesOrder: number
}

export type Jornada<T extends JornadaMatchRow> = { key: string; date: string; rivalId: string; matches: T[] }

/** Orden de juego: por hora y, a la misma hora, por el orden de la serie. */
export function byPlayingOrder(a: JornadaMatchRow, b: JornadaMatchRow): number {
  return Date.parse(String(a.kickoffAt)) - Date.parse(String(b.kickoffAt)) || a.seriesOrder - b.seriesOrder
}

const kickoffIso = (value: Date | string) => (typeof value === 'string' ? value : value.toISOString())

/** Agrupa partidos por día (en Santiago) y rival, con sus partidos en orden de juego; por fecha y hora. */
export function groupJornadas<T extends JornadaMatchRow>(rows: readonly T[]): Jornada<T>[] {
  const groups = new Map<string, Jornada<T>>()
  for (const row of [...rows].sort(byPlayingOrder)) {
    const date = toIsoDate(kickoffIso(row.kickoffAt))
    const key = jornadaKey(date, row.rivalId)
    const group = groups.get(key) ?? { key, date, rivalId: row.rivalId.toLowerCase(), matches: [] }
    group.matches.push(row)
    groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) => {
    const [first] = a.matches
    const [second] = b.matches
    return first && second ? byPlayingOrder(first, second) : 0
  })
}

/**
 * Partidos de la jornada que van en la tarjeta: los de las series marcadas (en orden de juego) o, sin
 * selección, los primeros `MAX_JORNADA_SERIES`.
 */
export function selectJornadaMatches<T extends JornadaMatchRow>(
  matches: readonly T[],
  seriesIds: readonly string[] | null | undefined,
): T[] {
  const ordered = [...matches].sort(byPlayingOrder)
  if (!seriesIds) return ordered.slice(0, MAX_JORNADA_SERIES)
  const wanted = new Set(seriesIds.map((id) => id.toLowerCase()))
  return ordered.filter((match) => wanted.has(match.seriesId.toLowerCase())).slice(0, MAX_JORNADA_SERIES)
}

/** Hora de inicio de la jornada: la del primer partido (de los marcados). */
export function jornadaStart(matches: readonly Pick<JornadaMatchRow, 'kickoffAt'>[]): string | null {
  let first: number | null = null
  for (const match of matches) {
    const time = Date.parse(kickoffIso(match.kickoffAt))
    if (first === null || time < first) first = time
  }
  return first === null ? null : new Date(first).toISOString()
}

/** Las series marcadas como texto para la dirección: `id1,id2` (sin repetir). */
export function encodeSeries(seriesIds: readonly string[]): string {
  return [...new Set(seriesIds.map((id) => id.toLowerCase()))].join(',')
}

/** Lee las series de la dirección; `null` si el texto no corresponde (así se ignora). */
export function parseSeries(value: string | null | undefined): string[] | null {
  if (!value) return null
  const ids = [...new Set(value.split(',').map((id) => id.toLowerCase()))]
  if (ids.length === 0 || ids.length > MAX_JORNADA_SERIES) return null
  return ids.every((id) => UUID.test(id)) ? ids : null
}

export type WeekendCard = 'proximo' | 'jornada' | 'programacion'

/**
 * Qué tarjeta lleva la publicación automática de un fin de semana: con un partido, su «Próximo partido»;
 * si todos son una sola jornada (mismo rival, mismo día, todos programados y que quepan), la «jornada»; si
 * no, la grilla
 * «Programación». Siempre un solo post por fin de semana. `null` si no hay partidos.
 */
export function weekendCardFor(
  rows: readonly (JornadaMatchRow & { status: string })[],
): { card: WeekendCard; jornadaKey: string | null } | null {
  if (rows.length === 0) return null
  if (rows.length === 1) return { card: 'proximo', jornadaKey: null }
  const jornadas = groupJornadas(rows)
  const [only] = jornadas
  const fits = rows.length <= MAX_JORNADA_SERIES
  if (jornadas.length === 1 && only && fits && rows.every((row) => row.status === 'programado')) {
    return { card: 'jornada', jornadaKey: only.key }
  }
  return { card: 'programacion', jornadaKey: null }
}
