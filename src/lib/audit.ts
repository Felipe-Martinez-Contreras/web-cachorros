import 'server-only'
import type { Tx } from '@/db/client'
import { auditLog } from '@/db/schema'

export type AuditEntry = {
  entityType?: string
  entityId?: string
  summary?: string
  meta?: Record<string, unknown>
}

/**
 * Registra una acción en la auditoría, dentro de la misma transacción que la escritura. `user = null` es
 * una tarea del sistema (por ejemplo, la publicación automática en redes).
 */
export async function audit(
  tx: Tx,
  user: { id: string } | null,
  action: string,
  entry: AuditEntry = {},
): Promise<void> {
  await tx.insert(auditLog).values({ userId: user?.id ?? null, action, ...entry })
}
