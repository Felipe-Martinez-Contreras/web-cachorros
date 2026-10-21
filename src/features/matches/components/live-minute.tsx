'use client' // Cliente: el minuto depende de la hora y se recalcula cada pocos segundos después de montar.

import { useEffect, useState } from 'react'
import type { MatchDTO } from '../dto'
import { formatMinute, suggestedMinute } from '../lib/match-clock'

type Props = {
  match: Pick<MatchDTO, 'status' | 'period' | 'periodStartedAt' | 'halfLengthMinutes'>
  /** Desfase del reloj del dispositivo respecto del servidor (`serverNow` de /api/live). */
  serverOffsetMs?: number
}

/**
 * Minuto aproximado del partido en vivo («23'», «45+2'»). El servidor no lo dibuja (depende de la hora,
 * especificación 3.3): aparece después de montar, en un espacio de ancho fijo para no mover nada.
 */
export function LiveMinute({ match, serverOffsetMs = 0 }: Props) {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    if (match.status !== 'en_vivo' || !match.periodStartedAt) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(timer)
  }, [match.status, match.periodStartedAt])

  const minute =
    now !== null && match.status === 'en_vivo' ? suggestedMinute(match, new Date(now + serverOffsetMs)) : null
  return (
    <span className="inline-block min-w-[4ch] text-center font-bold tabular-nums" aria-hidden="true">
      {minute ? formatMinute(minute.minute, minute.stoppage) : ''}
    </span>
  )
}
