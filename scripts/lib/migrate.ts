import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

export type MigrateOptions = {
  /** Conexión de administración (dueña del esquema): aplica migraciones y gestiona el rol de la app. */
  adminUrl: string
  /** Conexión de la app: de aquí salen el nombre y la clave del rol restringido. */
  appUrl: string
  migrationsFolder?: string
}

const ROLE_NAME = /^[a-z_][a-z0-9_]{0,62}$/

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function parseAppRole(appUrl: string, adminUrl: string) {
  const app = new URL(appUrl)
  const role = decodeURIComponent(app.username)
  const password = decodeURIComponent(app.password)
  if (!ROLE_NAME.test(role)) {
    throw new Error(
      `DATABASE_URL: el usuario "${role}" no es un nombre de rol válido (minúsculas, números y _).`,
    )
  }
  if (!password) throw new Error('DATABASE_URL: falta la contraseña del rol de la app.')
  if (role === decodeURIComponent(new URL(adminUrl).username)) {
    throw new Error(
      'DATABASE_URL y DATABASE_ADMIN_URL deben usar usuarios distintos: la app no puede ser administradora.',
    )
  }
  return { role, password }
}

/**
 * Aplica las migraciones pendientes y deja listo el rol restringido de la app (especificación 9.7):
 * solo SELECT/INSERT/UPDATE/DELETE, también sobre las tablas que se creen después. Es idempotente.
 */
export async function runMigrations({ adminUrl, appUrl, migrationsFolder = './drizzle' }: MigrateOptions) {
  const { role, password } = parseAppRole(appUrl, adminUrl)
  const sql = postgres(adminUrl, { max: 1, onnotice: () => {} })
  try {
    await migrate(drizzle(sql), { migrationsFolder })

    await sql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = ${quoteLiteral(role)}) THEN
          CREATE ROLE ${role} LOGIN PASSWORD ${quoteLiteral(password)};
        ELSE
          ALTER ROLE ${role} LOGIN PASSWORD ${quoteLiteral(password)};
        END IF;
      END
      $$;
    `)
    const [current] = await sql<{ name: string }[]>`select current_database() as name`
    if (!current) throw new Error('No se pudo leer el nombre de la base de datos.')
    await sql.unsafe(`
      GRANT CONNECT ON DATABASE "${current.name.replaceAll('"', '""')}" TO ${role};
      GRANT USAGE ON SCHEMA public TO ${role};
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role};
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role};
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role};
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${role};
    `)
    return { role }
  } finally {
    await sql.end()
  }
}

/** Lee una variable obligatoria para los scripts de consola, con un mensaje claro si falta. */
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Revisa tu archivo .env (guíate por .env.example).`)
  }
  return value
}
