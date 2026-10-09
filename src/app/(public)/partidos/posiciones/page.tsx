import type { Metadata } from 'next'
import { connection } from 'next/server'
import { PageHero } from '@/components/site/page-shell'
import { EmptyState } from '@/components/ui/feedback'
import { SportsNav } from '@/features/matches/components/sports-nav'
import { StandingsTable } from '@/features/matches/components/standings-table'
import { resolveSportsParams } from '@/features/matches/lib/public-params'
import { getSportsNav, getStandings } from '@/features/matches/public-queries'

export const metadata: Metadata = {
  title: 'Tabla de posiciones',
  description: 'Tabla de posiciones de cada serie del Club Deportivo Los Cachorros.',
}

type Props = { searchParams: Promise<{ serie?: string | string[]; temporada?: string | string[] }> }

export default async function StandingsPage({ searchParams }: Props) {
  // Los datos se leen en runtime: sin esto, el build intentaría consultar la base (especificación 3.4).
  await connection()
  const [params, nav] = await Promise.all([searchParams, getSportsNav()])
  const { series, season } = resolveSportsParams(nav, params)
  const tables = series && season ? await getStandings(series.id, season.id) : []

  return (
    <>
      <PageHero
        crumbs={[
          { href: '/', label: 'Inicio' },
          { href: '/partidos', label: 'Partidos' },
          { label: 'Posiciones' },
        ]}
        title="Tabla de posiciones"
      />
      <div className="container-site grid grid-cols-1 gap-10 py-8 md:py-12">
        {series && season ? (
          <>
            <SportsNav
              nav={nav}
              path="/partidos/posiciones"
              section="posiciones"
              seriesSlug={series.slug}
              season={season}
            />
            {tables.length === 0 ? (
              <EmptyState title={`Todavía no hay tabla de ${series.name} para la ${season.name}`}>
                Se publicará cuando comience el campeonato.
              </EmptyState>
            ) : (
              tables.map((table) => (
                <section
                  key={`${table.competitionName}:${table.groupLabel}`}
                  aria-label={`${table.competitionName} ${table.groupLabel}`.trim()}
                  className="grid max-w-4xl grid-cols-1 gap-3"
                >
                  <h2 className="text-h3">
                    {table.competitionName}
                    {table.groupLabel && ` · ${table.groupLabel}`}
                  </h2>
                  <StandingsTable standings={table} />
                </section>
              ))
            )}
          </>
        ) : (
          <EmptyState title="Todavía no hay tablas publicadas">Vuelve pronto.</EmptyState>
        )}
      </div>
    </>
  )
}
