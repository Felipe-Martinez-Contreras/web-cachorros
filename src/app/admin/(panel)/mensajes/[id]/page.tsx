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
import { actualizarMensaje } from '@/features/inbox/actions'
import { InboxUpdateForm } from '@/features/inbox/components/inbox-form'
import { getContactMessageAdmin } from '@/features/inbox/queries'
import { CONTACT_STATUSES } from '@/features/inbox/schemas'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'
import { formatLongDateTime } from '@/lib/format'
import { contactTopicLabels } from '@/lib/labels'

export const metadata: Metadata = { title: 'Mensaje' }

export default async function MessagePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser('messages:write')
  const { id } = await params
  const row = isUuid(id) ? await getContactMessageAdmin(id) : null
  if (!row) notFound()
  const topic = contactTopicLabels[row.topic]

  return (
    <>
      <PageHeader
        title={row.name}
        description={<InboxStatusBadge status={row.status} />}
        back={{ href: '/admin/mensajes', label: 'Mensajes' }}
      />
      <div className="grid max-w-3xl gap-8">
        <section aria-labelledby="datos" className="grid gap-4">
          <h2 id="datos" className="text-lg font-bold">
            Mensaje
          </h2>
          <InboxFacts>
            <Fact label="Recibido">{formatLongDateTime(row.createdAt)}</Fact>
            <Fact label="Tema">{topic}</Fact>
            <Fact label="Correo">
              <a href={`mailto:${row.email}`}>{row.email}</a>
            </Fact>
            <Fact label="Celular">{phoneFact(row.phone)}</Fact>
            <Fact label="Mensaje">
              <span className="whitespace-pre-line">{row.message}</span>
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
            subject={`Re: tu mensaje sobre ${topic}`}
            greeting={`Hola, ${row.name}: te escribimos del club por tu mensaje.`}
          />
        </section>
        <section aria-labelledby="seguimiento" className="grid gap-3">
          <h2 id="seguimiento" className="text-lg font-bold">
            Seguimiento
          </h2>
          <InboxUpdateForm
            statuses={CONTACT_STATUSES}
            action={actualizarMensaje.bind(null, row.id)}
            backHref="/admin/mensajes"
            defaults={{
              // Un mensaje no se aprueba ni se rechaza: si llegó así de otra versión, parte en «En revisión».
              status: (CONTACT_STATUSES as readonly string[]).includes(row.status)
                ? row.status
                : 'en_revision',
              internalNotes: row.internalNotes ?? '',
            }}
          />
        </section>
      </div>
    </>
  )
}
