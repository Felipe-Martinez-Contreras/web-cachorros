'use client' // Cliente: cola de avisos con temporizador, compartida por todas las pantallas del panel.

import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { Toast } from '@/components/ui/feedback'

type ToastVariant = 'success' | 'danger' | 'info'
type ToastInput = { message: string; variant?: ToastVariant; action?: ReactNode }
type ToastItem = ToastInput & { id: number }

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null)

const VISIBLE_MS = 5000
/** Con una acción («Deshacer») o un error se deja más tiempo para alcanzar a leer y tocar. */
const LONG_VISIBLE_MS = 9000
const MAX_VISIBLE = 3

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const push = useCallback(
    (toast: ToastInput) => {
      const id = nextId.current++
      setItems((current) => [...current, { ...toast, id }].slice(-MAX_VISIBLE))
      const long = toast.action || toast.variant === 'danger'
      window.setTimeout(() => dismiss(id), long ? LONG_VISIBLE_MS : VISIBLE_MS)
    },
    [dismiss],
  )

  const value = useMemo(() => push, [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 grid justify-items-center gap-2 px-4 lg:bottom-6">
        {items.map((item) => (
          <Toast key={item.id} variant={item.variant} action={item.action} onDismiss={() => dismiss(item.id)}>
            {item.message}
          </Toast>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/** `toast({ message: 'Guardado.' })` desde cualquier componente de cliente del panel. */
export function useToast() {
  const push = useContext(ToastContext)
  if (!push) throw new Error('useToast se usa dentro del panel (ToastProvider).')
  return push
}
