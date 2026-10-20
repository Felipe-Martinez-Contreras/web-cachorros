import { privacyConsent, requiredEmail } from '@/features/inbox/schemas'
import {
  checkbox,
  labeledEnum,
  optionalDate,
  optionalPhone,
  optionalText,
  optionalUrl,
  optionalUuid,
  requiredInt,
  requiredText,
} from '@/lib/form-schemas'
import { sponsorTierLabels } from '@/lib/labels'
import { z } from '@/lib/zod'

export const sponsorSchema = z
  .object({
    name: requiredText('Escribe el nombre del auspiciador.', 80),
    tier: labeledEnum(sponsorTierLabels, 'Elige un nivel de la lista.'),
    logoMediaId: optionalUuid(),
    description: optionalText(300),
    websiteUrl: optionalUrl(),
    instagramUrl: optionalUrl(),
    whatsapp: optionalPhone(),
    startsOn: optionalDate(),
    endsOn: optionalDate(),
    isActive: checkbox(),
    sortOrder: requiredInt(0, 999, 'Escribe un número entre 0 y 999.'),
  })
  .refine((value) => !value.startsOn || !value.endsOn || value.endsOn >= value.startsOn, {
    message: 'El término no puede ser anterior al inicio.',
    path: ['endsOn'],
  })
export type SponsorFormValues = z.input<typeof sponsorSchema>

/** Nivel de interés opcional: vacío → `null`. */
const optionalTier = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  labeledEnum(sponsorTierLabels, 'Elige un nivel de la lista.').nullable(),
)

/** Formulario público «¿Quieres auspiciar al club?» (especificación 6.10). */
export const sponsorshipFormSchema = z.object({
  businessName: requiredText('Escribe el nombre de tu comercio o empresa.', 120),
  contactName: requiredText('Escribe tu nombre.', 120),
  email: requiredEmail(),
  phone: optionalPhone(),
  tierInterest: optionalTier,
  message: optionalText(2000),
  privacy: privacyConsent,
})
