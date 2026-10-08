import { fileTypeFromBuffer } from 'file-type'

/** Formatos de imagen aceptados (especificación 9.5). SVG se rasteriza: nunca se sirve tal cual. */
export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'svg'

const BY_MIME: Record<string, ImageFormat> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function looksLikeSvg(input: Uint8Array): boolean {
  const head = new TextDecoder().decode(input.subarray(0, 1024)).trimStart().toLowerCase()
  return head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))
}

/**
 * Tipo real del archivo según su firma (*magic bytes*), no según su extensión ni el tipo que declara el
 * navegador. Devuelve `null` si no es una imagen permitida.
 */
export async function sniffImageFormat(input: Uint8Array): Promise<ImageFormat | null> {
  const detected = await fileTypeFromBuffer(input)
  // Los SVG son texto: `file-type` no los reconoce, o los informa como XML genérico si traen `<?xml …?>`.
  if (!detected || detected.mime === 'application/xml') return looksLikeSvg(input) ? 'svg' : null
  return BY_MIME[detected.mime] ?? null
}

/** Tamaño final al reducir una imagen para que ningún lado supere `max`, sin agrandarla. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= max) return { width, height }
  const scale = max / longest
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/**
 * Cola de concurrencia 1: cada tarea empieza cuando terminó la anterior, aunque esa haya fallado.
 * Mantiene acotada la memoria de sharp en la VM (especificación 2.7).
 */
export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve()
  return function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = tail.then(task, task)
    tail = result.catch(() => undefined)
    return result
  }
}
