import * as z from 'zod'
import { optionalUuid } from '@/lib/form-schemas'

// Fotos del matchday elegidas para una publicación en lugar de las de Configuración. Lógica pura. Viajan en
// la dirección de la página de publicación (`?fotos=id1,,id3`): son ids de la biblioteca, sin datos
// personales, y el servidor los vuelve a validar (incluida la regla de menores) antes de usarlos.

export type PhotoIds = (string | null)[]

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Las 3 fotos como texto para la dirección: `id1,,id3` (vacío = fondo del club). */
export function encodePhotos(photos: readonly (string | null)[]): string {
  return [0, 1, 2].map((index) => photos[index] ?? '').join(',')
}

/** Lee las 3 fotos de la dirección; `null` si el texto no corresponde (así se ignora). */
export function parsePhotos(value: string | null | undefined): PhotoIds | null {
  if (!value) return null
  const parts = value.split(',')
  if (parts.length !== 3) return null
  const photos = parts.map((part) => (part === '' ? null : part.toLowerCase()))
  return photos.every((photo) => photo === null || UUID.test(photo)) ? photos : null
}

/** Formulario «Fotos de esta publicación» (el mismo esquema en el panel y en la acción). */
export const manualPhotosSchema = z.object({
  photo1: optionalUuid(),
  photo2: optionalUuid(),
  photo3: optionalUuid(),
})
