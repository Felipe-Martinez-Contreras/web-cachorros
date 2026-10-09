'use client' // Cliente: envía las credenciales a /api/auth (con rate limit) y muestra el resultado.

import { type FormEvent, useState } from 'react'
import { FormBody } from '@/components/admin/form-body'
import { authClient } from '@/lib/auth/client'
import { authErrorMessage } from '@/lib/auth/errors'
import { z } from '@/lib/zod'
import { loginSchema } from '../schemas'
import { Field, primaryButtonClass } from './field'

// Navegación completa: el panel se renderiza en el servidor ya con la cookie de sesión.
const enterPanel = () => window.location.assign('/admin')

export function LoginForm() {
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({})
  // Segundo paso: la cuenta tiene verificación en dos pasos (especificación 7.6).
  const [secondStep, setSecondStep] = useState<'app' | 'respaldo' | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = loginSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)))
    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors)
      setMessage('')
      return
    }
    setFieldErrors({})
    setPending(true)
    const { data, error } = await authClient.signIn.email(parsed.data)
    if (error) {
      setMessage(authErrorMessage(error))
      setPending(false)
      return
    }
    if (data && 'twoFactorRedirect' in data && data.twoFactorRedirect) {
      setMessage('')
      setSecondStep('app')
      setPending(false)
      return
    }
    enterPanel()
  }

  async function onCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = String(new FormData(event.currentTarget).get('code') ?? '').trim()
    if (code === '') {
      setMessage('Escribe el código.')
      return
    }
    setPending(true)
    const { error } =
      secondStep === 'respaldo'
        ? await authClient.twoFactor.verifyBackupCode({ code })
        : await authClient.twoFactor.verifyTotp({ code: code.replace(/\s/g, '') })
    if (error) {
      setMessage(authErrorMessage(error))
      setPending(false)
      return
    }
    enterPanel()
  }

  if (secondStep) {
    const backup = secondStep === 'respaldo'
    return (
      <form onSubmit={onCode} noValidate>
        <FormBody className="grid gap-4">
          <p className="text-neutral-600">
            {backup
              ? 'Escribe uno de los códigos de respaldo que guardaste al activar los dos pasos.'
              : 'Tu cuenta tiene verificación en dos pasos. Escribe el código de 6 dígitos de tu app autenticadora.'}
          </p>
          <Field
            // Cambiar de método vacía el campo.
            key={secondStep}
            name="code"
            label={backup ? 'Código de respaldo' : 'Código de la app'}
            inputMode={backup ? 'text' : 'numeric'}
            autoComplete="one-time-code"
            required
          />
          <button type="submit" disabled={pending} className={primaryButtonClass}>
            {pending ? 'Verificando…' : 'Verificar y entrar'}
          </button>
          <button
            type="button"
            className="min-h-12 text-left underline"
            onClick={() => {
              setMessage('')
              setSecondStep(backup ? 'app' : 'respaldo')
            }}
          >
            {backup ? 'Usar el código de la app' : 'No tengo mi celular: usar un código de respaldo'}
          </button>
          <p role="alert" className="min-h-6 text-danger">
            {message}
          </p>
        </FormBody>
      </form>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FormBody className="grid gap-4">
        <Field
          name="email"
          label="Correo"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          error={fieldErrors.email?.[0]}
        />
        <Field
          name="password"
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          required
          error={fieldErrors.password?.[0]}
        />
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? 'Entrando…' : 'Entrar'}
        </button>
        <p role="alert" className="min-h-6 text-danger">
          {message}
        </p>
      </FormBody>
    </form>
  )
}
