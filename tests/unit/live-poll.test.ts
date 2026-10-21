import { describe, expect, it } from 'vitest'
import { matchPeriod } from '@/db/schema/enums'
import type { MatchDTO, MatchEventDTO } from '@/features/matches/dto'
import {
  backoffDelay,
  etagMatches,
  fromLiveEvent,
  isWatchable,
  liveEtag,
  MAX_BACKOFF_MS,
  PERIOD_CODES,
  patchMatch,
  pollInterval,
  toLiveEvent,
} from '@/features/matches/lib/live-poll'

const NOW = Date.parse('2026-10-25T19:00:00Z')
const at = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString()

describe('intervalo del polling (especificación 2.6)', () => {
  it('20 s con un partido en vivo', () => {
    expect(pollInterval([{ status: 'en_vivo', kickoffAt: at(-30) }], NOW)).toBe(20_000)
  })

  it('60 s si uno empieza en 30 minutos o menos', () => {
    expect(pollInterval([{ status: 'programado', kickoffAt: at(25) }], NOW)).toBe(60_000)
  })

  it('sin polling si no hay nada en vivo ni por comenzar', () => {
    expect(pollInterval([], NOW)).toBeNull()
    expect(pollInterval([{ status: 'programado', kickoffAt: at(45) }], NOW)).toBeNull()
    expect(pollInterval([{ status: 'finalizado', kickoffAt: at(-100) }], NOW)).toBeNull()
  })

  it('en desarrollo se puede acortar manteniendo la proporción', () => {
    expect(pollInterval([{ status: 'en_vivo', kickoffAt: at(0) }], NOW, 2000)).toBe(2000)
    expect(pollInterval([{ status: 'programado', kickoffAt: at(10) }], NOW, 2000)).toBe(6000)
  })

  it('un partido atrasado se sigue vigilando hasta 3 horas', () => {
    expect(isWatchable({ status: 'programado', kickoffAt: at(-60) }, NOW)).toBe(true)
    expect(isWatchable({ status: 'programado', kickoffAt: at(-200) }, NOW)).toBe(false)
  })
})

describe('backoff ante errores', () => {
  it('se duplica y tiene tope', () => {
    expect(backoffDelay(20_000, 0)).toBe(20_000)
    expect(backoffDelay(20_000, 2)).toBe(80_000)
    expect(backoffDelay(20_000, 10)).toBe(MAX_BACKOFF_MS)
  })
})

describe('ETag de las respuestas en vivo', () => {
  const state = { id: '018f0000-0000-7000-8000-000000000001', version: 4, status: 'en_vivo' }

  it('cambia con la versión o el estado, y es estable sin cambios', () => {
    const etag = liveEtag([state])
    expect(etag).toMatch(/^W\/"1-[0-9a-z]+"$/)
    expect(liveEtag([state])).toBe(etag)
    expect(liveEtag([{ ...state, version: 5 }])).not.toBe(etag)
    expect(liveEtag([{ ...state, status: 'finalizado' }])).not.toBe(etag)
    expect(liveEtag([])).toBe(liveEtag([]))
  })

  it('reconoce el If-None-Match, también en una lista', () => {
    const etag = liveEtag([state])
    expect(etagMatches(etag, etag)).toBe(true)
    expect(etagMatches(`W/"otro", ${etag}`, etag)).toBe(true)
    expect(etagMatches(null, etag)).toBe(false)
    expect(etagMatches('W/"otro"', etag)).toBe(false)
  })
})

describe('eventos compactos de la API en vivo', () => {
  it('los períodos van en el orden del enum de la BD', () => {
    expect(PERIOD_CODES).toEqual(matchPeriod.enumValues)
  })

  it('ida y vuelta sin perder datos, y sin los campos vacíos', () => {
    const event: MatchEventDTO = {
      id: 'x',
      type: 'gol',
      period: 'segundo_tiempo',
      minute: 90,
      stoppageMinute: 3,
      side: 'away',
      playerName: 'Rival Uno',
      relatedPlayerName: null,
      comment: null,
    }
    const live = toLiveEvent(event)
    expect(live).toEqual({ t: 'gol', p: 3, m: 90, s: 3, d: 'a', n: 'Rival Uno' })
    expect(fromLiveEvent(live, 7)).toEqual({ ...event, id: 'en-vivo-7' })
  })

  it('un comentario sin minuto ni equipo', () => {
    const live = toLiveEvent({
      id: 'y',
      type: 'comentario',
      period: 'entretiempo',
      minute: null,
      stoppageMinute: null,
      side: null,
      playerName: null,
      relatedPlayerName: null,
      comment: 'Se juega con lluvia.',
    })
    expect(live).toEqual({ t: 'comentario', p: 2, c: 'Se juega con lluvia.' })
    expect(fromLiveEvent(live, 0)).toMatchObject({
      minute: null,
      side: null,
      comment: 'Se juega con lluvia.',
    })
  })
})

describe('estado en vivo sobre el partido de la página', () => {
  it('copia lo que cambia en el juego y conserva equipos, escudos y cancha', () => {
    const match = {
      id: 'm1',
      slug: 'honor',
      status: 'programado',
      period: 'previa',
      periodStartedAt: null,
      homeScore: 0,
      awayScore: 0,
      homePenalties: null,
      awayPenalties: null,
      home: { name: 'Cachorros', shortName: 'Cachorros', crest: null, isOwnClub: true },
      venue: { name: 'Cancha', directionsUrl: null },
    } as unknown as MatchDTO
    const patched = patchMatch(match, {
      id: 'm1',
      slug: 'honor',
      status: 'en_vivo',
      period: 'primer_tiempo',
      periodStartedAt: '2026-10-25T19:00:00.000Z',
      kickoffAt: '2026-10-25T19:00:00.000Z',
      halfLengthMinutes: 45,
      homeScore: 1,
      awayScore: 0,
      homePenalties: null,
      awayPenalties: null,
      version: 3,
    })
    expect(patched).toMatchObject({ status: 'en_vivo', period: 'primer_tiempo', homeScore: 1 })
    expect(patched.home).toBe(match.home)
    expect(patched.venue).toBe(match.venue)
  })
})
