/**
 * Protección CSRF de los formularios públicos: el navegador envía `Origin` en todo POST y debe ser el del
 * sitio (`SITE_URL`). Es lo que las Server Actions verifican de serie; un Route Handler lo hace a mano.
 */
export function isSameOrigin(headers: Headers, siteUrl: string): boolean {
  const origin = headers.get('origin')
  if (!origin) return false
  return origin === new URL(siteUrl).origin
}
