import type { CardMatch, MatchCardData, WeekendCardData } from '@/features/share/dto'
import { clampText, weekendTitle } from '@/features/share/lib/cards'
import { formatLongDate, formatTime, toIsoDate } from '@/lib/format'
import { matchStatusLabels } from '@/lib/labels'

// Texto de las publicaciones en redes, armado con los mismos datos públicos de las tarjetas (los menores ya
// vienen con nombre e inicial y los marcadores `[COMPLETAR]` se quitan). Lógica pura. Sobrio: pocos emojis
// y sin hashtags.

/** Tope del texto. Facebook acepta mucho más, pero un post largo no se lee. */
export const MAX_CAPTION = 2000

const clean = (text: string) => clampText(text, 200)
const capitalize = (text: string) => text.replace(/^./, (letter) => letter.toUpperCase())
const longDay = (value: Date | string) => capitalize(formatLongDate(value).replace(/ de \d{4}$/, ''))
const SIDE = { local: 'local', visita: 'visita' } as const

function versus(match: CardMatch): string {
  return `${clean(match.home.name)} vs ${clean(match.away.name)}`
}

function competitionLine(match: CardMatch): string {
  return clean([match.competitionName, match.roundLabel].filter(Boolean).join(' · '))
}

function finish(lines: (string | null | false)[]): string {
  const text = lines
    .filter((line): line is string => typeof line === 'string')
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text.length > MAX_CAPTION ? `${text.slice(0, MAX_CAPTION - 1)}…` : text
}

/**
 * «⚽ Próximo partido · Honor», los equipos, fecha y hora, cancha y el enlace al partido. La programación de
 * un fin de semana con un solo partido usa este texto con otro encabezado («Partido del fin de semana»).
 */
export function nextMatchCaption(data: MatchCardData, link: string, heading = 'Próximo partido'): string {
  const { match } = data
  const postponed = match.status === 'postergado'
  return finish([
    `⚽ ${postponed ? 'Partido postergado' : heading} · ${clean(match.seriesName)}`,
    versus(match),
    '',
    postponed
      ? `📅 Nueva fecha por confirmar (estaba para el ${longDay(match.kickoffAt).toLowerCase()})`
      : `📅 ${longDay(match.kickoffAt)}, ${formatTime(match.kickoffAt)} h`,
    match.venueName
      ? `📍 ${clean(match.venueName)} (${SIDE[match.clubSide]})`
      : `📍 De ${SIDE[match.clubSide]}`,
    competitionLine(match),
    '',
    `Más información: ${link}`,
  ])
}

/** Marcador final, penales, goleadores del club y el enlace al partido. */
export function resultCaption(data: MatchCardData, link: string): string {
  const { match } = data
  const clubScorers = match.clubSide === 'local' ? data.scorers.home : data.scorers.away
  const penalties =
    match.homePenalties !== null && match.awayPenalties !== null
      ? `(${match.homePenalties}–${match.awayPenalties} en penales)`
      : null
  return finish([
    `Resultado final · ${clean(match.seriesName)}`,
    `${clean(match.home.name)} ${match.homeScore}–${match.awayScore} ${clean(match.away.name)}`,
    penalties,
    clubScorers.length > 0 && `⚽ ${clubScorers.map(clean).join(' · ')}`,
    competitionLine(match),
    '',
    `Más información: ${link}`,
  ])
}

/** La línea de un partido en la programación: «• 10:00 Infantil: Cachorros vs Rival (Cancha)». */
function scheduleLine(match: CardMatch): string {
  const when =
    match.status === 'programado'
      ? formatTime(match.kickoffAt)
      : matchStatusLabels[match.status].toLowerCase()
  const venue = match.venueName ? ` (${clean(match.venueName)})` : ''
  return `• ${when} ${clean(match.seriesName)}: ${versus(match)}${venue}`
}

/** «⚽ Programación del fin de semana», los partidos agrupados por día y el enlace a los partidos. */
export function weekendCaption(data: WeekendCardData, link: string): string {
  const days = new Map<string, CardMatch[]>()
  for (const match of data.matches) {
    const day = toIsoDate(match.kickoffAt)
    days.set(day, [...(days.get(day) ?? []), match])
  }
  const competitions = new Set(data.matches.map((match) => clean(match.competitionName)))
  const [onlyCompetition] = competitions
  return finish([
    '⚽ Programación del fin de semana',
    weekendTitle(data.saturday),
    competitions.size === 1 && onlyCompetition ? onlyCompetition : null,
    ...[...days].flatMap(([, matches]) => [
      '',
      longDay(matches[0]?.kickoffAt ?? data.saturday),
      ...matches.map(scheduleLine),
    ]),
    '',
    `Todos los partidos: ${link}`,
  ])
}
