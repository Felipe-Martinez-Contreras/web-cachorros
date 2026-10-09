'use server'

import { type ActionResult, ok } from '@/lib/action-result'
import { requirePermission } from '@/lib/auth/session'
import { runAction } from '@/lib/run-action'

/** Acción de muestra para la página del sistema de diseño: no escribe nada. */
export async function accionDeMuestra(): Promise<ActionResult<null>> {
  return runAction('design-system.demo', async () => {
    await requirePermission('panel:access')
    return ok(null)
  })
}
