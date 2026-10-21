import { ExternalLink, FileText } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { CopyBlock } from '@/components/site/copy-block'
import { DirectChannels } from '@/components/site/direct-channels'
import { PageHero } from '@/components/site/page-shell'
import { RichText } from '@/components/site/rich-text'
import { loadSite } from '@/components/site/site-frame'
import { buttonVariants } from '@/components/ui/button'
import { getDonationInfo } from '@/features/club/queries'
import { getPageBlock } from '@/features/pages/queries'
import { pageMetadata } from '@/features/seo/metadata'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Apoya al club',
    description:
      'Cómo aportar al Club Deportivo Los Cachorros: datos de transferencia, en qué se usan los aportes y las rendiciones.',
    path: '/apoya-al-club',
  })
}

export default async function SupportPage() {
  // Los datos se leen en runtime: sin esto, el build intentaría consultar la base (especificación 3.4).
  await connection()
  const [site, usage, donation] = await Promise.all([
    loadSite(),
    getPageBlock('donaciones.uso'),
    getDonationInfo(),
  ])

  return (
    <>
      <PageHero crumbs={[{ href: '/', label: 'Inicio' }, { label: 'Apoya al club' }]} title="Apoya al club">
        <p className="max-w-2xl text-(--muted)">
          Cada aporte se transforma en balones, camisetas, traslados y una cancha mejor para todas las series.
        </p>
      </PageHero>

      <div className="container-site grid max-w-3xl grid-cols-1 gap-12 py-8 md:py-12">
        {usage && (
          <section aria-labelledby="uso" className="grid gap-4">
            <h2 id="uso" className="text-h2 uppercase">
              {usage.title ?? '¿En qué se usan los aportes?'}
            </h2>
            <RichText doc={usage.body} images={usage.images} />
          </section>
        )}

        <section aria-labelledby="transferencia" className="grid gap-4">
          <h2 id="transferencia" className="text-h2 uppercase">
            Transferencia
          </h2>
          {donation.transferText ? (
            <CopyBlock text={donation.transferText} buttonLabel="Copiar datos" />
          ) : (
            <p className="text-(--muted)">Pronto publicaremos los datos. Mientras tanto, escríbenos.</p>
          )}
          {donation.paymentUrl && (
            <p>
              <a
                href={donation.paymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: 'dark', size: 'lg' })}
              >
                Aportar con tarjeta <ExternalLink aria-hidden="true" />
                <span className="sr-only"> (se abre en una pestaña nueva)</span>
              </a>
            </p>
          )}
        </section>

        <section aria-labelledby="rendiciones" className="grid gap-3">
          <h2 id="rendiciones" className="text-h2 uppercase">
            Rendiciones
          </h2>
          <p className="text-(--muted)">Publicamos en qué se usó cada aporte. Revísalo cuando quieras.</p>
          <p>
            <Link
              href="/club/transparencia?categoria=rendicion"
              className={buttonVariants({ variant: 'outline' })}
            >
              <FileText aria-hidden="true" /> Ver las rendiciones
            </Link>
          </p>
          <DirectChannels site={site} />
        </section>
      </div>
    </>
  )
}
