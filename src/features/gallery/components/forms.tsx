'use client' // Cliente: formularios de álbumes, sus fotos y videos (react-hook-form + Zod).

import { EntityForm } from '@/components/admin/entity-form'
import type { MediaThumbDTO } from '@/features/media/dto'
import type { ActionResult } from '@/lib/action-result'
import {
  type AlbumFormValues,
  type AlbumItemFormValues,
  type AlbumItemUpdateFormValues,
  albumItemSchema,
  albumItemUpdateSchema,
  albumSchema,
  type VideoFormValues,
  videoSchema,
} from '../schemas'

type Action = (input: unknown) => Promise<ActionResult<unknown>>
type Options = { value: string; label: string }[]

export function AlbumForm({
  action,
  defaults,
  cover,
  matches,
  events,
  isNew = false,
}: {
  action: Action
  defaults: AlbumFormValues
  cover: MediaThumbDTO | null
  matches: Options
  events: Options
  isNew?: boolean
}) {
  return (
    <EntityForm
      schema={albumSchema}
      action={action}
      defaultValues={defaults}
      mediaPreviews={{ coverMediaId: cover }}
      // Al crear se sigue al álbum, para subirle las fotos.
      successMessage={isNew ? 'Álbum creado. Ahora sube las fotos.' : 'Guardado.'}
      redirectTo={isNew ? (id) => `/admin/galeria/${id}` : '/admin/galeria'}
      cancelHref="/admin/galeria"
      submitLabel={isNew ? 'Crear y subir las fotos' : 'Guardar'}
      fields={[
        { name: 'title', label: 'Nombre', type: 'text', placeholder: 'Honor vs Unión Sagrada' },
        { name: 'takenOn', label: 'Fecha de las fotos', type: 'date', required: false },
        {
          name: 'coverMediaId',
          label: 'Portada',
          type: 'media',
          kind: 'photo',
          required: false,
          help: 'Sin portada, se usa la primera foto del álbum.',
        },
        {
          name: 'matchId',
          label: 'Partido',
          type: 'select',
          options: matches,
          emptyLabel: 'Ninguno',
          required: false,
        },
        {
          name: 'eventId',
          label: 'Evento',
          type: 'select',
          options: events,
          emptyLabel: 'Ninguno',
          required: false,
        },
        { name: 'isPublished', label: 'Publicado en la galería', type: 'checkbox' },
        {
          name: 'containsMinors',
          label: 'El álbum tiene fotos de menores de edad',
          type: 'checkbox',
          help: 'Por defecto la galería no publica fotos de menores. Las fotos marcadas «contiene menores» en la biblioteca no se muestran.',
        },
        {
          name: 'minorsConsent',
          label: 'Confirmo que el club tiene la autorización escrita de los apoderados',
          type: 'checkbox',
          help: 'Necesario para publicar un álbum con menores. Queda registrado quién lo confirmó y cuándo.',
        },
      ]}
    />
  )
}

export function AlbumItemForm({ action, defaults }: { action: Action; defaults: AlbumItemFormValues }) {
  return (
    <EntityForm
      schema={albumItemSchema}
      action={action}
      defaultValues={defaults}
      resetOnSuccess
      submitLabel="Agregar foto"
      successMessage="Foto agregada."
      fields={[
        { name: 'mediaId', label: 'Foto', type: 'media', kind: 'photo' },
        { name: 'caption', label: 'Pie de foto', type: 'text', required: false },
        { name: 'sortOrder', label: 'Orden', type: 'number', min: 0, step: 1, help: 'Menor primero.' },
      ]}
    />
  )
}

export function AlbumItemUpdateForm({
  action,
  defaults,
}: {
  action: Action
  defaults: AlbumItemUpdateFormValues
}) {
  return (
    <EntityForm
      schema={albumItemUpdateSchema}
      action={action}
      defaultValues={defaults}
      submitLabel="Guardar foto"
      successMessage="Foto guardada."
      fields={[
        { name: 'caption', label: 'Pie de foto', type: 'text', required: false },
        { name: 'sortOrder', label: 'Orden', type: 'number', min: 0, step: 1, help: 'Menor primero.' },
      ]}
    />
  )
}

export function VideoForm({
  action,
  defaults,
  thumbnail,
  matches,
}: {
  action: Action
  defaults: VideoFormValues
  thumbnail: MediaThumbDTO | null
  matches: Options
}) {
  return (
    <EntityForm
      schema={videoSchema}
      action={action}
      defaultValues={defaults}
      mediaPreviews={{ thumbnailMediaId: thumbnail }}
      redirectTo="/admin/galeria/videos"
      cancelHref="/admin/galeria/videos"
      fields={[
        { name: 'title', label: 'Título', type: 'text' },
        {
          name: 'url',
          label: 'Dirección del video',
          type: 'url',
          placeholder: 'https://www.youtube.com/watch?v=…',
          help: 'De YouTube o Facebook. En el sitio no se carga nada de ellos hasta que alguien toca el video.',
        },
        {
          name: 'thumbnailMediaId',
          label: 'Miniatura',
          type: 'media',
          kind: 'photo',
          required: false,
          help: 'Una foto propia: así no se pide la miniatura a YouTube.',
        },
        { name: 'publishedOn', label: 'Fecha', type: 'date', required: false },
        {
          name: 'matchId',
          label: 'Partido',
          type: 'select',
          options: matches,
          emptyLabel: 'Ninguno',
          required: false,
        },
        { name: 'isPublished', label: 'Publicado en Videos', type: 'checkbox' },
      ]}
    />
  )
}
