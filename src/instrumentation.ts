import type { Instrumentation } from 'next'

export async function register() {
  // biome-ignore lint/style/noProcessEnv: variables que define el propio Next
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NEXT_PHASE === 'phase-production-build') return
  const { registerNode } = await import('./instrumentation-node')
  await registerNode()
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const { logger } = await import('@/lib/logger')
  logger.error(
    {
      err: error,
      method: request.method,
      path: request.path.split('?')[0],
      routePath: context.routePath,
      routeType: context.routeType,
    },
    'error de servidor',
  )
}
