import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { connection } from 'next/server'
import { PageHero } from '@/components/site/page-shell'
import { EmptyState } from '@/components/ui/feedback'
import { SportsNav } from '@/features/matches/components/sports-nav'
import { resolveSportsParams } from '@/features/matches/lib/public-params'
import { getSportsNav, resolveSlugRedirect } from '@/features/matches/public-queries'
import { PlayerCard, StaffCard } from '@/features/players/components/player-card'
import { getSquad } from '@/features/players/public-queries'
import { pageMetadata } from '@/features/seo/metadata'
import { playerPositionGroupLabels } from '@/lib/labels'

type Props = {
  params: Promise<{ serie: string }>
  searchParams: Promise<{ temporada?: string | string[] }>
}

async function loadSquad({ params, searchParams }: Props) {
  // Los datos se leen en runtime: sin esto, el build intentaría consultar la base (especificación 3.4).
  await connection()
  const [{ serie }, query, nav] = await Promise.all([params, searchParams, getSportsNav()])
  const { season } = resolveSportsParams(nav, { serie, temporada: query.temporada })
  const squad = season ? await getSquad(serie, season.id) : null
  if (squad && season) return { squad, season, nav }
  // Serie renombrada: su dirección antigua lleva a la vigente (3.9).
  const current = await resolveSlugRedirect('series', serie)
  if (current) permanentRedirect(`/plantel/${current}`)
  notFound()
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { squad } = await loadSquad(props)
  return pageMetadata({
    title: `Plantel ${squad.series.name}`,
    description: `Jugadores y cuerpo técnico de la serie ${squad.series.name} del Club Deportivo Los Cachorros, ${squad.seasonName}.`,
    path: `/plantel/${squad.series.slug}`,
  })
}

const gridClass = 'grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5'

export default async function SquadPage(props: Props) {
  const { squad, season, nav } = await loadSquad(props)
  const groups = (['arquero', 'defensa', 'mediocampista', 'delantero'] as const)
    .map((position) => ({
      position,
      players: squad.players.filter((player) => player.position === position),
    }))
    .filter((group) => group.players.length > 0)

  return (
    <>
      <PageHero
        crumbs={[{ href: '/', label: 'Inicio' }, { label: 'Plantel' }]}
        eyebrow={squad.seasonName}
        title={`Plantel ${squad.series.name}`}
      >
        {squad.series.description && (
          <p className="max-w-2xl text-lg text-(--muted)">{squad.series.description}</p>
        )}
      </PageHero>
      <div className="container-site grid grid-cols-1 gap-12 py-8 md:py-12">
        <SportsNav
          nav={nav}
          path={`/plantel/${squad.series.slug}`}
          seriesSlug={squad.series.slug}
          season={season}
          seriesInPath
        />
        {squad.players.length === 0 && squad.staff.length === 0 ? (
          <EmptyState title={`Todavía no hay plantel de ${squad.series.name} para la ${squad.seasonName}`}>
            Se publicará cuando se inscriban los jugadores.
          </EmptyState>
        ) : (
          <>
            {groups.map((group) => (
              <section
                key={group.position}
                aria-labelledby={`linea-${group.position}`}
                className="grid gap-5"
              >
                <h2 id={`linea-${group.position}`} className="text-h2 uppercase">
                  {playerPositionGroupLabels[group.position]}
                </h2>
                <ul className={gridClass}>
                  {group.players.map((player) => (
                    <li key={`${player.shirtNumber}:${player.name}`}>
                      <PlayerCard player={player} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {squad.staff.length > 0 && (
              <section aria-labelledby="cuerpo-tecnico" className="grid gap-5">
                <h2 id="cuerpo-tecnico" className="text-h2 uppercase">
                  Cuerpo técnico
                </h2>
                <ul className={gridClass}>
                  {squad.staff.map((member) => (
                    <li key={`${member.role}:${member.name}`}>
                      <StaffCard member={member} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </>
  )
}
