import { Mail, MessageCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import type { inboxStatus } from '@/db/schema/enums'
import { formatLongDateTime, formatPhone } from '@/lib/format'
import { inboxStatusLabels } from '@/lib/labels'
import { whatsappUrl } from '@/lib/links'

// Piezas comunes de las bandejas del panel (socios, auspicios y contacto; especificación 7.4).

type InboxStatus = (typeof inboxStatus.enumValues)[number]

const STATUS_VARIANT = {
  nueva: 'accent',
  en_revision: 'soft',
  respondida: 'neutral',
  aprobada: 'success',
  rechazada: 'danger',
  archivada: 'outline',
} as const satisfies Record<InboxStatus, string>

export function InboxStatusBadge({ status }: { status: InboxStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{inboxStatusLabels[status]}</Badge>
}

/** Responder con un toque: correo con el asunto armado o WhatsApp con un saludo. */
export function ReplyLinks({
  email,
  phone,
  subject,
  greeting,
}: {
  email: string
  phone: string | null
  subject: string
  greeting: string
}) {
  const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${greeting}\n\n`)}`
  return (
    <div className="flex flex-wrap gap-2">
      <a href={mailto} className={buttonVariants({ variant: 'primary', size: 'lg' })}>
        <Mail aria-hidden="true" /> Responder por correo
      </a>
      {phone && (
        <a
          href={whatsappUrl(phone, greeting)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: 'outline', size: 'lg' })}
        >
          <MessageCircle aria-hidden="true" /> Responder por WhatsApp
        </a>
      )}
    </div>
  )
}

/** Ficha de datos del envío, como lista de definición: `<InboxFacts><Fact label="Correo">…</Fact></InboxFacts>`. */
export function InboxFacts({ children }: { children: ReactNode }) {
  return <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[max-content_minmax(0,1fr)]">{children}</dl>
}

export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="font-semibold">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

export function phoneFact(phone: string | null): ReactNode {
  return phone ? <a href={`tel:${phone}`}>{formatPhone(phone)}</a> : 'No lo indicó'
}

/** Consentimiento registrado: cuándo y qué versión de la política aceptó (especificación 9.6). */
export function consentFact(at: Date | null, version: string | null): ReactNode {
  if (!at) return 'Sin registro (envío anterior a la versión con consentimiento)'
  const versionLabel =
    version && version !== 'sin-publicar'
      ? `versión del ${formatLongDateTime(version)}`
      : 'sin versión publicada'
  return `Aceptó la política de privacidad el ${formatLongDateTime(at)} (${versionLabel})`
}
