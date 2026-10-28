import 'server-only'
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { MediaVariants } from '@/db/schema/media'
import { QueueAbortedError } from '@/features/media/lib/upload-rules'
import { runHeavy } from '@/lib/heavy-queue'
import { logger } from '@/lib/logger'
import { CREST_TREATMENT_REVISION, type CrestCardStyle, crestPreviewTile } from './crest-card'
import { shareCacheDir } from './images'
import { shortHash } from './lib/cards'
import { readMediaFile } from './queries'

// Vistas previas de «Escudos en las tarjetas» (Rivales): cada una se dibuja una sola vez por versión del
// escudo y estilo, y se guarda en `SHARE_CACHE_DIR/escudos/`. En la VM (0,25 vCPU) dibujar una cuesta ~1,6 s
// de CPU: sin caché, abrir la página varias veces dejaba al resto del sitio sin CPU (incidente sha-8191eed).

export type CrestPreview = { bytes: Buffer; fromCache: boolean }

/** Las que se están dibujando: una petición igual espera la misma en vez de encolar otra. */
const inFlight = new Map<string, Promise<CrestPreview | null>>()

/** Archivo del escudo para Satori (el PNG de 512 px o el original si ya es PNG). */
export function crestFile(variants: MediaVariants | null | undefined): string | null {
  return variants?.png512 ?? (variants?.master.endsWith('.png') ? variants.master : null)
}

/**
 * Nombre de la vista previa en la caché: cambia si cambia el archivo del escudo (o se reprocesa con otra
 * versión del proceso de logos) o el tratamiento de las tarjetas.
 */
export function crestPreviewName(mediaId: string, variants: MediaVariants, style: CrestCardStyle): string {
  const version = shortHash([crestFile(variants) ?? '', variants.logo?.v ?? 0, CREST_TREATMENT_REVISION])
  return `${mediaId}-${version}-${style}.png`
}

export function crestPreviewDir(): string {
  return path.join(/* turbopackIgnore: true */ shareCacheDir(), 'escudos')
}

/**
 * Vista previa del escudo con ese estilo: desde el disco si ya existe; si no, se dibuja en la cola (una sola
 * vez aunque la pidan varias a la vez) y se guarda. `null` si el escudo no tiene archivo. Con `signal`, si
 * quien la pidió se fue antes de su turno, no se dibuja (`QueueAbortedError`).
 */
export async function getCrestPreview(options: {
  mediaId: string
  variants: MediaVariants
  style: CrestCardStyle
  signal?: AbortSignal
}): Promise<CrestPreview | null> {
  const { mediaId, variants, style, signal } = options
  const source = crestFile(variants)
  if (!source) return null
  const name = crestPreviewName(mediaId, variants, style)

  // Se revisa y se anota sin ningún `await` de por medio: dos pedidos iguales nunca dibujan dos veces.
  const running = inFlight.get(name)
  if (running) {
    try {
      const preview = await running
      return preview ? { bytes: preview.bytes, fromCache: true } : null
    } catch (error) {
      // La que se estaba dibujando era de alguien que se fue: esta la pide de nuevo (con su propia señal).
      if (error instanceof QueueAbortedError) return getCrestPreview(options)
      throw error
    }
  }
  const work = drawOnce(name, source, mediaId, style, signal)
  inFlight.set(name, work)
  try {
    return await work
  } finally {
    inFlight.delete(name)
  }
}

async function drawOnce(
  name: string,
  source: string,
  mediaId: string,
  style: CrestCardStyle,
  signal: AbortSignal | undefined,
): Promise<CrestPreview | null> {
  const file = path.join(/* turbopackIgnore: true */ crestPreviewDir(), name)
  const cached = await readFile(file).catch(() => null)
  if (cached) return { bytes: cached, fromCache: true }
  // El archivo se lee antes de entrar a la cola; dentro solo se procesa.
  const png = await readMediaFile(source)
  if (!png) return null
  const bytes = await runHeavy(
    async () => {
      const tile = await crestPreviewTile(png, style)
      if (!tile) return null
      await mkdir(path.dirname(file), { recursive: true })
      const temporary = `${file}.${process.pid}.tmp`
      await writeFile(temporary, tile)
      await rename(temporary, file)
      await removeOldPreviews(mediaId, style, name)
      return tile
    },
    { signal },
  )
  return bytes ? { bytes, fromCache: false } : null
}

/** Borra las vistas previas anteriores del mismo escudo y estilo (el disco de la VM es chico). */
async function removeOldPreviews(mediaId: string, style: CrestCardStyle, current: string): Promise<void> {
  try {
    const names = await readdir(crestPreviewDir())
    await Promise.all(
      names
        .filter(
          (name) => name.startsWith(`${mediaId}-`) && name.endsWith(`-${style}.png`) && name !== current,
        )
        .map((name) => rm(path.join(crestPreviewDir(), name), { force: true })),
    )
  } catch (error) {
    logger.warn({ err: error }, 'no se pudieron borrar vistas previas antiguas de escudos')
  }
}
