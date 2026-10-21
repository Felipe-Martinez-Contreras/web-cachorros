import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { DirectChannels } from '@/components/site/direct-channels'
import { PageHero } from '@/components/site/page-shell'
import { type PublicFieldConfig, PublicForm } from '@/components/site/public-form'
import { RichText } from '@/components/site/rich-text'
import { loadSite } from '@/components/site/site-frame'
import { EmptyState } from '@/components/ui/feedback'
import { publicFormProps } from '@/features/inbox/form-props'
import { getPageBlock } from '@/features/pages/queries'
import { pageMetadata } from '@/features/seo/metadata'
import { SponsorShowcase } from '@/features/sponsors/components/sponsor-showcase'
import { getActiveSponsors } from '@/features/sponsors/queries'
import { optionsFromLabels } from '@/lib/form-schemas'
import { isFormErrorCode } from '@/lib/forms/messages'
import { sponsorTierLabels } from '@/lib/labels'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Auspiciadores',
    description:
      'Los comercios y empresas que apoyan al Club Deportivo Los Cachorros, y cómo auspiciar al club.',
    path: '/auspiciadores',
  })
}

type Props = { searchParams: Promise<{ enviado?: string; error?: string }> }

export default async function SponsorsPage({ searchParams }: Props) {
  // Por petición: la página firma el momento en que se dibuja el formulario (tiempo mínimo de llenado).
  await connection()
  const [params, site, sponsors, benefits] = await Promise.all([
    searchParams,
    loadSite(),
    getActiveSponsors(),
    getPageBlock('auspiciadores.beneficios'),
  ])
  const notice =
    params.enviado === '1'
      ? { ok: true as const }
      : isFormErrorCode(params.error)
        ? { ok: false as const, code: params.error }
        : null

  const fields: PublicFieldConfig[] = [
    {
      kind: 'text',
      name: 'businessName',
      label: 'Comercio o empresa',
      autoComplete: 'organization',
      required: true,
    },
    { kind: 'text', name: 'contactName', label: 'Tu nombre', autoComplete: 'name', required: true },
    { kind: 'email', name: 'email', label: 'Correo', autoComplete: 'email', required: true },
    { kind: 'tel', name: 'phone', label: 'Celular', autoComplete: 'tel' },
    {
      kind: 'select',
      name: 'tierInterest',
      label: 'Nivel que te interesa',
      options: [{ value: '', label: 'Aún no lo sé' }, ...optionsFromLabels(sponsorTierLabels)],
      defaultValue: '',
    },
    { kind: 'textarea', name: 'message', label: 'Mensaje', help: '¿Qué te gustaría proponer?' },
    {
      kind: 'checkbox',
      name: 'privacy',
      required: true,
      label: (
        <>
          Acepto la{' '}
          <Link href="/privacidad" className="text-(--link) underline">
            política de privacidad
          </Link>
          : el club usará estos datos solo para responder sobre el auspicio.
        </>
      ),
    },
  ]

  return (
    <>
      <PageHero crumbs={[{ href: '/', label: 'Inicio' }, { label: 'Auspiciadores' }]} title="Auspiciadores">
        <p className="max-w-2xl text-(--muted)">
          Gracias a ellos el club sigue en la cancha. Visítalos y cuéntales que llegaste desde aquí.
        </p>
      </PageHero>

      <div className="container-site grid grid-cols-1 gap-10 py-8">
        {sponsors.length === 0 ? (
          <EmptyState title="Este espacio espera a su primer auspiciador">
            ¿Te interesa? Escríbenos con el formulario de abajo.
          </EmptyState>
        ) : (
          <SponsorShowcase sponsors={sponsors} />
        )}
      </div>

      <section
        id="auspiciar"
        aria-labelledby="auspiciar-titulo"
        className="container-site grid max-w-3xl grid-cols-1 gap-4 py-8 md:pb-12"
      >
        <h2 id="auspiciar-titulo" className="text-h2 uppercase">
          ¿Quieres auspiciar al club?
        </h2>
        {benefits && <RichText doc={benefits.body} images={benefits.images} />}
        <div id="formulario" className="grid gap-4">
          <PublicForm
            {...publicFormProps('auspicios')}
            fields={fields}
            submitLabel="Enviar interés"
            success={{
              title: '¡Gracias por tu interés!',
              text: 'Te enviamos una copia a tu correo. La directiva te contactará pronto.',
            }}
            notice={notice}
            directChannels={<DirectChannels site={site} />}
          />
        </div>
      </section>
    </>
  )
}
