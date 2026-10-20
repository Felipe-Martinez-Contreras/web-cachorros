import { checkbox, labeledEnum, optionalPhone, requiredText } from '@/lib/form-schemas'
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
