import 'server-only'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import { db } from '@/db/client'
import { mediaAssets } from '@/db/schema'
import { audit } from '@/lib/audit'
import { env } from '@/lib/env'
import { processImage } from '@/lib/images/process'
import { type MediaThumbDTO, toMediaThumbDTO } from './dto'
import { createSerialQueue, sniffImageFormat } from './lib/upload-rules'

/** Un solo archivo a la vez en todo el proceso: sharp no compite consigo mismo por la memoria de la VM. */
const enqueue = createSerialQueue()

export class UploadError extends Error {
  readonly status: 400 | 413 | 415

  constructor(status: 400 | 413 | 415, message: string) {
    super(message)
    this.name = 'UploadError'
    this.status = status
  }
}

type StoreInput = {
  bytes: Buffer
  filename: string | null
  altText: string
  credit: string | null
  kind: 'photo' | 'logo'
  userId: string
}

export function uploadsDir(): string {
  return path.resolve(env.UPLOADS_DIR ?? './data/uploads')
}

export async function removeMediaFiles(storageKey: string): Promise<void> {
  // La clave es un UUID generado por el servidor; igual se verifica que no salga de la carpeta.
  if (!/^[a-z0-9][a-z0-9-]*$/.test(storageKey)) return
  await rm(path.join(uploadsDir(), storageKey), { recursive: true, force: true })
}

/**
 * Valida la firma real del archivo, lo re-codifica (sin EXIF ni GPS), genera las variantes y lo registra
 * en la biblioteca (especificación 2.7 y 9.5). Si falla el registro, no quedan archivos huérfanos.
 */
export async function storeUploadedImage(input: StoreInput): Promise<MediaThumbDTO> {
  const maxBytes = (env.MAX_UPLOAD_MB ?? 12) * 1024 * 1024
  if (input.bytes.byteLength === 0) throw new UploadError(400, 'El archivo llegó vacío. Vuelve a elegirlo.')
  if (input.bytes.byteLength > maxBytes) {
    throw new UploadError(413, `La imagen pesa más de ${env.MAX_UPLOAD_MB ?? 12} MB. Elige una más liviana.`)
  }
  const format = await sniffImageFormat(input.bytes)
  if (!format) {
    throw new UploadError(415, 'Ese archivo no es una imagen que podamos usar. Sube un JPG, PNG, WebP o SVG.')
  }

  return enqueue(async () => {
    let processed: Awaited<ReturnType<typeof processImage>>
    try {
      processed = await processImage(input.bytes, { uploadsDir: uploadsDir(), kind: input.kind })
    } catch {
      throw new UploadError(400, 'No pudimos leer la imagen. Puede estar dañada: prueba con otra.')
    }
    try {
      return await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(mediaAssets)
          .values({
            kind: 'imagen',
            storageKey: processed.storageKey,
            originalFilename: input.filename?.slice(0, 200) ?? null,
            mime: processed.mime,
            bytes: processed.bytes,
            width: processed.width,
            height: processed.height,
            variants: processed.variants,
            lqip: processed.lqip,
            altText: input.altText,
            credit: input.credit,
            uploadedBy: input.userId,
          })
          .returning({
            id: mediaAssets.id,
            variants: mediaAssets.variants,
            altText: mediaAssets.altText,
            containsMinors: mediaAssets.containsMinors,
          })
        if (!row) throw new Error('La biblioteca no devolvió el archivo creado.')
        await audit(tx, { id: input.userId }, 'media.create', {
          entityType: 'media_asset',
          entityId: row.id,
          summary: `Subió la imagen «${input.altText.slice(0, 80)}»`,
          meta: { width: processed.width, height: processed.height, format },
        })
        return toMediaThumbDTO(row)
      })
    } catch (error) {
      await removeMediaFiles(processed.storageKey)
      throw error
    }
  })
}
