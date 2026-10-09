'use client' // Cliente: formularios de noticias y categorías (react-hook-form + Zod).

import { EntityForm } from '@/components/admin/entity-form'
import type { MediaThumbDTO } from '@/features/media/dto'
import type { ActionResult } from '@/lib/action-result'
import { optionsFromLabels } from '@/lib/form-schemas'
import { newsTypeLabels } from '@/lib/labels'
import {
  type NewsCategoryFormValues,
  type NewsFormValues,
  newsCategorySchema,
  newsSchema,
  type ScheduleNewsValues,
  scheduleNewsSchema,
} from '../schemas'

type Action = (input: unknown) => Promise<ActionResult<unknown>>
type Option = { value: string; label: string }

export function NewsForm({
  action,
  defaults,
  options,
  cover,
  og,
  mode,
  autosave = false,
}: {
  action: Action
  defaults: NewsFormValues
  options: { categories: Option[]; series: Option[]; matches: Option[]; albums: Option[] }
  cover: MediaThumbDTO | null
  og: MediaThumbDTO | null
  mode: 'create' | 'edit'
  /** Solo los borradores se guardan solos: lo publicado cambia cuando se toca «Guardar». */
  autosave?: boolean
}) {
  const hasAlbums = options.albums.length > 0
  const types = optionsFromLabels(newsTypeLabels).filter((type) => hasAlbums || type.value !== 'galeria')
  return (
    <EntityForm
      schema={newsSchema}
      action={action}
      defaultValues={defaults}
      mediaPreviews={{ coverMediaId: cover, ogMediaId: og }}
      autosave={autosave}
      submitLabel={mode === 'create' ? 'Guardar borrador' : 'Guardar'}
      successMessage={mode === 'create' ? 'Borrador guardado.' : 'Noticia guardada.'}
      redirectTo={mode === 'create' ? (id) => `/admin/noticias/${id}` : undefined}
      cancelHref="/admin/noticias"
      fields={[
        { name: 'title', label: 'Título', type: 'text' },
        {
          name: 'coverMediaId',
          label: 'Foto principal',
          type: 'media',
          required: false,
          help: 'Puedes tomarla o subirla desde el celular. Se ve en la portada y al compartir.',
        },
        { name: 'body', label: 'Texto de la noticia', type: 'richtext' },
        {
          name: 'excerpt',
          label: 'Resumen',
          type: 'textarea',
          rows: 3,
          maxLength: 300,
          required: false,
          help: 'Una o dos frases para las tarjetas. Si lo dejas vacío se usa el comienzo del texto.',
        },
        {
          name: 'type',
          label: 'Tipo',
          type: 'select',
          options: types,
          help: 'La crónica abre con el marcador de su partido; el comunicado lleva el sello «Comunicado oficial».',
        },
        {
          name: 'categoryId',
          label: 'Categoría',
          type: 'select',
          options: options.categories,
          emptyLabel: 'Sin categoría',
          required: false,
        },
        {
          name: 'seriesIds',
          label: 'Series de las que habla',
          type: 'checkboxes',
          options: options.series,
          required: false,
        },
        {
          name: 'matchId',
          label: 'Partido relacionado',
          type: 'select',
          options: options.matches,
          emptyLabel: 'Ninguno',
          required: false,
          help: 'Obligatorio en una crónica.',
        },
        ...(hasAlbums
          ? [
              {
                name: 'albumId',
                label: 'Álbum de fotos',
                type: 'select' as const,
                options: options.albums,
                emptyLabel: 'Ninguno',
                required: false,
                help: 'Obligatorio en una galería.',
              },
            ]
          : []),
        {
          name: 'isFeatured',
          label: 'Destacada',
          type: 'checkbox',
          help: 'Aparece en grande en la portada.',
        },
        {
          name: 'isPinned',
          label: 'Fijar en la portada',
          type: 'checkbox',
          help: 'Queda primera aunque se publiquen otras después. Úsalo para comunicados importantes.',
        },
        {
          name: 'slug',
          label: 'Dirección en el sitio',
          type: 'text',
          required: false,
          help: 'La última parte del enlace (…/noticias/esta-parte). Si la dejas vacía sale del título. Si la cambias, el enlace antiguo sigue funcionando.',
        },
        {
          name: 'seoTitle',
          label: 'Título para buscadores',
          type: 'text',
          required: false,
          help: 'Si lo dejas vacío se usa el título.',
        },
        {
          name: 'seoDescription',
          label: 'Descripción para buscadores',
          type: 'textarea',
          rows: 2,
          maxLength: 160,
          required: false,
          help: 'Si la dejas vacía se usa el resumen.',
        },
        {
          name: 'ogMediaId',
          label: 'Imagen al compartir',
          type: 'media',
          required: false,
          help: 'Si no eliges una, se usa la foto principal.',
        },
      ]}
    />
  )
}

export function ScheduleNewsForm({ action, defaults }: { action: Action; defaults: ScheduleNewsValues }) {
  return (
    <EntityForm
      schema={scheduleNewsSchema}
      action={action}
      defaultValues={defaults}
      submitLabel="Programar"
      successMessage="Noticia programada."
      fields={[
        { name: 'date', label: 'Día de publicación', type: 'date' },
        { name: 'time', label: 'Hora', type: 'time', help: 'Hora de Chile.' },
      ]}
    />
  )
}

export function NewsCategoryForm({
  action,
  defaults,
  resetOnSuccess = false,
  redirectTo,
}: {
  action: Action
  defaults: NewsCategoryFormValues
  resetOnSuccess?: boolean
  redirectTo?: string
}) {
  return (
    <EntityForm
      schema={newsCategorySchema}
      action={action}
      defaultValues={defaults}
      resetOnSuccess={resetOnSuccess}
      redirectTo={redirectTo}
      cancelHref={redirectTo}
      successMessage="Categoría guardada."
      fields={[
        { name: 'name', label: 'Nombre', type: 'text', placeholder: 'Primer equipo' },
        {
          name: 'sortOrder',
          label: 'Orden',
          type: 'number',
          min: 0,
          max: 999,
          inputMode: 'numeric',
          required: false,
          help: 'Las de número menor aparecen primero en el filtro.',
        },
      ]}
    />
  )
}
