import { cn } from '@/lib/cn'

const PLATE_SIZES = {
  /** Marcador: un número por placa (72 → 120 px en el sitio). */
  score: 'text-score min-w-[1.1em] px-[0.12em]',
  /** Cuenta regresiva: cuatro placas de dos cifras caben en 360 px. */
  countdown: 'text-plate-countdown min-w-[1.25em] px-[0.1em]',
} as const

type PlateProps = {
  value: string
  size?: keyof typeof PLATE_SIZES
  /**
   * Gira la placa al llegar este valor. Quien la usa lo activa solo cuando el valor cambió en el cliente:
   * el que llega del servidor no se anima al cargar la página.
   */
  flip?: boolean
  className?: string
}

/**
 * Placa del marcador de la cancha: número blanco de Archivo 900 al 62,5 % sobre negro puro, sin radio.
 * Es decorativa (`aria-hidden`): quien la usa pone el texto equivalente para lectores de pantalla.
 *
 * El giro vuelve a correr porque cada valor monta su propio elemento (`key`): no hay estado ni JavaScript
 * propio, así que sirve igual en un Server Component.
 */
export function Plate({ value, size = 'score', flip = false, className }: PlateProps) {
  return (
    <span aria-hidden="true" className={cn('plate', PLATE_SIZES[size], className)}>
      <span key={value} className={cn('block', flip && 'plate-flip')}>
        {value}
      </span>
    </span>
  )
}
