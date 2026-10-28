import * as z from 'zod'
import type { SocialPublishingSettings } from '@/db/schema/system'
import { checkbox, optionalText, optionalUuid, requiredTime } from '@/lib/form-schemas'

// Configuración de la publicación en Facebook (panel → Facebook → Ajustes). Lógica pura.

export type FacebookSettings = NonNullable<SocialPublishingSettings['facebook']>

/**
 * Por defecto: desactivada, sin la programación semanal (si se activa, el viernes a las 12:00) y sin resultados
 * automáticos.
 */
export const FACEBOOK_DEFAULTS: FacebookSettings = {
  enabled: false,
  weekly: false,
  weekday: 5,
  time: '12:00',
  publishResults: false,
  photos: [null, null, null],
}

/** La línea pequeña sobre «MATCHDAY»: nada, el auspiciador de las tarjetas, un texto o un logo en blanco. */
export const TOP_LINE_MODES = ['ninguna', 'auspiciador', 'texto', 'logo'] as const
export type TopLineMode = (typeof TOP_LINE_MODES)[number]
export const TOP_LINE_MAX = 60

/** Días en que puede salir la programación: de lunes (1) a sábado (6). */
export const PUBLISH_WEEKDAYS = [1, 2, 3, 4, 5, 6] as const

/** Lo que envía el formulario del panel (el mismo esquema valida la acción). */
export const facebookSettingsSchema = z
  .object({
    enabled: checkbox(),
    weekly: checkbox(),
    weekday: z.coerce
      .number({ error: 'Elige el día.' })
      .int()
      .refine(
        (day) => (PUBLISH_WEEKDAYS as readonly number[]).includes(day),
        'Elige un día de lunes a sábado.',
      ),
    time: requiredTime('Escribe la hora, por ejemplo 12:00.'),
    publishResults: checkbox(),
    photo1: optionalUuid(),
    photo2: optionalUuid(),
    photo3: optionalUuid(),
    topLineMode: z.enum(TOP_LINE_MODES, { error: 'Elige qué va sobre «MATCHDAY».' }),
    topLineText: optionalText(TOP_LINE_MAX),
    topLineLogo: optionalUuid(),
  })
  .superRefine((value, context) => {
    if (value.topLineMode === 'texto' && !value.topLineText) {
      context.addIssue({ code: 'custom', path: ['topLineText'], message: 'Escribe el texto de la línea.' })
    }
    if (value.topLineMode === 'logo' && !value.topLineLogo) {
      context.addIssue({ code: 'custom', path: ['topLineLogo'], message: 'Elige el logo.' })
    }
  })

export type FacebookSettingsInput = z.infer<typeof facebookSettingsSchema>

const stored = z.object({
  enabled: z.boolean(),
  weekly: z.boolean().default(false),
  weeklyEnabledAt: z.string().optional(),
  weekday: z.number().int().min(1).max(6),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  publishResults: z.boolean(),
  enabledAt: z.string().optional(),
  resultsEnabledAt: z.string().optional(),
  photos: z.array(z.uuid().nullable()).length(3).default([null, null, null]),
  topLine: z
    .object({
      mode: z.enum(TOP_LINE_MODES),
      text: z.string().max(TOP_LINE_MAX).nullable().optional(),
      logoId: z.uuid().nullable().optional(),
    })
    .optional(),
})

/** Fotos de los 3 paneles del matchday (todas en blanco y negro): el encuadre que mejor funciona en cada uno. */
export const MATCHDAY_PHOTO_LABELS = [
  'Foto izquierda (primer plano)',
  'Foto central (jugada)',
  'Foto derecha (detalle)',
] as const

/**
 * Qué línea va sobre «MATCHDAY». Sin nada guardado (antes de elegirla por primera vez), la del auspiciador
 * de las tarjetas si hay uno: así sigue saliendo «POWERED BY …» como antes.
 */
export function topLineModeOf(settings: FacebookSettings, hasSponsor: boolean): TopLineMode {
  return settings.topLine?.mode ?? (hasSponsor ? 'auspiciador' : 'ninguna')
}

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
  const { photo1, photo2, photo3, topLineMode, topLineText, topLineLogo, ...rest } = input
  return {
    ...rest,
    photos: [photo1 ?? null, photo2 ?? null, photo3 ?? null],
    // Se guarda solo lo del modo elegido: un texto o un logo de antes no queda escondido.
    topLine: {
      mode: topLineMode,
      text: topLineMode === 'texto' ? (topLineText ?? null) : null,
      logoId: topLineMode === 'logo' ? (topLineLogo ?? null) : null,
    },
    enabledAt: input.enabled ? (current.enabled ? current.enabledAt : at) : undefined,
    weeklyEnabledAt: input.weekly ? (current.weekly ? current.weeklyEnabledAt : at) : undefined,
    resultsEnabledAt: input.publishResults
      ? current.publishResults
        ? current.resultsEnabledAt
        : at
      : undefined,
  }
}

/**
 * Desde cuándo corre la programación semanal: necesita el interruptor general y la suya, así que vale la más
 * reciente de las dos fechas. `undefined` si está apagada.
 */
export function weeklyActiveSince(settings: FacebookSettings): string | undefined {
  if (!settings.enabled || !settings.weekly || !settings.enabledAt || !settings.weeklyEnabledAt)
    return undefined
  return Date.parse(settings.enabledAt) > Date.parse(settings.weeklyEnabledAt)
    ? settings.enabledAt
    : settings.weeklyEnabledAt
}
