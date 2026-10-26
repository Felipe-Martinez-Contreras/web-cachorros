// `node scripts/run.mjs reprocess-logos [--limpiar]` (desarrollo) · `node scripts/reprocess-logos.mjs`
// (dentro del contenedor, docs/despliegue.md).
//
// Vuelve a procesar los escudos y logos ya subidos con el proceso actual de logos (recorte del margen vacío y
// medidas para el tamaño óptico, `LOGO_PIPELINE_VERSION`). Se puede correr las veces que quieras: solo toca
// los que quedaron con una revisión anterior.
//
// - Nunca pierde el original: parte del original guardado (o, en los antiguos, del master, que es el archivo
//   subido sin recortar) y lo vuelve a guardar como `original.png` en la carpeta nueva.
// - Escribe en una carpeta nueva (`<clave>-l<revisión>`): las imágenes se sirven como inmutables, así la URL
//   cambia y nadie ve el archivo viejo en caché. La carpeta anterior queda hasta correr con `--limpiar`.
// - Sube `share_version` de los partidos de esos equipos: sus tarjetas para redes se vuelven a dibujar.
import { access, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { and, eq, inArray, or, sql as sqlExpr } from 'drizzle-orm'
import { db, sql } from '@/db/client'
import { matches, mediaAssets, teams } from '@/db/schema'
import { LOGO_PIPELINE_VERSION } from '@/lib/images/crest'
import { processImage } from '@/lib/images/process'

const KEY = /^[a-z0-9][a-z0-9-]*$/
const REVISION_SUFFIX = /-l(\d+)$/

/** Clave sin la revisión: `abc-l1` → `abc`. */
function baseKey(storageKey: string): string {
  return storageKey.replace(REVISION_SUFFIX, '')
}

async function exists(file: string): Promise<boolean> {
  return access(file).then(
    () => true,
    () => false,
  )
}

async function reprocess(uploadsDir: string) {
  const rows = await db
    .select({ id: mediaAssets.id, storageKey: mediaAssets.storageKey, variants: mediaAssets.variants })
    .from(mediaAssets)
    .where(and(eq(mediaAssets.kind, 'imagen'), sqlExpr`${mediaAssets.variants} ? 'png512'`))
  let done = 0
  let current = 0
  for (const row of rows) {
    const variants = row.variants
    if (!variants || (variants.logo?.v ?? 0) >= LOGO_PIPELINE_VERSION) {
      current++
      continue
    }
    const source = variants.original ?? variants.master
    const bytes = await readFile(path.join(uploadsDir, source)).catch(() => null)
    if (!bytes) {
      console.warn(`- ${row.id}: no está el archivo ${source}; se deja como está.`)
      continue
    }
    const storageKey = `${baseKey(row.storageKey)}-l${LOGO_PIPELINE_VERSION}`
    const processed = await processImage(bytes, { uploadsDir, kind: 'logo', storageKey })
    const updated = await db.transaction(async (tx) => {
      const [media] = await tx
        .update(mediaAssets)
        .set({
          storageKey: processed.storageKey,
          mime: processed.mime,
          bytes: processed.bytes,
          width: processed.width,
          height: processed.height,
          variants: processed.variants,
          lqip: processed.lqip,
        })
        // Si alguien la cambió mientras tanto, no se pisa.
        .where(and(eq(mediaAssets.id, row.id), eq(mediaAssets.storageKey, row.storageKey)))
        .returning({ id: mediaAssets.id })
      if (!media) return false
      const crestTeams = tx.select({ id: teams.id }).from(teams).where(eq(teams.crestMediaId, row.id))
      await tx
        .update(matches)
        .set({ shareVersion: sqlExpr`${matches.shareVersion} + 1` })
        .where(or(inArray(matches.homeTeamId, crestTeams), inArray(matches.awayTeamId, crestTeams)))
      return true
    })
    if (!updated) {
      await rm(path.join(uploadsDir, storageKey), { recursive: true, force: true })
      console.warn(`- ${row.id}: cambió mientras se procesaba; se deja como está.`)
      continue
    }
    done++
    console.log(`- ${row.id}: ${row.storageKey} → ${storageKey} (${processed.width} × ${processed.height})`)
  }
  console.log(`Listo: ${done} reprocesados, ${current} ya estaban al día.`)
  if (done > 0) {
    console.log('Reinicia la app para que el sitio deje de usar los archivos anteriores en su caché.')
  }
}

/**
 * Borra las carpetas de otras revisiones de cada logo (la original sigue en `original.png`): las que dejó
 * `reprocess-logos` y la que queda si el seed vuelve a la clave sin revisión. Nunca una que esté en uso.
 */
async function clean(uploadsDir: string) {
  const all = await db
    .select({ storageKey: mediaAssets.storageKey, variants: mediaAssets.variants })
    .from(mediaAssets)
  const inUse = new Set(all.map((row) => row.storageKey))
  let removed = 0
  for (const row of all) {
    if (!row.variants?.png512) continue
    const base = baseKey(row.storageKey)
    const revisions = Array.from({ length: LOGO_PIPELINE_VERSION }, (_, index) => `${base}-l${index + 1}`)
    for (const key of [base, ...revisions]) {
      if (!KEY.test(key) || inUse.has(key)) continue
      const dir = path.join(uploadsDir, key)
      if (!(await exists(dir))) continue
      await rm(dir, { recursive: true, force: true })
      removed++
      console.log(`- borrada ${key}`)
    }
  }
  console.log(`Listo: ${removed} carpetas anteriores borradas.`)
}

let exitCode = 0
try {
  const args = process.argv.slice(2)
  const unknown = args.filter((arg) => arg !== '--limpiar')
  if (unknown.length > 0) {
    throw new Error(`Opción desconocida: ${unknown.join(', ')}. Uso: reprocess-logos [--limpiar]`)
  }
  const uploadsDir = path.resolve(process.env.UPLOADS_DIR || './data/uploads')
  if (args.includes('--limpiar')) await clean(uploadsDir)
  else await reprocess(uploadsDir)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  exitCode = 1
} finally {
  await sql.end()
}
process.exit(exitCode)
