import pino from 'pino'

/**
 * Logs en JSON a stdout (especificación 3.12). Nunca datos personales: los campos sensibles se censuran
 * y los emails se enmascaran con `maskEmail` antes de registrarlos.
 */
export const logger = pino({
  // Se lee directo (no desde env.ts) para poder registrar los errores de la propia validación de entorno.
  // biome-ignore lint/style/noProcessEnv: el logger debe funcionar antes de validar el entorno
  level: process.env.LOG_LEVEL || 'info',
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['password', 'newPassword', 'token', 'secret', 'authorization', 'cookie', '*.password', '*.token'],
    censor: '[oculto]',
  },
})

export function requestLogger(headers: Headers) {
  const requestId = headers.get('cf-ray') ?? headers.get('x-request-id') ?? crypto.randomUUID()
  return logger.child({ requestId })
}

/** `felipe@correo.cl` → `f***@correo.cl` */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return '***'
  return `${local.slice(0, 1)}***@${domain}`
}
