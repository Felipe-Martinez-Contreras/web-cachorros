import { parseCoordinates } from '@/features/teams/lib/parse-coordinates'
import {
  optionalEmail,
  optionalPhone,
  optionalText,
  optionalUrl,
  optionalUuid,
  requiredText,
} from '@/lib/form-schemas'
import { isContentMarker } from '@/lib/markers'
import { formatRut, isValidRut } from '@/lib/rut'
import { z } from '@/lib/zod'

const MAX_RECIPIENTS = 5

/** Lista de correos escrita en un solo campo, separados por comas, espacios o saltos de línea. */
function emailList() {
  return z
    .string()
    .max(600, 'Usa como máximo 600 caracteres.')
    .transform((value, ctx) => {
      const emails = [
        ...new Set(
          value
            .toLowerCase()
            .split(/[\s,;]+/)
            .filter(Boolean),
        ),
      ]
      const invalid = emails.find((email) => !z.email().safeParse(email).success)
      if (invalid) ctx.addIssue({ code: 'custom', message: `«${invalid}» no es un correo válido.` })
      if (emails.length > MAX_RECIPIENTS) {
        ctx.addIssue({ code: 'custom', message: `Usa como máximo ${MAX_RECIPIENTS} correos.` })
      }
      return emails
    })
}

export const clubSettingsSchema = z.object({
  clubName: requiredText('Escribe el nombre del club.', 120),
  shortName: requiredText('Escribe el nombre corto.', 30),
})

export const contactSettingsSchema = z.object({
  whatsapp: optionalPhone(),
  phone: optionalPhone(),
  publicEmail: optionalEmail(),
  notifySocios: emailList(),
  notifyAuspicios: emailList(),
  notifyContacto: emailList(),
})

export const socialSettingsSchema = z.object({
  instagram: optionalUrl(),
  facebook: optionalUrl(),
  tiktok: optionalUrl(),
  youtube: optionalUrl(),
  x: optionalUrl(),
})

export const locationSettingsSchema = z.object({
  address: optionalText(200),
  commune: optionalText(60),
  region: optionalText(60),
  location: optionalText(600).refine((value) => value === null || parseCoordinates(value) !== null, {
    message:
      'No encontramos las coordenadas. Pega el enlace largo de Google Maps o escribe «latitud, longitud».',
  }),
})

const BANK_FIELDS = ['holder', 'rut', 'bank', 'accountType', 'accountNumber'] as const

export const supportSettingsSchema = z
  .object({
    holder: optionalText(120),
    rut: optionalText(60).transform((value) => (value && isValidRut(value) ? formatRut(value) : value)),
    bank: optionalText(80),
    accountType: optionalText(60),
    accountNumber: optionalText(40),
    email: optionalEmail(),
    donationUrl: optionalUrl(),
  })
  .superRefine((value, ctx) => {
    if (value.rut !== null && !isContentMarker(value.rut) && !isValidRut(value.rut)) {
      ctx.addIssue({
        code: 'custom',
        path: ['rut'],
        message: 'Ese RUT no es válido. Revisa el dígito verificador.',
      })
    }
    // La cuenta se publica completa o no se publica: datos a medias llevan a transferencias mal hechas.
    const filled = BANK_FIELDS.filter((field) => value[field] !== null)
    if (filled.length > 0 || value.email !== null) {
      for (const field of BANK_FIELDS) {
        if (value[field] === null) {
          ctx.addIssue({ code: 'custom', path: [field], message: 'Completa este dato de la cuenta.' })
        }
      }
    }
  })

/** Destino de un botón del sitio: una página propia (`/socios`) o una dirección `https://`. */
function isSafeTarget(value: string): boolean {
  if (value.startsWith('/')) return !value.startsWith('//')
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

export const heroSettingsSchema = z
  .object({
    title: optionalText(80),
    subtitle: optionalText(160),
    ctaLabel: optionalText(30),
    ctaHref: optionalText(200).refine((value) => value === null || isSafeTarget(value), {
      message: 'Escribe una página del sitio (por ejemplo /socios) o una dirección que empiece con https://',
    }),
    mediaId: optionalUuid(),
    mobileMediaId: optionalUuid(),
  })
  .superRefine((value, ctx) => {
    if ((value.ctaLabel === null) !== (value.ctaHref === null)) {
      ctx.addIssue({
        code: 'custom',
        path: [value.ctaLabel === null ? 'ctaLabel' : 'ctaHref'],
        message: 'El botón necesita su texto y su destino.',
      })
    }
  })

export const featuredSettingsSchema = z.object({
  featuredSeriesId: optionalUuid(),
  shareCardSponsorId: optionalUuid(),
})

export const seoSettingsSchema = z.object({
  description: optionalText(160),
  ogMediaId: optionalUuid(),
})

export type ClubSettingsValues = z.input<typeof clubSettingsSchema>
export type ContactSettingsValues = z.input<typeof contactSettingsSchema>
export type SocialSettingsValues = z.input<typeof socialSettingsSchema>
export type LocationSettingsValues = z.input<typeof locationSettingsSchema>
export type SupportSettingsValues = z.input<typeof supportSettingsSchema>
export type HeroSettingsValues = z.input<typeof heroSettingsSchema>
export type FeaturedSettingsValues = z.input<typeof featuredSettingsSchema>
export type SeoSettingsValues = z.input<typeof seoSettingsSchema>
