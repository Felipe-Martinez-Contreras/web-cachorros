'use client' // Cliente: formularios de rivales y canchas (react-hook-form + Zod).

import { EntityForm } from '@/components/admin/entity-form'
import type { MediaThumbDTO } from '@/features/media/dto'
import type { ActionResult } from '@/lib/action-result'
import { type TeamFormValues, teamSchema, type VenueFormValues, venueSchema } from '../schemas'

type Action = (input: unknown) => Promise<ActionResult<unknown>>

export function TeamForm({
  action,
  defaults,
  crest,
}: {
  action: Action
  defaults: TeamFormValues
  crest: MediaThumbDTO | null
}) {
  return (
    <EntityForm
      schema={teamSchema}
      action={action}
      defaultValues={defaults}
      mediaPreviews={{ crestMediaId: crest }}
      redirectTo="/admin/rivales"
      cancelHref="/admin/rivales"
      fields={[
        { name: 'name', label: 'Nombre', type: 'text', placeholder: 'Deportivo Los Litres' },
        {
          name: 'shortName',
          label: 'Nombre corto',
          type: 'text',
          help: 'Para marcadores y tablas con poco espacio: «Los Litres».',
        },
        { name: 'commune', label: 'Comuna', type: 'text', required: false },
        {
          name: 'crestMediaId',
          label: 'Escudo',
          type: 'media',
          kind: 'logo',
          required: false,
          help: 'Cuadrado y con fondo transparente si es posible. Sin escudo se muestran las iniciales.',
        },
      ]}
    />
  )
}

export function VenueForm({ action, defaults }: { action: Action; defaults: VenueFormValues }) {
  return (
    <EntityForm
      schema={venueSchema}
      action={action}
      defaultValues={defaults}
      redirectTo="/admin/canchas"
      cancelHref="/admin/canchas"
      fields={[
        { name: 'name', label: 'Nombre', type: 'text', placeholder: 'Estadio Municipal' },
        { name: 'address', label: 'Dirección', type: 'text', required: false },
        { name: 'commune', label: 'Comuna', type: 'text', required: false },
        {
          name: 'location',
          label: 'Ubicación en el mapa',
          type: 'text',
          required: false,
          placeholder: '-35.0123, -71.4567',
          help: 'Pega el enlace de Google Maps (el largo, copiado desde la barra del navegador) o las coordenadas. Con esto el sitio ofrece «Cómo llegar».',
        },
        {
          name: 'isHome',
          label: 'Es una cancha del club',
          type: 'checkbox',
          help: 'Se propone por defecto cuando el club juega de local.',
        },
        {
          name: 'notes',
          label: 'Indicaciones',
          type: 'textarea',
          required: false,
          maxLength: 300,
          help: 'Por ejemplo: «entrada por el portón de calle Los Aromos».',
        },
      ]}
    />
  )
}
