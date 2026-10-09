import type { Metadata } from 'next'
import { connection } from 'next/server'
import { ClubImage } from '@/components/site/club-image'
import { PageHero } from '@/components/site/page-shell'
import { EmptyState } from '@/components/ui/feedback'
import { HistoryNav } from '@/features/history/components/history-nav'
import { getHallOfFame } from '@/features/history/queries'

export const metadata: Metadata = {
  title: 'Salón de la fama',
  description: 'Las personas que marcaron la historia del Club Deportivo Los Cachorros.',
}

export default async function HallOfFamePage() {
  // Los datos se leen en runtime: sin esto, el build intentaría consultar la base (especificación 3.4).
  await connection()
  const idols = await getHallOfFame()

  return (
    <>
      <PageHero
        crumbs={[
          { href: '/', label: 'Inicio' },
          { href: '/historia', label: 'Historia' },
          { label: 'Salón de la fama' },
        ]}
        title="Salón de la fama"
      >
        <HistoryNav current="/historia/salon-de-la-fama" />
      </PageHero>
      <div className="container-site grid grid-cols-1 py-8 md:py-12">
        {idols.length === 0 ? (
          <EmptyState title="El salón de la fama se está armando">Vuelve pronto.</EmptyState>
        ) : (
          <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {idols.map((idol) => (
              <li key={idol.id} className="grid content-start gap-3">
                <div className="aspect-[4/5] overflow-hidden rounded-lg bg-(--surface)">
                  {idol.photo ? (
                    <ClubImage
                      image={idol.photo}
                      sizes="(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw"
                      className="size-full object-cover"
                    />
                  ) : (
                    // biome-ignore lint/performance/noImgElement: archivo estático pequeño, sin optimizador (2.7)
                    <img
                      src="/placeholder/jugador.svg"
                      alt=""
                      width={400}
                      height={500}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  )}
                </div>
                <h2 className="text-h3">
                  {idol.fullName}
                  {idol.nickname && <span className="font-normal text-(--muted)"> «{idol.nickname}»</span>}
                </h2>
                {(idol.position || idol.eraLabel) && (
                  <p className="text-meta text-(--muted)">
                    {[idol.position, idol.eraLabel].filter(Boolean).join(' · ')}
                  </p>
                )}
                {idol.bio && <p className="whitespace-pre-line">{idol.bio}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
