import postgres from 'postgres'
import { runMigrations } from '../../scripts/lib/migrate'
import { testDb } from './db-urls'

/** Recrea la base de pruebas desde cero y le aplica las migraciones reales del proyecto. */
export default async function setup() {
  const sql = postgres(testDb.maintenanceUrl, { max: 1, onnotice: () => {} })
  try {
    await sql.unsafe(`DROP DATABASE IF EXISTS ${testDb.name} WITH (FORCE)`)
    await sql.unsafe(`CREATE DATABASE ${testDb.name}`)
  } catch (error) {
    throw new Error(
      'No se pudo preparar la base de pruebas. ¿Está corriendo PostgreSQL? ' +
        'Levántalo con: docker compose -f compose.dev.yaml up -d',
      { cause: error },
    )
  } finally {
    await sql.end()
  }
  await runMigrations({ adminUrl: testDb.adminUrl, appUrl: testDb.appUrl })
}
