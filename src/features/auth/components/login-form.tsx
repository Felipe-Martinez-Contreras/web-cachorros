'use client' // Cliente: envía las credenciales a /api/auth (con rate limit) y muestra el resultado.

import { type FormEvent, useState } from 'react'
import { authClient } from '@/lib/auth/client'
import { authErrorMessage } from '@/lib/auth/errors'
import { z } from '@/lib/zod'
import { loginSchema } from '../schemas'
import { Field, primaryButtonClass } from './field'

export function LoginForm() {
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({})

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
    const { error } = await authClient.signIn.email(parsed.data)
    if (error) {
      setMessage(authErrorMessage(error))
      setPending(false)
      return
    }
    // Navegación completa: el panel se renderiza en el servidor ya con la cookie de sesión.
    window.location.assign('/admin')
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
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
    </form>
  )
}
