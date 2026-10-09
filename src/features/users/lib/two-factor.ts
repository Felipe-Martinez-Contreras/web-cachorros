import { renderSVG } from 'uqr'

/** Lo que recibe la pantalla al empezar a activar los dos pasos. */
export type TwoFactorStart = { uri: string; secret: string; qr: string; backupCodes: string[] }

/**
 * Lo que se muestra para configurar la app autenticadora a partir de la dirección `otpauth://` que entrega
 * Better Auth: el código QR (SVG generado en el servidor, como imagen `data:`) y la clave para copiarla a
 * mano. Lógica pura.
 */
export function twoFactorSetup(totpUri: string): { uri: string; secret: string; qr: string } | null {
  let url: URL
  try {
    url = new URL(totpUri)
  } catch {
    return null
  }
  const secret = url.searchParams.get('secret')
  if (url.protocol !== 'otpauth:' || !secret) return null
  const svg = renderSVG(totpUri, { ecc: 'M', border: 2 })
  return {
    uri: totpUri,
    // En grupos de cuatro: más fácil de copiar a mano.
    secret: secret.replace(/(.{4})(?=.)/g, '$1 '),
    qr: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
  }
}

/** Dispositivo en palabras simples a partir del `User-Agent` de una sesión. */
export function describeDevice(userAgent: string | null): string {
  if (!userAgent) return 'Dispositivo desconocido'
  const system = /iPhone|iPad/.test(userAgent)
    ? 'iPhone o iPad'
    : /Android/.test(userAgent)
      ? 'Android'
      : /Windows/.test(userAgent)
        ? 'Windows'
        : /Mac OS X|Macintosh/.test(userAgent)
          ? 'Mac'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : null
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Firefox\//.test(userAgent)
      ? 'Firefox'
      : /Chrome\//.test(userAgent)
        ? 'Chrome'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : null
  return [browser, system].filter(Boolean).join(' en ') || 'Dispositivo desconocido'
}
