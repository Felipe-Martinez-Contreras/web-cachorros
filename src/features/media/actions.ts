'use server'

import { eq } from 'drizzle-orm'
import { updateTag } from 'next/cache'
import { db } from '@/db/client'
import { mediaAssets } from '@/db/schema'
import { type ActionResult, fail, ok } from '@/lib/action-result'
import { audit } from '@/lib/audit'
import { requirePermission } from '@/lib/auth/session'
import { tags } from '@/lib/cache-tags'
import { requiredUuid } from '@/lib/form-schemas'
import { logger } from '@/lib/logger'
import { runAction } from '@/lib/run-action'
import { getMediaUsage } from './queries'
import { updateMediaSchema } from './schemas'
import { removeMediaFiles } from './store'

const idSchema = requiredUuid('No encontramos esa imagen.')

function describeUsage(usage: { label: string; count: number }[]): string {
  return usage.map((item) => item.label).join(', ')
}

/** Las imágenes pueden aparecer en cualquier sección: se invalidan todas las lecturas públicas. */
function invalidateEverythingWithImages() {
  for (const tag of [
    tags.media(),
    tags.settings(),
    tags.matches(),
    tags.players(),
    tags.news(),
    tags.sponsors(),
    tags.events(),
    tags.history(),
    tags.social(),
    tags.store(),
  ]) {
    updateTag(tag)
  }
}

export async function actualizarMedio(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction('media.update', async () => {
    const user = await requirePermission('media:write')
    const parsedId = idSchema.safeParse(id)
    if (!parsedId.success) return fail('No encontramos esa imagen.')
    const parsed = updateMediaSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error)
    const { minorsConsent: _consent, ...data } = parsed.data

    // Mientras no exista la política de fotos de menores, una imagen marcada no se muestra en el sitio:
    // no se puede marcar una que ya está en uso (decisión registrada en la Fase 2).
    if (data.containsMinors) {
      const usage = await getMediaUsage(parsedId.data)
      if (usage.length > 0) {
        return fail(
          `Esta imagen está en uso en: ${describeUsage(usage)}. Quítala de ahí antes de marcarla, porque las fotos con menores todavía no se publican.`,
        )
      }
    }

    const updated = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          containsMinors: mediaAssets.containsMinors,
          consentAt: mediaAssets.minorsConsentConfirmedAt,
        })
        .from(mediaAssets)
        .where(eq(mediaAssets.id, parsedId.data))
        .for('update')
      if (!current) return null
      const consentAt = data.containsMinors ? (current.consentAt ?? new Date()) : null
      await tx
        .update(mediaAssets)
        .set({ ...data, minorsConsentConfirmedAt: consentAt })
        .where(eq(mediaAssets.id, parsedId.data))
      await audit(tx, user, 'media.update', {
        entityType: 'media_asset',
        entityId: parsedId.data,
        summary: `Editó la imagen «${data.altText.slice(0, 80)}»`,
        meta: { containsMinors: data.containsMinors, consentConfirmed: data.containsMinors },
      })
      return true
    })
    if (!updated) return fail('No encontramos esa imagen. Puede que la hayan eliminado.')

    invalidateEverythingWithImages()
    return ok({ id: parsedId.data })
  })
}

export async function eliminarMedio(id: string): Promise<ActionResult<null>> {
  return runAction('media.delete', async () => {
    const user = await requirePermission('media:write')
    const parsedId = idSchema.safeParse(id)
    if (!parsedId.success) return fail('No encontramos esa imagen.')

    const usage = await getMediaUsage(parsedId.data)
    if (usage.length > 0) {
      return fail(`No se puede eliminar: está en uso en ${describeUsage(usage)}. Cámbiala ahí primero.`)
    }

    const storageKey = await db.transaction(async (tx) => {
      const [row] = await tx
        .delete(mediaAssets)
        .where(eq(mediaAssets.id, parsedId.data))
        .returning({ storageKey: mediaAssets.storageKey, altText: mediaAssets.altText })
      if (!row) return null
      await audit(tx, user, 'media.delete', {
        entityType: 'media_asset',
        entityId: parsedId.data,
        summary: `Eliminó la imagen «${(row.altText ?? '').slice(0, 80)}»`,
      })
      return row.storageKey
    })
    if (!storageKey) return fail('No encontramos esa imagen. Puede que ya la hayan eliminado.')

    // Los archivos se borran después de confirmar la transacción: si falla, queda basura pero no datos rotos.
    await removeMediaFiles(storageKey).catch((error: unknown) => {
      logger.error({ err: error, storageKey }, 'no se pudieron borrar los archivos de una imagen eliminada')
    })
    updateTag(tags.media())
    return ok(null)
  })
}
