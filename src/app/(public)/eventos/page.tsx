import type { Metadata } from 'next'
import { connection } from 'next/server'
import { PageHero } from '@/components/site/page-shell'
import { EmptyState } from '@/components/ui/feedback'
import { Pagination } from '@/components/ui/pagination'
import { EventCard } from '@/features/events/components/event-card'
import { eventsListHref, parsePage } from '@/features/events/lib/public'
import { getEventsPage } from '@/features/events/queries'
import { pageMetadata } from '@/features/seo/metadata'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Eventos',
    description:
      'Completadas, bingos, rifas, aniversarios y campeonatos de verano del Club Deportivo Los Cachorros.',
    path: '/eventos',
  })
}

type Props = { searchParams: Promise<{ pagina?: string | string[] }> }

const gridClass = 'grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3'

export default async function EventsPage({ searchParams }: Props) {
  // Los datos se leen en runtime: sin esto, el build intentaría consultar la base (especificación 3.4).
  await connection()
  const { upcoming, past, page, totalPages } = await getEventsPage(parsePage((await searchParams).pagina))

  return (
    <>
      <PageHero crumbs={[{ href: '/', label: 'Inicio' }, { label: 'Eventos' }]} title="Eventos">
        <p className="max-w-2xl text-(--muted)">
          Las actividades que sostienen al club: completadas, bingos, rifas, aniversarios y más. Súmate.
        </p>
      </PageHero>

      <div className="container-site grid grid-cols-1 gap-12 py-8 md:py-12">
        {page === 1 && (
          <section aria-labelledby="proximos" className="grid gap-5">
            <h2 id="proximos" className="text-h2 uppercase">
              Próximos eventos
            </h2>
            {upcoming.length === 0 ? (
              <EmptyState title="Por ahora no hay eventos programados">
                Síguenos en redes para enterarte del próximo.
              </EmptyState>
            ) : (
              <ul className={gridClass}>
                {upcoming.map((event) => (
                  <li key={event.id}>
                    <EventCard event={event} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {past.length > 0 && (
          <section aria-labelledby="pasados" className="grid gap-5">
            <h2 id="pasados" className="text-h2 uppercase">
              Eventos pasados{page > 1 && ` · página ${page}`}
            </h2>
            <ul className={gridClass}>
              {past.map((event) => (
                <li key={event.id}>
                  <EventCard event={event} />
                </li>
              ))}
            </ul>
            <Pagination page={page} totalPages={totalPages} hrefFor={eventsListHref} />
          </section>
        )}
      </div>
    </>
  )
}
