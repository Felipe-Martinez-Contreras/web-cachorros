// Borra lo que dejaron las pruebas e2e anteriores (todo lo que ellas crean empieza con «E2E»).
// Solo desarrollo: lo ejecuta `tests/e2e/global-setup.ts` antes de cargar el seed.
import { rm } from 'node:fs/promises'
import path from 'node:path'
import postgres from 'postgres'
import { requireEnv } from './lib/migrate'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'postgres', 'db'])

try {
  const adminUrl = requireEnv('DATABASE_ADMIN_URL')
  if (process.env.SITE_ENV !== 'development' || !LOCAL_HOSTS.has(new URL(adminUrl).hostname)) {
    throw new Error('e2e-clean solo corre con SITE_ENV=development y una base de datos local.')
  }
  const sql = postgres(adminUrl, { max: 1, onnotice: () => {} })
  try {
    const media = await sql<{ storage_key: string }[]>`
      delete from media_assets where alt_text like 'E2E %' returning storage_key`
    const uploadsDir = path.resolve(process.env.UPLOADS_DIR || './data/uploads')
    for (const { storage_key } of media) {
      if (/^[a-z0-9][a-z0-9-]*$/.test(storage_key)) {
        await rm(path.join(uploadsDir, storage_key), { recursive: true, force: true })
      }
    }
    console.log(`Limpieza e2e: ${media.length} imágenes de pruebas anteriores eliminadas.`)
  } finally {
    await sql.end()
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
