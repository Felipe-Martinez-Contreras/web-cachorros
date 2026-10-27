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
import { manualPublishSchema } from '../schemas'

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
      successMessage="Configuración de Facebook guardada."
      fields={[
        {
          name: 'enabled',
          label: 'Publicar en Facebook',
          type: 'checkbox',
          help: 'Activa la programación automática del fin de semana y el botón «Publicar en Facebook» de cada partido.',
        },
        {
          name: 'weekday',
          label: 'Día de la programación',
          type: 'select',
          options: PUBLISH_WEEKDAYS.map((day) => ({ value: String(day), label: weekdayLabels[day] ?? '' })),
          help: 'Ese día sale la tarjeta «Programación del fin de semana». Si ese fin de semana no hay partidos, no se publica nada.',
        },
        {
          name: 'time',
          label: 'Hora (de Chile)',
          type: 'time',
          help: 'Si a esa hora ya empezó el primer partido del fin de semana, ya no se publica.',
        },
        {
          name: 'publishResults',
          label: 'Publicar el resultado al finalizar cada partido',
          type: 'checkbox',
          help: 'Sale unos 10 minutos después de finalizarlo, por si hay que corregir el marcador.',
        },
        ...MATCHDAY_PHOTO_FIELDS,
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
