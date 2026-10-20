const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/** Claves de prueba oficiales («siempre pasa», «siempre falla», …): nunca en producción. */
export const TURNSTILE_TEST_KEY = /^[123]x0{20,}[A-F]{2}$/

export type TurnstileConfig = {
  secret: string
  /** Hostname del sitio (`SITE_URL`): el token debe venir de él. */
  hostname: string
  fetch?: typeof fetch
}

export type TurnstileResult = 'ok' | 'missing' | 'rejected' | 'unavailable'

type SiteverifyResponse = { success?: boolean; hostname?: string; action?: string }

/**
 * Valida el token en el servidor (especificación 9.4): `success`, `hostname` y `action`. Con las claves de
 * prueba oficiales Cloudflare responde un hostname y una acción ficticios, así que solo cuenta `success`.
 */
export async function verifyTurnstile(
  token: string | null,
  expected: { action: string; remoteIp?: string },
  config: TurnstileConfig,
): Promise<TurnstileResult> {
  if (!token) return 'missing'
  const body = new URLSearchParams({ secret: config.secret, response: token })
  if (expected.remoteIp) body.set('remoteip', expected.remoteIp)

  let result: SiteverifyResponse
  try {
    const response = await (config.fetch ?? fetch)(VERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) return 'unavailable'
    result = (await response.json()) as SiteverifyResponse
  } catch {
    return 'unavailable'
  }

  if (result.success !== true) return 'rejected'
  if (TURNSTILE_TEST_KEY.test(config.secret)) return 'ok'
  return result.hostname === config.hostname && result.action === expected.action ? 'ok' : 'rejected'
}
