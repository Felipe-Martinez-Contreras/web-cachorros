import type { BankDetails } from '@/db/schema/system'

/**
 * Mapa de OpenStreetMap de un punto (especificación 6.13): `embed` para el iframe detrás de la fachada y
 * `page` para el enlace sin JavaScript. Lógica pura.
 */
export function openStreetMapUrls(lat: number, lng: number) {
  // Recuadro de unos 600 × 450 m alrededor del punto.
  const dLng = 0.004
  const dLat = 0.003
  const bbox = [lng - dLng, lat - dLat, lng + dLng, lat + dLat].map((value) => value.toFixed(5)).join('%2C')
  return {
    embed: `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`,
    page: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`,
  }
}

const BANK_LINES: [keyof BankDetails, string][] = [
  ['holder', 'Titular'],
  ['rut', 'RUT'],
  ['bank', 'Banco'],
  ['accountType', 'Tipo de cuenta'],
  ['accountNumber', 'Número de cuenta'],
  ['email', 'Correo'],
]

/**
 * Datos de transferencia como bloque listo para pegar en la app del banco (6.14), una línea por dato y
 * en el orden que piden los bancos chilenos. `null` si no hay ninguno.
 */
export function bankTransferText(details: Partial<BankDetails> | null | undefined): string | null {
  if (!details) return null
  const lines = BANK_LINES.flatMap(([key, label]) => {
    const value = details[key]?.trim()
    return value ? [`${label}: ${value}`] : []
  })
  return lines.length > 0 ? lines.join('\n') : null
}
