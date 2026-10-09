'use client' // Cliente: lee el token del enlace y envía la contraseña nueva a /api/auth.

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { type FormEvent, useState } from 'react'
import { FormBody } from '@/components/admin/form-body'
import { authClient } from '@/lib/auth/client'
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/constants'
import { authErrorMessage } from '@/lib/auth/errors'
import { z } from '@/lib/zod'
import { resetPasswordSchema } from '../schemas'
import { Field, primaryButtonClass } from './field'

export function ResetPasswordForm() {
  const token = useSearchParams().get('token')
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const [message, setMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({})

  if (!token) {
    return (
      <p role="alert">
        Este enlace no es válido.{' '}
        <Link href="/admin/recuperar" className="text-(--link) underline">
          Pide uno nuevo
        </Link>
        .
      </p>
    )
  }

  if (done) {
    return (
      <p role="status" className="rounded-md bg-neutral-100 p-4">
        Listo, tu contraseña cambió.{' '}
        <Link href="/admin/login" className="text-(--link) underline">
          Entrar al panel
        </Link>
      </p>
    )
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return
    const parsed = resetPasswordSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)))
    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors)
      return
    }
    setFieldErrors({})
    setPending(true)
    const { error } = await authClient.resetPassword({ newPassword: parsed.data.password, token })
    setPending(false)
    if (error) {
      setMessage(authErrorMessage(error))
      return
    }
    setDone(true)
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FormBody className="grid gap-4">
        <Field
          name="password"
          label="Contraseña nueva"
          type="password"
          autoComplete="new-password"
          required
          help={`Al menos ${MIN_PASSWORD_LENGTH} caracteres. Una frase larga funciona muy bien.`}
          error={fieldErrors.password?.[0]}
        />
        <Field
          name="confirm"
          label="Repite la contraseña"
          type="password"
          autoComplete="new-password"
          required
          error={fieldErrors.confirm?.[0]}
        />
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? 'Guardando…' : 'Guardar contraseña'}
        </button>
        <p role="alert" className="min-h-6 text-danger">
          {message}
        </p>
      </FormBody>
    </form>
  )
}
