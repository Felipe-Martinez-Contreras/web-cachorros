import * as z from 'zod'
import type { SocialPublishingSettings } from '@/db/schema/system'
import { checkbox, requiredTime } from '@/lib/form-schemas'

// Configuración de la publicación en Facebook (panel → Configuración → Facebook). Lógica pura.

export type FacebookSettings = NonNullable<SocialPublishingSettings['facebook']>

/** Por defecto: desactivada, la programación el viernes a las 12:00 y sin resultados automáticos. */
export const FACEBOOK_DEFAULTS: FacebookSettings = {
  enabled: false,
  weekday: 5,
  time: '12:00',
  publishResults: false,
}

/** Días en que puede salir la programación: de lunes (1) a sábado (6). */
export const PUBLISH_WEEKDAYS = [1, 2, 3, 4, 5, 6] as const

/** Lo que envía el formulario del panel (el mismo esquema valida la acción). */
export const facebookSettingsSchema = z.object({
  enabled: checkbox(),
  weekday: z.coerce
    .number({ error: 'Elige el día.' })
    .int()
    .refine(
      (day) => (PUBLISH_WEEKDAYS as readonly number[]).includes(day),
      'Elige un día de lunes a sábado.',
    ),
  time: requiredTime('Escribe la hora, por ejemplo 12:00.'),
  publishResults: checkbox(),
})

export type FacebookSettingsInput = z.infer<typeof facebookSettingsSchema>

const stored = z.object({
  enabled: z.boolean(),
  weekday: z.number().int().min(1).max(6),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  publishResults: z.boolean(),
  enabledAt: z.string().optional(),
  resultsEnabledAt: z.string().optional(),
})

/** Lo guardado en `site_settings.social_publishing`, o los valores por defecto si falta o no es válido. */
export function readFacebookSettings(value: SocialPublishingSettings | null | undefined): FacebookSettings {
  const parsed = stored.safeParse(value?.facebook)
  return parsed.success ? parsed.data : FACEBOOK_DEFAULTS
}

/**
 * Ajustes nuevos a partir de lo que llegó del formulario. Al activar algo se anota desde cuándo: así no se
 * publica nada de lo que ocurrió mientras estaba apagado (por ejemplo, partidos finalizados ayer).
 */
export function nextFacebookSettings(
  current: FacebookSettings,
  input: FacebookSettingsInput,
  now: Date,
): FacebookSettings {
  const at = now.toISOString()
  return {
    ...input,
    enabledAt: input.enabled ? (current.enabled ? current.enabledAt : at) : undefined,
    resultsEnabledAt: input.publishResults
      ? current.publishResults
        ? current.resultsEnabledAt
        : at
      : undefined,
  }
}
