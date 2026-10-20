'use client' // Cliente: formulario de auspiciadores (react-hook-form + Zod).

import { EntityForm } from '@/components/admin/entity-form'
import type { MediaThumbDTO } from '@/features/media/dto'
import type { ActionResult } from '@/lib/action-result'
import { optionsFromLabels } from '@/lib/form-schemas'
import { sponsorTierLabels } from '@/lib/labels'
import { type SponsorFormValues, sponsorSchema } from '../schemas'

export function SponsorForm({
  action,
  defaults,
  logo,
}: {
  action: (input: unknown) => Promise<ActionResult<unknown>>
  defaults: SponsorFormValues
  logo: MediaThumbDTO | null
}) {
  return (
    <EntityForm
      schema={sponsorSchema}
      action={action}
      defaultValues={defaults}
      mediaPreviews={{ logoMediaId: logo }}
      redirectTo="/admin/auspiciadores"
      cancelHref="/admin/auspiciadores"
      fields={[
        {
          name: 'name',
          label: 'Nombre',
          type: 'text',
          help: 'Su enlace (/r/auspiciador/…) se arma con el nombre al crearlo y no cambia después.',
        },
        {
          name: 'tier',
          label: 'Nivel',
          type: 'select',
          options: optionsFromLabels(sponsorTierLabels),
          help: 'Rubros regulados: por defecto, sin alcohol ni apuestas junto a contenido de formativas (pendiente de verificar la normativa).',
        },
        { name: 'logoMediaId', label: 'Logo', type: 'media', kind: 'logo', required: false },
        {
          name: 'description',
          label: 'Descripción breve',
          type: 'textarea',
          required: false,
          maxLength: 300,
        },
        { name: 'websiteUrl', label: 'Sitio web', type: 'url', required: false, placeholder: 'https://' },
        {
          name: 'instagramUrl',
          label: 'Instagram',
          type: 'url',
          required: false,
          placeholder: 'https://instagram.com/…',
        },
        { name: 'whatsapp', label: 'WhatsApp', type: 'tel', required: false, placeholder: '+56 9 1234 5678' },
        { name: 'startsOn', label: 'Vigente desde', type: 'date', required: false },
        {
          name: 'endsOn',
          label: 'Vigente hasta',
          type: 'date',
          required: false,
          help: 'Al día siguiente deja de mostrarse solo.',
        },
        { name: 'isActive', label: 'Visible en el sitio', type: 'checkbox' },
        { name: 'sortOrder', label: 'Orden dentro del nivel', type: 'number', min: 0, step: 1 },
      ]}
    />
  )
}
