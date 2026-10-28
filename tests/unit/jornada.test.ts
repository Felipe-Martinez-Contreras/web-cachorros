import { describe, expect, it } from 'vitest'
import { santiagoWallTime } from '@/features/matches/lib/schedule'
import type { CardMatch, JornadaCardData } from '@/features/share/dto'
import { jornadaCardVersion, parseShareRequest, seriesBandLayout } from '@/features/share/lib/cards'
import {
  encodeSeries,
  groupJornadas,
  jornadaKey,
  jornadaStart,
  parseJornadaKey,
  parseSeries,
  selectJornadaMatches,
  weekendCardFor,
} from '@/features/share/lib/jornada'
import { jornadaCaption } from '@/features/social-publishing/lib/caption'

const RIVAL = '01a15f15-bb07-7e50-b715-4482a6b29aef'
const OTHER = '01a15f15-bb07-7e50-b715-4482a6b29af0'
const S = {
  tercera: '0b000000-0000-4000-8000-000000000001',
  segunda: '0b000000-0000-4000-8000-000000000002',
  juvenil: '0b000000-0000-4000-8000-000000000003',
  senior: '0b000000-0000-4000-8000-000000000004',
  honor: '0b000000-0000-4000-8000-000000000005',
}

const at = (day: string, time: string) => santiagoWallTime(day, time)
let next = 0
const row = (seriesId: string, kickoffAt: Date, rivalId = RIVAL, seriesOrder = 0) => ({
  id: `m${++next}`,
  kickoffAt,
  rivalId,
  seriesId,
  seriesOrder,
  status: 'programado',
})

describe('clave de la jornada', () => {
  it('fecha y rival, y solo acepta fechas que existen', () => {
    const key = jornadaKey('2026-10-31', RIVAL.toUpperCase())
    expect(key).toBe(`2026-10-31_${RIVAL}`)
    expect(parseJornadaKey(key)).toEqual({ date: '2026-10-31', rivalId: RIVAL })
    expect(parseJornadaKey(`2026-02-30_${RIVAL}`)).toBeNull()
    expect(parseJornadaKey('2026-10-31')).toBeNull()
    expect(parseJornadaKey(`2026-10-31_${RIVAL}x`)).toBeNull()
  })

  it('la ruta de tarjetas acepta la plantilla «jornada» solo con una clave válida', () => {
    expect(parseShareRequest('jornada', `2026-10-31_${RIVAL}`, 'vertical')).toEqual({
      template: 'jornada',
      id: `2026-10-31_${RIVAL}`,
      format: 'vertical',
    })
    expect(parseShareRequest('jornada', RIVAL, 'vertical')).toBeNull()
    expect(parseShareRequest('jornada', '2026-10-31', 'og')).toBeNull()
  })
})

describe('agrupación por día y rival', () => {
  it('agrupa por día en Santiago (no en UTC) y por rival, en orden de juego', () => {
    const rows = [
      row(S.honor, at('2026-10-31', '15:30')),
      row(S.tercera, at('2026-10-31', '10:00')),
      // 22:30 del sábado en Chile ya es domingo en UTC: sigue siendo la jornada del sábado.
      row(S.senior, at('2026-10-31', '22:30')),
      row(S.juvenil, at('2026-10-31', '12:00'), OTHER),
      row(S.segunda, at('2026-11-01', '00:30')),
    ]
    const jornadas = groupJornadas(rows)
    expect(jornadas.map((jornada) => [jornada.key, jornada.matches.length])).toEqual([
      [`2026-10-31_${RIVAL}`, 3],
      [`2026-10-31_${OTHER}`, 1],
      [`2026-11-01_${RIVAL}`, 1],
    ])
    expect(jornadas[0]?.matches.map((match) => match.seriesId)).toEqual([S.tercera, S.honor, S.senior])
  })

  it('a la misma hora desempata el orden de la serie', () => {
    const rows = [
      row(S.honor, at('2026-10-31', '10:00'), RIVAL, 5),
      row(S.tercera, at('2026-10-31', '10:00'), RIVAL, 1),
    ]
    expect(groupJornadas(rows)[0]?.matches.map((match) => match.seriesId)).toEqual([S.tercera, S.honor])
  })
})

describe('series marcadas y hora de inicio', () => {
  const matches = [
    row(S.tercera, at('2026-10-31', '10:00')),
    row(S.segunda, at('2026-10-31', '11:45')),
    row(S.juvenil, at('2026-10-31', '13:30')),
    row(S.honor, at('2026-10-31', '15:30')),
  ]

  it('sin selección van todas; con selección, solo las marcadas en orden de juego', () => {
    expect(selectJornadaMatches(matches, null)).toHaveLength(4)
    expect(selectJornadaMatches(matches, [S.honor, S.segunda]).map((match) => match.seriesId)).toEqual([
      S.segunda,
      S.honor,
    ])
    expect(selectJornadaMatches(matches, [S.senior])).toEqual([])
  })

  it('la hora de inicio es la del primer partido marcado', () => {
    expect(jornadaStart(matches)).toBe(at('2026-10-31', '10:00').toISOString())
    expect(jornadaStart(selectJornadaMatches(matches, [S.juvenil, S.honor]))).toBe(
      at('2026-10-31', '13:30').toISOString(),
    )
    expect(jornadaStart([])).toBeNull()
  })

  it('caben hasta 6 series', () => {
    const many = Array.from({ length: 8 }, (_, index) =>
      row(`0c000000-0000-4000-8000-00000000000${index}`, at('2026-10-31', `1${index}:00`)),
    )
    expect(selectJornadaMatches(many, null)).toHaveLength(6)
  })

  it('las series viajan en la dirección y se validan al leerlas', () => {
    expect(encodeSeries([S.honor, S.honor.toUpperCase(), S.tercera])).toBe(`${S.honor},${S.tercera}`)
    expect(parseSeries(`${S.honor},${S.tercera}`)).toEqual([S.honor, S.tercera])
    expect(parseSeries('')).toBeNull()
    expect(parseSeries('no-es-un-id')).toBeNull()
    expect(parseSeries(Object.values(S).concat(RIVAL, OTHER).join(','))).toBeNull()
  })
})

