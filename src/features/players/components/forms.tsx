'use client' // Cliente: formularios de jugadores, inscripciones y estadísticas históricas.

import { EntityForm, type FieldDef } from '@/components/admin/entity-form'
import type { MediaThumbDTO } from '@/features/media/dto'
import type { ActionResult } from '@/lib/action-result'
import { optionsFromLabels } from '@/lib/form-schemas'
import { playerPositionLabels, positionDetailLabels, registrationStatusLabels } from '@/lib/labels'
import {
  type AdjustmentFormValues,
  adjustmentSchema,
  type NewPlayerFormValues,
  newPlayerSchema,
  type PlayerFormValues,
  playerSchema,
  type RegistrationFormValues,
  registrationSchema,
} from '../schemas'

type Action = (input: unknown) => Promise<ActionResult<unknown>>
type Option = { value: string; label: string }

const PLAYER_FIELDS: FieldDef[] = [
  { name: 'firstName', label: 'Nombre', type: 'text', autoComplete: 'off' },
  { name: 'lastName', label: 'Apellido', type: 'text', autoComplete: 'off' },
  { name: 'nickname', label: 'Apodo', type: 'text', required: false },
  {
    name: 'birthDate',
    label: 'Fecha de nacimiento',
    type: 'date',
    required: false,
    help: 'Es privada: nunca se muestra en el sitio. Sirve para saber si es menor de edad.',
  },
  {
    name: 'primaryPosition',
    label: 'Posición',
    type: 'select',
    options: optionsFromLabels(playerPositionLabels),
  },
  {
    name: 'positionDetail',
    label: 'Posición específica',
    type: 'select',
    required: false,
    emptyLabel: 'Sin especificar',
    options: optionsFromLabels(positionDetailLabels),
  },
  {
    name: 'photoMediaId',
    label: 'Foto',
    type: 'media',
    required: false,
    help: 'Retrato vertical. Si es menor de edad, el sitio no muestra su foto.',
  },
  {
    name: 'imageConsent',
    label: 'El club tiene su autorización para publicar su imagen',
    type: 'checkbox',
  },
  {
    name: 'isActive',
    label: 'Jugador activo',
    type: 'checkbox',
    help: 'Un jugador inactivo no aparece en el plantel, pero conserva sus estadísticas.',
  },
]

export function NewPlayerForm({
  action,
  defaults,
  series,
}: {
  action: Action
  defaults: NewPlayerFormValues
  series: Option[]
}) {
  return (
    <EntityForm
      schema={newPlayerSchema}
      action={action}
      defaultValues={defaults}
      submitLabel="Crear jugador"
      successMessage="Jugador creado."
      redirectTo={(id) => `/admin/jugadores/${id}`}
      cancelHref="/admin/jugadores"
      fields={[
        ...PLAYER_FIELDS.slice(0, 5),
        {
          name: 'seriesId',
          label: 'Inscribir en la serie',
          type: 'select',
          required: false,
          emptyLabel: 'No inscribir todavía',
          options: series,
          help: 'En la temporada actual. Después puedes inscribirlo en más series.',
        },
        {
          name: 'shirtNumber',
          label: 'Número de camiseta',
          type: 'number',
          required: false,
          min: 1,
          max: 99,
          inputMode: 'numeric',
        },
        ...PLAYER_FIELDS.slice(5),
      ]}
    />
  )
}

export function PlayerForm({
  action,
  defaults,
  photo,
}: {
  action: Action
  defaults: PlayerFormValues
  photo: MediaThumbDTO | null
}) {
  return (
    <EntityForm
      schema={playerSchema}
      action={action}
      defaultValues={defaults}
      mediaPreviews={{ photoMediaId: photo }}
      fields={PLAYER_FIELDS}
    />
  )
}

export function RegistrationForm({
  action,
  defaults,
  seasons,
  series,
  isNew = false,
}: {
  action: Action
  defaults: RegistrationFormValues
  seasons: Option[]
  series: Option[]
  isNew?: boolean
}) {
  return (
    <EntityForm
      schema={registrationSchema}
      action={action}
      defaultValues={defaults}
      resetOnSuccess={isNew}
      submitLabel={isNew ? 'Inscribir' : 'Guardar inscripción'}
      successMessage={isNew ? 'Jugador inscrito.' : 'Inscripción guardada.'}
      fields={[
        { name: 'seasonId', label: 'Temporada', type: 'select', options: seasons },
        { name: 'seriesId', label: 'Serie', type: 'select', options: series },
        {
          name: 'shirtNumber',
          label: 'Número de camiseta',
          type: 'number',
          required: false,
          min: 1,
          max: 99,
          inputMode: 'numeric',
        },
        { name: 'isCaptain', label: 'Es capitán', type: 'checkbox' },
        {
          name: 'status',
          label: 'Estado',
          type: 'select',
          options: optionsFromLabels(registrationStatusLabels),
        },
      ]}
    />
  )
}

export function AdjustmentForm({
  action,
  defaults,
  seasons,
  series,
}: {
  action: Action
  defaults: AdjustmentFormValues
  seasons: Option[]
  series: Option[]
}) {
  const stat = (name: string, label: string): FieldDef => ({
    name,
    label,
    type: 'number',
    min: 0,
    max: 999,
    inputMode: 'numeric',
  })
  return (
    <EntityForm
      schema={adjustmentSchema}
      action={action}
      defaultValues={defaults}
      resetOnSuccess
      submitLabel="Agregar"
      successMessage="Estadísticas agregadas."
      fields={[
        { name: 'seasonId', label: 'Temporada', type: 'select', options: seasons },
        { name: 'seriesId', label: 'Serie', type: 'select', options: series },
        stat('appearances', 'Partidos jugados'),
        stat('goals', 'Goles'),
        stat('yellowCards', 'Tarjetas amarillas'),
        stat('redCards', 'Tarjetas rojas'),
        {
          name: 'note',
          label: 'Nota',
          type: 'text',
          required: false,
          help: 'De dónde sale el dato: «Planilla de la asociación, 2019».',
        },
      ]}
    />
  )
}
