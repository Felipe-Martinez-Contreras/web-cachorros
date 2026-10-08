import { MapPin } from 'lucide-react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { formatLongDateTime, formatMatchDate } from '@/lib/format'
import type { MatchDTO, MatchdayDTO } from '../dto'
import { Countdown } from './countdown'
import { MatchCard } from './match-card'
import { LiveBadge, Scoreboard } from './scoreboard'

function MatchHeading({ match, eyebrow }: { match: MatchDTO; eyebrow: string }) {
  return (
    <div className="grid gap-1 text-center">
      <p className="text-eyebrow text-(--link)">{eyebrow}</p>
      <p className="font-semibold">
        {match.seriesName}
        <span className="font-normal text-(--muted)">
          {' · '}
          {match.competitionName}
          {match.roundLabel && ` · ${match.roundLabel}`}
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

function LiveMatch({ match }: { match: MatchDTO }) {
  return (
    <article className="grid w-full shrink-0 snap-center gap-4 p-5 md:p-8">
      <div className="flex justify-center">
        <LiveBadge />
      </div>
      <MatchHeading match={match} eyebrow="Se está jugando" />
      <Scoreboard match={match} size="lg" />
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
      <MatchHeading match={match} eyebrow="Próximo partido" />
      <Scoreboard match={match} size="lg" />
      <div className="grid justify-items-center gap-3">
        <p className="text-center font-medium first-letter:uppercase">
          {formatLongDateTime(match.kickoffAt)}
        </p>
        <Countdown target={match.kickoffAt} label={formatLongDateTime(match.kickoffAt)} />
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
          <h3 className="mb-1 text-eyebrow text-(--muted)">Ese día también juegan</h3>
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
      <MatchHeading match={match} eyebrow="Último resultado" />
      <Scoreboard match={match} size="lg" />
      <p className="text-center text-meta text-(--muted)">{formatMatchDate(match.kickoffAt)}</p>
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
 * Se renderiza en el servidor con el último estado; el polling en vivo llega en la Fase 4.
 */
export function MatchdayStrip({ matchday, className }: { matchday: MatchdayDTO; className?: string }) {
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
            <LiveMatch key={match.id} match={match} />
          ))}
        </div>
      )}
      {matchday.kind === 'next' && <NextMatch match={matchday.match} alsoToday={matchday.alsoToday} />}
      {matchday.kind === 'last' && <LastMatch match={matchday.match} />}
    </section>
  )
}
