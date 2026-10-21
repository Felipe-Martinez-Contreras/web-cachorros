import { MapPin, Navigation } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { DirectChannels } from '@/components/site/direct-channels'
import { MapFacade } from '@/components/site/map-facade'
import { PageHero } from '@/components/site/page-shell'
import { loadSite } from '@/components/site/site-frame'
import { buttonVariants } from '@/components/ui/button'
import { TrainingSchedule } from '@/features/club/components/training-schedule'
import { openStreetMapUrls } from '@/features/club/lib/place'
import { getClubPlace, getTrainingBySeries } from '@/features/club/queries'
import { pageMetadata } from '@/features/seo/metadata'
import { directionsUrls } from '@/lib/links'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'La cancha',
    description:
      'Cómo llegar a la cancha del Club Deportivo Los Cachorros en Sagrada Familia y los horarios de entrenamiento.',
    path: '/club/la-cancha',
  })
}

export default async function FieldPage() {
  // Los datos se leen en runtime: sin esto, el build intentaría consultar la base (especificación 3.4).
  await connection()
  const [site, place, training] = await Promise.all([loadSite(), getClubPlace(), getTrainingBySeries('all')])
  const address = [place.address, place.commune, place.region].filter(Boolean).join(', ')
  const map = place.geo ? openStreetMapUrls(place.geo.lat, place.geo.lng) : null
  const directions = place.geo ? directionsUrls(place.geo.lat, place.geo.lng) : null

  return (
    <>
      <PageHero crumbs={[{ href: '/', label: 'Inicio' }, { label: 'La cancha' }]} title="La cancha">
        {address && (
          <p className="flex items-start gap-2 text-(--muted)">
            <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-accent" />
            {address}
          </p>
        )}
      </PageHero>

      <div className="container-site grid grid-cols-1 gap-12 py-8 md:py-12">
        <section aria-labelledby="como-llegar" className="grid gap-4">
          <h2 id="como-llegar" className="text-h2 uppercase">
            Cómo llegar
          </h2>
          {map && <MapFacade embedUrl={map.embed} pageUrl={map.page} label={`cancha de ${site.shortName}`} />}
          {directions ? (
            <ul aria-label="Abrir la ruta en" className="flex flex-wrap gap-3">
              {(
                [
                  ['Google Maps', directions.google],
                  ['Waze', directions.waze],
                  ['Apple Maps', directions.apple],
                ] as const
              ).map(([name, href]) => (
                <li key={name}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: 'outline' })}
                  >
                    <Navigation aria-hidden="true" /> {name}
                    <span className="sr-only"> (se abre en una pestaña nueva)</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-(--muted)">
              Pronto publicaremos el mapa. Mientras tanto, escríbenos y te contamos.
            </p>
          )}
        </section>

        {training.length > 0 && (
          <section aria-labelledby="entrenamientos" className="grid gap-4">
            <h2 id="entrenamientos" className="text-h2 uppercase">
              Horarios de entrenamiento
            </h2>
            <TrainingSchedule series={training} />
            <p className="text-(--muted)">
              ¿Tu hijo o hija quiere jugar? Revisa{' '}
              <Link href="/formativas" className="text-(--link) underline">
                Divisiones formativas
              </Link>
              .
            </p>
          </section>
        )}

        <section aria-labelledby="contacto-cancha" className="grid max-w-3xl gap-4">
          <h2 id="contacto-cancha" className="text-h2 uppercase">
            ¿Dudas?
          </h2>
          <DirectChannels site={site} />
        </section>
      </div>
    </>
  )
}
