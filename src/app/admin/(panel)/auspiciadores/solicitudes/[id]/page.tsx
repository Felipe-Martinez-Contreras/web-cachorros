import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  consentFact,
  Fact,
  InboxFacts,
  InboxStatusBadge,
  phoneFact,
  ReplyLinks,
} from '@/components/admin/inbox'
import { PageHeader } from '@/components/admin/resource-list'
import { InboxUpdateForm } from '@/features/inbox/components/inbox-form'
import { SPONSORSHIP_STATUSES } from '@/features/inbox/schemas'
import { actualizarSolicitudAuspicio } from '@/features/sponsors/actions'
import { getSponsorshipInquiryAdmin } from '@/features/sponsors/admin-queries'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'
import { formatLongDateTime } from '@/lib/format'
import { sponsorTierLabels } from '@/lib/labels'

export const metadata: Metadata = { title: 'Solicitud de auspicio' }

export default async function SponsorshipInquiryPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser('sponsors:write')
  const { id } = await params
  const row = isUuid(id) ? await getSponsorshipInquiryAdmin(id) : null
  if (!row) notFound()

  return (
    <>
      <PageHeader
        title={row.businessName}
        description={<InboxStatusBadge status={row.status} />}
        back={{ href: '/admin/auspiciadores/solicitudes', label: 'Solicitudes' }}
      />
      <div className="grid max-w-3xl gap-8">
        <section aria-labelledby="datos" className="grid gap-4">
          <h2 id="datos" className="text-lg font-bold">
            Datos de la solicitud
          </h2>
          <InboxFacts>
            <Fact label="Recibida">{formatLongDateTime(row.createdAt)}</Fact>
            <Fact label="Contacto">{row.contactName}</Fact>
            <Fact label="Correo">
              <a href={`mailto:${row.email}`}>{row.email}</a>
            </Fact>
            <Fact label="Celular">{phoneFact(row.phone)}</Fact>
            <Fact label="Nivel de interés">
              {row.tierInterest ? sponsorTierLabels[row.tierInterest] : 'Sin definir'}
            </Fact>
            <Fact label="Mensaje">
              {row.message ? <span className="whitespace-pre-line">{row.message}</span> : 'Sin mensaje'}
            </Fact>
            <Fact label="Privacidad">{consentFact(row.privacyConsentAt, row.privacyPolicyVersion)}</Fact>
            <Fact label="Aviso a la directiva">
              {row.notifiedAt ? formatLongDateTime(row.notifiedAt) : 'Pendiente de envío'}
            </Fact>
          </InboxFacts>
        </section>
        <section aria-labelledby="responder" className="grid gap-3">
          <h2 id="responder" className="text-lg font-bold">
            Responder
          </h2>
          <ReplyLinks
            email={row.email}
            phone={row.phone}
            subject={`Auspicio de ${row.businessName}`}
            greeting={`Hola, ${row.contactName}: te escribimos del club por el auspicio de ${row.businessName}.`}
          />
        </section>
        <section aria-labelledby="seguimiento" className="grid gap-3">
          <h2 id="seguimiento" className="text-lg font-bold">
            Seguimiento
          </h2>
          <p className="text-neutral-600">
            Si el acuerdo se cierra, márcala como aprobada y crea al auspiciador en la pestaña Auspiciadores.
          </p>
          <InboxUpdateForm
            statuses={SPONSORSHIP_STATUSES}
            action={actualizarSolicitudAuspicio.bind(null, row.id)}
            backHref="/admin/auspiciadores/solicitudes"
            defaults={{ status: row.status, internalNotes: row.internalNotes ?? '' }}
          />
        </section>
      </div>
    </>
  )
}
