import { checkbox, labeledEnum, optionalPhone, optionalText, requiredText } from '@/lib/form-schemas'
import { contactTopicLabels } from '@/lib/labels'
import { z } from '@/lib/zod'

/** Correo obligatorio, en minúsculas. */
export function requiredEmail(message = 'Escribe un correo válido.') {
  return z
    .string({ error: message })
    .trim()
    .toLowerCase()
    .max(160, 'Usa como máximo 160 caracteres.')
    .pipe(z.email({ error: message }))
}

/** Consentimiento de privacidad: obligatorio y nunca premarcado (especificación 9.6). */
export const privacyConsent = checkbox().refine(
  (value) => value,
  'Para enviar, debes aceptar la política de privacidad.',
)

export const contactFormSchema = z.object({
  name: requiredText('Escribe tu nombre.', 120),
  email: requiredEmail(),
  phone: optionalPhone(),
  topic: labeledEnum(contactTopicLabels, 'Elige un tema de la lista.'),
  message: requiredText('Escribe tu mensaje.', 2000),
  privacy: privacyConsent,
})
export type ContactFormInput = z.infer<typeof contactFormSchema>

/** Estados de cada bandeja. En socios, «Aprobada» solo llega con «Aprobar y dar de alta». */
export const CONTACT_STATUSES = ['nueva', 'en_revision', 'respondida', 'archivada'] as const
export const MEMBERSHIP_STATUSES = [
  'nueva',
  'en_revision',
  'respondida',
  'aprobada',
  'rechazada',
  'archivada',
] as const
/** Auspicios: «Aprobada» es un acuerdo cerrado; el auspiciador se crea aparte en el panel. */
export const SPONSORSHIP_STATUSES = MEMBERSHIP_STATUSES
/** Una solicitud aprobada ya tiene socio en el padrón: solo puede quedar aprobada o archivarse. */
export const APPROVED_STATUSES = ['aprobada', 'archivada'] as const
export const PENDING_MEMBERSHIP_STATUSES = [
  'nueva',
  'en_revision',
  'respondida',
  'rechazada',
  'archivada',
] as const

export function inboxUpdateSchema<const S extends readonly [string, ...string[]]>(statuses: S) {
  return z.object({
    status: z.enum(statuses, { error: 'Elige un estado de la lista.' }),
    internalNotes: optionalText(2000),
  })
}
export type InboxUpdateValues = { status: string; internalNotes: string }