describe('tarjeta del fin de semana', () => {
  it('un partido: su previa; una sola jornada: la jornada; varios rivales o días: la grilla', () => {
    expect(weekendCardFor([])).toBeNull()
    expect(weekendCardFor([row(S.honor, at('2026-10-31', '15:30'))])).toEqual({
      card: 'proximo',
      jornadaKey: null,
    })
    const jornada = [row(S.tercera, at('2026-10-31', '10:00')), row(S.honor, at('2026-10-31', '15:30'))]
    expect(weekendCardFor(jornada)).toEqual({ card: 'jornada', jornadaKey: `2026-10-31_${RIVAL}` })
    expect(weekendCardFor([...jornada, row(S.juvenil, at('2026-10-31', '12:00'), OTHER)])).toMatchObject({
      card: 'programacion',
    })
    expect(weekendCardFor([...jornada, row(S.juvenil, at('2026-11-01', '12:00'))])).toMatchObject({
      card: 'programacion',
    })
    // Un partido postergado no cabe en la jornada: sale la grilla, que lo muestra como postergado.
    expect(
      weekendCardFor([...jornada, { ...row(S.juvenil, at('2026-10-31', '12:00')), status: 'postergado' }]),
    ).toMatchObject({ card: 'programacion' })
  })
})

describe('versión de la tarjeta', () => {
  const a = { id: 'a', version: 1 }
  const b = { id: 'b', version: 3 }

  it('cambia con las series marcadas, con un cambio en un partido y con las fotos', () => {
    const base = jornadaCardVersion([a, b], 'x1')
    expect(jornadaCardVersion([a, b], 'x1')).toBe(base)
    expect(jornadaCardVersion([b], 'x1')).not.toBe(base)
    expect(jornadaCardVersion([a, { ...b, version: 4 }], 'x1')).not.toBe(base)
    expect(jornadaCardVersion([a, b], 'x2')).not.toBe(base)
    expect(base).toMatch(/^[0-9a-z]{1,16}$/)
    expect(base.endsWith('j3')).toBe(true)
  })
})

describe('banda de series', () => {
  it('nunca corta un nombre y reparte las líneas parejas', () => {
    const five = ['Tercera', 'Segunda', 'Juvenil', 'Senior', 'Honor']
    const layout = seriesBandLayout(five, 930, 86, 52)
    expect(layout.lines.flat()).toEqual(five.map((name) => name.toUpperCase()))
    expect(layout.lines).toHaveLength(2)
    expect(layout.size).toBeGreaterThanOrEqual(52)
  })

  it('pocas series van en una sola línea', () => {
    expect(seriesBandLayout(['Juvenil', 'Senior', 'Honor'], 930, 104, 64).lines).toEqual([
      ['JUVENIL', 'SENIOR', 'HONOR'],
    ])
  })
})

describe('texto de la jornada', () => {
  const team = (name: string) => ({ name, crest: null })
  const match: CardMatch = {
    clubSide: 'local',
    home: team('Cachorros'),
    away: team('Deportivo Ejemplo [COMPLETAR: nombre corto]'),
    seriesName: 'Tercera',
    competitionName: 'Campeonato de ejemplo',
    roundLabel: 'Fecha 7',
    kickoffAt: at('2026-10-31', '10:00').toISOString(),
    venueName: 'Cancha de ejemplo',
    status: 'programado',
    resolution: 'normal',
    homeScore: 0,
    awayScore: 0,
    homePenalties: null,
    awayPenalties: null,
  }
  const data: JornadaCardData = {
    kind: 'jornada',
    template: 'jornada',
    clubName: 'Club',
    match,
    series: ['Tercera', 'Segunda', 'Juvenil', 'Senior', 'Honor'],
    matchday: { topLine: null, photoSources: [], photos: [] },
  }

  it('rival, fecha, hora de inicio, cancha, series y competencia', () => {
    expect(jornadaCaption(data, 'https://club.example/partidos')).toBe(
      [
        '⚽ Jornada · Cachorros vs Deportivo Ejemplo',
        '',
        '📅 Sábado 31 de octubre, desde las 10:00 h',
        '📍 Cancha de ejemplo (local)',
        'Series: Tercera · Segunda · Juvenil · Senior · Honor',
        'Campeonato de ejemplo',
        '',
        'Todos los partidos: https://club.example/partidos',
      ].join('\n'),
    )
  })

  it('de visita sin cancha y con varias competencias', () => {
    const text = jornadaCaption(
      { ...data, match: { ...match, clubSide: 'visita', venueName: null, competitionName: '' } },
      'https://club.example/partidos',
      'Jornada del fin de semana',
    )
    expect(text).toMatch(/^⚽ Jornada del fin de semana · /)
    expect(text).toContain('📍 De visita')
    expect(text).not.toContain('Campeonato')
  })
})
