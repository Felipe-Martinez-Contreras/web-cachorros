import { describe, expect, it } from 'vitest'
import { isMinor, publicPlayerName } from '@/features/players/lib/is-minor'
import { tags } from '@/lib/cache-tags'
import { fixedClock, systemClock } from '@/lib/clock'
import {
  formatClp,
  formatDayMonth,
  formatDayMonthNumeric,
  formatLongDate,
  formatLongDateTime,
  formatMatchDate,
  formatNumber,
  formatPhone,
  formatShortDate,
  formatTime,
  fromIsoDate,
  toIsoDate,
  whatsappNumber,
  yearsBetween,
} from '@/lib/format'
import { matchStatusLabels, weekdayLabels } from '@/lib/labels'
import { cleanRut, formatRut, isValidRut, rutCheckDigit } from '@/lib/rut'
import { slugify, uniqueSlug } from '@/lib/slug'

describe('isMinor', () => {
  const today = '2026-10-07'
  const adulta = { containsMinors: false }
  const juvenil = { containsMinors: true }

  it('con fecha de nacimiento, decide por la edad', () => {
    expect(isMinor({ birthDate: '2008-10-08' }, [adulta], today)).toBe(true) // cumple 18 mañana
    expect(isMinor({ birthDate: '2008-10-07' }, [adulta], today)).toBe(false) // cumple 18 hoy
    expect(isMinor({ birthDate: '1990-01-15' }, [juvenil], today)).toBe(false)
  })

  it('un juvenil inscrito en una serie adulta sigue siendo menor', () => {
    expect(isMinor({ birthDate: '2010-03-01' }, [adulta], today)).toBe(true)
    expect(isMinor({ birthDate: '2010-03-01' }, [adulta, juvenil], today)).toBe(true)
  })

  it('sin fecha de nacimiento, decide por las series en que está inscrito', () => {
    expect(isMinor({ birthDate: null }, [adulta, juvenil], today)).toBe(true)
    expect(isMinor({ birthDate: null }, [adulta], today)).toBe(false)
    expect(isMinor({ birthDate: null }, [], today)).toBe(false)
  })

  it('muestra a los menores con nombre e inicial del apellido, sin apodo', () => {
    const player = { firstName: 'Benjamín', lastName: 'Rojas Soto', nickname: 'Benja' }
    expect(publicPlayerName(player, true)).toBe('Benjamín R.')
    expect(publicPlayerName(player, false)).toBe('Benjamín Rojas Soto')
    expect(publicPlayerName({ firstName: 'Benjamín', lastName: ' ' }, true)).toBe('Benjamín')
  })
})

describe('formatos chilenos', () => {
  const kickoff = '2026-10-10T19:00:00Z' // sábado 10 de octubre, 16:00 en Santiago (UTC−3)

  it('formatea fechas y horas en America/Santiago', () => {
    expect(formatTime(kickoff)).toBe('16:00')
    expect(formatDayMonth(kickoff)).toBe('sáb 10 oct')
    expect(formatMatchDate(kickoff)).toBe('sáb 10 oct · 16:00')
    expect(formatShortDate(kickoff)).toBe('10 oct 2026')
    expect(formatLongDate(kickoff)).toBe('sábado 10 de octubre de 2026')
    expect(formatLongDateTime(kickoff)).toBe('sábado 10 de octubre de 2026, 16:00 h')
    expect(formatDayMonthNumeric(kickoff)).toBe('10/10')
  })

  it('usa el horario de invierno cuando corresponde (UTC−4)', () => {
    expect(formatMatchDate('2026-06-13T19:00:00Z')).toBe('sáb 13 jun · 15:00')
  })

  it('usa el día de Santiago aunque en UTC ya sea el día siguiente', () => {
    expect(toIsoDate('2026-10-10T02:30:00Z')).toBe('2026-10-09')
    expect(toIsoDate(fromIsoDate('1934-04-01'))).toBe('1934-04-01')
    expect(formatLongDate(fromIsoDate('1934-04-01'))).toBe('domingo 1 de abril de 1934')
  })

  it('formatea dinero, números y teléfonos', () => {
    expect(formatClp(15000)).toBe('$15.000')
    expect(formatClp(1500)).toBe('$1.500')
    expect(formatClp(0)).toBe('$0')
    expect(formatClp(-2000)).toBe('-$2.000')
    expect(formatNumber(1234567)).toBe('1.234.567')
    expect(formatPhone('+56912345678')).toBe('+56 9 1234 5678')
    expect(formatPhone('+56752123456')).toBe('+56 75 212 3456')
    expect(formatPhone('+5491112345678')).toBe('+5491112345678')
    expect(whatsappNumber('+56 9 1234 5678')).toBe('56912345678')
  })

  it('cuenta años cumplidos', () => {
    expect(yearsBetween('1934-04-01', '2026-03-31')).toBe(91)
    expect(yearsBetween('1934-04-01', '2026-04-01')).toBe(92)
    expect(yearsBetween('2000-12-31', '2026-12-30')).toBe(25)
  })
})

