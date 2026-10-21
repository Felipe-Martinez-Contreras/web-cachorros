import {
  checkbox,
  labeledEnum,
  optionalDate,
  optionalText,
  optionalUuid,
  requiredInt,
} from '@/lib/form-schemas'
import { isContentMarker } from '@/lib/markers'
import { z } from '@/lib/zod'
import { detectSocialPost, FEED_PLATFORM_LABELS } from './lib/feed'

/** Publicación del feed curado (especificación 2.9): el enlace define la red. */
export const socialPostSchema = z
  .object({
    permalink: z
      .string({ error: 'Pega el enlace de la publicación.' })
      .trim()
      .min(1, 'Pega el enlace de la publicación.')
      .max(300, 'Usa como máximo 300 caracteres.')
      // Un marcador `[COMPLETAR: …]` se acepta: la publicación sigue en los pendientes de contenido.
      .refine((value) => isContentMarker(value) || detectSocialPost(value) !== null, {
        message: 'Pega el enlace de una publicación de Instagram, Facebook o TikTok (empieza con https://).',
      }),
    /** Solo se usa mientras el enlace es un marcador; con un enlace real, la red sale del enlace. */
    platform: labeledEnum(FEED_PLATFORM_LABELS, 'Elige la red social.'),
    imageMediaId: optionalUuid(),
    excerpt: optionalText(200),
    postedOn: optionalDate(),
    sortOrder: requiredInt(0, 999, 'Escribe un número entre 0 y 999.'),
    isPinned: checkbox(),
    embedEnabled: checkbox(),
    isPublished: checkbox(),
  })
  .superRefine((data, context) => {
    const detected = detectSocialPost(data.permalink)
    // Un enlace que no es de ninguna red ya tiene su propio error.
    const pending = !detected && isContentMarker(data.permalink)
    if (data.embedEnabled && (pending || (detected && !detected.embeddable))) {
      context.addIssue({
        code: 'custom',
        path: ['embedEnabled'],
        message: pending
          ? 'Primero pega el enlace real de la publicación.'
          : 'Las publicaciones de TikTok se muestran solo como enlace.',
      })
    }
    if (data.isPublished && !data.imageMediaId) {
      context.addIssue({
        code: 'custom',
        path: ['imageMediaId'],
        message: 'Para publicarla en el sitio, elige su imagen.',
      })
    }
  })
export type SocialPostFormValues = z.input<typeof socialPostSchema>
