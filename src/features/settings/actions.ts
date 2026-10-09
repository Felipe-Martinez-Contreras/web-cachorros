'use server'

import { eq } from 'drizzle-orm'
import type { ZodType } from 'zod'
import type { Tx } from '@/db/client'
import { siteSettings } from '@/db/schema'
import { assertPublishableMedia } from '@/features/media/guards'
import { parseCoordinates } from '@/features/teams/lib/parse-coordinates'
import { type ActionResult, fail } from '@/lib/action-result'
import { tags } from '@/lib/cache-tags'
import { mutate, Rejection } from '@/lib/entity-action'
import {
  clubSettingsSchema,
  contactSettingsSchema,
  featuredSettingsSchema,
  heroSettingsSchema,
  locationSettingsSchema,
  seoSettingsSchema,
  socialSettingsSchema,
  supportSettingsSchema,
} from './schemas'
import { isSettingsSection, SETTINGS_SECTIONS, type SettingsSection } from './sections'

type Result = Promise<ActionResult<{ id: string }>>
type Values = Partial<typeof siteSettings.$inferInsert>

/** Quita las claves vacías de un `jsonb`: lo que no se sabe no se guarda. */
function compact<T extends Record<string, unknown>>(value: T): { [K in keyof T]?: NonNullable<T[K]> } {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null && item !== '')) as {
    [K in keyof T]?: NonNullable<T[K]>
  }
}

/** Cada sección valida con su esquema y dice qué columnas de `site_settings` escribe. */
function section<T>(schema: ZodType<T>, values: (data: T, tx: Tx) => Promise<Values> | Values) {
  return (key: SettingsSection, input: unknown): Result =>
    mutate({
      action: `settings.${key}.update`,
      permission: 'settings:write',
      entityType: 'site_settings',
      schema,
      input,
      // La serie destacada cambia los filtros y la portada de Partidos.
      tags: key === 'destacados' ? [tags.settings(), tags.matches()] : [tags.settings()],
      write: async (tx, data) => {
        const [row] = await tx
          .update(siteSettings)
          .set(await values(data, tx))
          .where(eq(siteSettings.id, 1))
          .returning({ id: siteSettings.id })
        if (!row) throw new Rejection('No encontramos la configuración del club. Avisa a soporte.')
        // La auditoría no guarda los valores: pueden ser datos de contacto o bancarios.
        return {
          id: '1',
          summary: `Cambió la configuración: ${SETTINGS_SECTIONS[key].label}`,
          meta: { section: key },
        }
      },
    })
}

const handlers: Record<SettingsSection, (key: SettingsSection, input: unknown) => Result> = {
  club: section(clubSettingsSchema, (data) => data),
  contacto: section(contactSettingsSchema, (data) => ({
    whatsappE164: data.whatsapp,
    phoneE164: data.phone,
    publicEmail: data.publicEmail,
    notifyRecipients: {
      socios: data.notifySocios,
      auspicios: data.notifyAuspicios,
      contacto: data.notifyContacto,
    },
  })),
  redes: section(socialSettingsSchema, (data) => ({ socialLinks: compact(data) })),
  ubicacion: section(locationSettingsSchema, ({ location, ...data }) => {
    const coordinates = location ? parseCoordinates(location) : null
    return { ...data, geoLat: coordinates?.lat ?? null, geoLng: coordinates?.lng ?? null }
  }),
  aportes: section(supportSettingsSchema, ({ donationUrl, email, ...bank }) => ({
    donationUrl,
    bankDetails:
      bank.holder && bank.rut && bank.bank && bank.accountType && bank.accountNumber
        ? {
            holder: bank.holder,
            rut: bank.rut,
            bank: bank.bank,
            accountType: bank.accountType,
            accountNumber: bank.accountNumber,
            ...(email ? { email } : null),
          }
        : null,
  })),
  portada: section(heroSettingsSchema, async (data, tx) => {
    await assertPublishableMedia(tx, data.mediaId, 'mediaId')
    await assertPublishableMedia(tx, data.mobileMediaId, 'mobileMediaId')
    return { hero: compact(data) }
  }),
  destacados: section(featuredSettingsSchema, (data) => data),
  seo: section(seoSettingsSchema, async (data, tx) => {
    await assertPublishableMedia(tx, data.ogMediaId, 'ogMediaId')
    return { seoDefaults: compact(data) }
  }),
}

/** Guarda una sección de Configuración (especificación 7.7). */
export async function guardarConfiguracion(sectionKey: string, input: unknown): Result {
  if (!isSettingsSection(sectionKey)) return fail('Esa sección de Configuración no existe.')
  return handlers[sectionKey](sectionKey, input)
}
