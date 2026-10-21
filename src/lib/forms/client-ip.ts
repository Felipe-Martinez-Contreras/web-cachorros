import { createHmac } from 'node:crypto'

/**
 * Cabecera con la que las pruebas e2e simulan IP distintas para el rate limit. Solo se respeta con
 * `SITE_ENV=development` (que es como corre el CI); en staging y producción se ignora siempre.
 */
export const TEST_IP_HEADER = 'x-e2e-client-ip'

/**
 * IP real de quien envía (especificación 9.4). En staging y producción la entrega Cloudflare en
 * `CF-Connecting-IP`: es confiable porque solo Cloudflare puede conectarse al origen (firewall + AOP), y
 * Cloudflare la reescribe aunque el cliente la mande.
 */
export function clientIp(headers: Headers, siteEnv: 'development' | 'staging' | 'production'): string {
  if (siteEnv === 'development') {
    const testIp = headers.get(TEST_IP_HEADER)?.trim()
    if (testIp) return testIp
  }
  return headers.get('cf-connecting-ip')?.trim() || 'desconocida'
}

/** La IP solo se guarda como HMAC con `IP_HASH_SALT`: permite agrupar envíos sin conocer la IP. */
export function hashIp(ip: string, salt: string): string {
  return createHmac('sha256', salt).update(ip).digest('hex')
}
