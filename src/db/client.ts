import 'server-only'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '@/lib/env'
import * as schema from './schema'

function createClient() {
  // postgres.js conecta recién con la primera consulta: importar este módulo no toca la BD
  // (requisito para que `next build` funcione sin base de datos).
  return postgres(env.DATABASE_URL ?? 'postgres://sin-configurar', {
    max: env.DB_POOL_MAX ?? 5,
    // Una conexión ociosa se cierra a los 2 minutos (no a los 30 s): con la CPU de la VM ocupada, cada
    // reconexión es un handshake más que puede no alcanzar a completarse (incidente sha-8191eed).
    idle_timeout: 120,
    // Se renuevan cada 30 minutos aunque estén en uso: una conexión que quedó mal no dura para siempre.
    max_lifetime: 60 * 30,
    // Plazo para conectar y autenticarse. Si se cumple, la consulta falla y la siguiente vuelve a intentar.
    connect_timeout: 15,
    // Para reconocerlas en pg_stat_activity.
    connection: { application_name: 'cachorros-web' },
    onnotice: () => {},
  })
}

// En desarrollo se reutiliza el pool entre recargas en caliente para no agotar conexiones.
const globalForDb = globalThis as typeof globalThis & { __cachorrosSql?: ReturnType<typeof createClient> }

export const sql = globalForDb.__cachorrosSql ?? createClient()
if (env.SITE_ENV === 'development') globalForDb.__cachorrosSql = sql

export const db = drizzle(sql, { schema })

export type Db = typeof db
/** Transacción de Drizzle: lo que reciben los helpers que escriben dentro de `db.transaction`. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
