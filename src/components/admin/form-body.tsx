'use client' // Cliente: sabe cuándo React ya tomó el control del formulario (hidratación).

import { createContext, type ReactNode, useContext, useSyncExternalStore } from 'react'
import { cn } from '@/lib/cn'

const subscribe = () => () => {}

/** `false` en el HTML del servidor y hasta que React hidrata; `true` desde entonces. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
}

// Un cuerpo dentro de otro (las secciones de la carga de resultados) no repite el aviso.
const InsideFormBody = createContext(false)

/**
 * Cuerpo de todo formulario del panel. El HTML llega antes que el JavaScript: lo que se escribiera en ese
 * intervalo se perdería cuando el formulario toma el control (o se enviaría como un formulario nativo, sin
 * validar). Por eso los campos y botones nacen deshabilitados (`<fieldset disabled>`) con un aviso, y se
 * habilitan todos juntos cuando la pantalla está lista: no existe un momento en que se pueda escribir algo
 * que después no se guarde.
 */
export function FormBody({ children, className }: { children: ReactNode; className?: string }) {
  const ready = useHydrated()
  const nested = useContext(InsideFormBody)
  return (
    <fieldset
      disabled={!ready}
      aria-busy={!ready}
      // `min-w-0`: un fieldset no se achica por defecto y ensancharía la página en el celular.
      className={cn('min-w-0', !ready && !nested && 'opacity-60', className)}
    >
      {!nested && (
        <p role="status" className={ready ? 'sr-only' : 'text-sm font-medium text-neutral-700'}>
          {ready ? '' : 'Preparando el formulario…'}
        </p>
      )}
      <InsideFormBody value={true}>{children}</InsideFormBody>
    </fieldset>
  )
}
