import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { env } from '@/lib/env'

const CONTENT_TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.pdf': 'application/pdf',
}

/**
 * Sirve `/media/*` SOLO en desarrollo (y en las pruebas e2e locales). En staging y producción responde
 * 404: ahí las imágenes las sirve Caddy desde el volumen y Node nunca las toca (especificación 2.7).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (env.SITE_ENV !== 'development') return new Response(null, { status: 404 })

  const root = path.resolve(env.UPLOADS_DIR)
  const file = path.resolve(root, ...(await params).path)
  const contentType = CONTENT_TYPES[path.extname(file).toLowerCase()]
  // La ruta resuelta debe quedar dentro de la carpeta de subidas y tener una extensión conocida.
  if (!contentType || !file.startsWith(root + path.sep)) return new Response(null, { status: 404 })

  try {
    const body = await readFile(file)
    return new Response(new Uint8Array(body), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        ...(contentType === 'application/pdf' ? { 'Content-Security-Policy': 'sandbox' } : null),
      },
    })
  } catch {
    return new Response(null, { status: 404 })
  }
}
