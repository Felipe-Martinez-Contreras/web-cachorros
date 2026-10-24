'use client' // Cliente: formularios de productos, tallas, fotos y categorías de la tienda (react-hook-form + Zod).

import { EntityForm } from '@/components/admin/entity-form'
import type { ActionResult } from '@/lib/action-result'
import {
  type ProductCategoryFormValues,
  type ProductFormValues,
  type ProductImageFormValues,
  type ProductVariantFormValues,
  productCategorySchema,
  productImageSchema,
  productSchema,
  productVariantSchema,
} from '../schemas'

type Action = (input: unknown) => Promise<ActionResult<unknown>>
type Options = { value: string; label: string }[]

const sortOrderField = {
  name: 'sortOrder',
  label: 'Orden',
  type: 'number',
  min: 0,
  step: 1,
  help: 'Menor primero.',
} as const

export function ProductForm({
  action,
  defaults,
  categories,
  isNew = false,
}: {
  action: Action
  defaults: ProductFormValues
  categories: Options
  isNew?: boolean
}) {
  return (
    <EntityForm
      schema={productSchema}
      action={action}
      defaultValues={defaults}
      // Al crear se sigue a la ficha, para agregar tallas y fotos.
      successMessage={isNew ? 'Producto creado. Ahora agrega sus tallas y fotos.' : 'Guardado.'}
      redirectTo={isNew ? (id) => `/admin/tienda/${id}` : '/admin/tienda'}
      cancelHref="/admin/tienda"
      submitLabel={isNew ? 'Crear y seguir con tallas y fotos' : 'Guardar'}
      fields={[
        { name: 'name', label: 'Nombre', type: 'text', placeholder: 'Camiseta oficial (local)' },
        {
          name: 'categoryId',
          label: 'Categoría',
          type: 'select',
          options: categories,
          emptyLabel: 'Sin categoría',
          required: false,
        },
        { name: 'description', label: 'Descripción', type: 'textarea', required: false, maxLength: 2000 },
        {
          name: 'priceClp',
          label: 'Precio en pesos',
          type: 'number',
          min: 0,
          step: 1,
          inputMode: 'numeric',
          help: 'Sin puntos ni signo: 18000.',
        },
        {
          name: 'compareAtPriceClp',
          label: 'Precio anterior',
          type: 'number',
          min: 0,
          step: 1,
          inputMode: 'numeric',
          required: false,
          help: 'Para mostrar una rebaja: se ve tachado junto al precio.',
        },
        {
          name: 'trackStock',
          label: 'Controlar stock por talla',
          type: 'checkbox',
          help: 'Una talla con 0 unidades se muestra «Agotada». Sin control, solo cuenta si la talla está disponible.',
        },
        { name: 'isActive', label: 'Visible en la tienda', type: 'checkbox' },
        sortOrderField,
      ]}
    />
  )
}

export function VariantForm({
  action,
  defaults,
  isNew = false,
}: {
  action: Action
  defaults: ProductVariantFormValues
  isNew?: boolean
}) {
  return (
    <EntityForm
      schema={productVariantSchema}
      action={action}
      defaultValues={defaults}
      resetOnSuccess={isNew}
      submitLabel={isNew ? 'Agregar talla' : 'Guardar talla'}
      successMessage={isNew ? 'Talla agregada.' : 'Talla guardada.'}
      fields={[
        { name: 'sizeLabel', label: 'Talla', type: 'text', placeholder: 'M o 10 años' },
        {
          name: 'stock',
          label: 'Unidades disponibles',
          type: 'number',
          min: 0,
          step: 1,
          inputMode: 'numeric',
          required: false,
          help: 'Solo si el producto controla stock. Vacío: sin control para esta talla.',
        },
        {
          name: 'isAvailable',
          label: 'Disponible',
          type: 'checkbox',
          help: 'Desmárcala para mostrarla «Agotada».',
        },
        sortOrderField,
      ]}
    />
  )
}

export function ProductImageForm({ action, defaults }: { action: Action; defaults: ProductImageFormValues }) {
  return (
    <EntityForm
      schema={productImageSchema}
      action={action}
      defaultValues={defaults}
      resetOnSuccess
      submitLabel="Agregar foto"
      successMessage="Foto agregada."
      fields={[
        { name: 'mediaId', label: 'Foto', type: 'media', kind: 'photo' },
        { ...sortOrderField, help: 'La primera es la portada del producto.' },
      ]}
    />
  )
}

export function ProductCategoryForm({
  action,
  defaults,
  isNew = false,
}: {
  action: Action
  defaults: ProductCategoryFormValues
  isNew?: boolean
}) {
  return (
    <EntityForm
      schema={productCategorySchema}
      action={action}
      defaultValues={defaults}
      resetOnSuccess={isNew}
      submitLabel={isNew ? 'Agregar categoría' : 'Guardar categoría'}
      successMessage={isNew ? 'Categoría agregada.' : 'Categoría guardada.'}
      fields={[{ name: 'name', label: 'Nombre', type: 'text', placeholder: 'Indumentaria' }, sortOrderField]}
    />
  )
}
