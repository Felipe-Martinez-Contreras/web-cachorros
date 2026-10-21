'use client' // Cliente: formularios de la directiva y de los documentos de transparencia (react-hook-form + Zod).

import { EntityForm } from '@/components/admin/entity-form'
import type { MediaThumbDTO } from '@/features/media/dto'
import type { ActionResult } from '@/lib/action-result'
import { optionsFromLabels } from '@/lib/form-schemas'
import { documentCategoryLabels } from '@/lib/labels'
import {
  type BoardMemberFormValues,
  boardMemberSchema,
  type DocumentFormValues,
  documentSchema,
} from '../schemas'

type Action = (input: unknown) => Promise<ActionResult<unknown>>

export function BoardMemberForm({
  action,
  defaults,
  photo,
}: {
  action: Action
  defaults: BoardMemberFormValues
  photo: MediaThumbDTO | null
}) {
  return (
    <EntityForm
      schema={boardMemberSchema}
      action={action}
      defaultValues={defaults}
      mediaPreviews={{ photoMediaId: photo }}
      redirectTo="/admin/club"
      cancelHref="/admin/club"
      fields={[
        { name: 'roleTitle', label: 'Cargo', type: 'text', placeholder: 'Presidenta' },
        { name: 'fullName', label: 'Nombre completo', type: 'text', autoComplete: 'off' },
        { name: 'photoMediaId', label: 'Foto', type: 'media', kind: 'photo', required: false },
        {
          name: 'publicEmail',
          label: 'Correo público',
          type: 'email',
          required: false,
          help: 'Se muestra en el sitio. Usa un correo del club, no uno personal.',
        },
        { name: 'termStart', label: 'Inicio del período', type: 'date', required: false },
        { name: 'termEnd', label: 'Término del período', type: 'date', required: false },
        {
          name: 'isCurrent',
          label: 'Integra la directiva vigente',
          type: 'checkbox',
          help: 'Desmárcalo al terminar su período: deja de mostrarse en el sitio.',
        },
        { name: 'sortOrder', label: 'Orden', type: 'number', min: 0, step: 1, help: 'Menor primero.' },
      ]}
    />
  )
}

export function DocumentForm({
  action,
  defaults,
  file,
}: {
  action: Action
  defaults: DocumentFormValues
  file: MediaThumbDTO | null
}) {
  return (
    <EntityForm
      schema={documentSchema}
      action={action}
      defaultValues={defaults}
      mediaPreviews={{ fileMediaId: file }}
      redirectTo="/admin/club/documentos"
      cancelHref="/admin/club/documentos"
      fields={[
        { name: 'title', label: 'Título', type: 'text', placeholder: 'Balance anual 2025' },
        {
          name: 'category',
          label: 'Categoría',
          type: 'select',
          options: optionsFromLabels(documentCategoryLabels),
        },
        {
          name: 'fileMediaId',
          label: 'Archivo PDF',
          type: 'document',
          help: 'Solo PDF, hasta 12 MB. Se revisa que de verdad sea un PDF.',
        },
        {
          name: 'documentDate',
          label: 'Fecha del documento',
          type: 'date',
          required: false,
          help: 'Sirve para el filtro por año. Sin fecha, cuenta la de publicación.',
        },
        {
          name: 'periodLabel',
          label: 'Período',
          type: 'text',
          required: false,
          placeholder: '2025 o «Primer semestre 2026»',
        },
        { name: 'description', label: 'Descripción', type: 'textarea', required: false, maxLength: 500 },
        { name: 'isPublished', label: 'Publicado en Transparencia', type: 'checkbox' },
      ]}
    />
  )
}
