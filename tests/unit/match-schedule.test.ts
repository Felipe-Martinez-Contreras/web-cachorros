import { describe, expect, it } from 'vitest'
import {
  clubSideOf,
  matchSlugBase,
  periodForMinute,
  roundLabelFor,
  santiagoWallTime,
  toSantiagoWallTime,
} from '@/features/matches/lib/schedule'

describe('hora de pared en Santiago', () => {
  it('convierte «sábado a las 16:00» al instante correcto en horario de verano e invierno', () => {
    // Octubre: Chile continental está en UTC-3.
    expect(santiagoWallTime('2026-10-10', '16:00').toISOString()).toBe('2026-10-10T19:00:00.000Z')
    // Junio: UTC-4.
    expect(santiagoWallTime('2026-06-13', '16:00').toISOString()).toBe('2026-06-13T20:00:00.000Z')
  })

  it('respeta el cambio de horario de abril y de septiembre de 2026', () => {
    // El sábado 4 de abril a medianoche los relojes se atrasan: el domingo 5 ya es UTC-4.
    expect(santiagoWallTime('2026-04-04', '16:00').toISOString()).toBe('2026-04-04T19:00:00.000Z')
    expect(santiagoWallTime('2026-04-05', '16:00').toISOString()).toBe('2026-04-05T20:00:00.000Z')
    // El sábado 5 de septiembre a medianoche se adelantan: el domingo 6 vuelve a UTC-3.
    expect(santiagoWallTime('2026-09-05', '16:00').toISOString()).toBe('2026-09-05T20:00:00.000Z')
    expect(santiagoWallTime('2026-09-06', '16:00').toISOString()).toBe('2026-09-06T19:00:00.000Z')
  })

  it('ida y vuelta: lo que se guarda vuelve igual al formulario', () => {
    for (const [date, time] of [
      ['2026-10-10', '16:00'],
      ['2026-04-05', '00:30'],
      ['2026-09-06', '23:45'],
      ['2027-01-01', '09:05'],
    ] as const) {
      expect(toSantiagoWallTime(santiagoWallTime(date, time))).toEqual({ date, time })
    }
  })

  it('un partido de noche en Santiago conserva su día aunque en UTC ya sea el siguiente', () => {
    const instant = santiagoWallTime('2026-10-10', '22:30')
    expect(instant.toISOString()).toBe('2026-10-11T01:30:00.000Z')
    expect(toSantiagoWallTime(instant.toISOString())).toEqual({ date: '2026-10-10', time: '22:30' })
  })
})

describe('datos derivados del partido', () => {
  it('el lado del club lo define cuál de los dos equipos es el propio', () => {
    expect(clubSideOf('club', 'rival', 'club')).toBe('local')
    expect(clubSideOf('rival', 'club', 'club')).toBe('visita')
    expect(clubSideOf('rival-a', 'rival-b', 'club')).toBe('ninguno')
    expect(clubSideOf('rival-a', 'rival-b', null)).toBe('ninguno')
  })

  it('rotula la fecha con su número salvo que se escriba un rótulo propio', () => {
    expect(roundLabelFor(5, null)).toBe('Fecha 5')
    expect(roundLabelFor(5, 'Semifinal')).toBe('Semifinal')
    expect(roundLabelFor(null, null)).toBeNull()
  })

  it('arma un slug legible con serie, año, fecha y equipos', () => {
    const base = { seriesSlug: 'honor', year: 2026, homeShortName: 'Cachorros', awayShortName: 'Los Litres' }
    expect(matchSlugBase({ ...base, roundNumber: 5, roundLabel: 'Fecha 5' })).toBe(
      'honor-2026-fecha-5-cachorros-vs-los-litres',
    )
    expect(matchSlugBase({ ...base, roundNumber: null, roundLabel: 'Semifinal de ida' })).toBe(
      'honor-2026-semifinal-de-ida-cachorros-vs-los-litres',
    )
    expect(matchSlugBase({ ...base, roundNumber: null, roundLabel: null })).toBe(
      'honor-2026-cachorros-vs-los-litres',
    )
    expect(
      matchSlugBase({ ...base, awayShortName: 'Ñublense Añejo', roundNumber: 1, roundLabel: null }),
    ).toBe('honor-2026-fecha-1-cachorros-vs-nublense-anejo')
  })

  it('deduce el período desde el minuto y la duración de cada tiempo de la serie', () => {
    expect(periodForMinute(1, 45)).toBe('primer_tiempo')
    expect(periodForMinute(45, 45)).toBe('primer_tiempo')
    expect(periodForMinute(46, 45)).toBe('segundo_tiempo')
    expect(periodForMinute(90, 45)).toBe('segundo_tiempo')
    expect(periodForMinute(95, 45)).toBe('alargue')
    // Senior 50 juega tiempos de 30 minutos: el minuto 31 ya es segundo tiempo.
    expect(periodForMinute(31, 30)).toBe('segundo_tiempo')
    expect(periodForMinute(null, 45)).toBe('primer_tiempo')
  })
})
