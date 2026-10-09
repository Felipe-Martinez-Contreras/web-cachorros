import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { opsRuns } from '@/db/schema'

/** Último respaldo registrado por el contenedor `ops` (especificación 12.8); `null` si no hay ninguno. */
export async function getLastBackup() {
  const [row] = await db
    .select({ status: opsRuns.status, startedAt: opsRuns.startedAt, finishedAt: opsRuns.finishedAt })
    .from(opsRuns)
    .where(eq(opsRuns.kind, 'respaldo'))
    .orderBy(desc(opsRuns.startedAt))
    .limit(1)
  return row ?? null
}
