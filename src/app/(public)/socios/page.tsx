import { Check } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { DirectChannels } from '@/components/site/direct-channels'
import { PageHero } from '@/components/site/page-shell'
import { type PublicFieldConfig, PublicForm } from '@/components/site/public-form'
import { RichText } from '@/components/site/rich-text'
import { loadSite } from '@/components/site/site-frame'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/feedback'
import { publicFormProps } from '@/features/inbox/form-props'
import { getMembershipPlans, type MembershipPlanDTO } from '@/features/members/queries'
import { getPageBlock } from '@/features/pages/queries'
import { pageMetadata } from '@/features/seo/metadata'
import { formatClp } from '@/lib/format'
import { isFormErrorCode } from '@/lib/forms/messages'
import { feePeriodLabels } from '@/lib/labels'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Hazte socio',
    description:
      'Hazte socio del Club Deportivo Los Cachorros: beneficios, planes y cuotas, y el formulario de inscripción.',
    path: '/socios',
  })
}

type Props = { searchParams: Promise<{ plan?: string | string[]; enviado?: string; error?: string }> }

function PlanCard({ plan }: { plan: MembershipPlanDTO }) {
  return (
    <li className="grid content-start gap-3 rounded-lg border border-(--border) bg-(--surface) p-5">
      <h3 className="text-h3">{plan.name}</h3>
      <p>
        <span className="font-tight text-4xl font-black [font-stretch:62.5%]">{formatClp(plan.feeClp)}</span>{' '}
        <span className="text-(--muted)">{feePeriodLabels[plan.feePeriod]}</span>
      </p>
      {plan.benefits.length > 0 && (
        <ul className="grid gap-1">
          {plan.benefits.map((benefit) => (
            <li key={benefit} className="flex gap-2">
              <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-(--link)" />
              {benefit}
            </li>
          ))}
        </ul>
      )}
      <Link
        href={`/socios?plan=${plan.id}#formulario`}
        className={buttonVariants({ variant: 'outline', className: 'justify-self-start' })}
      >
        Elegir {plan.name}
      </Link>
    </li>
  )
}

export default async function MembershipPage({ searchParams }: Props) {
  // Por petición: la página firma el momento en que se dibuja el formulario (tiempo mínimo de llenado).
  await connection()
  const [params, site, plans, benefits, faq] = await Promise.all([
    searchParams,
    loadSite(),
    getMembershipPlans(),
    getPageBlock('socios.beneficios'),
    getPageBlock('socios.preguntas'),
  ])
  const chosen = plans.find((plan) => plan.id === params.plan)?.id ?? plans[0]?.id
  const notice =
    params.enviado === '1'
      ? { ok: true as const }
      : isFormErrorCode(params.error)
        ? { ok: false as const, code: params.error }
        : null

  const fields: PublicFieldConfig[] = [
    {
      kind: 'select',
      name: 'planId',
      label: 'Plan',
      options: plans.map((plan) => ({
        value: plan.id,
        label: `${plan.name} · ${formatClp(plan.feeClp)} ${feePeriodLabels[plan.feePeriod]}`,
      })),
      defaultValue: chosen,
      required: true,
    },
    { kind: 'text', name: 'fullName', label: 'Nombre completo', autoComplete: 'name', required: true },
    { kind: 'email', name: 'email', label: 'Correo', autoComplete: 'email', required: true },
    { kind: 'tel', name: 'phone', label: 'Celular', autoComplete: 'tel', required: true },
    { kind: 'text', name: 'commune', label: 'Comuna', autoComplete: 'address-level2', required: true },
    {
      kind: 'text',
      name: 'rut',
      label: 'RUT',
      help: 'Si lo dejas en blanco, te lo pediremos al confirmar la inscripción.',
    },
    { kind: 'textarea', name: 'message', label: 'Mensaje', help: '¿Algo que la directiva deba saber?' },
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
          : el club usará estos datos para gestionar mi inscripción.
        </>
      ),
    },
    {
      kind: 'checkbox',
      name: 'marketing',
      label: 'Quiero recibir noticias y avisos del club por correo o WhatsApp.',
    },
  ]

  return (
    <>
      <PageHero crumbs={[{ href: '/', label: 'Inicio' }, { label: 'Hazte socio' }]} title="Hazte socio">
        <p className="max-w-2xl text-(--muted)">
          Ser socio es la forma más directa de sostener al club: sus series, sus formativas y su cancha.
        </p>
      </PageHero>

      {benefits && (
        <section
          aria-labelledby="beneficios"
          className="container-site grid max-w-3xl grid-cols-1 gap-4 py-8"
        >
          <h2 id="beneficios" className="text-h2 uppercase">
            {benefits.title ?? 'Beneficios'}
          </h2>
          <RichText doc={benefits.body} images={benefits.images} />
        </section>
      )}

      <section aria-labelledby="planes" className="container-site grid grid-cols-1 gap-6 py-8">
        <h2 id="planes" className="text-h2 uppercase">
          Planes y cuotas
        </h2>
        {plans.length === 0 ? (
          <EmptyState title="Pronto abriremos las inscripciones">
            Mientras tanto, escríbenos y te avisamos.
            <DirectChannels site={site} />
          </EmptyState>
        ) : (
          <ul className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </ul>
        )}
      </section>

      {plans.length > 0 && (
        <section
          id="formulario"
          aria-labelledby="formulario-titulo"
          className="container-site grid max-w-3xl grid-cols-1 gap-4 py-8"
        >
          <h2 id="formulario-titulo" className="text-h2 uppercase">
            Inscríbete
          </h2>
          <p className="text-(--muted)">
            La directiva revisa cada solicitud y te contacta para confirmar la inscripción y la forma de pago.
          </p>
          <PublicForm
            // «Elegir plan» navega a la misma página: con otra `key` el formulario vuelve a montar con ese plan.
            key={chosen}
            {...publicFormProps('socios')}
            fields={fields}
            submitLabel="Enviar solicitud"
            success={{
              title: '¡Solicitud enviada!',
              text: 'Te enviamos una copia a tu correo. La directiva revisará tu solicitud y te contactará pronto.',
            }}
            notice={notice}
            directChannels={<DirectChannels site={site} />}
          />
        </section>
      )}

      {faq && (
        <section
          id="preguntas"
          aria-labelledby="preguntas-titulo"
          className="container-site grid max-w-3xl grid-cols-1 gap-4 py-8 md:pb-12"
        >
          <h2 id="preguntas-titulo" className="text-h2 uppercase">
            {faq.title ?? 'Preguntas frecuentes'}
          </h2>
          <RichText doc={faq.body} images={faq.images} />
        </section>
      )}
    </>
  )
}
