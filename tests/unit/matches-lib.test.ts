import { describe, expect, it } from 'vitest'
import {
  calendarDaysUntil,
  countdownParts,
  relativeDayLabel,
  santiagoDateTime,
  startOfSantiagoDay,
} from '@/features/matches/lib/countdown'
import { compareEvents, formatMinute, suggestedMinute } from '@/features/matches/lib/match-clock'
import {
  clubOutcome,
  derivePenaltyShootout,
  deriveScore,
  type ScoringEvent,
} from '@/features/matches/lib/score'
import { compactStandings, computeStandings, rankStandings } from '@/features/matches/lib/standings'

const sides = { homeTeamId: 'local', awayTeamId: 'visita' }

/** Generador determinista (mulberry32) para las pruebas con datos aleatorios. */
function prng(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('marcador derivado', () => {
  it('suma goles y penales al equipo del autor y el autogol al contrario', () => {
    const events: ScoringEvent[] = [
      { type: 'gol', teamId: 'local' },
      { type: 'gol_penal', teamId: 'local' },
      { type: 'autogol', teamId: 'local' },
      { type: 'gol', teamId: 'visita' },
      { type: 'autogol', teamId: 'visita' },
    ]
    expect(deriveScore(events, sides)).toEqual({ home: 3, away: 2 })
  })

  it('ignora lo que no es gol y los eventos sin equipo o de otro equipo', () => {
    const events: ScoringEvent[] = [
      { type: 'penal_errado', teamId: 'local' },
      { type: 'tarjeta_amarilla', teamId: 'local' },
      { type: 'cambio', teamId: 'visita' },
      { type: 'comentario', teamId: null },
      { type: 'gol', teamId: null },
      { type: 'gol', teamId: 'otro' },
    ]
    expect(deriveScore(events, sides)).toEqual({ home: 0, away: 0 })
  })

  it('no cuenta en el marcador los lanzamientos de la definición por penales', () => {
    const events: ScoringEvent[] = [
      { type: 'gol', teamId: 'local', period: 'segundo_tiempo' },
      { type: 'gol', teamId: 'visita', period: 'primer_tiempo' },
      { type: 'gol_penal', teamId: 'local', period: 'penales' },
      { type: 'gol_penal', teamId: 'local', period: 'penales' },
      { type: 'gol_penal', teamId: 'visita', period: 'penales' },
      { type: 'penal_errado', teamId: 'visita', period: 'penales' },
      { type: 'gol_penal', teamId: 'otro', period: 'penales' },
    ]
    expect(deriveScore(events, sides)).toEqual({ home: 1, away: 1 })
    expect(derivePenaltyShootout(events, sides)).toEqual({ home: 2, away: 1 })
  })

  it('con datos aleatorios, el marcador siempre es la suma de los eventos de gol', () => {
    const random = prng(1934)
    const types = ['gol', 'gol_penal', 'autogol', 'penal_errado', 'tarjeta_amarilla', 'cambio'] as const
    for (let round = 0; round < 200; round++) {
      const events: ScoringEvent[] = []
      const expected = { home: 0, away: 0 }
      const count = Math.floor(random() * 30)
      for (let i = 0; i < count; i++) {
        const type = types[Math.floor(random() * types.length)] ?? 'gol'
        const isHome = random() < 0.5
        events.push({ type, teamId: isHome ? 'local' : 'visita' })
        if (type === 'gol' || type === 'gol_penal') expected[isHome ? 'home' : 'away'] += 1
        if (type === 'autogol') expected[isHome ? 'away' : 'home'] += 1
      }
      expect(deriveScore(events, sides)).toEqual(expected)
    }
  })

  it('entrega el resultado desde el punto de vista del club', () => {
    expect(clubOutcome({ home: 2, away: 1 }, 'local')).toBe('ganado')
    expect(clubOutcome({ home: 2, away: 1 }, 'visita')).toBe('perdido')
    expect(clubOutcome({ home: 1, away: 1 }, 'visita')).toBe('empatado')
    expect(clubOutcome({ home: 1, away: 1 }, 'ninguno')).toBeNull()
  })
})

describe('tabla de posiciones', () => {
  const rule = { pointsWin: 3, pointsDraw: 1 }

  it('calcula PJ, DIF y PTS desde los resultados, incluidos los partidos entre rivales', () => {
    const table = computeStandings(
      [
        { homeTeamId: 'a', awayTeamId: 'b', homeScore: 2, awayScore: 0 },
        { homeTeamId: 'b', awayTeamId: 'c', homeScore: 1, awayScore: 1 },
        { homeTeamId: 'c', awayTeamId: 'a', homeScore: 3, awayScore: 1 },
      ],
      rule,
    )
    expect(table.map((r) => [r.position, r.teamId, r.played, r.goalDiff, r.points])).toEqual([
      [1, 'c', 2, 2, 4],
      [2, 'a', 2, 0, 3],
      [3, 'b', 2, -2, 1],
    ])
    expect(table[0]).toMatchObject({ won: 1, drawn: 1, lost: 0, goalsFor: 4, goalsAgainst: 2 })
  })

  it('desempata por PTS, DIF, GF y luego por la posición manual', () => {
    const base = { won: 1, drawn: 0, lost: 0, goalsAgainst: 0 }
    const table = rankStandings(
      [
        { teamId: 'menos-goles', ...base, goalsFor: 2, goalsAgainst: 1 },
        { teamId: 'manual-2', ...base, goalsFor: 3, goalsAgainst: 1, manualPosition: 2 },
        { teamId: 'manual-1', ...base, goalsFor: 3, goalsAgainst: 1, manualPosition: 1 },
        { teamId: 'mejor-dif', ...base, goalsFor: 3 },
        { teamId: 'sin-manual', ...base, goalsFor: 3, goalsAgainst: 1 },
        { teamId: 'lider', won: 2, drawn: 0, lost: 0, goalsFor: 2, goalsAgainst: 0 },
      ],
      rule,
    )
    expect(table.map((r) => r.teamId)).toEqual([
      'lider',
      'mejor-dif',
      'manual-1',
      'manual-2',
      'sin-manual',
      'menos-goles',
    ])
  })

  it('aplica ajustes de puntos y agrega a los equipos que aún no juegan', () => {
    const table = computeStandings([{ homeTeamId: 'a', awayTeamId: 'b', homeScore: 1, awayScore: 0 }], rule, {
      teamIds: ['a', 'b', 'c'],
      adjustments: [{ teamId: 'a', pointsAdjustment: -3 }, { teamId: 'd' }],
    })
    expect(table.find((r) => r.teamId === 'a')).toMatchObject({ points: 0, pointsAdjustment: -3 })
    expect(table.find((r) => r.teamId === 'c')).toMatchObject({ played: 0, points: 0 })
    expect(table).toHaveLength(4)
  })

  it('respeta los puntos de la competencia', () => {
    const [first] = computeStandings([{ homeTeamId: 'a', awayTeamId: 'b', homeScore: 1, awayScore: 0 }], {
      pointsWin: 2,
      pointsDraw: 1,
    })
    expect(first?.points).toBe(2)
  })

  it('la mini-tabla muestra el top 5 y agrega la fila del club si quedó fuera', () => {
    const rows = rankStandings(
      Array.from({ length: 8 }, (_, i) => ({
        teamId: `equipo-${i}`,
        won: 8 - i,
        drawn: 0,
        lost: i,
        goalsFor: 8 - i,
        goalsAgainst: i,
      })),
      rule,
    )
    expect(compactStandings(rows, 'equipo-1').map((r) => r.position)).toEqual([1, 2, 3, 4, 5])
    expect(compactStandings(rows, 'equipo-6').map((r) => r.position)).toEqual([1, 2, 3, 4, 5, 7])
    expect(compactStandings(rows, 'no-existe')).toHaveLength(5)
  })
})

describe('reloj del partido', () => {
  const start = '2026-10-10T19:00:00Z'
  const at = (minutes: number) => new Date(new Date(start).getTime() + minutes * 60_000)

  it('sugiere el minuto en curso durante el primer tiempo', () => {
    const input = { period: 'primer_tiempo', periodStartedAt: start, halfLengthMinutes: 45 } as const
    expect(suggestedMinute(input, at(0))).toEqual({ minute: 1, stoppage: 0 })
    expect(suggestedMinute(input, at(22.5))).toEqual({ minute: 23, stoppage: 0 })
    expect(suggestedMinute(input, at(44.9))).toEqual({ minute: 45, stoppage: 0 })
  })

  it('expresa la adición como 45+2', () => {
    const input = { period: 'primer_tiempo', periodStartedAt: start, halfLengthMinutes: 45 } as const
    expect(suggestedMinute(input, at(46.2))).toEqual({ minute: 45, stoppage: 2 })
  })

  it('usa la duración del tiempo de la serie en el segundo tiempo', () => {
    const input = { period: 'segundo_tiempo', periodStartedAt: start, halfLengthMinutes: 35 } as const
    expect(suggestedMinute(input, at(9.5))).toEqual({ minute: 45, stoppage: 0 })
    expect(suggestedMinute(input, at(37))).toEqual({ minute: 70, stoppage: 3 })
  })

  it('continúa la cuenta en el alargue', () => {
    const input = { period: 'alargue', periodStartedAt: start, halfLengthMinutes: 45 } as const
    expect(suggestedMinute(input, at(4.5))).toEqual({ minute: 95, stoppage: 0 })
  })

  it('no sugiere minuto fuera del juego, sin hora de inicio o con el reloj del celular atrasado', () => {
    expect(
      suggestedMinute({ period: 'entretiempo', periodStartedAt: start, halfLengthMinutes: 45 }, at(5)),
    ).toBeNull()
    expect(
      suggestedMinute({ period: 'primer_tiempo', periodStartedAt: null, halfLengthMinutes: 45 }, at(5)),
    ).toBeNull()
    expect(
      suggestedMinute({ period: 'primer_tiempo', periodStartedAt: start, halfLengthMinutes: 45 }, at(-3)),
    ).toEqual({ minute: 1, stoppage: 0 })
  })

  it('formatea el minuto', () => {
    expect(formatMinute(23)).toBe("23'")
    expect(formatMinute(45, 2)).toBe("45+2'")
    expect(formatMinute(90, 0)).toBe("90'")
    expect(formatMinute(null)).toBe('')
  })

  it('ordena los eventos por período, minuto, adición y orden de registro', () => {
    const event = (
      id: string,
      period: 'primer_tiempo' | 'segundo_tiempo',
      minute: number | null,
      extra = 0,
    ) => ({
      id,
      period,
      minute,
      stoppageMinute: extra || null,
      createdAt: `2026-10-10T19:00:0${id.length}Z`,
    })
    const events = [
      event('ccc', 'segundo_tiempo', 46),
      event('bbbb', 'primer_tiempo', 45, 2),
      event('bb', 'primer_tiempo', 45, 2),
      event('b', 'primer_tiempo', 45),
      event('a', 'primer_tiempo', null),
    ]
    expect(events.sort(compareEvents).map((e) => e.id)).toEqual(['a', 'b', 'bb', 'bbbb', 'ccc'])
  })
})

describe('cuenta regresiva en America/Santiago', () => {
  it('descompone el tiempo que falta', () => {
    expect(countdownParts('2026-10-10T19:00:00Z', new Date('2026-10-08T15:29:30Z'))).toEqual({
      days: 2,
      hours: 3,
      minutes: 30,
      seconds: 30,
      isPast: false,
    })
  })

  it('marca como pasado un partido que ya debió comenzar', () => {
    expect(countdownParts('2026-10-10T19:00:00Z', new Date('2026-10-10T19:00:00Z')).isPast).toBe(true)
    expect(countdownParts(new Date('2026-10-10T19:00:00Z'), new Date('2026-10-11T00:00:00Z'))).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isPast: true,
    })
  })

  // Chile atrasa el reloj la noche del primer sábado de abril (UTC−3 → UTC−4)…
  it('en el cambio a horario de invierno, «mañana a la misma hora» son 25 horas', () => {
    const now = santiagoDateTime(new Date('2026-04-04T15:00:00Z'), 0, 16) // sábado 4 de abril, 16:00
    const kickoff = santiagoDateTime(now, 1, 16) // domingo 5 de abril, 16:00
    expect(now.toISOString()).toBe('2026-04-04T19:00:00.000Z')
    expect(kickoff.toISOString()).toBe('2026-04-05T20:00:00.000Z')
    expect(countdownParts(kickoff, now)).toMatchObject({ days: 1, hours: 1, minutes: 0 })
    expect(calendarDaysUntil(kickoff, now)).toBe(1)
    expect(relativeDayLabel(kickoff, now)).toBe('Mañana')
  })

  // …y lo adelanta la noche del primer sábado de septiembre (UTC−4 → UTC−3).
  it('en el cambio a horario de verano, «mañana a la misma hora» son 23 horas', () => {
    const now = santiagoDateTime(new Date('2026-09-05T15:00:00Z'), 0, 16) // sábado 5 de septiembre, 16:00
    const kickoff = santiagoDateTime(now, 1, 16) // domingo 6 de septiembre, 16:00
    expect(now.toISOString()).toBe('2026-09-05T20:00:00.000Z')
    expect(kickoff.toISOString()).toBe('2026-09-06T19:00:00.000Z')
    expect(countdownParts(kickoff, now)).toMatchObject({ days: 0, hours: 23, minutes: 0 })
    expect(calendarDaysUntil(kickoff, now)).toBe(1)
  })

  it('cuenta días de calendario de Santiago, no bloques de 24 horas ni días UTC', () => {
    // 23:30 del viernes en Santiago ya es sábado en UTC.
    const now = new Date('2026-10-10T02:30:00Z')
    expect(calendarDaysUntil('2026-10-10T03:30:00Z', now)).toBe(1) // 00:30 del sábado: mañana
    expect(relativeDayLabel('2026-10-10T02:45:00Z', now)).toBe('Hoy')
    expect(relativeDayLabel('2026-10-12T19:00:00Z', now)).toBe('En 3 días')
    expect(relativeDayLabel('2026-10-08T19:00:00Z', now)).toBe('Ayer')
    expect(relativeDayLabel('2026-10-05T19:00:00Z', now)).toBe('Hace 4 días')
  })

  it('calcula el inicio del día en Santiago', () => {
    const now = new Date('2026-10-10T02:30:00Z') // viernes 9, 23:30
    expect(startOfSantiagoDay(now).toISOString()).toBe('2026-10-09T03:00:00.000Z')
    expect(startOfSantiagoDay(now, 1).toISOString()).toBe('2026-10-10T03:00:00.000Z')
    expect(santiagoDateTime(now, -1, 10, 30).toISOString()).toBe('2026-10-08T13:30:00.000Z')
  })
})
