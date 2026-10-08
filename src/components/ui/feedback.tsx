import { cva, type VariantProps } from 'class-variance-authority'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

const alertVariants = cva(
  'flex gap-3 rounded-md border p-4 text-ink [&_svg]:mt-0.5 [&_svg]:size-5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        info: 'border-neutral-300 bg-neutral-50',
        success: 'border-success bg-[#e9f5ee] [&_svg]:text-success',
        warning: 'border-accent-strong bg-accent-soft [&_svg]:text-accent-strong',
        danger: 'border-danger bg-[#fdecea] [&_svg]:text-danger',
      },
    },
    defaultVariants: { variant: 'info' },
  },
)

const ALERT_ICONS = { info: Info, success: CircleCheck, warning: CircleAlert, danger: CircleAlert } as const

type AlertProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> &
  VariantProps<typeof alertVariants> & { title?: string }

/** Aviso en línea. Los errores se anuncian de inmediato (`role="alert"`); el resto, con cortesía. */
export function Alert({ className, variant, title, children, ...props }: AlertProps) {
  const kind = variant ?? 'info'
  const Icon = ALERT_ICONS[kind]
  return (
    <div
      role={kind === 'danger' ? 'alert' : 'status'}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon aria-hidden="true" />
      <div className="grid gap-1">
        {title && <p className="font-semibold">{title}</p>}
        <div className="text-sm">{children}</div>
      </div>
    </div>
  )
}

/** Bloque gris animado que reserva el espacio final mientras carga el contenido (CLS = 0). */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-(--fg)/10', className)} {...props} />
  )
}

type EmptyStateProps = {
  icon?: ReactNode
  title: string
  /** Explica qué hacer a continuación. */
  children?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, children, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'grid justify-items-center gap-3 rounded-lg border border-dashed border-(--border) px-6 py-10 text-center',
        className,
      )}
    >
      {icon && <div className="text-(--muted) [&_svg]:size-10">{icon}</div>}
      <p className="text-h3">{title}</p>
      {children && <div className="max-w-md text-(--muted)">{children}</div>}
      {action}
    </div>
  )
}

const toastVariants = cva(
  'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md p-4 shadow-lg [&_svg]:mt-0.5 [&_svg]:size-5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        success: 'bg-ink text-paper [&>svg]:text-[#6fd3a0]',
        danger: 'bg-danger text-paper',
        info: 'bg-ink text-paper',
      },
    },
    defaultVariants: { variant: 'success' },
  },
)

type ToastProps = VariantProps<typeof toastVariants> & {
  children: ReactNode
  /** Acción opcional, por ejemplo «Deshacer». */
  action?: ReactNode
  onDismiss?: () => void
  className?: string
}

/** Aviso breve del panel con el resultado de una acción. La cola y el temporizador llegan con el panel (Fase 2). */
export function Toast({ variant, children, action, onDismiss, className }: ToastProps) {
  const kind = variant ?? 'success'
  const Icon = kind === 'danger' ? CircleAlert : kind === 'info' ? Info : CircleCheck
  return (
    <div role={kind === 'danger' ? 'alert' : 'status'} className={cn(toastVariants({ variant }), className)}>
      <Icon aria-hidden="true" />
      <p className="flex-1 text-sm font-medium">{children}</p>
      {action}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar aviso"
          className="-m-2 grid size-9 place-items-center"
        >
          <X aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
