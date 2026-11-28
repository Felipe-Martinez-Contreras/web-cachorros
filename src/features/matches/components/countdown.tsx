'use client' // Cliente: la cuenta regresiva depende de la hora del dispositivo y se actualiza cada segundo.

import { useEffect, useState } from 'react'
import { Plate } from '@/components/site/plate'
import { cn } from '@/lib/cn'
import { COUNTDOWN_UNITS, type CountdownParts, countdownParts, countdownPlates } from '../lib/countdown'

type CountdownProps = {
  /** Inicio del partido (ISO 8601). */
  target: string
  /** Texto estático equivalente («sábado 10 de octubre de 2026, 16:00 h»): es lo que se anuncia. */
  label: string
  className?: string
}

/**
 * Cuenta regresiva al inicio del partido, en placas del marcador. El servidor dibuja las placas con «--» y
 * el mismo ancho final; el valor real se calcula después de montar: así no hay errores de hidratación ni
 * CLS (especificación 3.3). Cada placa gira cuando cambia su número. No se anuncia a lectores de pantalla:
 * en su lugar va la fecha como texto.
 */
export function Countdown({ target, label, className }: CountdownProps) {
  const [parts, setParts] = useState<CountdownParts | null>(null)

  useEffect(() => {
    const update = () => setParts(countdownParts(target, new Date()))
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [target])

  const plates = countdownPlates(parts)
  return (
    <div className={cn('inline-block', className)}>
      <p className="sr-only">Comienza el {label}.</p>
      <div aria-hidden="true" className="flex gap-1.5 md:gap-2">
        {COUNTDOWN_UNITS.map(([unit, name]) => (
          <div key={unit} className="grid justify-items-center gap-1.5">
            {/* El primer valor también gira: reemplaza a «--», que no es un número. */}
            <Plate value={plates[unit]} size="countdown" flip={parts !== null} />
            <span className="text-meta text-(--muted)">{name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
