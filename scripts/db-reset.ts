// `pnpm db:reset`: borra TODO y vuelve a crear el esquema. Solo para desarrollo.
import postgres from 'postgres'
import { requireEnv, runMigrations } from './lib/migrate'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

try {
  const adminUrl = requireEnv('DATABASE_ADMIN_URL')
  const siteEnv = process.env.SITE_ENV
  if (siteEnv !== 'development' || !LOCAL_HOSTS.has(new URL(adminUrl).hostname)) {
    throw new Error(
      'db:reset solo corre con SITE_ENV=development y una base de datos local. No se tocó nada.',
    )
  }

  const sql = postgres(adminUrl, { max: 1, onnotice: () => {} })
  try {
    await sql.unsafe(`
      DROP SCHEMA IF EXISTS public CASCADE;
      DROP SCHEMA IF EXISTS drizzle CASCADE;
      CREATE SCHEMA public;
    `)
  } finally {
    await sql.end()
  }

  await runMigrations({ adminUrl, appUrl: requireEnv('DATABASE_URL') })
  console.log('Base de datos recreada desde cero. Crea un administrador con: pnpm admin:create')
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
