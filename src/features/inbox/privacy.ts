import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { pageBlocks } from '@/db/schema'

/**
 * Versión vigente de la política de privacidad: la fecha de su última edición en el panel (bloque
 * `privacidad.politica`). Se guarda junto a cada consentimiento; sin caché, para no registrar una anterior.
 */
export async function getPrivacyPolicyVersion(): Promise<string> {
  const [row] = await db
    .select({ updatedAt: pageBlocks.updatedAt })
    .from(pageBlocks)
    .where(eq(pageBlocks.key, 'privacidad.politica'))
    .limit(1)
  return row ? row.updatedAt.toISOString() : 'sin-publicar'
}
