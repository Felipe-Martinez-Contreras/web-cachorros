'use client' // Cliente: formularios de Facebook (react-hook-form + Zod).

import { EntityForm, type FieldDef } from '@/components/admin/entity-form'
import type { MediaThumbDTO } from '@/features/media/dto'
import { jornadaOptionsSchema } from '@/features/share/schemas'
import type { ActionResult } from '@/lib/action-result'
import { topLineModeLabels, weekdayLabels } from '@/lib/labels'
import { MAX_CAPTION } from '../lib/caption'
import { manualPhotosSchema } from '../lib/photos'
import {
  facebookSettingsSchema,
  MATCHDAY_PHOTO_LABELS,
  PUBLISH_WEEKDAYS,
  TOP_LINE_MAX,
  TOP_LINE_MODES,
  type TopLineMode,
} from '../lib/settings'
import { manualPublishSchema, publishOrScheduleSchema, scheduleTimeSchema } from '../schemas'

type Action = (input: unknown) => Promise<ActionResult<unknown>>

/** El encuadre que mejor funciona en cada barra (las tres van en blanco y negro). */
const PHOTO_HELP = [
  'Un primer plano o un rostro. Se respetan el punto focal y el acercamiento de la foto. Las fotos con menores no se pueden usar.',
  'Un jugador en acción. Se respetan el punto focal y el acercamiento de la foto.',
  'Un detalle de la camiseta o una espalda con su número. Se respetan el punto focal y el acercamiento de la foto.',
] as const

/** Las 3 fotos del matchday. Sin foto, la barra usa un fondo gris. */
const MATCHDAY_PHOTO_FIELDS: FieldDef[] = MATCHDAY_PHOTO_LABELS.map((label, index) => ({
  name: `photo${index + 1}`,
  label,
  type: 'media',
  kind: 'photo',
  required: false,
  help: PHOTO_HELP[index],
  adjustLink: true,
}))

export function FacebookSettingsForm({
  action,
  defaults,
  previews,
}: {
  previews: Record<string, MediaThumbDTO | null>
  action: Action
  defaults: {
    enabled: boolean
    weekly: boolean
    weekday: string
    time: string
    publishResults: boolean
    photo1: string
    photo2: string
    photo3: string
    topLineMode: TopLineMode
    topLineText: string
    topLineLogo: string
  }
}) {
  return (
    <EntityForm
      schema={facebookSettingsSchema}
      action={action}
      defaultValues={defaults}
      mediaPreviews={previews}
      successMessage="Ajustes de Facebook guardados."
      fields={[
        {
          name: 'enabled',
          label: 'Publicar en Facebook',
          type: 'checkbox',
          help: 'Interruptor general: sin él no sale nada, ni lo que se publica a mano ni lo programado.',
        },
        {
          name: 'topLineMode',
          label: 'Línea sobre «MATCHDAY»',
          type: 'select',
          options: TOP_LINE_MODES.map((mode) => ({ value: mode, label: topLineModeLabels[mode] })),
          help: 'La línea pequeña, en blanco, sobre el título de las tarjetas matchday y la programación. El auspiciador es el de Configuración → Destacados.',
        },
        {
          name: 'topLineText',
          label: 'Texto de la línea',
          type: 'text',
          required: false,
          placeholder: 'ANFA · Asociación de fútbol',
          help: `Solo si elegiste «Un texto». Hasta ${TOP_LINE_MAX} caracteres; se escribe en mayúsculas.`,
        },
        {
          name: 'topLineLogo',
          label: 'Logo de la línea',
          type: 'media',
          kind: 'logo',
          required: false,
          help: 'Solo si elegiste «Un logo». Mejor con fondo transparente: se dibuja todo en blanco.',
        },
        ...MATCHDAY_PHOTO_FIELDS,
        {
          name: 'publishResults',
          label: 'Publicar el resultado al finalizar cada partido',
          type: 'checkbox',
          help: 'Sale unos 10 minutos después de finalizarlo, por si hay que corregir el marcador.',
        },
        {
          name: 'weekly',
          label: 'Publicación automática semanal (opción secundaria)',
          type: 'checkbox',
          help: 'Solo cubre sábado y domingo: un post con la programación del fin de semana. Lo recomendado es programar cada jornada o partido desde su página.',
        },
        {
          name: 'weekday',
          label: 'Día de la publicación semanal',
          type: 'select',
          options: PUBLISH_WEEKDAYS.map((day) => ({ value: String(day), label: weekdayLabels[day] ?? '' })),
          help: 'Solo si activaste la publicación semanal. Si ese fin de semana no hay partidos, no se publica nada.',
        },
        {
          name: 'time',
          label: 'Hora de la publicación semanal (de Chile)',
          type: 'time',
          help: 'Si a esa hora ya empezó el primer partido del fin de semana, ya no se publica.',
        },
      ]}
    />
  )
}

/** Texto revisado y «Publicar en Facebook». `backHref`: adónde vuelve (la ficha del partido o la jornada). */
export function ManualPublishForm({
  action,
  caption,
  backHref,
  help = 'Se armó con los datos del partido. Puedes cambiarlo antes de publicar.',
}: {
  action: Action
  caption: string
  backHref: string
  help?: string
}) {
  return (
    <EntityForm
      schema={manualPublishSchema}
      action={action}
      defaultValues={{ message: caption }}
      submitLabel="Publicar en Facebook"
      successMessage="Publicado en Facebook."
      redirectTo={backHref}
      cancelHref={backHref}
      fields={[
        {
          name: 'message',
          label: 'Texto de la publicación',
          type: 'textarea',
          rows: 12,
          maxLength: MAX_CAPTION,
          help,
        },
      ]}
    />
  )
}

