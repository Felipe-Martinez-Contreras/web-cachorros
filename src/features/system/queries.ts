import 'server-only'
import { desc, inArray } from 'drizzle-orm'
import { db } from '@/db/client'
import { opsRuns } from '@/db/schema'
import type { OpsRunSummary, SystemRuns } from './lib/health'

/**
 * Última ejecución de cada tarea del contenedor `ops` (especificación 12.8 y 12.9): respaldo, prueba de
 * restauración y chequeo de disco. Una sola consulta con `DISTINCT ON`.
 */
export async function getSystemRuns(): Promise<SystemRuns> {
  const rows = await db
    .selectDistinctOn([opsRuns.kind], {
      kind: opsRuns.kind,
      status: opsRuns.status,
      startedAt: opsRuns.startedAt,
      finishedAt: opsRuns.finishedAt,
      details: opsRuns.details,
    })
    .from(opsRuns)
    .where(inArray(opsRuns.kind, ['respaldo', 'prueba_restauracion', 'disco']))
    .orderBy(opsRuns.kind, desc(opsRuns.startedAt))
  const summary = (kind: (typeof rows)[number]['kind']): OpsRunSummary | null => {
    const row = rows.find((item) => item.kind === kind)
    if (!row) return null
    return {
      status: row.status,
      at: (row.finishedAt ?? row.startedAt).toISOString(),
      details: row.details ?? null,
    }
  }
  return { backup: summary('respaldo'), restoreTest: summary('prueba_restauracion'), disk: summary('disco') }
}
