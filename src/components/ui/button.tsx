import { cva, type VariantProps } from 'class-variance-authority'
import { LoaderCircle } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/**
 * Estilos del botón. Para enlaces con aspecto de botón se usan directo:
 * `<Link className={buttonVariants({ variant: 'primary' })}>`.
 */
export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap',
    'transition-[background-color,color,border-color,transform] duration-150 ease-out',
    'active:translate-y-px disabled:pointer-events-none disabled:opacity-50',
    'aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        // Texto negro sobre el naranja del escudo (contraste AA en cualquier tamaño).
        primary: 'bg-accent text-ink hover:bg-[#ff8a1f]',
        dark: 'bg-ink text-paper hover:bg-neutral-800',
        light: 'bg-paper text-ink hover:bg-neutral-100',
        outline: 'border border-current bg-transparent hover:bg-(--fg)/8',
        ghost: 'bg-transparent hover:bg-(--fg)/8',
        danger: 'bg-danger text-paper hover:bg-[#971c12]',
        link: 'h-auto min-h-0 rounded-none p-0 text-(--link) underline underline-offset-4 hover:no-underline',
      },
      size: {
        md: 'min-h-11 px-5 text-base',
        lg: 'min-h-12 px-6 text-base',
        // Compacto en lo visual, pero conserva el área táctil de 44 px.
        sm: 'min-h-11 px-3 text-sm',
        icon: 'size-11',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    /** Muestra un indicador de progreso y bloquea el botón. */
    loading?: boolean
  }

export function Button({
  className,
  variant,
  size,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <LoaderCircle aria-hidden="true" className="animate-spin" />}
      {children}
    </button>
  )
}
