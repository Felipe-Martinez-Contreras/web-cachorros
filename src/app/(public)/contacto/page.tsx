import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { DirectChannels } from '@/components/site/direct-channels'
import { PageHero } from '@/components/site/page-shell'
import { type PublicFieldConfig, PublicForm } from '@/components/site/public-form'
import { loadSite } from '@/components/site/site-frame'
import { publicFormProps } from '@/features/inbox/form-props'
import { pageMetadata } from '@/features/seo/metadata'
import { SocialFollowLinks } from '@/features/social/components/social-post-card'
import { optionsFromLabels } from '@/lib/form-schemas'
import { isFormErrorCode } from '@/lib/forms/messages'
import { contactTopicLabels } from '@/lib/labels'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Contacto',
    description:
      'Escríbele al Club Deportivo Los Cachorros: socios, auspicios, formativas, prensa e historia.',
    path: '/contacto',
  })
}

type Props = { searchParams: Promise<{ tema?: string | string[]; enviado?: string; error?: string }> }

export default async function ContactPage({ searchParams }: Props) {
  // Por petición: la página firma el momento en que se dibuja el formulario (tiempo mínimo de llenado).
  await connection()
  const [params, site] = await Promise.all([searchParams, loadSite()])
  const topic =
    typeof params.tema === 'string' && Object.hasOwn(contactTopicLabels, params.tema)
      ? params.tema
      : 'general'
  const notice =
    params.enviado === '1'
      ? { ok: true as const }
      : isFormErrorCode(params.error)
        ? { ok: false as const, code: params.error }
        : null

  const fields: PublicFieldConfig[] = [
    {
      kind: 'select',
      name: 'topic',
      label: 'Tema',
      options: optionsFromLabels(contactTopicLabels),
      defaultValue: topic,
      required: true,
    },
    { kind: 'text', name: 'name', label: 'Nombre', autoComplete: 'name', required: true },
    { kind: 'email', name: 'email', label: 'Correo', autoComplete: 'email', required: true },
    {
      kind: 'tel',
      name: 'phone',
      label: 'Celular',
      autoComplete: 'tel',
      help: 'Si prefieres que te respondamos por WhatsApp.',
    },
    { kind: 'textarea', name: 'message', label: 'Mensaje', required: true },
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
          : el club usará estos datos solo para responderme.
        </>
      ),
    },
  ]

  return (
    <>
      <PageHero crumbs={[{ href: '/', label: 'Inicio' }, { label: 'Contacto' }]} title="Contacto">
        <p className="max-w-2xl text-(--muted)">
          ¿Quieres hacerte socio, auspiciar, inscribir a tu hijo en formativas o tienes un dato de la historia
          del club? Escríbenos.
        </p>
      </PageHero>
      <div className="container-site grid gap-10 py-10 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section id="formulario" aria-labelledby="formulario-titulo" className="grid gap-4">
          <h2 id="formulario-titulo" className="text-h2">
            Envíanos un mensaje
          </h2>
          <PublicForm
            {...publicFormProps('contacto')}
            fields={fields}
            submitLabel="Enviar mensaje"
            success={{
              title: '¡Mensaje enviado!',
              text: 'Te enviamos una copia a tu correo. Te responderemos lo antes posible.',
            }}
            notice={notice}
            directChannels={<DirectChannels site={site} />}
          />
        </section>
        <aside aria-labelledby="canales-titulo" className="grid content-start gap-3">
          <h2 id="canales-titulo" className="text-h3">
            Otros canales
          </h2>
          <DirectChannels site={site} />
          {site.socialLinks.length > 0 && (
            <>
              <h3 className="text-eyebrow text-(--muted)">Síguenos</h3>
              <SocialFollowLinks links={site.socialLinks} />
            </>
          )}
        </aside>
      </div>
    </>
  )
}
