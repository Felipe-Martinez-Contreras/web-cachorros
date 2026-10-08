import { fitWithin } from '../lib/upload-rules'

/** Lado máximo antes de subir (especificación 2.7): ahorra datos del celular y memoria del servidor. */
const MAX_SIDE = 2560
/** Bajo este peso y tamaño, el archivo se sube tal cual. */
const SMALL_ENOUGH_BYTES = 1.5 * 1024 * 1024

export class UnreadableImageError extends Error {}

async function toBlob(bitmap: ImageBitmap, width: number, height: number, type: string): Promise<Blob> {
  const quality = type === 'image/jpeg' ? 0.88 : undefined
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height)
    return canvas.convertToBlob({ type, quality })
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new UnreadableImageError())), type, quality)
  })
}

/**
 * Reduce y recomprime la imagen en el navegador antes de subirla. Los SVG y las imágenes pequeñas pasan
 * sin tocar. Si el navegador no puede decodificarla (HEIC fuera de Safari), lanza `UnreadableImageError`.
 */
export async function prepareImage(file: File, kind: 'photo' | 'logo'): Promise<Blob> {
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new UnreadableImageError()
  }
  try {
    const target = fitWithin(bitmap.width, bitmap.height, MAX_SIDE)
    const alreadyFine =
      target.width === bitmap.width &&
      file.size <= SMALL_ENOUGH_BYTES &&
      ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    if (alreadyFine) return file
    // Los escudos conservan la transparencia; las fotos van a JPEG.
    const type = kind === 'logo' || file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    return await toBlob(bitmap, target.width, target.height, type)
  } finally {
    bitmap.close()
  }
}
