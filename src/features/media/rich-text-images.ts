import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import type { Tx } from '@/db/client'
import { db } from '@/db/client'
import { mediaAssets } from '@/db/schema'
import type { RichTextDoc } from '@/db/schema/_columns'
import { type ImageDTO, toImageDTO } from '@/lib/images/dto'
import { richTextMediaIds } from '@/lib/rich-text/document'
import { assertPublishableMedia } from './guards'

/**
 * Imágenes de la biblioteca que usa un texto enriquecido, por id, listas para `<RichText>`.
 * Segunda barrera: una imagen marcada con menores después de insertarla no se entrega al sitio.
 */
export async function loadRichTextImages(
  doc: RichTextDoc | null | undefined,
): Promise<Record<string, ImageDTO>> {
  const ids = richTextMediaIds(doc)
  if (ids.length === 0) return {}
  const rows = await db
    .select({
      id: mediaAssets.id,
      variants: mediaAssets.variants,
      width: mediaAssets.width,
      height: mediaAssets.height,
      altText: mediaAssets.altText,
      lqip: mediaAssets.lqip,
      credit: mediaAssets.credit,
      focalX: mediaAssets.focalX,
      focalY: mediaAssets.focalY,
    })
    .from(mediaAssets)
    .where(and(inArray(mediaAssets.id, ids), eq(mediaAssets.containsMinors, false)))
  const images: Record<string, ImageDTO> = {}
  for (const row of rows) {
    const image = toImageDTO(row)
    if (image) images[row.id] = image
  }
  return images
}

/** Toda imagen dentro de un texto enriquecido debe poder publicarse (se llama al guardar). */
export async function assertRichTextMedia(
  tx: Tx,
  doc: RichTextDoc | null | undefined,
  field: string,
): Promise<void> {
  for (const mediaId of richTextMediaIds(doc)) await assertPublishableMedia(tx, mediaId, field)
}
