import { MapPin } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { formatKickoff, formatLongDateTime } from '@/lib/format'
import type { MatchDTO, MatchdayDTO } from '../dto'
import { MatchCard } from './match-card'
import { LiveBadge, Scoreboard } from './scoreboard'

/** Qué partido es («Próximo partido») como título, y su serie y torneo debajo, separados por comas. */
function MatchHeading({ match, title }: { match: MatchDTO; title: string }) {
  return (
    <div className="grid gap-1 text-center">
      <p className="font-display text-2xl font-extrabold [font-stretch:75%]">{title}</p>
      <p>
        <span className="font-semibold">{match.seriesName}</span>
        <span className="text-(--muted)">
          , {match.competitionName}
          {match.roundLabel && `, ${match.roundLabel}`}
        </span>
      </p>
    </div>
  )
}

function Venue({ match }: { match: MatchDTO }) {
  if (!match.venue) return null
  return (
    <p className="flex items-center justify-center gap-1.5 text-meta text-(--muted)">
      <MapPin aria-hidden="true" className="size-4 shrink-0" />
      {match.venue.name}
    </p>
  )
}

type MinuteRenderer = (match: MatchDTO) => ReactNode

function LiveMatch({ match, renderMinute }: { match: MatchDTO; renderMinute?: MinuteRenderer }) {
  return (
    <article className="grid w-full shrink-0 snap-center gap-4 p-5 md:p-8">
      <div className="flex justify-center">
        <LiveBadge />
      </div>
      <MatchHeading match={match} title="Se está jugando" />
      <Scoreboard match={match} size="lg" minute={renderMinute?.(match)} />
      <div className="flex justify-center">
        <Link href={`/partidos/${match.slug}`} className={buttonVariants({ variant: 'primary' })}>
          Seguir el partido
        </Link>
      </div>
    </article>
  )
}

function NextMatch({ match, alsoToday }: { match: MatchDTO; alsoToday: MatchDTO[] }) {
  return (
    <div className="grid gap-5 p-5 md:p-8">
      <MatchHeading match={match} title="Próximo partido" />
      <Scoreboard match={match} size="lg" />
      <div className="grid justify-items-center gap-3">
        <p className="text-center font-medium first-letter:uppercase">
          {formatLongDateTime(match.kickoffAt)}
        </p>
        <Venue match={match} />
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href={`/partidos/${match.slug}`} className={buttonVariants({ variant: 'primary' })}>
          Ver el partido
        </Link>
        {match.venue?.directionsUrl && (
          <a
            href={match.venue.directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'outline' })}
          >
            Cómo llegar
            <span className="sr-only"> (se abre en una pestaña nueva)</span>
          </a>
        )}
      </div>
      {alsoToday.length > 0 && (
        <div className="border-t border-(--border) pt-4">
          <h2 className="mb-1 font-bold">Ese día también juegan</h2>
          <ul className="grid gap-1 md:grid-cols-2">
            {alsoToday.map((other) => (
              <li key={other.id}>
                <MatchCard match={other} variant="compact" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function LastMatch({ match }: { match: MatchDTO }) {
  return (
    <div className="grid gap-4 p-5 md:p-8">
      <MatchHeading match={match} title="Último resultado" />
      <Scoreboard match={match} size="lg" />
      <p className="text-center text-meta text-(--muted)">{formatKickoff(match.kickoffAt)}</p>
      <div className="flex justify-center">
        <Link href={`/partidos/${match.slug}`} className={buttonVariants({ variant: 'outline' })}>
          Ver el partido
        </Link>
      </div>
    </div>
  )
}

/**
 * Franja matchday de la portada (especificación 5.3): en vivo → próximo partido → último resultado.
 * Se renderiza en el servidor con el último estado; `LiveMatchday` la actualiza con el polling (2.6). La
 * cuenta regresiva no va aquí: está en las placas del hero (`HeroMatchday`).
 */
export function MatchdayStrip({
  matchday,
  renderMinute,
  className,
}: {
  matchday: MatchdayDTO
  /** Minuto en vivo de cada partido (lo aporta la isla de polling). */
  renderMinute?: MinuteRenderer
  className?: string
}) {
  return (
    <section
      aria-label={matchday.kind === 'live' ? 'Partidos en vivo' : 'Próximo partido'}
      className={cn('theme-light overflow-hidden rounded-lg border border-(--border) shadow-xl', className)}
    >
      {matchday.kind === 'live' && (
        // Varios partidos en vivo: carrusel con desplazamiento nativo (sin JavaScript ni autoplay).
        <div
          className={cn('flex snap-x snap-mandatory overflow-x-auto', matchday.matches.length > 1 && 'pb-2')}
          // Con más de un partido el contenedor se desplaza: debe poder enfocarse con el teclado.
          {...(matchday.matches.length > 1
            ? { role: 'group', tabIndex: 0, 'aria-label': 'Partidos en vivo' }
            : {})}
        >
          {matchday.matches.map((match) => (
            <LiveMatch key={match.id} match={match} renderMinute={renderMinute} />
          ))}
        </div>
      )}
      {matchday.kind === 'next' && <NextMatch match={matchday.match} alsoToday={matchday.alsoToday} />}
      {matchday.kind === 'last' && <LastMatch match={matchday.match} />}
    </section>
  )
}
