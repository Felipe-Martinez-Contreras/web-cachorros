'use server'

import { eq } from 'drizzle-orm'
import { contactMessages } from '@/db/schema'
import type { ActionResult } from '@/lib/action-result'
import { assertId, mutate, Rejection } from '@/lib/entity-action'
import { CONTACT_STATUSES, inboxUpdateSchema } from './schemas'

/** Estado y notas internas de un mensaje de contacto. La auditoría no guarda el texto de las notas. */
export async function actualizarMensaje(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  return mutate({
    action: 'contact_message.update',
    permission: 'messages:write',
    entityType: 'contact_message',
    schema: inboxUpdateSchema(CONTACT_STATUSES),
    input,
    tags: [],
    write: async (tx, data) => {
      const messageId = assertId(id, 'No encontramos ese mensaje.')
      const [row] = await tx
        .update(contactMessages)
        .set(data)
        .where(eq(contactMessages.id, messageId))
        .returning({ id: contactMessages.id })
      if (!row) throw new Rejection('No encontramos ese mensaje. Puede que lo hayan eliminado.')
      return { id: messageId, summary: 'Actualizó un mensaje de contacto', meta: { status: data.status } }
    },
  })
}
