import { MapPin } from 'lucide-react'
import Link from 'next/link'
import { ClubImage } from '@/components/site/club-image'
import { Plate } from '@/components/site/plate'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { formatLongDateTimeShown, formatTime } from '@/lib/format'
import type { ImageDTO } from '@/lib/images/dto'
import { hasScore, type MatchCenterDTO, type MatchDTO, scoreText } from '../dto'
import { LiveBadge, matchNote, TeamCrest } from './scoreboard'
import { SeriesTabs } from './series-tabs'

export const MATCH_CENTER_ID = 'partidos'

type Slot = 'last' | 'current' | 'following'

const TITLES: Record<Slot, string> = {
  last: 'Último resultado',
  current: 'Próximo partido',
  following: 'Siguiente partido',
}

/** Equipo con su escudo y su nombre corto, sin cortarlo. */
function Team({ team, large }: { team: MatchDTO['home']; large: boolean }) {
  return (
    <div className="grid min-w-0 justify-items-center gap-2 text-center">
      <TeamCrest team={team} size={large ? 'lg' : 'md'} />
      <span className={cn('font-semibold text-pretty', large ? 'text-base md:text-lg' : 'text-sm')}>
        {team.shortName}
      </span>
    </div>
  )
}

/** El marcador en placas (jugado o en vivo) o la hora del partido. */
function Board({ match, large }: { match: MatchDTO; large: boolean }) {
  if (hasScore(match)) {
    return (
      <>
        <p className="sr-only">{scoreText(match)}.</p>
        <div aria-hidden="true" className="flex gap-1">
          <Plate value={String(match.homeScore)} size={large ? 'countdown' : 'card'} />
          <Plate value={String(match.awayScore)} size={large ? 'countdown' : 'card'} />
        </div>
      </>
    )
  }
  return (
    <p
      className={cn(
        'font-tight font-black tabular-nums [font-stretch:62.5%]',
        large ? 'text-5xl md:text-6xl' : 'text-4xl',
      )}
    >
      {formatTime(match.kickoffAt)}
    </p>
  )
}

function MatchCard({ match, slot }: { match: MatchDTO; slot: Slot }) {
  const large = slot === 'current'
  const live = match.status === 'en_vivo'
  const note = matchNote(match)
  return (
    <article
      aria-label={`${live ? 'En vivo' : TITLES[slot]}: ${match.home.shortName} contra ${match.away.shortName}`}
      className={cn('theme-light grid h-full content-start gap-4', large ? 'p-6 md:p-8' : 'p-5 md:p-6')}
    >
      <header className="grid gap-1">
        <h3
          className={cn(
            'font-display font-extrabold [font-stretch:75%]',
            large ? 'text-2xl md:text-3xl' : 'text-xl',
          )}
        >
          {live ? <LiveBadge /> : TITLES[slot]}
        </h3>
        <p className="text-meta first-letter:uppercase">{formatLongDateTimeShown(match.kickoffAt)}</p>
        {match.venue && (
          <p className="flex items-center gap-1.5 text-meta text-(--muted)">
            <MapPin aria-hidden="true" className="size-4 shrink-0" />
            {match.venue.name}
          </p>
        )}
      </header>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <Team team={match.home} large={large} />
        <Board match={match} large={large} />
        <Team team={match.away} large={large} />
      </div>
      {note && <p className="text-center text-meta text-(--muted)">{note}</p>}
      <p className="text-meta text-(--muted)">
        {match.competitionName}
        {match.roundLabel && `, ${match.roundLabel}`}
      </p>
      <Link
        href={`/partidos/${match.slug}`}
        className={buttonVariants({ variant: 'primary', className: 'justify-self-start' })}
      >
        Ver el partido
      </Link>
    </article>
  )
}

function EmptyCard({ slot }: { slot: Slot }) {
  const text =
    slot === 'last' ? 'Esta serie aún no juega esta temporada.' : 'Todavía no hay fecha programada.'
  return (
    <div className="theme-light grid h-full content-start gap-2 p-5 md:p-6">
      <h3 className="font-display text-xl font-extrabold [font-stretch:75%]">{TITLES[slot]}</h3>
      <p className="text-(--muted)">{text}</p>
    </div>
  )
}

/**
 * Centro de partidos de la portada: pestañas por serie (enlaces `?serie=`, sin JavaScript) y tres tarjetas
 * blancas sobre la foto de la cancha. En escritorio, el partido actual va al centro y más grande; en el
 * celular, un carrusel con desplazamiento nativo que se desliza con el dedo (sin autoplay).
 */
export function MatchCenter({ center, image }: { center: MatchCenterDTO; image: ImageDTO | null }) {
  const slots: [Slot, MatchDTO | null][] = [
    ['last', center.last],
    ['current', center.current],
    ['following', center.following],
  ]
  return (
    <section
      id={MATCH_CENTER_ID}
      aria-labelledby="partidos-titulo"
      className="relative isolate overflow-hidden py-12 md:py-20"
    >
      {/* [DECIDIR: foto propia de la cancha para el centro de partidos. Default: la foto principal de la portada] */}
      {image && (
        <ClubImage
          image={image}
          alt=""
          sizes="100vw"
          className="absolute inset-0 -z-20 size-full object-cover"
        />
      )}
      <div className="absolute inset-0 -z-10 bg-ink/75" />

      <div className="container-site grid grid-cols-1 gap-6 md:gap-8">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <h2 id="partidos-titulo" className="text-h2 uppercase">
            Partidos
          </h2>
          <Link
            href="/partidos"
            className="inline-flex min-h-11 items-center font-semibold text-(--link) hover:underline hover:underline-offset-4"
          >
            Fixture y resultados
          </Link>
        </div>
        <SeriesTabs
          series={center.series}
          activeSlug={center.activeSlug}
          hrefFor={(slug) => `/?serie=${slug}#${MATCH_CENTER_ID}`}
          label="Series del centro de partidos"
        />
        <ul
          aria-label={`Partidos de la serie ${center.series.find((item) => item.slug === center.activeSlug)?.name ?? ''}`}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: carrusel con desplazamiento, alcanzable con teclado
          tabIndex={0}
          className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-[1fr_1.35fr_1fr] md:items-center md:gap-4 md:overflow-visible md:px-0 md:pb-0"
        >
          {slots.map(([slot, match]) => (
            <li key={slot} className="w-[85%] shrink-0 snap-center sm:w-[60%] md:w-auto">
              {match ? <MatchCard match={match} slot={slot} /> : <EmptyCard slot={slot} />}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