/**
 * «Series y fotos» de la tarjeta de una jornada: las series que van (todas marcadas por defecto) y las 3
 * fotos del matchday. Al guardar, la página se recarga con lo elegido en la dirección.
 */
export function JornadaOptionsForm({
  action,
  jornadaKey,
  series,
  defaults,
  previews,
}: {
  action: (input: unknown) => Promise<ActionResult<{ id: string }>>
  jornadaKey: string
  series: { value: string; label: string }[]
  defaults: { series: string[]; photo1: string; photo2: string; photo3: string }
  previews: Record<string, MediaThumbDTO | null>
}) {
  return (
    <EntityForm
      schema={jornadaOptionsSchema}
      action={action}
      defaultValues={defaults}
      mediaPreviews={previews}
      submitLabel="Ver la tarjeta así"
      successMessage="Tarjeta actualizada."
      redirectTo={(search) => `/admin/partidos/jornadas/${jornadaKey}?${search}`}
      fields={[
        {
          name: 'series',
          label: 'Series que van en la tarjeta',
          type: 'checkboxes',
          options: series,
          help: 'En orden de juego. La hora de inicio es la de la primera serie marcada.',
        },
        ...MATCHDAY_PHOTO_FIELDS,
      ]}
    />
  )
}

/** «Fotos de esta publicación»: cambia las del matchday solo para el post que se está preparando. */
export function ManualPhotosForm({
  action,
  defaults,
  previews,
  matchId,
}: {
  action: (input: unknown) => Promise<ActionResult<{ id: string }>>
  defaults: { photo1: string; photo2: string; photo3: string }
  previews: Record<string, MediaThumbDTO | null>
  matchId: string
}) {
  return (
    <EntityForm
      schema={manualPhotosSchema}
      action={action}
      defaultValues={defaults}
      mediaPreviews={previews}
      submitLabel="Ver con estas fotos"
      successMessage="Vista previa actualizada."
      redirectTo={(photos) => `/admin/partidos/${matchId}/facebook?fotos=${encodeURIComponent(photos)}`}
      fields={MATCHDAY_PHOTO_FIELDS}
    />
  )
}

/** Fecha y hora de una programada: «Hora de Chile» junto al campo y el margen del tick debajo. */
const SCHEDULE_FIELDS: FieldDef[] = [
  { name: 'date', label: 'Día', type: 'date', showIf: 'programar' },
  {
    name: 'time',
    label: 'Hora de Chile',
    type: 'time',
    showIf: 'programar',
    help: 'Puede publicarse hasta 5 minutos después de la hora elegida.',
  },
]

/**
 * Texto revisado y «Publicar ahora» o «Programar» (con día y hora de Chile). `schedule`: la hora sugerida, o
 * `null` si ya no queda tiempo para programar antes del partido.
 */
export function PublishOrScheduleForm({
  action,
  caption,
  backHref,
  schedule,
  allowNow,
  help,
}: {
  action: Action
  caption: string
  backHref: string
  schedule: { date: string; time: string } | null
  /** `false` si ahora no se puede publicar (Facebook apagado): solo se ofrece programar. */
  allowNow: boolean
  help: string
}) {
  return (
    <EntityForm
      schema={publishOrScheduleSchema}
      action={action}
      switchField="when"
      defaultValues={{
        message: caption,
        when: schedule ? 'programar' : 'ahora',
        date: schedule?.date ?? '',
        time: schedule?.time ?? '',
      }}
      submitLabel={(when) => (when === 'programar' ? 'Programar' : 'Publicar ahora')}
      successMessage={(when) => (when === 'programar' ? 'Publicación programada.' : 'Publicado en Facebook.')}
      redirectTo={backHref}
      fields={[
        {
          name: 'message',
          label: 'Texto de la publicación',
          type: 'textarea',
          rows: 12,
          maxLength: MAX_CAPTION,
          help: `${help} Si no lo cambias, se vuelve a armar al publicar con los datos de ese momento.`,
        },
        {
          name: 'when',
          label: 'Cuándo',
          type: 'select',
          options: [
            ...(schedule ? [{ value: 'programar', label: 'Programar' }] : []),
            ...(allowNow ? [{ value: 'ahora', label: 'Publicar ahora' }] : []),
          ],
          help: schedule
            ? 'Programada, sale sola a la hora elegida. Si el partido cambia antes, no sale y te avisamos.'
            : 'Ya no queda tiempo para programarla antes del partido.',
        },
        ...SCHEDULE_FIELDS,
      ]}
    />
  )
}

/** «Cambiar fecha» de una programada: precarga la fecha y hora programadas. */
export function RescheduleForm({
  action,
  current,
}: {
  action: Action
  current: { date: string; time: string }
}) {
  return (
    <EntityForm
      schema={scheduleTimeSchema}
      action={action}
      defaultValues={current}
      submitLabel="Guardar la nueva hora"
      successMessage="Hora cambiada."
      fields={SCHEDULE_FIELDS.map(({ showIf: _, ...field }) => field as FieldDef)}
    />
  )
}
