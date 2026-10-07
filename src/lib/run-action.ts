import 'server-only'
import { type ActionResult, fail } from '@/lib/action-result'
import { AuthError } from '@/lib/auth/session'
import { logger } from '@/lib/logger'

/**
 * Envuelve el cuerpo de una Server Action: nunca llegan errores crudos al cliente (especificación 3.5).
 * Los de autorización se devuelven con su mensaje; el resto se registra y se responde algo genérico.
 */
export async function runAction<T>(
  name: string,
  body: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await body()
  } catch (error) {
    if (error instanceof AuthError) return fail(error.message)
    logger.error({ err: error, action: name }, 'error inesperado en una acción')
    return fail('Algo salió mal. Inténtalo de nuevo en unos segundos.')
  }
}
