// `pnpm db:seed [--en-vivo] [--hoy=AAAA-MM-DD]` (desarrollo) · `node scripts/seed.mjs` (dentro del contenedor).
//
// Carga los datos de ejemplo de la demo. Se puede correr las veces que quieras: no duplica nada.
// Con SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD crea además un administrador de demostración.
import path from 'node:path'
import { sql } from '@/db/client'
import { santiagoDateTime } from '@/features/matches/lib/countdown'
import { createAdmin } from '@/lib/auth/create-admin'
import { requireEnv } from './lib/migrate'
import { runSeed } from './seed/run'

function parseNow(args: string[]): Date {
  const value = args.find((arg) => arg.startsWith('--hoy='))?.slice('--hoy='.length)
  if (!value) return new Date()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error('La fecha de --hoy debe tener el formato AAAA-MM-DD, por ejemplo --hoy=2026-10-10.')
  }
  // Las 10:00 de ese día en Santiago.
  return santiagoDateTime(new Date(`${value}T15:00:00Z`), 0, 10)
}

let exitCode = 0
try {
  const args = process.argv.slice(2)
  const unknown = args.filter((arg) => arg !== '--en-vivo' && !arg.startsWith('--hoy='))
  if (unknown.length > 0) {
    throw new Error(
      `Opción desconocida: ${unknown.join(', ')}. Uso: pnpm db:seed [--en-vivo] [--hoy=AAAA-MM-DD]`,
    )
  }

  const uploadsDir = path.resolve(process.env.UPLOADS_DIR || './data/uploads')
  console.log('Cargando datos de ejemplo… (las imágenes tardan unos segundos)')
  const result = await runSeed({
    now: parseNow(args),
    live: args.includes('--en-vivo'),
    uploadsDir,
    siteEnv: requireEnv('SITE_ENV'),
  })

  console.log(
    `Listo: ${result.matches} partidos, ${result.players} jugadores, ${result.events} eventos y ${result.media} archivos en ${uploadsDir}.`,
  )
  if (!result.usedClubFiles.crest) {
    console.log(
      'Escudo: se usó el genérico. Para usar el real, deja public/placeholder/escudo.svg (o .png) y repite.',
    )
  }
  if (!result.usedClubFiles.hero) {
    console.log(
      'Hero: se usó una imagen de ejemplo. Para usar una foto real, deja public/placeholder/hero.jpg y repite.',
    )
  }
  if (args.includes('--en-vivo')) console.log('Quedó un partido de Honor EN VIVO en la portada.')

  const email = process.env.SEED_ADMIN_EMAIL
  const password = process.env.SEED_ADMIN_PASSWORD
  if (email && password) {
    const admin = await createAdmin({ name: 'Administrador de demostración', email, password })
    console.log(
      admin.status === 'creado'
        ? `Administrador de demostración creado: ${admin.email}`
        : `El administrador de demostración ya existía: ${admin.email}`,
    )
  }
  console.log('Revisa lo que falta completar con: pnpm content:pending')
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  exitCode = 1
} finally {
  await sql.end()
}
process.exit(exitCode)
