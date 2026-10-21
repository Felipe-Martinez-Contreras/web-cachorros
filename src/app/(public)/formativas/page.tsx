import { Mail, MessageCircle } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { PageHero } from '@/components/site/page-shell'
import { RichText } from '@/components/site/rich-text'
import { loadSite } from '@/components/site/site-frame'
import { buttonVariants } from '@/components/ui/button'
import { TrainingSchedule } from '@/features/club/components/training-schedule'
import { getTrainingBySeries } from '@/features/club/queries'
import { getPageBlock } from '@/features/pages/queries'
import { pageMetadata } from '@/features/seo/metadata'
import { whatsappUrl } from '@/lib/links'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Divisiones formativas',
    description:
      'La escuela de fútbol y las series menores del Club Deportivo Los Cachorros: categorías, horarios y cómo inscribirse.',
    path: '/formativas',
  })
}

export default async function YouthPage() {
  // Los datos se leen en runtime: sin esto, el build intentaría consultar la base (especificación 3.4).
  await connection()
  const [site, info, faq, training] = await Promise.all([
    loadSite(),
    getPageBlock('formativas.info'),
    getPageBlock('formativas.preguntas'),
    getTrainingBySeries('youth'),
  ])

  return (
    <>
      <PageHero
        crumbs={[{ href: '/', label: 'Inicio' }, { label: 'Divisiones formativas' }]}
        title="Divisiones formativas"
      >
        <p className="max-w-2xl text-(--muted)">
          Fútbol para niñas, niños y jóvenes de Sagrada Familia: aprender, compartir y crecer con la camiseta
          del club.
        </p>
      </PageHero>

      <div className="container-site grid grid-cols-1 gap-12 py-8 md:py-12">
        {info && (
          <section aria-labelledby="escuela" className="grid max-w-3xl gap-4">
            <h2 id="escuela" className="text-h2 uppercase">
              {info.title ?? 'La escuela'}
            </h2>
            <RichText doc={info.body} images={info.images} />
          </section>
        )}

        {training.length > 0 && (
          <section aria-labelledby="series-formativas" className="grid gap-4">
            <h2 id="series-formativas" className="text-h2 uppercase">
              Categorías y horarios
            </h2>
            <TrainingSchedule series={training} showCoaches showDescription />
          </section>
        )}

        <section aria-labelledby="inscripcion" className="theme-dark grid gap-4 rounded-lg p-6 md:p-8">
          <h2 id="inscripcion" className="text-h2 uppercase">
            ¿Quieres inscribir a tu hijo o hija?
          </h2>
          <p className="max-w-2xl text-(--muted)">
            Escríbenos y te contamos cómo sumarte. Los datos los entrega siempre el adulto responsable: por
            este sitio no pedimos datos de niños.
          </p>
          <div className="flex flex-wrap gap-3">
            {site.whatsapp && (
              <a
                href={whatsappUrl(
                  site.whatsapp,
                  '¡Hola! Quiero información para inscribir a mi hijo o hija en formativas.',
                )}
                className={buttonVariants({ size: 'lg' })}
              >
                <MessageCircle aria-hidden="true" /> Escribir por WhatsApp
              </a>
            )}
            <Link
              href="/contacto?tema=formativas"
              className={buttonVariants({ variant: 'light', size: 'lg' })}
            >
              <Mail aria-hidden="true" /> Escribir desde Contacto
            </Link>
          </div>
        </section>

        {faq && (
          <section id="preguntas" aria-labelledby="preguntas-titulo" className="grid max-w-3xl gap-4">
            <h2 id="preguntas-titulo" className="text-h2 uppercase">
              {faq.title ?? 'Preguntas frecuentes'}
            </h2>
            <RichText doc={faq.body} images={faq.images} />
          </section>
        )}
      </div>
    </>
  )
}
