'use client' // Cliente: formulario del panel con react-hook-form + Zod y errores del servidor por campo.

import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Controller, type FieldValues, type Path, type Resolver, useForm } from 'react-hook-form'
import type { ZodType } from 'zod'
import { Button, buttonVariants } from '@/components/ui/button'
import { Alert } from '@/components/ui/feedback'
import { CheckboxField, Field, SelectField, TextareaField } from '@/components/ui/field'
import { MediaPicker } from '@/features/media/components/media-picker'
import type { MediaThumbDTO } from '@/features/media/dto'
import type { ActionResult } from '@/lib/action-result'
import { useToast } from './toast'

type Base = {
  name: string
  label: string
  help?: string
  /** `false` agrega «(opcional)» a la etiqueta. */
  required?: boolean
}

export type FieldDef =
  | (Base & {
      type: 'text' | 'number' | 'date' | 'time' | 'datetime-local' | 'email' | 'tel' | 'url'
      placeholder?: string
      min?: number
      max?: number
      step?: number | 'any'
      inputMode?: 'numeric' | 'decimal' | 'tel' | 'email' | 'url'
      autoComplete?: string
    })
  | (Base & { type: 'textarea'; rows?: number; maxLength?: number })
  | (Base & {
      type: 'select'
      options: { value: string; label: string }[]
      /** Texto de la opción vacía; sin ella hay que elegir una. */
      emptyLabel?: string
    })
  | (Base & { type: 'checkbox' })
  | (Base & { type: 'media'; kind?: 'photo' | 'logo' })

type EntityFormProps<T extends FieldValues> = {
  /** El mismo esquema que valida la Server Action. */
  schema: ZodType<unknown, T>
  fields: FieldDef[]
  defaultValues: T
  action: (input: unknown) => Promise<ActionResult<unknown>>
  submitLabel?: string
  successMessage?: string
  /** A dónde ir al guardar (normalmente la lista); sin ella se queda en la pantalla. */
  redirectTo?: string
  cancelHref?: string
  /** Miniatura de la imagen ya guardada en cada campo `media` (el formulario solo guarda su id). */
  mediaPreviews?: Record<string, MediaThumbDTO | null>
}

/**
 * Formulario genérico de los CRUD del panel: cada entidad aporta su esquema, sus campos y su acción.
 * Valida en el navegador con el mismo esquema del servidor, muestra los errores junto a cada campo y
 * lleva el foco al primero (especificación 4.9).
 */
export function EntityForm<T extends FieldValues>({
  schema,
  fields,
  defaultValues,
  action,
  submitLabel = 'Guardar',
  successMessage = 'Guardado.',
  redirectTo,
  cancelHref,
  mediaPreviews,
}: EntityFormProps<T>) {
  const router = useRouter()
  const toast = useToast()
  const [formError, setFormError] = useState<string | null>(null)
  const [previews, setPreviews] = useState(mediaPreviews ?? {})
  const form = useForm<T>({
    // El resolver valida; a la acción se envían los valores tal como están en el formulario y el servidor
    // los vuelve a validar y transformar con el mismo esquema.
    resolver: zodResolver(schema as never) as unknown as Resolver<T>,
    defaultValues: defaultValues as never,
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async () => {
    setFormError(null)
    const result = await action(form.getValues())
    if (!result.ok) {
      const entries = Object.entries(result.fieldErrors ?? {})
      for (const [name, messages] of entries) {
        form.setError(name as Path<T>, { type: 'server', message: messages[0] })
      }
      const first = entries.find(([name]) => fields.some((field) => field.name === name))
      if (first) form.setFocus(first[0] as Path<T>)
      setFormError(result.message)
      return
    }
    toast({ message: successMessage })
    if (redirectTo) router.push(redirectTo)
    router.refresh()
  })

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-2xl gap-4">
      {formError && <Alert variant="danger">{formError}</Alert>}
      {fields.map((field) => {
        const error = errors[field.name]?.message
        if (field.type === 'media') {
          return (
            <Controller
              key={field.name}
              control={form.control}
              name={field.name as Path<T>}
              render={({ field: control }) => (
                <MediaPicker
                  label={field.label}
                  help={field.help}
                  required={field.required}
                  kind={field.kind}
                  error={typeof error === 'string' ? error : undefined}
                  value={previews[field.name] ?? null}
                  onChange={(media) => {
                    setPreviews((current) => ({ ...current, [field.name]: media }))
                    control.onChange(media?.id ?? '')
                  }}
                />
              )}
            />
          )
        }
        const shared = {
          label: field.label,
          help: field.help,
          required: field.required,
          error: typeof error === 'string' ? error : undefined,
          ...form.register(field.name as Path<T>),
        }
        if (field.type === 'textarea') {
          return <TextareaField key={field.name} {...shared} rows={field.rows} maxLength={field.maxLength} />
        }
        if (field.type === 'select') {
          return (
            <SelectField key={field.name} {...shared}>
              {field.emptyLabel !== undefined && <option value="">{field.emptyLabel}</option>}
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          )
        }
        if (field.type === 'checkbox') return <CheckboxField key={field.name} {...shared} />
        return (
          <Field
            key={field.name}
            {...shared}
            type={field.type}
            placeholder={field.placeholder}
            min={field.min}
            max={field.max}
            step={field.step}
            inputMode={field.inputMode}
            autoComplete={field.autoComplete ?? 'off'}
          />
        )
      })}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="submit" variant="dark" size="lg" loading={isSubmitting}>
          {isSubmitting ? 'Guardando…' : submitLabel}
        </Button>
        {cancelHref && (
          <Link href={cancelHref} className={buttonVariants({ variant: 'outline', size: 'lg' })}>
            Cancelar
          </Link>
        )}
      </div>
    </form>
  )
}
