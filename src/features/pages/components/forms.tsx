'use client' // Cliente: formulario de un texto de página (react-hook-form + Zod + editor).

import { EntityForm } from '@/components/admin/entity-form'
import type { ActionResult } from '@/lib/action-result'
import { type PageBlockFormValues, pageBlockSchema } from '../schemas'

export function PageBlockForm({
  action,
  defaults,
}: {
  action: (input: unknown) => Promise<ActionResult<unknown>>
  defaults: PageBlockFormValues
}) {
  return (
    <EntityForm
      schema={pageBlockSchema}
      action={action}
      defaultValues={defaults}
      successMessage="Texto guardado."
      cancelHref="/admin/textos"
      fields={[
        { name: 'title', label: 'Título', type: 'text', required: false },
        { name: 'body', label: 'Texto', type: 'richtext' },
      ]}
    />
  )
}
