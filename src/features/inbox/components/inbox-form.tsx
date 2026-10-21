'use client' // Cliente: estado y notas internas de un envío de la bandeja (react-hook-form + Zod).

import { useMemo } from 'react'
import { EntityForm } from '@/components/admin/entity-form'
import type { inboxStatus } from '@/db/schema/enums'
import type { ActionResult } from '@/lib/action-result'
import { inboxStatusLabels } from '@/lib/labels'
import { type InboxUpdateValues, inboxUpdateSchema } from '../schemas'

type InboxStatus = (typeof inboxStatus.enumValues)[number]

export function InboxUpdateForm({
  statuses,
  action,
  defaults,
  backHref,
}: {
  /** Los estados que se pueden elegir ahora; el servidor vuelve a validar el cambio. */
  statuses: readonly [InboxStatus, ...InboxStatus[]]
  action: (input: unknown) => Promise<ActionResult<unknown>>
  defaults: InboxUpdateValues
  backHref: string
}) {
  // Del lado del cliente el estado se trata como texto: los valores por defecto vienen de la fila guardada.
  const schema = useMemo(() => inboxUpdateSchema<readonly [string, ...string[]]>(statuses), [statuses])
  return (
    <EntityForm
      schema={schema}
      action={action}
      defaultValues={defaults}
      redirectTo={backHref}
      cancelHref={backHref}
      fields={[
        {
          name: 'status',
          label: 'Estado',
          type: 'select',
          options: statuses.map((status) => ({ value: status, label: inboxStatusLabels[status] })),
        },
        {
          name: 'internalNotes',
          label: 'Notas internas',
          type: 'textarea',
          required: false,
          maxLength: 2000,
          help: 'Solo las ve la directiva en el panel. No anotes datos sensibles.',
        },
      ]}
    />
  )
}
