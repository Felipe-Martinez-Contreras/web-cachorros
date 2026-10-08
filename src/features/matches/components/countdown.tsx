'use client' // Cliente: la cuenta regresiva depende de la hora del dispositivo y se actualiza cada segundo.

import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { type CountdownParts, countdownParts } from '../lib/countdown'

type CountdownProps = {
  /** Inicio del partido (ISO 8601). */
  target: string
  /** Texto estático equivalente («sábado 10 de octubre de 2026, 16:00 h»): es lo que se anuncia. */
  label: string
  className?: string
}

const UNITS = [
  ['days', 'días'],
  ['hours', 'hrs'],
  ['minutes', 'min'],
  ['seconds', 'seg'],
] as const

/**
 * Cuenta regresiva al inicio del partido. El servidor renderiza los casilleros vacíos («--») con el mismo
 * tamaño final y el valor real se calcula después de montar: así no hay errores de hidratación ni CLS
 * (especificación 3.3). No se anuncia a lectores de pantalla: en su lugar va la fecha como texto.
 */
export function Countdown({ target, label, className }: CountdownProps) {
  const [parts, setParts] = useState<CountdownParts | null>(null)

  useEffect(() => {
    const update = () => setParts(countdownParts(target, new Date()))
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [target])

  return (
    <div className={cn('inline-block', className)}>
      <p className="sr-only">Comienza el {label}.</p>
      <div aria-hidden="true" className="grid grid-cols-4 gap-2 text-center">
        {UNITS.map(([unit, name]) => (
          <div key={unit} className="grid min-w-14 gap-1 rounded-md bg-(--fg)/8 px-2 py-2">
            <span className="font-tight text-3xl font-black tabular-nums [font-stretch:62.5%] md:text-4xl">
              {parts ? String(parts[unit]).padStart(2, '0') : '--'}
            </span>
            <span className="text-[0.6875rem] font-semibold tracking-wider text-(--muted) uppercase">
              {name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
