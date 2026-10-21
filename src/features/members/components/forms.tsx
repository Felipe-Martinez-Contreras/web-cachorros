'use client' // Cliente: formularios de planes y del padrón de socios (react-hook-form + Zod).

import { EntityForm, type FieldDef } from '@/components/admin/entity-form'
import type { ActionResult } from '@/lib/action-result'
import { optionsFromLabels } from '@/lib/form-schemas'
import { feePeriodLabels, memberStatusLabels } from '@/lib/labels'
import {
  type MemberFormValues,
  memberSchema,
  type NewMemberFormValues,
  newMemberSchema,
  type PlanFormValues,
  planSchema,
} from '../schemas'

type Action = (input: unknown) => Promise<ActionResult<unknown>>
type Options = { value: string; label: string }[]

export function PlanForm({ action, defaults }: { action: Action; defaults: PlanFormValues }) {
  return (
    <EntityForm
      schema={planSchema}
      action={action}
      defaultValues={defaults}
      redirectTo="/admin/socios/planes"
      cancelHref="/admin/socios/planes"
      fields={[
        { name: 'name', label: 'Nombre', type: 'text', placeholder: 'Socio activo' },
        {
          name: 'feeClp',
          label: 'Cuota en pesos',
          type: 'number',
          min: 0,
          step: 1,
          inputMode: 'numeric',
          help: 'Sin puntos ni signo: 5000.',
        },
        {
          name: 'feePeriod',
          label: 'Se paga',
          type: 'select',
          options: optionsFromLabels(feePeriodLabels),
        },
        {
          name: 'benefits',
          label: 'Beneficios',
          type: 'textarea',
          required: false,
          rows: 5,
          help: 'Uno por línea. Se muestran como lista en la página Hazte socio.',
        },
        {
          name: 'isActive',
          label: 'Disponible en el sitio',
          type: 'checkbox',
          help: 'Un plan inactivo deja de ofrecerse, pero los socios que lo tienen lo conservan.',
        },
        { name: 'sortOrder', label: 'Orden', type: 'number', min: 0, step: 1, help: 'Menor primero.' },
      ]}
    />
  )
}

function memberFields(plans: Options): FieldDef[] {
  return [
    { name: 'fullName', label: 'Nombre completo', type: 'text', autoComplete: 'off' },
    { name: 'rut', label: 'RUT', type: 'text', required: false, placeholder: '12.345.678-5' },
    { name: 'email', label: 'Correo', type: 'email', required: false },
    { name: 'phone', label: 'Celular', type: 'tel', required: false, placeholder: '+56 9 1234 5678' },
    {
      name: 'planId',
      label: 'Plan',
      type: 'select',
      options: plans,
      emptyLabel: 'Sin plan',
      required: false,
    },
    { name: 'status', label: 'Estado', type: 'select', options: optionsFromLabels(memberStatusLabels) },
    { name: 'joinedOn', label: 'Fecha de ingreso', type: 'date' },
  ]
}

export function NewMemberForm({
  action,
  defaults,
  plans,
}: {
  action: Action
  defaults: NewMemberFormValues
  plans: Options
}) {
  return (
    <EntityForm
      schema={newMemberSchema}
      action={action}
      defaultValues={defaults}
      redirectTo="/admin/socios/padron"
      cancelHref="/admin/socios/padron"
      fields={[
        {
          name: 'memberNumber',
          label: 'Número de socio',
          type: 'number',
          min: 1,
          step: 1,
          required: false,
          help: 'Déjalo en blanco para usar el siguiente. Escríbelo solo si el socio ya tenía un número.',
        },
        ...memberFields(plans),
      ]}
    />
  )
}

export function MemberForm({
  action,
  defaults,
  plans,
}: {
  action: Action
  defaults: MemberFormValues
  plans: Options
}) {
  return (
    <EntityForm
      schema={memberSchema}
      action={action}
      defaultValues={defaults}
      redirectTo="/admin/socios/padron"
      cancelHref="/admin/socios/padron"
      fields={memberFields(plans)}
    />
  )
}
