import { safeExternalUrl, whatsappUrl } from '@/lib/links'

/** Eventos pasados por página en `/eventos`. */
export const PAST_EVENTS_PAGE_SIZE = 9

/** Página pedida en `?pagina=`: un entero desde 1; cualquier otra cosa es la primera. Lógica pura. */
export function parsePage(value: string | string[] | undefined): number {
  const page = Number(Array.isArray(value) ? value[0] : value)
  return Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1
}

/** `/eventos` o `/eventos?pagina=N` (la página 1 se omite). */
export function eventsListHref(page = 1): string {
  return page > 1 ? `/eventos?pagina=${page}` : '/eventos'
}

/**
 * Botón de acción del evento (6.11): el enlace propio si es una dirección real (inscripción, venta de
 * entradas) o, si no, WhatsApp del club con un mensaje listo. `null` si no hay ninguno.
 */
export function eventCta(
  event: { title: string; ctaUrl: string | null },
  clubWhatsapp: string | null,
): { href: string; label: string; external: boolean } | null {
  const own = safeExternalUrl(event.ctaUrl)
  if (own) return { href: own, label: 'Más información', external: true }
  if (!clubWhatsapp?.startsWith('+')) return null
  return {
    href: whatsappUrl(clubWhatsapp, `¡Hola! Quiero información sobre «${event.title}».`),
    label: 'Consultar por WhatsApp',
    external: true,
  }
}

/** Enlace al mapa del lugar: coordenadas de la cancha si las hay; si no, búsqueda por el texto. */
export function eventMapUrl(place: {
  locationText: string | null
  geoLat: number | null
  geoLng: number | null
}): string | null {
  if (place.geoLat !== null && place.geoLng !== null) {
    return `https://www.google.com/maps/search/?api=1&query=${place.geoLat},${place.geoLng}`
  }
  const text = place.locationText?.trim()
  if (!text || text.includes('[COMPLETAR')) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`
}
