export type Coordinates = { lat: number; lng: number }

const NUMBER = String.raw`-?\d{1,3}(?:\.\d+)?`

// De más a menos preciso: el marcador del lugar, el destino o la búsqueda, y por último el centro del mapa.
const URL_PATTERNS = [
  new RegExp(`!3d(${NUMBER})!4d(${NUMBER})`),
  new RegExp(`[?&](?:q|query|destination|daddr|ll|mlat)=(${NUMBER}),\\s*(${NUMBER})`),
  new RegExp(`@(${NUMBER}),(${NUMBER})`),
]

/** «-35.0123, -71.4567» o, con coma decimal, «-35,0123; -71,4567». */
const PLAIN_DOT = new RegExp(`^(${NUMBER})\\s*[,; ]\\s*(${NUMBER})$`)
const PLAIN_COMMA = /^(-?\d{1,3},\d+)\s*[; ]\s*(-?\d{1,3},\d+)$/

function valid(lat: number, lng: number): Coordinates | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}

/**
 * Coordenadas a partir de lo que una persona pega en el panel (especificación 7.7): un enlace de Google
 * Maps, OpenStreetMap o Waze, o el par «latitud, longitud». Devuelve `null` si no las encuentra (por
 * ejemplo, en un enlace corto `maps.app.goo.gl`, que no trae las coordenadas).
 */
export function parseCoordinates(input: string): Coordinates | null {
  let text = input.trim()
  if (text === '') return null
  try {
    text = decodeURIComponent(text)
  } catch {
    // Un «%» suelto no es un enlace codificado: se usa el texto tal cual.
  }
  // Algunos teclados escriben el signo menos tipográfico.
  text = text.replace(/[−–]/g, '-')

  const dot = PLAIN_DOT.exec(text)
  if (dot) return valid(Number(dot[1]), Number(dot[2]))
  const comma = PLAIN_COMMA.exec(text)
  if (comma) return valid(Number(comma[1]?.replace(',', '.')), Number(comma[2]?.replace(',', '.')))

  for (const pattern of URL_PATTERNS) {
    const match = pattern.exec(text)
    if (match) return valid(Number(match[1]), Number(match[2]))
  }
  return null
}

/** Texto para volver a mostrar las coordenadas guardadas en el formulario. */
export function formatCoordinates(lat: number | null, lng: number | null): string {
  return lat === null || lng === null ? '' : `${lat}, ${lng}`
}
