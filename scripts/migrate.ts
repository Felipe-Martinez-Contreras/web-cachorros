// `pnpm db:migrate` (desarrollo) · `node scripts/migrate.mjs` (servicio `migrate` de la imagen).
import { requireEnv, runMigrations } from './lib/migrate'

try {
  const { role } = await runMigrations({
    adminUrl: requireEnv('DATABASE_ADMIN_URL'),
    appUrl: requireEnv('DATABASE_URL'),
  })
  console.log(`Migraciones aplicadas. Rol de la app listo: ${role}.`)
} catch (error) {
  console.error('No se pudieron aplicar las migraciones.')
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
