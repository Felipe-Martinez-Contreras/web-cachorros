'use client' // Cliente: ejecuta una Server Action, pide confirmación en un <dialog> y avisa el resultado.

import type { VariantProps } from 'class-variance-authority'
import { useRouter } from 'next/navigation'
import { type ReactNode, useId, useRef, useState } from 'react'
import { Button, type buttonVariants } from '@/components/ui/button'
import type { ActionResult } from '@/lib/action-result'
import { useToast } from './toast'

type ActionButtonProps = VariantProps<typeof buttonVariants> & {
  /** Server Action ya enlazada a su entidad: `eliminarSerie.bind(null, id)`. */
  action: () => Promise<ActionResult<unknown>>
  children: ReactNode
  /** Si viene, se pregunta antes de ejecutar (acciones destructivas, especificación 7.1). */
  confirm?: { title: string; description?: string; confirmLabel: string }
  successMessage?: string
  /** A dónde ir después; por defecto se recarga la pantalla actual. */
  redirectTo?: string
  className?: string
  'aria-label'?: string
  disabled?: boolean
}

export function ActionButton({
  action,
  children,
  confirm,
  successMessage,
  redirectTo,
  variant = 'outline',
  size = 'lg',
  ...button
}: ActionButtonProps) {
  const router = useRouter()
  const toast = useToast()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [pending, setPending] = useState(false)

  async function run() {
    // Protección contra doble toque.
    if (pending) return
    setPending(true)
    try {
      const result = await action()
      dialogRef.current?.close()
      if (!result.ok) {
        toast({ variant: 'danger', message: result.message })
        return
      }
      if (successMessage) toast({ message: successMessage })
      if (redirectTo) router.push(redirectTo)
      else router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        loading={pending && !confirm}
        onClick={() => (confirm ? dialogRef.current?.showModal() : run())}
        {...button}
      >
        {children}
      </Button>
      {confirm && (
        <dialog
          ref={dialogRef}
          aria-labelledby={titleId}
          className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-lg bg-paper p-5 text-ink shadow-2xl backdrop:bg-ink/60"
        >
          <h2 id={titleId} className="text-h3">
            {confirm.title}
          </h2>
          {confirm.description && <p className="mt-2 text-neutral-600">{confirm.description}</p>}
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Button variant="outline" size="lg" onClick={() => dialogRef.current?.close()}>
              Cancelar
            </Button>
            <Button variant="danger" size="lg" loading={pending} onClick={run}>
              {confirm.confirmLabel}
            </Button>
          </div>
        </dialog>
      )}
    </>
  )
}
