import { CalendarPlus, MapPin } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { Breadcrumbs } from '@/components/site/page-shell'
import { ShareBar } from '@/components/site/share-bar'
import { buttonVariants } from '@/components/ui/button'
import { Alert } from '@/components/ui/feedback'
import { EventTimeline } from '@/features/matches/components/event-timeline'
import { LiveBadge, Scoreboard } from '@/features/matches/components/scoreboard'
import { hasScore, type LineupPlayerDTO, scoreText } from '@/features/matches/dto'
import { getMatchDetail, resolveSlugRedirect } from '@/features/matches/public-queries'
import { env } from '@/lib/env'
import { formatLongDateTime } from '@/lib/format'
import { matchStatusLabels } from '@/lib/labels'

type Props = { params: Promise<{ slug: string }> }

async function loadMatch(slug: string) {
  const detail = await getMatchDetail(slug)
  if (detail) return detail
  // Dirección antigua de un partido que cambió de slug: se envía a la vigente (3.9).
  const current = await resolveSlugRedirect('match', slug)
  if (current) permanentRedirect(`/partidos/${current}`)
  notFound()
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { match } = await loadMatch((await params).slug)
  const versus = `${match.home.shortName} vs ${match.away.shortName}`
  return {
    title: `${versus} · ${match.seriesName}`,
    description: hasScore(match)
      ? `${scoreText(match)}. ${match.seriesName}, ${match.competitionName}.`
      : `${versus}: ${formatLongDateTime(match.kickoffAt)}. ${match.seriesName}, ${match.competitionName}.`,
  }
}

function PlayerList({ title, players }: { title: string; players: (LineupPlayerDTO & { note?: string })[] }) {
  if (players.length === 0) return null
  return (
    <div className="grid content-start gap-2">
      <h3 className="text-eyebrow text-(--muted)">{title}</h3>
      <ul className="grid gap-1">
        {players.map((player) => (
          <li key={`${player.shirtNumber}:${player.name}`} className="flex min-h-11 items-center gap-3">
            <span className="w-7 text-right font-bold tabular-nums" aria-hidden="true">
              {player.shirtNumber ?? ''}
            </span>
            {player.slug ? (
              <Link href={`/jugadores/${player.slug}`} className="hover:underline hover:underline-offset-4">
                {player.name}
              </Link>
            ) : (
              <span>{player.name}</span>
            )}
            {player.note && <span className="text-meta text-(--muted)">{player.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default async function MatchPage({ params }: Props) {
  const { slug } = await params
  const { match, notes, venue, events, lineup } = await loadMatch(slug)
  const title = `${match.home.name} vs ${match.away.name}`
  const off = match.status === 'postergado' || match.status === 'suspendido' || match.status === 'cancelado'
  const upcoming = match.status === 'programado'

  return (
    <article>
      <header className="theme-dark">
        <div className="container-site grid gap-4 pt-4 pb-10 md:pb-14">
          <Breadcrumbs
            items={[
              { href: '/', label: 'Inicio' },
              { href: `/partidos?serie=${match.seriesSlug}`, label: 'Partidos' },
              { label: `${match.home.shortName} vs ${match.away.shortName}` },
            ]}
          />
          <div className="grid justify-items-center gap-2 text-center">
            <p className="text-eyebrow text-accent">
              {match.seriesName} · {match.competitionName}
              {match.roundLabel && ` · ${match.roundLabel}`}
            </p>
            <h1 className="sr-only">{title}</h1>
            {match.status === 'en_vivo' && <LiveBadge />}
          </div>
          <Scoreboard match={match} size="lg" />
          <p className="text-center text-(--muted)">
            <time dateTime={match.kickoffAt}>{formatLongDateTime(match.kickoffAt)}</time>
            {match.venue && ` · ${match.venue.name}`}
          </p>
        </div>
      </header>

      <div className="container-site grid max-w-4xl gap-10 py-8 md:py-12">
        {off && (
          <Alert variant="warning" title={`Partido ${matchStatusLabels[match.status].toLowerCase()}`}>
            {notes ?? 'Avisaremos aquí cuando haya novedades.'}
          </Alert>
        )}
        {!off && notes && <p className="text-lg">{notes}</p>}

        {events.length > 0 && (
          <section aria-labelledby="cronologia" className="grid gap-4">
            <h2 id="cronologia" className="text-h2 uppercase">
              Cronología
            </h2>
            <EventTimeline events={events} homeName={match.home.shortName} awayName={match.away.shortName} />
          </section>
        )}

        {lineup.starters.length + lineup.substitutes.length > 0 && (
          <section aria-labelledby="nomina" className="grid gap-4">
            <h2 id="nomina" className="text-h2 uppercase">
              Nómina de {match.clubSide === 'local' ? match.home.shortName : match.away.shortName}
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
              <PlayerList title="Titulares" players={lineup.starters} />
              <PlayerList
                title="Suplentes"
                players={lineup.substitutes.map((player) => ({
                  ...player,
                  note: hasScore(match) && player.played ? 'entró' : undefined,
                }))}
              />
            </div>
          </section>
        )}

        {venue && (
          <section aria-labelledby="cancha" className="grid gap-3">
            <h2 id="cancha" className="text-h2 uppercase">
              Cancha
            </h2>
            <p className="flex items-start gap-2 text-lg">
              <MapPin aria-hidden="true" className="mt-1 size-5 shrink-0" />
              <span>
                <span className="font-semibold">{venue.name}</span>
                {venue.address && <span className="block text-base text-(--muted)">{venue.address}</span>}
                {venue.notes && <span className="block text-base text-(--muted)">{venue.notes}</span>}
              </span>
            </p>
            {venue.directions && (
              <ul className="flex flex-wrap gap-2" aria-label="Cómo llegar">
                {(
                  [
                    ['Google Maps', venue.directions.google],
                    ['Waze', venue.directions.waze],
                    ['Apple Maps', venue.directions.apple],
                  ] as const
                ).map(([label, href]) => (
                  <li key={label}>
                    <a
                      href={href}
                      rel="noopener noreferrer"
                      target="_blank"
                      className={buttonVariants({ variant: 'outline' })}
                    >
                      Cómo llegar con {label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section aria-label="Compartir y calendario" className="grid gap-4 border-t border-(--border) pt-6">
          {upcoming && (
            <div>
              <a href={`/api/ics/partido/${match.id}`} className={buttonVariants({ variant: 'dark' })}>
                <CalendarPlus aria-hidden="true" />
                Agregar al calendario
              </a>
            </div>
          )}
          <ShareBar
            url={`${env.SITE_URL}/partidos/${match.slug}`}
            title={
              hasScore(match) ? `${scoreText(match)} · ${match.seriesName}` : `${title} · ${match.seriesName}`
            }
          />
        </section>
      </div>
    </article>
  )
}
