import 'server-only'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import { env } from '@/lib/env'

// Carpeta y borrado de los archivos de la biblioteca, sin sharp: lo importan las acciones que solo
// borran (eliminar una imagen o un documento) sin cargar el procesamiento de imágenes.

export function uploadsDir(): string {
  // La carpeta de subidas se decide en runtime (variable de entorno): el comentario evita que el build
  // rastree todo el proyecto y lo meta en la imagen.
  return path.resolve(/* turbopackIgnore: true */ env.UPLOADS_DIR ?? './data/uploads')
}

export async function removeMediaFiles(storageKey: string): Promise<void> {
  // La clave es un UUID generado por el servidor; igual se verifica que no salga de la carpeta.
  if (!/^[a-z0-9][a-z0-9-]*$/.test(storageKey)) return
  await rm(path.join(/* turbopackIgnore: true */ uploadsDir(), storageKey), { recursive: true, force: true })
}
