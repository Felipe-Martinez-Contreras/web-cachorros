'use server'

import { type ActionResult, fail, ok } from '@/lib/action-result'
import { requirePermission } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'
import { runAction } from '@/lib/run-action'
import { type ConsoleSnapshot, consoleSnapshot, getResultSheet } from './admin-queries'

/**
 * Estado actual de la consola en vivo, para releerlo después de cada acción confirmada. Es una lectura
 * por Server Action (no `router.refresh()`): si la señal se corta a mitad de camino, solo falla la
 * lectura, sin recargar la página ni perder la consola.
 */
export async function leerConsola(id: string): Promise<ActionResult<ConsoleSnapshot>> {
  return runAction('match.console.read', async () => {
    await requirePermission('matches:live')
    if (!isUuid(id)) return fail('No encontramos ese partido.')
    const sheet = await getResultSheet(id)
    return sheet
      ? ok(consoleSnapshot(sheet))
      : fail('No encontramos ese partido. Puede que lo hayan eliminado.')
  })
}
