'use client' // Cliente: formularios de series, temporadas y competencias (react-hook-form + Zod).

import { EntityForm } from '@/components/admin/entity-form'
import type { ActionResult } from '@/lib/action-result'
import { optionsFromLabels } from '@/lib/form-schemas'
import { competitionKindLabels, seriesKindLabels } from '@/lib/labels'
import {
  type CompetitionFormValues,
  competitionSchema,
  copySquadSchema,
  type SeasonFormValues,
  type SeriesFormValues,
  seasonSchema,
  seriesSchema,
} from '../schemas'

type Action = (input: unknown) => Promise<ActionResult<unknown>>
type Option = { value: string; label: string }

export function SeriesForm({ action, defaults }: { action: Action; defaults: SeriesFormValues }) {
  return (
    <EntityForm
      schema={seriesSchema}
      action={action}
      defaultValues={defaults}
      redirectTo="/admin/series"
      cancelHref="/admin/series"
      fields={[
        {
          name: 'name',
          label: 'Nombre',
          type: 'text',
          help: 'Como se muestra en el sitio: «Honor», «Senior 35».',
        },
        {
          name: 'shortName',
          label: 'Nombre corto',
          type: 'text',
          help: 'Para pestañas y tarjetas con poco espacio.',
        },
        { name: 'kind', label: 'Tipo', type: 'select', options: optionsFromLabels(seriesKindLabels) },
        {
          name: 'halfLengthMinutes',
          label: 'Minutos por tiempo',
          type: 'number',
          min: 5,
          max: 60,
          inputMode: 'numeric',
          help: 'Sirve para sugerir el minuto al cargar goles y tarjetas.',
        },
        {
          name: 'containsMinors',
          label: 'En esta serie juegan menores de edad',
          type: 'checkbox',
          help: 'Sus jugadores se muestran solo con nombre e inicial, sin ficha ni fecha de nacimiento.',
        },
        {
          name: 'isActive',
          label: 'Serie activa',
          type: 'checkbox',
          help: 'Una serie inactiva deja de aparecer en el sitio, pero conserva su historial.',
        },
        { name: 'description', label: 'Descripción', type: 'textarea', required: false, maxLength: 500 },
      ]}
    />
  )
}

export function SeasonForm({ action, defaults }: { action: Action; defaults: SeasonFormValues }) {
  return (
    <EntityForm
      schema={seasonSchema}
      action={action}
      defaultValues={defaults}
      redirectTo="/admin/temporadas"
      cancelHref="/admin/temporadas"
      fields={[
        { name: 'name', label: 'Nombre', type: 'text', placeholder: 'Temporada 2027' },
        { name: 'year', label: 'Año', type: 'number', min: 1934, max: 2100, inputMode: 'numeric' },
        { name: 'startsOn', label: 'Inicio', type: 'date', required: false },
        { name: 'endsOn', label: 'Término', type: 'date', required: false },
        {
          name: 'isCurrent',
          label: 'Es la temporada actual',
          type: 'checkbox',
          help: 'El sitio muestra esta temporada por defecto. Al marcarla, la anterior deja de ser la actual.',
        },
      ]}
    />
  )
}

export function CopySquadForm({ action, seasons }: { action: Action; seasons: Option[] }) {
  return (
    <EntityForm
      schema={copySquadSchema}
      action={action}
      defaultValues={{ fromSeasonId: seasons[0]?.value ?? '' }}
      submitLabel="Copiar plantel y cuerpo técnico"
      successMessage="Plantel copiado. Revisa las inscripciones en Jugadores."
      fields={[{ name: 'fromSeasonId', label: 'Copiar desde', type: 'select', options: seasons }]}
    />
  )
}

export function CompetitionForm({
  action,
  defaults,
  seasons,
}: {
  action: Action
  defaults: CompetitionFormValues
  seasons: Option[]
}) {
  return (
    <EntityForm
      schema={competitionSchema}
      action={action}
      defaultValues={defaults}
      redirectTo="/admin/competencias"
      cancelHref="/admin/competencias"
      fields={[
        { name: 'seasonId', label: 'Temporada', type: 'select', options: seasons },
        { name: 'name', label: 'Nombre', type: 'text', placeholder: 'Campeonato Oficial' },
        { name: 'kind', label: 'Tipo', type: 'select', options: optionsFromLabels(competitionKindLabels) },
        {
          name: 'organizer',
          label: 'Organizador',
          type: 'text',
          required: false,
          help: 'La asociación o liga que la organiza.',
        },
        {
          name: 'pointsWin',
          label: 'Puntos por triunfo',
          type: 'number',
          min: 0,
          max: 10,
          inputMode: 'numeric',
        },
        {
          name: 'pointsDraw',
          label: 'Puntos por empate',
          type: 'number',
          min: 0,
          max: 10,
          inputMode: 'numeric',
        },
      ]}
    />
  )
}