describe('RUT', () => {
  it('calcula el dígito verificador con módulo 11', () => {
    expect(rutCheckDigit(12345678)).toBe('5')
    expect(rutCheckDigit(11111111)).toBe('1')
    expect(rutCheckDigit(6)).toBe('K')
    expect(rutCheckDigit(14)).toBe('0')
  })

  it('valida con o sin puntos y guion', () => {
    expect(isValidRut('12.345.678-5')).toBe(true)
    expect(isValidRut('123456785')).toBe(true)
    expect(isValidRut('12.345.678-9')).toBe(false)
    expect(isValidRut('1-9')).toBe(false)
    expect(isValidRut('')).toBe(false)
  })

  it('formatea como 12.345.678-5', () => {
    expect(formatRut('123456785')).toBe('12.345.678-5')
    expect(formatRut('9876543k')).toBe('9.876.543-K')
    expect(cleanRut(' 12.345.678-5 ')).toBe('123456785')
    expect(formatRut('5')).toBe('5')
  })
})

describe('slugs', () => {
  it('quita tildes, convierte la ñ y usa guiones', () => {
    expect(slugify('¡Campeón! Ñublense vs. Los Cachorros')).toBe('campeon-nublense-vs-los-cachorros')
    expect(slugify('  Senior 35  ')).toBe('senior-35')
  })

  it('corta en 80 caracteres sin dejar un guion al final', () => {
    const slug = slugify(`${'a'.repeat(79)} b c`)
    expect(slug).toHaveLength(79)
    expect(slugify('palabra '.repeat(20)).length).toBeLessThanOrEqual(80)
  })

  it('agrega -2, -3 cuando el slug ya existe', () => {
    const taken = new Set(['honor', 'honor-2'])
    expect(uniqueSlug('Honor', (s) => taken.has(s))).toBe('honor-3')
    expect(uniqueSlug('Segunda', (s) => taken.has(s))).toBe('segunda')
    expect(uniqueSlug('¿?', () => false)).toBe('sin-titulo')
    const long = 'x'.repeat(80)
    expect(uniqueSlug(long, (s) => s === long)).toBe(`${'x'.repeat(78)}-2`)
  })
})

describe('reloj, tags y etiquetas', () => {
  it('el reloj fijo siempre devuelve la misma hora', () => {
    const clock = fixedClock('2026-10-10T19:00:00Z')
    expect(clock.now().toISOString()).toBe('2026-10-10T19:00:00.000Z')
    expect(clock.now()).not.toBe(clock.now())
    expect(Math.abs(systemClock.now().getTime() - Date.now())).toBeLessThan(1000)
  })

  it('los tags parametrizados incluyen el identificador', () => {
    expect(tags.match('abc')).toBe('match:abc')
    expect(tags.standings('c1', 's1')).toBe('standings:c1:s1')
    expect(new Set(Object.values(tags).map((tag) => tag('x', 'y'))).size).toBe(Object.keys(tags).length)
  })

  it('hay etiquetas en español para los estados', () => {
    expect(matchStatusLabels.en_vivo).toBe('En vivo')
    expect(weekdayLabels[6]).toBe('Sábado')
  })
})
