import 'server-only'
import { eq } from 'drizzle-orm'
import type { Tx } from '@/db/client'
import { mediaAssets } from '@/db/schema'
import { Rejection } from '@/lib/entity-action'

/**
 * Toda imagen que se asigna a algo visible en el sitio pasa por aquí. Mientras el club no defina su
 * política de fotos de menores (especificación 9.6), una imagen marcada «contiene menores» no se publica.
 */
export async function assertPublishableMedia(tx: Tx, mediaId: string | null, field: string): Promise<void> {
  if (!mediaId) return
  const [media] = await tx
    .select({ containsMinors: mediaAssets.containsMinors })
    .from(mediaAssets)
    .where(eq(mediaAssets.id, mediaId))
  if (!media) throw new Rejection('Esa imagen ya no está en la biblioteca. Elige otra.', field)
  if (media.containsMinors) {
    throw new Rejection('Esa imagen está marcada con menores de edad y todavía no se puede publicar.', field)
  }
}
