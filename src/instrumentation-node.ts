import { logger } from '@/lib/logger'

/** Arranque del servidor Node: valida las variables de entorno. Si falta algo, la app no parte. */
export async function registerNode() {
  try {
    const { env } = await import('@/lib/env')
    logger.info({ siteEnv: env.SITE_ENV, version: env.APP_VERSION }, 'aplicación iniciada')
  } catch (error) {
    logger.fatal(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
