// Las pruebas de integración usan una base aparte (`cachorros_test`) en el mismo PostgreSQL de desarrollo,
// para no tocar tus datos locales. La app se conecta con el rol restringido, igual que en producción.
import { existsSync } from 'node:fs'

if (existsSync('.env')) process.loadEnvFile('.env')

const TEST_DB = 'cachorros_test'

function withDatabase(url: string, database: string): string {
  const parsed = new URL(url)
  parsed.pathname = `/${database}`
  return parsed.toString()
}

const adminUrl =
  process.env.DATABASE_ADMIN_URL ?? 'postgres://cachorros_admin:cachorros_admin_dev@localhost:5439/cachorros'
const appUrl =
  process.env.DATABASE_URL ?? 'postgres://cachorros_app:cachorros_app_dev@localhost:5439/cachorros'

export const testDb = {
  name: TEST_DB,
  /** Conexión de administración a la base original: solo para crear y borrar la de pruebas. */
  maintenanceUrl: adminUrl,
  adminUrl: withDatabase(adminUrl, TEST_DB),
  appUrl: withDatabase(appUrl, TEST_DB),
}
