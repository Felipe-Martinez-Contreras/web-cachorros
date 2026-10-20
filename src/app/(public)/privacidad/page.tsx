import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { PageHero } from '@/components/site/page-shell'
import { RichText } from '@/components/site/rich-text'
import { EmptyState } from '@/components/ui/feedback'
import { getPageBlock } from '@/features/pages/queries'
import { pageMetadata } from '@/features/seo/metadata'
import { formatLongDateTime } from '@/lib/format'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Política de privacidad',
    description:
      'Cómo el Club Deportivo Los Cachorros trata los datos personales que recibe por el sitio y cómo ejercer tus derechos.',
    path: '/privacidad',
  })
}

export default async function PrivacyPage() {
  // Los datos se leen en runtime: sin esto, el build intentaría consultar la base (especificación 3.4).
  await connection()
  const policy = await getPageBlock('privacidad.politica')

  return (
    <>
      <PageHero
        crumbs={[{ href: '/', label: 'Inicio' }, { label: 'Privacidad' }]}
        title={policy?.title ?? 'Política de privacidad'}
      >
        {policy && (
          // La versión es la fecha de la última edición: es la que queda registrada con cada consentimiento.
          <p className="text-meta text-(--muted)">
            Versión vigente del{' '}
            <time dateTime={policy.updatedAt}>{formatLongDateTime(policy.updatedAt)}</time>
          </p>
        )}
      </PageHero>
      <div className="container-site grid max-w-3xl grid-cols-1 gap-6 py-8 md:py-12">
        {policy ? (
          <RichText doc={policy.body} images={policy.images} />
        ) : (
          <EmptyState title="Estamos preparando la política de privacidad">
            Mientras tanto, si tienes una consulta sobre tus datos,{' '}
            <Link href="/contacto" className="text-(--link) underline">
              escríbenos
            </Link>
            .
          </EmptyState>
        )}
        <p className="text-(--muted)">
          Para pedir una copia de tus datos, corregirlos o eliminarlos, escríbenos desde{' '}
          <Link href="/contacto" className="text-(--link) underline">
            Contacto
          </Link>
          .
        </p>
      </div>
    </>
  )
}
