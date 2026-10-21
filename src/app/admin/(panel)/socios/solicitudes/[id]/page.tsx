import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ActionButton } from '@/components/admin/action-button'
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
import { APPROVED_STATUSES, PENDING_MEMBERSHIP_STATUSES } from '@/features/inbox/schemas'
import { actualizarSolicitudSocio, aprobarSolicitudSocio } from '@/features/members/actions'
import { getMembershipRequestAdmin } from '@/features/members/queries'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'
import { formatLongDateTime } from '@/lib/format'

export const metadata: Metadata = { title: 'Solicitud de socio' }

export default async function MembershipRequestPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser('members:write')
  const { id } = await params
  const row = isUuid(id) ? await getMembershipRequestAdmin(id) : null
  if (!row) notFound()
  const approved = row.memberId !== null

  return (
    <>
      <PageHeader
        title={row.fullName}
        description={<InboxStatusBadge status={row.status} />}
        back={{ href: '/admin/socios', label: 'Solicitudes' }}
      />
      <div className="grid max-w-3xl gap-8">
        <section aria-labelledby="datos" className="grid gap-4">
          <h2 id="datos" className="text-lg font-bold">
            Datos de la solicitud
          </h2>
          <InboxFacts>
            <Fact label="Recibida">{formatLongDateTime(row.createdAt)}</Fact>
            <Fact label="Plan">{row.planName ?? 'Sin plan'}</Fact>
            <Fact label="Correo">
              <a href={`mailto:${row.email}`}>{row.email}</a>
            </Fact>
            <Fact label="Celular">{phoneFact(row.phone)}</Fact>
            <Fact label="Comuna">{row.commune ?? 'No la indicó'}</Fact>
            <Fact label="RUT">{row.rut ?? 'No lo indicó'}</Fact>
            <Fact label="Mensaje">
              {row.message ? <span className="whitespace-pre-line">{row.message}</span> : 'Sin mensaje'}
            </Fact>
            <Fact label="Comunicaciones">
              {row.marketingConsent ? 'Acepta recibir noticias del club' : 'No las pidió'}
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
            subject="Tu solicitud de socio"
            greeting={`Hola, ${row.fullName}: te escribimos del club por tu solicitud de socio.`}
          />
        </section>

        <section aria-labelledby="aprobar" className="grid gap-3">
          <h2 id="aprobar" className="text-lg font-bold">
            Alta en el padrón
          </h2>
          {approved ? (
            <p>
              Aprobada: es el{' '}
              <Link href={`/admin/socios/padron/${row.memberId}`} className="font-semibold underline">
                socio N.º {row.memberNumber}
              </Link>
              .
            </p>
          ) : (
            <>
              <p className="text-neutral-600">
                Crea al socio en el padrón con el número siguiente y marca la solicitud como aprobada.
              </p>
              <ActionButton
                action={aprobarSolicitudSocio.bind(null, row.id)}
                variant="primary"
                className="justify-self-start"
                confirm={{
                  title: `¿Aprobar a ${row.fullName}?`,
                  description:
                    'Se le asignará el número de socio siguiente. El número no se puede cambiar después.',
                  confirmLabel: 'Aprobar y dar de alta',
                }}
                successMessage="Socio dado de alta en el padrón."
              >
                Aprobar y dar de alta
              </ActionButton>
            </>
          )}
        </section>

        <section aria-labelledby="seguimiento" className="grid gap-3">
          <h2 id="seguimiento" className="text-lg font-bold">
            Seguimiento
          </h2>
          <InboxUpdateForm
            statuses={approved ? APPROVED_STATUSES : PENDING_MEMBERSHIP_STATUSES}
            action={actualizarSolicitudSocio.bind(null, row.id)}
            backHref="/admin/socios"
            defaults={{ status: row.status, internalNotes: row.internalNotes ?? '' }}
          />
        </section>
      </div>
    </>
  )
}
