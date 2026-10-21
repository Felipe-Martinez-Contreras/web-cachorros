'use client' // Cliente: actualiza la franja de la portada con el polling de /api/live/current.

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  type LiveCurrentResponse,
  type LiveMatchStateDTO,
  type MatchDTO,
  type MatchdayDTO,
  scoreText,
} from '../dto'
import { patchMatch, pollInterval, SOON_WINDOW_MS } from '../lib/live-poll'
import { LiveMinute } from './live-minute'
import { MatchdayStrip } from './matchday-strip'
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

/**
 * Franja matchday con polling (especificación 2.6): el servidor la dibuja con el último estado y esta isla
 * la mantiene al día sin recargar. Si un partido empieza o termina, la franja cambia de forma (en vivo ↔
 * próximo ↔ último resultado): se pide al servidor de nuevo con `router.refresh()`.
 */
export function LiveMatchday({
  matchday,
  pollBaseMs,
  className,
}: {
  matchday: MatchdayDTO
  pollBaseMs: number
  className?: string
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

  return (
    <>
      <MatchdayStrip
        matchday={view}
        className={className}
        renderMinute={(match) => <LiveMinute match={match} serverOffsetMs={offset} />}
      />
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </>
  )
}
