'use client'
// Isla del formulario público: monta Turnstile, envía por fetch y muestra el resultado sin recargar.

import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/feedback'
import { CheckboxField, Field, SelectField, TextareaField } from '@/components/ui/field'
import { HONEYPOT_FIELD, STAMP_FIELD, TURNSTILE_FIELD } from '@/lib/forms/fields'
import {
  FORM_ERRORS,
  type FormErrorCode,
  type FormResponse,
  SHOW_DIRECT_CHANNELS,
} from '@/lib/forms/messages'

export type PublicFieldConfig =
  | {
      kind: 'text' | 'email' | 'tel'
      name: string
      label: string
      required?: boolean
      autoComplete?: string
      help?: string
    }
  | { kind: 'textarea'; name: string; label: string; required?: boolean; help?: string }
  | {
      kind: 'select'
      name: string
      label: string
      options: { value: string; label: string }[]
      defaultValue?: string
      required?: boolean
    }
  | { kind: 'checkbox'; name: string; label: ReactNode; required?: boolean }

type Notice = { ok: true } | { ok: false; code: FormErrorCode } | null

type Props = {
  /** Nombre del formulario en `/api/forms/[form]`. */
  form: string
  /** Clave pública de Turnstile, entregada por el servidor (nunca `NEXT_PUBLIC_*`). */
  siteKey: string
  turnstileAction: string
  /** Momento firmado en que el servidor dibujó el formulario (tiempo mínimo de llenado). */
  stamp: string
  fields: PublicFieldConfig[]
  submitLabel: string
  success: { title: string; text: string }
  /** Resultado de un envío sin JavaScript (`?enviado=1` o `?error=…`). */
  notice: Notice
  /** WhatsApp y correo del club, para cuando el formulario no se puede enviar. */
  directChannels: ReactNode
}

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

let turnstileScript: Promise<TurnstileApi> | undefined

function loadTurnstile(): Promise<TurnstileApi> {
  turnstileScript ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.onload = () => {
      const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile
      if (api) resolve(api)
      else reject(new Error('Turnstile no quedó disponible'))
    }
    script.onerror = () => {
      turnstileScript = undefined
      reject(new Error('No se pudo cargar Turnstile'))
    }
    document.head.append(script)
  })
  return turnstileScript
}

export function PublicForm({
  form,
  siteKey,
  turnstileAction,
  stamp,
  fields,
  submitLabel,
  success,
  notice,
  directChannels,
}: Props) {
  const [sent, setSent] = useState(notice?.ok === true)
  const [error, setError] = useState<{ code: FormErrorCode | 'esperando'; message: string } | null>(
    notice && !notice.ok ? { code: notice.code, message: FORM_ERRORS[notice.code] } : null,
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [sending, setSending] = useState(false)
  const widgetRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (sent) return
    let cancelled = false
    loadTurnstile()
      .then((api) => {
        if (cancelled || !widgetRef.current) return
        widgetId.current = api.render(widgetRef.current, {
          sitekey: siteKey,
          action: turnstileAction,
          language: 'es',
          size: 'flexible',
          theme: 'light',
        })
      })
      .catch(() => {
        if (!cancelled) setError({ code: 'verificacion-caida', message: FORM_ERRORS['verificacion-caida'] })
      })
    return () => {
      cancelled = true
      const id = widgetId.current
      widgetId.current = null
      if (id) void loadTurnstile().then((api) => api.remove(id))
    }
  }, [sent, siteKey, turnstileAction])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    if (!data.get(TURNSTILE_FIELD)) {
      setError({
        code: 'esperando',
        message: 'Estamos verificando que no eres un robot. Espera un momento y vuelve a enviarlo.',
      })
      return
    }
    setSending(true)
    setError(null)
    try {
      const response = await fetch(`/api/forms/${form}`, {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' },
      })
      const result = (await response.json()) as FormResponse
      if (result.ok) {
        setSent(true)
        requestAnimationFrame(() => resultRef.current?.focus())
        return
      }
      setFieldErrors(result.fieldErrors ?? {})
      setError({ code: result.code, message: result.message })
      const firstInvalid = result.fieldErrors ? Object.keys(result.fieldErrors)[0] : undefined
      const target = firstInvalid ? formRef.current?.elements.namedItem(firstInvalid) : null
      if (target instanceof HTMLElement) target.focus()
    } catch {
      setError({ code: 'servidor', message: FORM_ERRORS.servidor })
    } finally {
      setSending(false)
      // Cada token de Turnstile sirve una sola vez.
      const id = widgetId.current
      if (id) void loadTurnstile().then((api) => api.reset(id))
    }
  }

  if (sent) {
    return (
      <div ref={resultRef} tabIndex={-1} className="outline-none">
        <Alert variant="success" title={success.title}>
          {success.text}
        </Alert>
      </div>
    )
  }

  const errorOf = (name: string) => fieldErrors[name]?.[0]

  return (
    <form
      ref={formRef}
      method="post"
      action={`/api/forms/${form}`}
      onSubmit={onSubmit}
      noValidate
      className="grid gap-5"
    >
      {error && (
        <Alert variant={error.code === 'esperando' ? 'info' : 'danger'}>
          <p>{error.message}</p>
          {error.code !== 'esperando' && SHOW_DIRECT_CHANNELS.has(error.code) && directChannels}
        </Alert>
      )}
      <noscript>
        <Alert variant="info">
          <p>{FORM_ERRORS['sin-verificacion']}</p>
          {directChannels}
        </Alert>
      </noscript>

      {fields.map((field) => {
        const error = errorOf(field.name)
        switch (field.kind) {
          case 'textarea':
            return (
              <TextareaField
                key={field.name}
                name={field.name}
                label={field.label}
                help={field.help}
                required={field.required ?? false}
                error={error}
                rows={6}
              />
            )
          case 'select':
            return (
              <SelectField
                key={field.name}
                name={field.name}
                label={field.label}
                required={field.required ?? false}
                defaultValue={field.defaultValue}
                error={error}
              >
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
            )
          case 'checkbox':
            return (
              <CheckboxField
                key={field.name}
                name={field.name}
                label={field.label}
                required={field.required}
                error={error}
              />
            )
          default:
            return (
              <Field
                key={field.name}
                name={field.name}
                type={field.kind}
                label={field.label}
                help={field.help}
                autoComplete={field.autoComplete}
                required={field.required ?? false}
                error={error}
              />
            )
        }
      })}

      {/* Campo trampa: fuera de la pantalla y del orden de tabulación; las personas no lo ven. */}
      <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
        <label htmlFor={`${form}-${HONEYPOT_FIELD}`}>No completes este campo</label>
        <input id={`${form}-${HONEYPOT_FIELD}`} name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" />
      </div>
      <input type="hidden" name={STAMP_FIELD} value={stamp} />

      <div ref={widgetRef} className="min-h-[65px]" />

      <Button type="submit" size="lg" loading={sending} className="justify-self-start">
        {submitLabel}
      </Button>
    </form>
  )
}
