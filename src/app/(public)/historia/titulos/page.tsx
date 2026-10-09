import type { Metadata } from 'next'
import { connection } from 'next/server'
import { ClubImage } from '@/components/site/club-image'
import { PageHero } from '@/components/site/page-shell'
import { EmptyState } from '@/components/ui/feedback'
import { HistoryNav } from '@/features/history/components/history-nav'
import { getHonours } from '@/features/history/queries'
import { pageMetadata } from '@/features/seo/metadata'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Títulos',
    description: 'Títulos y campeonatos del Club Deportivo Los Cachorros.',
    path: '/historia/titulos',
  })
}

export default async function HonoursPage() {
  // Los datos se leen en runtime: sin esto, el build intentaría consultar la base (especificación 3.4).
  await connection()
  const honours = await getHonours()

  return (
    <>
      <PageHero
        crumbs={[
          { href: '/', label: 'Inicio' },
          { href: '/historia', label: 'Historia' },
          { label: 'Títulos' },
        ]}
        title="Títulos"
      >
        <HistoryNav current="/historia/titulos" />
      </PageHero>
      <div className="container-site grid grid-cols-1 py-8 md:py-12">
        {honours.length === 0 ? (
          <EmptyState title="Todavía no hay títulos publicados">Vuelve pronto.</EmptyState>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {honours.map((honour) => (
              <li
                key={honour.id}
                className="grid content-start gap-3 rounded-lg border border-(--border) bg-(--surface) p-5"
              >
                {honour.image && (
                  <ClubImage
                    image={honour.image}
                    sizes="(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw"
                    className="aspect-[4/3] w-full rounded-md object-cover"
                  />
                )}
                {honour.year !== null && (
                  <p className="font-tight text-5xl leading-none font-black [font-stretch:62.5%]">
                    {honour.year}
                  </p>
                )}
                <h2 className="text-h3">{honour.name}</h2>
                {(honour.competitionName || honour.seriesName) && (
                  <p className="text-meta text-(--muted)">
                    {[honour.competitionName, honour.seriesName].filter(Boolean).join(' · ')}
                  </p>
                )}
                {honour.description && <p className="whitespace-pre-line">{honour.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
