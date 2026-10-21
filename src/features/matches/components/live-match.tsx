'use client' // Cliente: mantiene al día el marcador y la cronología con el polling de /api/live/[matchId].

import { useRouter } from 'next/navigation'
import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { matchEventTypeLabels } from '@/lib/labels'
import { type LiveMatchResponse, type MatchDTO, type MatchEventDTO, scoreText } from '../dto'
import { fromLiveEvent, patchMatch, pollInterval, SOON_WINDOW_MS, toLiveEvent } from '../lib/live-poll'
import { formatMinute } from '../lib/match-clock'
import { EventTimeline } from './event-timeline'
import { LiveMinute } from './live-minute'
import { LiveBadge, Scoreboard } from './scoreboard'
import { useLivePolling } from './use-live-polling'

type LiveState = { match: MatchDTO; events: MatchEventDTO[]; offset: number }

const LiveMatchContext = createContext<LiveState | null>(null)

function useLiveMatch(): LiveState {
  const state = useContext(LiveMatchContext)
  if (!state) throw new Error('useLiveMatch va dentro de <LiveMatchProvider>.')
  return state
}

/**
 * Estado en vivo del detalle de un partido (especificación 2.6). El servidor entrega el último estado y
 * el proveedor lo actualiza mientras el partido está en vivo o por comenzar; al terminar deja de sondear y
 * pide la página de nuevo (la nómina y las notas finales vienen del servidor).
 */
export function LiveMatchProvider({
  match,
  events,
  pollBaseMs,
  children,
}: {
  match: MatchDTO
  events: MatchEventDTO[]
  pollBaseMs: number
  children: ReactNode
}) {
  const router = useRouter()
  const [state, setState] = useState<LiveState>({ match, events, offset: 0 })
  const [announcement, setAnnouncement] = useState('')
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => setState((current) => ({ ...current, match, events })), [match, events])

  const initial = useMemo<LiveMatchResponse>(
    () => ({
      serverNow: new Date().toISOString(),
      match: {
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
      },
      events: events.map(toLiveEvent),
    }),
    [match, events],
  )

  useLivePolling<LiveMatchResponse>(`/api/live/${match.id}`, {
    initial,
    intervalFor: (data, now) => pollInterval([data.match], now, pollBaseMs),
    wakeAt: (data) => {
      if (data.match.status !== 'programado') return null
      const at = Date.parse(data.match.kickoffAt) - SOON_WINDOW_MS
      return at > Date.now() ? at : null
    },
    onData: (data, offset) => {
      const before = stateRef.current
      const next: LiveState = {
        match: patchMatch(before.match, data.match),
        events: data.events.map(fromLiveEvent),
        offset,
      }
      if (next.events.length > before.events.length) {
        const newest = next.events.at(-1)
        const goal =
          next.match.homeScore !== before.match.homeScore || next.match.awayScore !== before.match.awayScore
        if (goal) setAnnouncement(`Gol. ${scoreText(next.match)}.`)
        else if (newest) {
          setAnnouncement(
            `${matchEventTypeLabels[newest.type]} ${formatMinute(newest.minute, newest.stoppageMinute)}.`,
          )
        }
      } else if (
        next.match.homeScore !== before.match.homeScore ||
        next.match.awayScore !== before.match.awayScore
      ) {
        setAnnouncement(`Marcador corregido. ${scoreText(next.match)}.`)
      }
      setState(next)
      // Al terminar (o suspenderse) la página pasa a su versión final, que trae el servidor.
      if (before.match.status === 'en_vivo' && next.match.status !== 'en_vivo') router.refresh()
      if (before.match.status !== 'en_vivo' && next.match.status === 'en_vivo') router.refresh()
    },
  })

  return (
    <LiveMatchContext.Provider value={state}>
      {children}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </LiveMatchContext.Provider>
  )
}

/** Insignia EN VIVO y marcador del encabezado, al día. */
export function LiveMatchScore() {
  const { match, offset } = useLiveMatch()
  return (
    <>
      {match.status === 'en_vivo' && (
        <div className="flex justify-center">
          <LiveBadge />
        </div>
      )}
      <Scoreboard match={match} size="lg" minute={<LiveMinute match={match} serverOffsetMs={offset} />} />
    </>
  )
}

/** Cronología del partido, al día; no se muestra mientras no haya eventos. */
export function LiveMatchTimeline({ title }: { title: ReactNode }) {
  const { match, events } = useLiveMatch()
  if (events.length === 0) return null
  return (
    <section aria-labelledby="cronologia" className="grid gap-4">
      <h2 id="cronologia" className="text-h2 uppercase">
        {title}
      </h2>
      <EventTimeline events={events} homeName={match.home.shortName} awayName={match.away.shortName} />
    </section>
  )
}
