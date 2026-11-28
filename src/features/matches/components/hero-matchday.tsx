'use client' // Cliente: lee el estado del polling de la franja (marcador en vivo) y gira las placas al cambiar.

import Link from 'next/link'
import { Plate } from '@/components/site/plate'
import { buttonVariants } from '@/components/ui/button'
import { formatLongDateTime, formatLongDateTimeShown } from '@/lib/format'
import { type MatchDTO, type MatchdayDTO, scoreText } from '../dto'
import { Countdown } from './countdown'
import { useLiveMatchday } from './live-matchday'
import { LiveMinute } from './live-minute'
import { LiveBadge, matchNote } from './scoreboard'

/** El mismo partido como llegó del servidor: sus números no giran al cargar la página. */
function initialOf(matchday: MatchdayDTO, id: string): MatchDTO | undefined {
  if (matchday.kind === 'live') return matchday.matches.find((match) => match.id === id)
  return matchday.match.id === id ? matchday.match : undefined
}

function Heading({ title, match }: { title: string; match: MatchDTO }) {
  return (
    <p className="font-display text-xl font-extrabold [font-stretch:75%] md:text-2xl">
      {title}
      <span className="font-sans font-medium text-(--muted) [font-stretch:100%]">, {match.seriesName}</span>
    </p>
  )
}

function ScorePlates({ match, initial }: { match: MatchDTO; initial: MatchDTO | undefined }) {
  const home = String(match.homeScore)
  const away = String(match.awayScore)
  const note = matchNote(match)
  return (
    <>
      <p className="sr-only">{scoreText(match)}.</p>
      <div aria-hidden="true" className="grid w-fit grid-cols-2 gap-x-1.5 gap-y-2 md:gap-x-2">
        <Plate value={home} flip={initial !== undefined && home !== String(initial.homeScore)} />
        <Plate value={away} flip={initial !== undefined && away !== String(initial.awayScore)} />
        <span className="max-w-36 text-meta text-pretty">{match.home.shortName}</span>
        <span className="max-w-36 text-meta text-pretty">{match.away.shortName}</span>
      </div>
      {note && <p className="text-meta text-(--muted)">{note}</p>}
    </>
  )
}

/** El botón de la portada lleva al partido de las placas (el encabezado ya tiene «Hazte socio»). */
function MatchLink({ match }: { match: MatchDTO }) {
  return (
    <div className="mt-2">
      <Link href={`/partidos/${match.slug}`} className={buttonVariants({ variant: 'primary', size: 'lg' })}>
        Ver el partido
      </Link>
    </div>
  )
}

/**
 * Placas del hero, debajo del lema: el marcador en vivo, la cuenta regresiva al próximo partido o el
 * último resultado. Usa el mismo polling que la tarjeta de la franja (`LiveMatchdayProvider`).
 */
export function HeroMatchday() {
  const { initial, view, offset } = useLiveMatchday()

  if (view.kind === 'next') {
    const { match } = view
    return (
      <div className="grid gap-3">
        <Heading title="Próximo partido" match={match} />
        <Countdown target={match.kickoffAt} label={formatLongDateTime(match.kickoffAt)} />
        <p className="text-meta text-(--muted) first-letter:uppercase">
          {match.home.shortName} contra {match.away.shortName}, {formatLongDateTimeShown(match.kickoffAt)}
        </p>
        <MatchLink match={match} />
      </div>
    )
  }

  // Con varios partidos en vivo, el hero muestra el primero (en el orden de las series); la tarjeta, todos.
  const match = view.kind === 'live' ? view.matches[0] : view.match
  if (!match) return null
  const live = view.kind === 'live'
  return (
    <div className="grid gap-3">
      {live ? (
        <p className="flex items-center gap-3">
          <LiveBadge />
          <span className="font-semibold">{match.seriesName}</span>
          <LiveMinute match={match} serverOffsetMs={offset} />
        </p>
      ) : (
        <Heading title="Último resultado" match={match} />
      )}
      <ScorePlates match={match} initial={initialOf(initial, match.id)} />
      <MatchLink match={match} />
    </div>
  )
}
