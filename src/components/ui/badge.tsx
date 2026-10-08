import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs leading-none font-bold tracking-wide uppercase',
  {
    variants: {
      variant: {
        neutral: 'bg-neutral-100 text-neutral-700',
        dark: 'bg-ink text-paper',
        accent: 'bg-accent text-ink',
        soft: 'bg-accent-soft text-ink',
        outline: 'border border-current',
        live: 'bg-live text-paper',
        success: 'bg-success text-paper',
        danger: 'bg-danger text-paper',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
)

type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
