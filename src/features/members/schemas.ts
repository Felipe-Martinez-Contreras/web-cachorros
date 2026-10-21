import { privacyConsent, requiredEmail } from '@/features/inbox/schemas'
import {
  checkbox,
  labeledEnum,
  optionalEmail,
  optionalInt,
  optionalPhone,
  optionalRut,
  optionalText,
  optionalUuid,
  requiredDate,
  requiredInt,
  requiredText,
  requiredUuid,
} from '@/lib/form-schemas'
import { feePeriodLabels, memberStatusLabels } from '@/lib/labels'
import { z } from '@/lib/zod'

/** Beneficios de un plan: uno por línea en el formulario, una lista en la BD. */
const benefitLines = optionalText(2000).transform((value) =>
  (value ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0),
)

export const planSchema = z.object({
  name: requiredText('Escribe el nombre del plan.', 60),
  feeClp: requiredInt(0, 10_000_000, 'Escribe la cuota en pesos, sin puntos: 5000.'),
  feePeriod: labeledEnum(feePeriodLabels, 'Elige cada cuánto se paga.'),
  benefits: benefitLines.refine((lines) => lines.length <= 12, 'Usa como máximo 12 beneficios.'),
  isActive: checkbox(),
  sortOrder: requiredInt(0, 999, 'Escribe un número entre 0 y 999.'),
})
export type PlanFormValues = z.input<typeof planSchema>

export const memberSchema = z.object({
  fullName: requiredText('Escribe el nombre completo.', 120),
  rut: optionalRut(),
  email: optionalEmail(),
  phone: optionalPhone(),
  planId: optionalUuid(),
  status: labeledEnum(memberStatusLabels, 'Elige un estado de la lista.'),
  joinedOn: requiredDate('Escribe la fecha de ingreso.'),
})
export type MemberFormValues = z.input<typeof memberSchema>

/** Al dar de alta a mano se puede respetar el número que el socio ya tenía; después queda fijo. */
export const newMemberSchema = memberSchema.extend({
  memberNumber: optionalInt(1, 999_999, 'Escribe un número entero mayor que 0.'),
})
export type NewMemberFormValues = z.input<typeof newMemberSchema>

/** Formulario público «Hazte socio» (especificación 6.7). */
export const membershipFormSchema = z.object({
  fullName: requiredText('Escribe tu nombre completo.', 120),
  email: requiredEmail(),
  phone: optionalPhone().refine((value) => value !== null, 'Escribe tu celular.'),
  commune: requiredText('Escribe tu comuna.', 60),
  planId: requiredUuid('Elige un plan de la lista.'),
  rut: optionalRut(),
  message: optionalText(1000),
  privacy: privacyConsent,
  marketing: checkbox(),
})
export type MembershipFormInput = z.infer<typeof membershipFormSchema>
