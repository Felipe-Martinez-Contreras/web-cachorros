import type { Metadata } from 'next'
import { connection } from 'next/server'
import { ClubImage } from '@/components/site/club-image'
import { PageHero } from '@/components/site/page-shell'
import { EmptyState } from '@/components/ui/feedback'
import { HistoryNav } from '@/features/history/components/history-nav'
import { getHistoricKits } from '@/features/history/queries'

export const metadata: Metadata = {
  title: 'Camisetas históricas',
  description: 'Las camisetas que ha vestido el Club Deportivo Los Cachorros a lo largo de su historia.',
}

export default async function HistoricKitsPage() {
  // Los datos se leen en runtime: sin esto, el build intentaría consultar la base (especificación 3.4).
  await connection()
  const kits = await getHistoricKits()

  return (
    <>
      <PageHero
        crumbs={[
          { href: '/', label: 'Inicio' },
          { href: '/historia', label: 'Historia' },
          { label: 'Camisetas' },
        ]}
        title="Camisetas históricas"
      >
        <HistoryNav current="/historia/camisetas" />
      </PageHero>
      <div className="container-site grid grid-cols-1 py-8 md:py-12">
        {kits.length === 0 ? (
          <EmptyState title="Todavía no hay camisetas publicadas">Vuelve pronto.</EmptyState>
        ) : (
          <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {kits.map((kit) => (
              <li key={kit.id} className="grid content-start gap-3">
                {kit.image && (
                  <figure className="grid gap-1">
                    <ClubImage
                      image={kit.image}
                      sizes="(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw"
                      className="aspect-square w-full rounded-lg bg-(--surface) object-contain"
                    />
                    {kit.image.credit && (
                      <figcaption className="text-meta text-(--muted)">Foto: {kit.image.credit}</figcaption>
                    )}
                  </figure>
                )}
                {kit.years && <h2 className="text-h3">{kit.years}</h2>}
                <p className="whitespace-pre-line">{kit.description}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
