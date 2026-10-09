'use client' // Cliente: formularios del cuerpo técnico y sus cargos por serie.

import { EntityForm } from '@/components/admin/entity-form'
import type { MediaThumbDTO } from '@/features/media/dto'
import type { ActionResult } from '@/lib/action-result'
import { optionsFromLabels } from '@/lib/form-schemas'
import { staffRoleLabels } from '@/lib/labels'
import { type AssignmentFormValues, assignmentSchema, type StaffFormValues, staffSchema } from '../schemas'

type Action = (input: unknown) => Promise<ActionResult<unknown>>
type Option = { value: string; label: string }

export function StaffForm({
  action,
  defaults,
  photo,
  isNew = false,
}: {
  action: Action
  defaults: StaffFormValues
  photo: MediaThumbDTO | null
  isNew?: boolean
}) {
  return (
    <EntityForm
      schema={staffSchema}
      action={action}
      defaultValues={defaults}
      mediaPreviews={{ photoMediaId: photo }}
      submitLabel={isNew ? 'Crear' : 'Guardar'}
      redirectTo={isNew ? (id) => `/admin/cuerpo-tecnico/${id}` : undefined}
      cancelHref={isNew ? '/admin/cuerpo-tecnico' : undefined}
      fields={[
        { name: 'fullName', label: 'Nombre completo', type: 'text' },
        { name: 'photoMediaId', label: 'Foto', type: 'media', required: false },
        { name: 'bio', label: 'Reseña', type: 'textarea', required: false, maxLength: 600 },
      ]}
    />
  )
}

export function AssignmentForm({
  action,
  defaults,
  seasons,
  series,
}: {
  action: Action
  defaults: AssignmentFormValues
  seasons: Option[]
  series: Option[]
}) {
  return (
    <EntityForm
      schema={assignmentSchema}
      action={action}
      defaultValues={defaults}
      submitLabel="Asignar cargo"
      successMessage="Cargo asignado."
      fields={[
        { name: 'role', label: 'Cargo', type: 'select', options: optionsFromLabels(staffRoleLabels) },
        { name: 'seriesId', label: 'Serie', type: 'select', options: series },
        { name: 'seasonId', label: 'Temporada', type: 'select', options: seasons },
      ]}
    />
  )
}
