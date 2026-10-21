import {
  checkbox,
  optionalDate,
  optionalText,
  optionalUuid,
  requiredInt,
  requiredText,
  requiredUuid,
} from '@/lib/form-schemas'
import { parseEmbedUrl } from '@/lib/rich-text/embed'
import { z } from '@/lib/zod'

const sortOrder = () => requiredInt(0, 9999, 'Escribe un número entre 0 y 9999.')

/**
 * Álbum de fotos (especificación 6.5). Política por defecto: sin fotos de menores (9.6); si el club marca
 * que el álbum los incluye, publicarlo exige confirmar que tiene las autorizaciones de los apoderados.
 */
export const albumSchema = z
  .object({
    title: requiredText('Escribe el nombre del álbum.', 120),
    takenOn: optionalDate(),
    coverMediaId: optionalUuid(),
    matchId: optionalUuid(),
    eventId: optionalUuid(),
    isPublished: checkbox(),
    containsMinors: checkbox(),
    minorsConsent: checkbox(),
  })
  .refine((value) => !value.isPublished || !value.containsMinors || value.minorsConsent, {
    path: ['minorsConsent'],
    message: 'Para publicar un álbum con menores, confirma que el club tiene las autorizaciones.',
  })
export type AlbumFormValues = z.input<typeof albumSchema>

export const albumItemSchema = z.object({
  mediaId: requiredUuid('Elige una foto de la biblioteca.'),
  caption: optionalText(200),
  sortOrder: sortOrder(),
})
export type AlbumItemFormValues = z.input<typeof albumItemSchema>

export const albumItemUpdateSchema = albumItemSchema.omit({ mediaId: true })
export type AlbumItemUpdateFormValues = z.input<typeof albumItemUpdateSchema>

/** Video (6.5): YouTube o Facebook. El proveedor y el id salen de la dirección. */
export const videoSchema = z
  .object({
    title: requiredText('Escribe el título del video.', 120),
    url: requiredText('Pega la dirección del video.', 500),
    thumbnailMediaId: optionalUuid(),
    publishedOn: optionalDate(),
    matchId: optionalUuid(),
    isPublished: checkbox(),
  })
  .transform((value, ctx) => {
    const embed = parseEmbedUrl(value.url)
    if (!embed || embed.provider === 'instagram') {
      ctx.addIssue({
        code: 'custom',
        path: ['url'],
        message: 'Pega la dirección de un video de YouTube o de Facebook.',
      })
      return z.NEVER
    }
    return { ...value, url: embed.url, provider: embed.provider, externalId: embed.videoId ?? null }
  })
export type VideoFormValues = z.input<typeof videoSchema>
