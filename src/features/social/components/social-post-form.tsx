'use client' // Cliente: formulario de una publicación del feed (react-hook-form + Zod).

import { EntityForm } from '@/components/admin/entity-form'
import type { MediaThumbDTO } from '@/features/media/dto'
import type { ActionResult } from '@/lib/action-result'
import { optionsFromLabels } from '@/lib/form-schemas'
import { FEED_PLATFORM_LABELS } from '../lib/feed'
import { type SocialPostFormValues, socialPostSchema } from '../schemas'

type Action = (input: unknown) => Promise<ActionResult<unknown>>

export function SocialPostForm({
  action,
  defaults,
  image,
}: {
  action: Action
  defaults: SocialPostFormValues
  image: MediaThumbDTO | null
}) {
  return (
    <EntityForm
      schema={socialPostSchema}
      action={action}
      defaultValues={defaults}
      mediaPreviews={{ imageMediaId: image }}
      redirectTo="/admin/redes"
      cancelHref="/admin/redes"
      fields={[
        {
          name: 'permalink',
          label: 'Enlace de la publicación',
          type: 'url',
          placeholder: 'https://www.instagram.com/p/…',
          help: 'Cópialo desde «Compartir → Copiar enlace» en Instagram, Facebook o TikTok. La red se reconoce sola.',
        },
        {
          name: 'platform',
          label: 'Red',
          type: 'select',
          options: optionsFromLabels(FEED_PLATFORM_LABELS),
          help: 'Con un enlace real se reconoce sola; esta opción solo cuenta mientras el enlace esté pendiente.',
        },
        {
          name: 'imageMediaId',
          label: 'Imagen',
          type: 'media',
          required: false,
          help: 'Sube la misma foto de la publicación. El sitio muestra esta imagen (liviana) y enlaza a la red.',
        },
        {
          name: 'excerpt',
          label: 'Texto breve',
          type: 'textarea',
          required: false,
          maxLength: 200,
          help: 'Opcional: se lee sobre la imagen. Sin texto, dice «Publicación en Instagram».',
        },
        { name: 'postedOn', label: 'Fecha de la publicación', type: 'date', required: false },
        {
          name: 'sortOrder',
          label: 'Orden',
          type: 'number',
          help: 'Las de número menor van primero (después de las fijadas).',
        },
        { name: 'isPinned', label: 'Fijar al comienzo', type: 'checkbox' },
        {
          name: 'embedEnabled',
          label: 'Permitir verla dentro del sitio',
          type: 'checkbox',
          help: 'Agrega «Ver aquí»: el contenido de Instagram o Facebook se carga solo cuando la persona lo toca.',
        },
        {
          name: 'isPublished',
          label: 'Publicada en el sitio',
          type: 'checkbox',
          help: 'La portada muestra las 6 primeras publicadas.',
        },
      ]}
    />
  )
}
