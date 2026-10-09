import type { Metadata } from 'next'
import { connection } from 'next/server'
import { PageHero } from '@/components/site/page-shell'
import { EmptyState } from '@/components/ui/feedback'
import { MatchCard } from '@/features/matches/components/match-card'
import { SportsNav } from '@/features/matches/components/sports-nav'
import type { MatchDTO } from '@/features/matches/dto'
import { resolveSportsParams } from '@/features/matches/lib/public-params'
import { getFixture, getSportsNav } from '@/features/matches/public-queries'

export const metadata: Metadata = {
  title: 'Partidos',
  description: 'Fixture y resultados de todas las series del Club Deportivo Los Cachorros.',
}

type Props = { searchParams: Promise<{ serie?: string | string[]; temporada?: string | string[] }> }

/** Partidos que todavía no tienen resultado: por jugar, en vivo, postergados o suspendidos. */
const isPending = (match: MatchDTO) => match.status !== 'finalizado' && match.status !== 'cancelado'

function MatchList({ title, matches }: { title: string; matches: MatchDTO[] }) {
  if (matches.length === 0) return null
  const id = title.toLowerCase().replace(/\s+/g, '-')
  return (
    <section aria-labelledby={id} className="grid gap-4">
      <h2 id={id} className="text-h2 uppercase">
        {title}
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {matches.map((match) => (
          <li key={match.id}>
            <MatchCard match={match} />
          </li>
        ))}
      </ul>
    </section>
  )
}

export default async function FixturePage({ searchParams }: Props) {
  // Los datos se leen en runtime: sin esto, el build intentaría consultar la base (especificación 3.4).
  await connection()
  const [params, nav] = await Promise.all([searchParams, getSportsNav()])
  const { series, season } = resolveSportsParams(nav, params)
  const matches = series && season ? await getFixture(series.id, season.id) : []
  const upcoming = matches.filter(isPending)
  // Los resultados, del más reciente al más antiguo.
  const played = matches.filter((match) => !isPending(match)).reverse()

  return (
    <>
      <PageHero crumbs={[{ href: '/', label: 'Inicio' }, { label: 'Partidos' }]} title="Partidos" />
      <div className="container-site grid grid-cols-1 gap-10 py-8 md:py-12">
        {series && season ? (
          <>
            <SportsNav
              nav={nav}
              path="/partidos"
              section="fixture"
              seriesSlug={series.slug}
              season={season}
            />
            {matches.length === 0 ? (
              <EmptyState title={`${series.name} todavía no tiene partidos en la ${season.name}`}>
                Cuando se programe la próxima fecha, aparecerá aquí.
              </EmptyState>
            ) : (
              <>
                <MatchList title="Próximos partidos" matches={upcoming} />
                <MatchList title="Resultados" matches={played} />
              </>
            )}
          </>
        ) : (
          <EmptyState title="Todavía no hay partidos publicados">Vuelve pronto.</EmptyState>
        )}
      </div>
    </>
  )
}
