'use client' // Cliente: formularios de Facebook (react-hook-form + Zod).

import { EntityForm } from '@/components/admin/entity-form'
import type { ActionResult } from '@/lib/action-result'
import { weekdayLabels } from '@/lib/labels'
import { MAX_CAPTION } from '../lib/caption'
import { facebookSettingsSchema, PUBLISH_WEEKDAYS } from '../lib/settings'
import { manualPublishSchema } from '../schemas'

type Action = (input: unknown) => Promise<ActionResult<unknown>>

export function FacebookSettingsForm({
  action,
  defaults,
}: {
  action: Action
  defaults: {
    enabled: boolean
    weekday: string
    time: string
    publishResults: boolean
    photo1: string
    photo2: string
    photo3: string
  }
}) {
  return (
    <EntityForm
      schema={facebookSettingsSchema}
      action={action}
      defaultValues={defaults}
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
      ]}
    />
  )
}

export function ManualPublishForm({
  action,
  caption,
  matchId,
}: {
  action: Action
  caption: string
  matchId: string
}) {
  return (
    <EntityForm
      schema={manualPublishSchema}
      action={action}
      defaultValues={{ message: caption }}
      submitLabel="Publicar en Facebook"
      successMessage="Publicado en Facebook."
      redirectTo={`/admin/partidos/${matchId}`}
      cancelHref={`/admin/partidos/${matchId}`}
      fields={[
        {
          name: 'message',
          label: 'Texto de la publicación',
          type: 'textarea',
          rows: 12,
          maxLength: MAX_CAPTION,
          help: 'Se armó con los datos del partido. Puedes cambiarlo antes de publicar.',
        },
      ]}
    />
  )
}
