'use server'

import { db } from '@/db/client'
import { assertPublishableMedia } from '@/features/media/guards'
import { encodePhotos } from '@/features/social-publishing/lib/photos'
import { type ActionResult, fail, ok } from '@/lib/action-result'
import { requirePermission } from '@/lib/auth/session'
import { Rejection } from '@/lib/entity-action'
import { runAction } from '@/lib/run-action'
import { encodeSeries, parseJornadaKey } from './lib/jornada'
import { jornadaMatches } from './queries'
import { jornadaOptionsSchema } from './schemas'

// Acciones del panel para las tarjetas. No guardan nada: validan lo elegido y lo devuelven para la dirección
// de la página, donde la vista previa y las descargas salen de la ruta del panel (nunca de la pública).

/**
 * Elige las series y las fotos de la tarjeta de una jornada: las series deben ser de esa jornada y las
 * fotos, publicables (sin menores). Devuelve la búsqueda `series=…&fotos=…` para la dirección.
 */
export async function elegirOpcionesJornada(
  key: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction('share.jornada.options', async () => {
    await requirePermission('matches:write')
    if (!parseJornadaKey(key)) return fail('Esta jornada no existe. Vuelve a Partidos.')
    const parsed = jornadaOptionsSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error)
    const { series, photo1, photo2, photo3 } = parsed.data
    const playing = await jornadaMatches(key, series)
    if (playing.length !== new Set(series).size) {
      return {
        ok: false,
        message: 'Revisa los campos marcados.',
        fieldErrors: { series: ['Una de las series ya no juega en esta jornada. Recarga la página.'] },
      }
    }
    const photos = [photo1, photo2, photo3]
    try {
      await db.transaction(async (tx) => {
        for (const [index, photo] of photos.entries()) {
          await assertPublishableMedia(tx, photo ?? null, `photo${index + 1}`)
        }
      })
    } catch (error) {
      if (!(error instanceof Rejection)) throw error
      return {
        ok: false,
        message: 'Revisa los campos marcados.',
        fieldErrors: error.field ? { [error.field]: [error.message] } : undefined,
      }
    }
    const search = new URLSearchParams({ series: encodeSeries(series), fotos: encodePhotos(photos) })
    return ok({ id: search.toString() })
  })
}
