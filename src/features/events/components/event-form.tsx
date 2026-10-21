'use client' // Cliente: formulario de eventos (react-hook-form + Zod).

import { EntityForm } from '@/components/admin/entity-form'
import type { MediaThumbDTO } from '@/features/media/dto'
import type { ActionResult } from '@/lib/action-result'
import { optionsFromLabels } from '@/lib/form-schemas'
import { eventStatusLabels, eventTypeLabels } from '@/lib/labels'
import { type EventFormValues, eventSchema } from '../schemas'

export function EventForm({
  action,
  defaults,
  poster,
  venues,
}: {
  action: (input: unknown) => Promise<ActionResult<unknown>>
  defaults: EventFormValues
  poster: MediaThumbDTO | null
  venues: { value: string; label: string }[]
}) {
  return (
    <EntityForm
      schema={eventSchema}
      action={action}
      defaultValues={defaults}
      mediaPreviews={{ posterMediaId: poster }}
      redirectTo="/admin/eventos"
      cancelHref="/admin/eventos"
      fields={[
        { name: 'title', label: 'Nombre', type: 'text', placeholder: 'Gran completada a beneficio' },
        { name: 'type', label: 'Tipo', type: 'select', options: optionsFromLabels(eventTypeLabels) },
        { name: 'startDate', label: 'Día', type: 'date' },
        { name: 'startTime', label: 'Hora de inicio', type: 'time' },
        {
          name: 'endDate',
          label: 'Día de término',
          type: 'date',
          required: false,
          help: 'Solo si termina otro día (por ejemplo, un campeonato de verano).',
        },
        { name: 'endTime', label: 'Hora de término', type: 'time', required: false },
        {
          name: 'venueId',
          label: 'Cancha',
          type: 'select',
          options: venues,
          emptyLabel: 'En otro lugar',
          required: false,
          help: 'Si es en una cancha cargada, el sitio muestra su dirección y el mapa.',
        },
        {
          name: 'locationText',
          label: 'Lugar',
          type: 'text',
          required: false,
          placeholder: 'Sede social, calle…',
        },
        { name: 'posterMediaId', label: 'Afiche', type: 'media', kind: 'photo', required: false },
        { name: 'description', label: 'Descripción', type: 'richtext', required: false },
        {
          name: 'priceText',
          label: 'Valor',
          type: 'text',
          required: false,
          placeholder: 'Completo $2.000 · Promoción 3 x $5.000',
        },
        {
          name: 'ctaUrl',
          label: 'Enlace de inscripción o venta',
          type: 'url',
          required: false,
          placeholder: 'https://',
          help: 'Sin enlace, el botón abre WhatsApp del club con un mensaje sobre el evento.',
        },
        { name: 'status', label: 'Estado', type: 'select', options: optionsFromLabels(eventStatusLabels) },
        { name: 'isPublished', label: 'Publicado en el sitio', type: 'checkbox' },
      ]}
    />
  )
}
