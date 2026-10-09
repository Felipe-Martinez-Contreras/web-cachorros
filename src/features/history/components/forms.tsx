'use client' // Cliente: formularios de Historia (react-hook-form + Zod).

import { EntityForm } from '@/components/admin/entity-form'
import type { MediaThumbDTO } from '@/features/media/dto'
import type { ActionResult } from '@/lib/action-result'
import type { HistoryFormDefaults } from '../form-defaults'
import { honourSchema, idolSchema, kitSchema, milestoneSchema } from '../schemas'

type Action = (input: unknown) => Promise<ActionResult<unknown>>
type Option = { value: string; label: string }

const MONTHS: Option[] = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
].map((label, index) => ({ value: String(index + 1), label }))

const YEAR = { type: 'number', min: 1900, max: 2100, inputMode: 'numeric' } as const

/** Formulario de un registro de Historia: cada sección tiene sus campos. */
export function HistoryForm({
  action,
  form,
  image,
  seriesOptions,
}: {
  action: Action
  form: HistoryFormDefaults
  image: MediaThumbDTO | null
  seriesOptions: Option[]
}) {
  const list = `/admin/historia/${form.section}`
  const shared = { action, redirectTo: list, cancelHref: list } as const

  switch (form.section) {
    case 'hitos':
      return (
        <EntityForm
          {...shared}
          schema={milestoneSchema}
          defaultValues={form.defaults}
          mediaPreviews={{ imageMediaId: image }}
          fields={[
            { name: 'title', label: 'Título', type: 'text', placeholder: 'Fundación del club' },
            { name: 'year', label: 'Año', ...YEAR },
            {
              name: 'month',
              label: 'Mes',
              type: 'select',
              options: MONTHS,
              emptyLabel: 'No se sabe',
              required: false,
            },
            {
              name: 'day',
              label: 'Día',
              type: 'number',
              min: 1,
              max: 31,
              inputMode: 'numeric',
              required: false,
              help: 'Si solo se conoce el año, deja el mes y el día vacíos.',
            },
            { name: 'body', label: 'Relato', type: 'textarea', rows: 6, maxLength: 2000, required: false },
            {
              name: 'imageMediaId',
              label: 'Foto',
              type: 'media',
              required: false,
              help: 'Las fotos antiguas lucen mucho aquí. Indica de quién es en el crédito de la imagen.',
            },
            {
              name: 'isPlaceholder',
              label: 'Dato por confirmar',
              type: 'checkbox',
              help: 'Se muestra con el aviso «Por confirmar» hasta que el club lo verifique.',
            },
          ]}
        />
      )
    case 'titulos':
      return (
        <EntityForm
          {...shared}
          schema={honourSchema}
          defaultValues={form.defaults}
          mediaPreviews={{ imageMediaId: image }}
          fields={[
            { name: 'name', label: 'Título', type: 'text', placeholder: 'Campeón del torneo oficial' },
            { name: 'year', label: 'Año', ...YEAR, required: false },
            {
              name: 'seriesId',
              label: 'Serie',
              type: 'select',
              options: seriesOptions,
              emptyLabel: 'Sin serie',
              required: false,
            },
            { name: 'competitionName', label: 'Competencia', type: 'text', required: false },
            {
              name: 'description',
              label: 'Relato',
              type: 'textarea',
              rows: 5,
              maxLength: 1000,
              required: false,
            },
            { name: 'imageMediaId', label: 'Foto', type: 'media', required: false },
          ]}
        />
      )
    case 'salon-de-la-fama':
      return (
        <EntityForm
          {...shared}
          schema={idolSchema}
          defaultValues={form.defaults}
          mediaPreviews={{ photoMediaId: image }}
          fields={[
            { name: 'fullName', label: 'Nombre', type: 'text' },
            { name: 'nickname', label: 'Apodo', type: 'text', required: false },
            { name: 'position', label: 'Posición o rol', type: 'text', required: false },
            {
              name: 'eraLabel',
              label: 'Época',
              type: 'text',
              required: false,
              placeholder: 'Años 70 y 80',
            },
            {
              name: 'bio',
              label: 'Trayectoria',
              type: 'textarea',
              rows: 6,
              maxLength: 2000,
              required: false,
            },
            { name: 'photoMediaId', label: 'Foto', type: 'media', required: false },
          ]}
        />
      )
    case 'camisetas':
      return (
        <EntityForm
          {...shared}
          schema={kitSchema}
          defaultValues={form.defaults}
          mediaPreviews={{ imageMediaId: image }}
          fields={[
            {
              name: 'description',
              label: 'Descripción',
              type: 'textarea',
              rows: 3,
              maxLength: 300,
              help: 'Colores, diseño y cualquier dato que la distinga.',
            },
            { name: 'yearFrom', label: 'Se usó desde el año', ...YEAR, required: false },
            { name: 'yearTo', label: 'Hasta el año', ...YEAR, required: false },
            { name: 'imageMediaId', label: 'Foto', type: 'media', required: false },
          ]}
        />
      )
  }
}
