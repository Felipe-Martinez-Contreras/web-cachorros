import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { connection } from 'next/server'
import { ClubImage } from '@/components/site/club-image'
import { Breadcrumbs } from '@/components/site/page-shell'
import { resolveSlugRedirect } from '@/features/matches/public-queries'
import { getPlayerProfile } from '@/features/players/public-queries'
import { playerPositionLabels, positionDetailLabels } from '@/lib/labels'

type Props = { params: Promise<{ slug: string }> }

/** La ficha no existe para menores de edad ni para jugadores inactivos: responde 404 (6.3). */
async function loadProfile(slug: string) {
  // Los datos se leen en runtime: sin esto, el build intentaría consultar la base (especificación 3.4).
  await connection()
  const profile = await getPlayerProfile(slug)
  if (profile) return profile
  const current = await resolveSlugRedirect('player', slug)
  // La dirección vigente vuelve a pasar por la misma regla: si es de un menor, termina en 404.
  if (current && current !== slug) permanentRedirect(`/jugadores/${current}`)
  notFound()
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await loadProfile((await params).slug)
  const series = profile.current.map((item) => item.seriesName).join(', ')
  return {
    title: profile.name,
    description: `${profile.name}, ${playerPositionLabels[profile.position].toLowerCase()} del Club Deportivo Los Cachorros${series ? ` (${series})` : ''}.`,
  }
}

const STAT_COLUMNS = [
  ['PJ', 'Partidos jugados', 'appearances'],
  ['Goles', 'Goles', 'goals'],
  ['TA', 'Tarjetas amarillas', 'yellowCards'],
  ['TR', 'Tarjetas rojas', 'redCards'],
] as const

export default async function PlayerPage({ params }: Props) {
  const profile = await loadProfile((await params).slug)
  const main = profile.current[0]

  return (
    <article>
      <header className="theme-dark">
        <div className="container-site grid grid-cols-1 gap-6 pt-4 pb-10 md:grid-cols-[minmax(0,18rem)_1fr] md:items-end md:pb-14">
          <div className="md:col-span-2">
            <Breadcrumbs
              items={[
                { href: '/', label: 'Inicio' },
                main
                  ? { href: `/plantel/${main.seriesSlug}`, label: `Plantel ${main.seriesName}` }
                  : { href: '/plantel', label: 'Plantel' },
                { label: profile.name },
              ]}
            />
          </div>
          <div className="aspect-[4/5] w-48 overflow-hidden rounded-lg bg-neutral-800 md:w-full">
            {profile.photo ? (
              <ClubImage
                image={profile.photo}
                sizes="(min-width: 768px) 288px, 192px"
                priority
                className="size-full object-cover"
              />
            ) : (
              // biome-ignore lint/performance/noImgElement: archivo estático pequeño, sin optimizador (2.7)
              <img
                src="/placeholder/jugador.svg"
                alt=""
                width={320}
                height={400}
                className="size-full object-cover"
              />
            )}
          </div>
          <div className="grid gap-2">
            <p className="text-eyebrow text-accent">
              {playerPositionLabels[profile.position]}
              {profile.positionDetail && ` · ${positionDetailLabels[profile.positionDetail]}`}
            </p>
            <h1 className="text-h1">{profile.name}</h1>
            {profile.nickname && <p className="text-xl text-(--muted)">«{profile.nickname}»</p>}
            {profile.current.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {profile.current.map((item) => (
                  <li key={item.seriesSlug}>
                    <Link
                      href={`/plantel/${item.seriesSlug}`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-(--border) px-4 font-semibold hover:border-(--fg)"
                    >
                      {item.seriesName}
                      {item.shirtNumber !== null && (
                        <span className="tabular-nums">· N.º {item.shirtNumber}</span>
                      )}
                      {item.isCaptain && <span>· Capitán</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </header>

      <div className="container-site grid grid-cols-1 max-w-4xl gap-6 py-8 md:py-12">
        <h2 className="text-h2 uppercase">Estadísticas</h2>
        {profile.stats.length === 0 ? (
          <p className="text-lg text-(--muted)">Todavía no registra partidos con el club.</p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {STAT_COLUMNS.map(([, label, key]) => (
                <div key={key} className="rounded-lg border border-(--border) p-4">
                  <dt className="text-meta text-(--muted)">{label}</dt>
                  <dd className="font-tight text-5xl font-black tabular-nums [font-stretch:62.5%]">
                    {profile.totals[key]}
                  </dd>
                </div>
              ))}
            </dl>
            <div
              className="overflow-x-auto rounded-lg border border-(--border)"
              {...{
                role: 'region',
                tabIndex: 0,
                'aria-label': `Estadísticas por temporada de ${profile.name}`,
              }}
            >
              <table className="w-full border-collapse text-sm tabular-nums">
                <caption className="sr-only">Estadísticas de {profile.name} por temporada y serie</caption>
                <thead>
                  <tr className="border-b border-(--border) bg-(--surface) text-left">
                    <th scope="col" className="px-3 py-3 font-semibold">
                      Temporada
                    </th>
                    <th scope="col" className="px-3 py-3 font-semibold">
                      Serie
                    </th>
                    {STAT_COLUMNS.map(([short, label, key]) => (
                      <th key={key} scope="col" className="px-3 py-3 text-right font-semibold">
                        <abbr title={label} className="no-underline">
                          {short}
                        </abbr>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {profile.stats.map((row) => (
                    <tr
                      key={`${row.seasonName}:${row.seriesName}`}
                      className="border-b border-(--border) last:border-0"
                    >
                      <th scope="row" className="px-3 py-3 text-left font-semibold">
                        {row.seasonName}
                      </th>
                      <td className="px-3 py-3">{row.seriesName}</td>
                      {STAT_COLUMNS.map(([, , key]) => (
                        <td key={key} className="px-3 py-3 text-right">
                          {row[key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-meta text-(--muted)">
              Las estadísticas se calculan con los partidos finalizados que el club tiene cargados.
            </p>
          </>
        )}
      </div>
    </article>
  )
}
