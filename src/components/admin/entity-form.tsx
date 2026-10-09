'use client' // Cliente: formulario del panel con react-hook-form + Zod y errores del servidor por campo.

import { zodResolver } from '@hookform/resolvers/zod'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { Controller, type FieldValues, type Path, type Resolver, useForm } from 'react-hook-form'
import type { ZodType } from 'zod'
import { Button, buttonVariants } from '@/components/ui/button'
import { Alert } from '@/components/ui/feedback'
import { CheckboxField, Field, SelectField, TextareaField } from '@/components/ui/field'
import { MediaPicker } from '@/features/media/components/media-picker'
import type { MediaThumbDTO } from '@/features/media/dto'
import type { ActionResult } from '@/lib/action-result'
import { formatTime } from '@/lib/format'
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
  | (Base & { type: 'checkboxes'; options: { value: string; label: string }[] })
  | (Base & { type: 'media'; kind?: 'photo' | 'logo' })
  | (Base & { type: 'richtext' })

type EntityFormProps<T extends FieldValues> = {
  /** El mismo esquema que valida la Server Action. */
  schema: ZodType<unknown, T>
  fields: FieldDef[]
  defaultValues: T
  action: (input: unknown) => Promise<ActionResult<unknown>>
  submitLabel?: string
  successMessage?: string
  /** A dónde ir al guardar (normalmente la lista); sin ella se queda en la pantalla. */
  redirectTo?: string | ((id: string) => string)
  /** Formularios de «agregar» que se quedan en la pantalla: vuelven a sus valores iniciales al guardar. */
  resetOnSuccess?: boolean
  cancelHref?: string
  /** Miniatura de la imagen ya guardada en cada campo `media` (el formulario solo guarda su id). */
  mediaPreviews?: Record<string, MediaThumbDTO | null>
  /**
   * Autoguardado (especificación 7.1): unos segundos después del último cambio guarda con `action`, sin
   * avisos ni navegación, siempre que el formulario sea válido. Solo para borradores.
   */
  autosave?: boolean
}

const AUTOSAVE_DELAY_MS = 4000

// El editor (Tiptap) pesa: se descarga solo en las pantallas que tienen un campo de texto enriquecido.
const RichTextEditor = dynamic(() => import('./rich-text-editor').then((module) => module.RichTextEditor), {
  ssr: false,
  loading: () => (
    <p className="min-h-64 rounded-md border border-neutral-300 p-3 text-neutral-600">Cargando el editor…</p>
  ),
})

type AutosaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; at: Date } | { kind: 'error' }

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
  resetOnSuccess = false,
  autosave = false,
}: EntityFormProps<T>) {
  // Una página puede tener varios formularios con los mismos campos: cada uno prefija sus ids.
  const uid = useId()
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
  const [autosaveState, setAutosaveState] = useState<AutosaveState>({ kind: 'idle' })
  // Evita que un autoguardado y un guardado manual se pisen.
  const savingRef = useRef(false)

  useEffect(() => {
    if (!autosave) return
    let timer: number | undefined
    const subscription = form.watch(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(async () => {
        const values = form.getValues()
        // Un borrador a medio escribir (sin título, por ejemplo) no se guarda ni muestra errores.
        if (savingRef.current || !schema.safeParse(values).success) return
        savingRef.current = true
        setAutosaveState({ kind: 'saving' })
        try {
          const result = await action(values)
          setAutosaveState(result.ok ? { kind: 'saved', at: new Date() } : { kind: 'error' })
        } catch {
          setAutosaveState({ kind: 'error' })
        } finally {
          savingRef.current = false
        }
      }, AUTOSAVE_DELAY_MS)
    })
    return () => {
      window.clearTimeout(timer)
      subscription.unsubscribe()
    }
  }, [autosave, form, schema, action])

  const onSubmit = form.handleSubmit(async () => {
    setFormError(null)
    savingRef.current = true
    const result = await action(form.getValues()).finally(() => {
      savingRef.current = false
    })
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
    if (resetOnSuccess) form.reset()
    const savedId = (result.data as { id?: unknown } | null)?.id
    if (typeof redirectTo === 'function') {
      if (typeof savedId === 'string') router.push(redirectTo(savedId))
    } else if (redirectTo) {
      router.push(redirectTo)
    }
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
        if (field.type === 'richtext') {
          return (
            <Controller
              key={field.name}
              control={form.control}
              name={field.name as Path<T>}
              render={({ field: control }) => (
                <RichTextEditor
                  label={field.label}
                  help={field.help}
                  required={field.required}
                  error={typeof error === 'string' ? error : undefined}
                  value={control.value ?? null}
                  onChange={control.onChange}
                />
              )}
            />
          )
        }
        if (field.type === 'checkboxes') {
          return (
            <Controller
              key={field.name}
              control={form.control}
              name={field.name as Path<T>}
              render={({ field: control }) => {
                const selected: string[] = Array.isArray(control.value) ? control.value : []
                return (
                  <fieldset className="grid gap-1">
                    <legend className="font-medium">
                      {field.label}
                      {field.required === false && (
                        <span className="font-normal text-neutral-600"> (opcional)</span>
                      )}
                    </legend>
                    <div className="grid gap-x-4 sm:grid-cols-2">
                      {field.options.map((option) => (
                        <CheckboxField
                          key={option.value}
                          id={`${uid}-${field.name}-${option.value}`}
                          name={`${field.name}-${option.value}`}
                          label={option.label}
                          checked={selected.includes(option.value)}
                          onChange={(event) =>
                            control.onChange(
                              event.target.checked
                                ? [...selected, option.value]
                                : selected.filter((value) => value !== option.value),
                            )
                          }
                        />
                      ))}
                    </div>
                    {field.help && <p className="text-sm text-neutral-600">{field.help}</p>}
                    {typeof error === 'string' && <p className="text-sm font-medium text-danger">{error}</p>}
                  </fieldset>
                )
              }}
            />
          )
        }
        const shared = {
          id: `${uid}-${field.name}`,
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
      {autosave && (
        <p role="status" className="min-h-5 text-sm text-neutral-600">
          {autosaveState.kind === 'saving' && 'Guardando el borrador…'}
          {autosaveState.kind === 'saved' && `Borrador guardado a las ${formatTime(autosaveState.at)}.`}
          {autosaveState.kind === 'error' &&
            'No se pudo guardar el borrador automáticamente. Revisa tu conexión y toca «Guardar».'}
        </p>
      )}
    </form>
  )
}
