import { whatsappNumber } from './format'

/** `https://wa.me/<número sin + ni espacios>?text=<mensaje codificado>` */
export function whatsappUrl(e164: string, message?: string): string {
  const base = `https://wa.me/${whatsappNumber(e164)}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}

/** Enlaces de navegación a una ubicación (especificación 6.13). */
export function directionsUrls(lat: number, lng: number) {
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
    apple: `https://maps.apple.com/?daddr=${lat},${lng}`,
  }
}

/** Solo se enlaza a direcciones web reales: los marcadores [COMPLETAR] y otros textos no son enlaces. */
export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}
