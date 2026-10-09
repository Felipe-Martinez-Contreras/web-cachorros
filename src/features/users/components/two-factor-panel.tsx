'use client' // Cliente: activa o desactiva los dos pasos contra /api/auth, que reemplaza la cookie de sesión.

import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'
import { useToast } from '@/components/admin/toast'
import { Button, buttonVariants } from '@/components/ui/button'
import { Alert } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { authClient } from '@/lib/auth/client'
import { authErrorMessage } from '@/lib/auth/errors'
import { iniciarDosPasos } from '../actions'
import type { TwoFactorStart } from '../lib/two-factor'

type Step =
  | { kind: 'idle' }
  | { kind: 'scan'; setup: TwoFactorStart }
  | { kind: 'done'; backupCodes: string[] }

/** Verificación en dos pasos de la cuenta propia (especificación 7.6): código QR, clave y códigos de respaldo. */
export function TwoFactorPanel({ enabled }: { enabled: boolean }) {
  const router = useRouter()
  const toast = useToast()
  const [step, setStep] = useState<Step>({ kind: 'idle' })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()

  async function run(task: () => Promise<string | undefined>) {
    if (pending) return
    setPending(true)
    setError(undefined)
    try {
      setError(await task())
    } catch {
      setError('Algo salió mal. Inténtalo de nuevo en unos segundos.')
    } finally {
      setPending(false)
    }
  }

  const value = (event: FormEvent<HTMLFormElement>, name: string) =>
    String(new FormData(event.currentTarget).get(name) ?? '')

  function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const password = value(event, 'password')
    run(async () => {
      const result = await iniciarDosPasos({ password })
      if (!result.ok) return result.fieldErrors?.password?.[0] ?? result.message
      setStep({ kind: 'scan', setup: result.data })
    })
  }

  function verify(event: FormEvent<HTMLFormElement>, setup: TwoFactorStart) {
    event.preventDefault()
    const code = value(event, 'code').replace(/\s/g, '')
    run(async () => {
      const { error: failure } = await authClient.twoFactor.verifyTotp({ code })
      if (failure) return authErrorMessage(failure)
      setStep({ kind: 'done', backupCodes: setup.backupCodes })
      toast({ message: 'Verificación en dos pasos activada.' })
      router.refresh()
    })
  }

  function disable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const password = value(event, 'password')
    run(async () => {
      const { error: failure } = await authClient.twoFactor.disable({ password })
      if (failure) return authErrorMessage(failure)
      setStep({ kind: 'idle' })
      toast({ message: 'Verificación en dos pasos desactivada.' })
      router.refresh()
    })
  }

  if (step.kind === 'done') {
    return (
      <div className="grid gap-3">
        <Alert variant="success" title="Lista: tu cuenta ya pide el código al entrar">
          Guarda estos códigos de respaldo en un lugar seguro. Cada uno sirve una sola vez para entrar si no
          tienes tu celular a mano. No se vuelven a mostrar.
        </Alert>
        <ul aria-label="Códigos de respaldo" className="grid max-w-md grid-cols-2 gap-2 font-mono text-lg">
          {step.backupCodes.map((code) => (
            <li key={code} className="rounded-md bg-neutral-100 px-3 py-2 text-center">
              {code}
            </li>
          ))}
        </ul>
        <div>
          <Button variant="outline" size="lg" onClick={() => setStep({ kind: 'idle' })}>
            Ya los guardé
          </Button>
        </div>
      </div>
    )
  }

  if (step.kind === 'scan') {
    const { setup } = step
    return (
      <form onSubmit={(event) => verify(event, setup)} noValidate className="grid max-w-md gap-4">
        <ol className="grid list-decimal gap-4 pl-5">
          <li>
            Abre tu app autenticadora (Google Authenticator, Microsoft Authenticator u otra) y escanea este
            código con el celular.
            {/* biome-ignore lint/performance/noImgElement: SVG generado en el servidor, incrustado como data: */}
            <img
              src={setup.qr}
              alt="Código QR para configurar la app autenticadora"
              width={220}
              height={220}
              className="mt-3 rounded-md border border-neutral-300 bg-paper p-2"
            />
            <p className="mt-3 text-sm text-neutral-600">
              ¿Estás en el mismo celular?{' '}
              <a href={setup.uri} className="font-medium text-ink underline">
                Abrir en la app autenticadora
              </a>
              . O escribe esta clave a mano:
            </p>
            <p className="mt-1 font-mono break-all">{setup.secret}</p>
          </li>
          <li>Escribe el código de 6 dígitos que muestra la app.</li>
        </ol>
        <Field
          name="code"
          label="Código de la app"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          error={error}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="dark" size="lg" loading={pending}>
            Activar
          </Button>
          <Button variant="outline" size="lg" onClick={() => setStep({ kind: 'idle' })}>
            Cancelar
          </Button>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={enabled ? disable : start} noValidate className="grid max-w-md gap-4">
      <p className="text-neutral-600">
        {enabled
          ? 'Está activada: al entrar se pide, además de la contraseña, un código de tu app autenticadora.'
          : 'Recomendada: aunque alguien adivine tu contraseña, no podrá entrar sin el código de tu celular.'}
      </p>
      <Field
        name="password"
        label={enabled ? 'Tu contraseña, para desactivarla' : 'Tu contraseña, para activarla'}
        type="password"
        autoComplete="current-password"
        error={error}
      />
      <div>
        <button
          type="submit"
          disabled={pending}
          className={buttonVariants({ variant: enabled ? 'outline' : 'dark', size: 'lg' })}
        >
          {enabled ? 'Desactivar los dos pasos' : 'Activar los dos pasos'}
        </button>
      </div>
    </form>
  )
}
