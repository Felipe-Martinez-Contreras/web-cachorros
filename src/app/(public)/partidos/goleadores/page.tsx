import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { PageHero } from '@/components/site/page-shell'
import { EmptyState } from '@/components/ui/feedback'
import { SportsNav } from '@/features/matches/components/sports-nav'
import { resolveSportsParams } from '@/features/matches/lib/public-params'
import { getSportsNav, getTopScorers } from '@/features/matches/public-queries'
import { pageMetadata } from '@/features/seo/metadata'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Goleadores',
    description: 'Goleadores de cada serie del Club Deportivo Los Cachorros.',
    path: '/partidos/goleadores',
  })
}

type Props = { searchParams: Promise<{ serie?: string | string[]; temporada?: string | string[] }> }

export default async function ScorersPage({ searchParams }: Props) {
  // Los datos se leen en runtime: sin esto, el build intentaría consultar la base (especificación 3.4).
  await connection()
  const [params, nav] = await Promise.all([searchParams, getSportsNav()])
  const { series, season } = resolveSportsParams(nav, params)
  const scorers = series && season ? await getTopScorers(series.id, season.id) : []

  return (
    <>
      <PageHero
        crumbs={[
          { href: '/', label: 'Inicio' },
          { href: '/partidos', label: 'Partidos' },
          { label: 'Goleadores' },
        ]}
        title="Goleadores"
      />
      <div className="container-site grid grid-cols-1 gap-10 py-8 md:py-12">
        {series && season ? (
          <>
            <SportsNav
              nav={nav}
              path="/partidos/goleadores"
              section="goleadores"
              seriesSlug={series.slug}
              season={season}
            />
            {scorers.length === 0 ? (
              <EmptyState title={`Todavía no hay goles de ${series.name} en la ${season.name}`}>
                El ranking se arma solo con los resultados cargados.
              </EmptyState>
            ) : (
              <div className="max-w-2xl overflow-hidden rounded-lg border border-(--border)">
                <table className="w-full border-collapse tabular-nums">
                  <caption className="sr-only">
                    Goleadores de {series.name}, {season.name}
                  </caption>
                  <thead>
                    <tr className="border-b border-(--border) bg-(--surface) text-left text-sm">
                      <th scope="col" className="w-12 px-3 py-3 font-semibold">
                        <abbr title="Posición" className="no-underline">
                          Pos
                        </abbr>
                      </th>
                      <th scope="col" className="px-3 py-3 font-semibold">
                        Jugador
                      </th>
                      <th scope="col" className="w-14 px-3 py-3 text-right font-semibold">
                        <abbr title="Partidos jugados" className="no-underline">
                          PJ
                        </abbr>
                      </th>
                      <th scope="col" className="w-16 px-3 py-3 text-right font-semibold">
                        Goles
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {scorers.map((scorer) => (
                      <tr
                        key={`${scorer.rank}:${scorer.player.name}`}
                        className="border-b border-(--border) last:border-0"
                      >
                        <td className="px-3 py-3 text-(--muted)">{scorer.rank}</td>
                        <th scope="row" className="px-3 py-3 text-left font-semibold">
                          {scorer.player.slug ? (
                            <Link
                              href={`/jugadores/${scorer.player.slug}`}
                              className="inline-flex min-h-11 items-center hover:underline hover:underline-offset-4"
                            >
                              {scorer.player.name}
                            </Link>
                          ) : (
                            scorer.player.name
                          )}
                        </th>
                        <td className="px-3 py-3 text-right text-(--muted)">{scorer.appearances}</td>
                        <td className="px-3 py-3 text-right text-lg font-bold">{scorer.goals}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <EmptyState title="Todavía no hay goleadores publicados">Vuelve pronto.</EmptyState>
        )}
      </div>
    </>
  )
}
