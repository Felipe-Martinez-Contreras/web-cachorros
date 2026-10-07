'use client' // Cliente: pide el enlace de recuperación a /api/auth (con rate limit) y confirma en pantalla.

import { type FormEvent, useState } from 'react'
import { authClient } from '@/lib/auth/client'
import { authErrorMessage } from '@/lib/auth/errors'
import { z } from '@/lib/zod'
import { forgotPasswordSchema } from '../schemas'
import { Field, primaryButtonClass } from './field'

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  const [message, setMessage] = useState('')
  const [emailError, setEmailError] = useState<string>()

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)))
    if (!parsed.success) {
      setEmailError(z.flattenError(parsed.error).fieldErrors.email?.[0])
      return
    }
    setEmailError(undefined)
    setPending(true)
    const { error } = await authClient.requestPasswordReset({ email: parsed.data.email })
    setPending(false)
    if (error) {
      setMessage(authErrorMessage(error))
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <p role="status" className="rounded-md bg-neutral-100 p-4">
        Si ese correo tiene una cuenta, te enviamos un enlace para crear una contraseña nueva. Vale por 1
        hora. Revisa también la carpeta de spam.
      </p>
    )
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
        error={emailError}
      />
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? 'Enviando…' : 'Enviar enlace'}
      </button>
      <p role="alert" className="min-h-6 text-danger">
        {message}
      </p>
    </form>
  )
}
