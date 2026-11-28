'use client' // Cliente: mantiene al día las placas de la portada con el polling de /api/live/current.

import { useRouter } from 'next/navigation'
import { createContext, type ReactNode, use, useEffect, useMemo, useRef, useState } from 'react'
import {
  type LiveCurrentResponse,
  type LiveMatchStateDTO,
  type MatchDTO,
  type MatchdayDTO,
  scoreText,
} from '../dto'
import { patchMatch, pollInterval, SOON_WINDOW_MS } from '../lib/live-poll'
import { useLivePolling } from './use-live-polling'

/** Partidos de la franja que interesan al polling. */
function watchedMatches(matchday: MatchdayDTO): MatchDTO[] {
  if (matchday.kind === 'live') return matchday.matches
  if (matchday.kind === 'next') return [matchday.match, ...matchday.alsoToday]
  return []
}

function toState(match: MatchDTO): LiveMatchStateDTO {
  return {
    id: match.id,
    slug: match.slug,
    status: match.status,
    period: match.period,
    periodStartedAt: match.periodStartedAt,
    kickoffAt: match.kickoffAt,
    halfLengthMinutes: match.halfLengthMinutes,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    homePenalties: match.homePenalties,
    awayPenalties: match.awayPenalties,
    version: 0,
  }
}

function patchMatchday(matchday: MatchdayDTO, byId: Map<string, LiveMatchStateDTO>): MatchdayDTO {
  const patch = (match: MatchDTO) => {
    const state = byId.get(match.id)
    return state ? patchMatch(match, state) : match
  }
  if (matchday.kind === 'live') return { kind: 'live', matches: matchday.matches.map(patch) }
  if (matchday.kind === 'next') {
    return { kind: 'next', match: patch(matchday.match), alsoToday: matchday.alsoToday.map(patch) }
  }
  return matchday
}

type LiveMatchdayState = {
  /** La franja tal como llegó del servidor (las placas no giran con ese valor). */
  initial: MatchdayDTO
  /** La franja al día. */
  view: MatchdayDTO
  /** Desfase del reloj del dispositivo respecto del servidor. */
  offset: number
}

const LiveMatchdayContext = createContext<LiveMatchdayState | null>(null)

/** Estado de la franja para las islas que la muestran (las placas del hero y la tarjeta de abajo). */
export function useLiveMatchday(): LiveMatchdayState {
  const state = use(LiveMatchdayContext)
  if (!state) throw new Error('useLiveMatchday va dentro de <LiveMatchdayProvider>')
  return state
}

/**
 * Polling de la franja matchday (especificación 2.6): el servidor la dibuja con el último estado y este
 * proveedor la mantiene al día sin recargar, con una sola consulta para el hero y la tarjeta. Si un partido
 * empieza o termina, la franja cambia de forma (en vivo ↔ próximo ↔ último resultado): se pide al servidor
 * de nuevo con `router.refresh()`. El contenido que envuelve puede ser de servidor.
 */
export function LiveMatchdayProvider({
  matchday,
  pollBaseMs,
  children,
}: {
  matchday: MatchdayDTO
  pollBaseMs: number
  children: ReactNode
}) {
  const router = useRouter()
  const [view, setView] = useState(matchday)
  const [offset, setOffset] = useState(0)
  const [announcement, setAnnouncement] = useState('')
  const viewRef = useRef(view)
  viewRef.current = view

  // Tras `router.refresh()` llega la franja nueva desde el servidor.
  useEffect(() => setView(matchday), [matchday])

  const initial = useMemo<LiveCurrentResponse>(
    () => ({ serverNow: new Date().toISOString(), matches: watchedMatches(matchday).map(toState) }),
    [matchday],
  )

  useLivePolling<LiveCurrentResponse>('/api/live/current', {
    initial,
    intervalFor: (data, now) => pollInterval(data.matches, now, pollBaseMs),
    // Un próximo partido a más de 30 minutos: se vuelve a mirar cuando entre en la ventana.
    wakeAt: () => {
      const starts = watchedMatches(viewRef.current)
        .filter((match) => match.status === 'programado')
        .map((match) => Date.parse(match.kickoffAt) - SOON_WINDOW_MS)
        .filter((at) => at > Date.now())
      return starts.length > 0 ? Math.min(...starts) : null
    },
    onData: (data, serverOffsetMs) => {
      setOffset(serverOffsetMs)
      const byId = new Map(data.matches.map((state) => [state.id, state]))
      const current = viewRef.current
      const shown = watchedMatches(current)
      const liveNow = data.matches.filter((state) => state.status === 'en_vivo').map((state) => state.id)
      const liveShown = current.kind === 'live' ? shown.map((match) => match.id) : []
      const changedShape =
        liveNow.length !== liveShown.length || liveNow.some((id) => !liveShown.includes(id))
      if (changedShape) {
        router.refresh()
        return
      }
      const next = patchMatchday(current, byId)
      for (const match of watchedMatches(next)) {
        const before = shown.find((old) => old.id === match.id)
        if (before && (before.homeScore !== match.homeScore || before.awayScore !== match.awayScore)) {
          setAnnouncement(`Gol. ${scoreText(match)}.`)
        }
      }
      setView(next)
    },
  })

  const state = useMemo(() => ({ initial: matchday, view, offset }), [matchday, view, offset])
  return (
    <LiveMatchdayContext value={state}>
      {children}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </LiveMatchdayContext>
  )
}
