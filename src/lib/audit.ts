import 'server-only'
import type { Tx } from '@/db/client'
import { auditLog } from '@/db/schema'

export type AuditEntry = {
  entityType?: string
  entityId?: string
  summary?: string
  meta?: Record<string, unknown>
}

/** Registra una acción en la auditoría, dentro de la misma transacción que la escritura. */
export async function audit(
  tx: Tx,
  user: { id: string },
  action: string,
  entry: AuditEntry = {},
): Promise<void> {
  await tx.insert(auditLog).values({ userId: user.id, action, ...entry })
}
