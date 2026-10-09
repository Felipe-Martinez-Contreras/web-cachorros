import { describe, expect, it } from 'vitest'
import {
  decadeOf,
  decadesOf,
  formatMilestoneDate,
  fromMilestoneDate,
  resolveDecade,
  toMilestoneDate,
  yearOf,
} from '@/features/history/lib/dates'
import { HISTORY_SECTION_KEYS, isHistorySection } from '@/features/history/sections'
import { isPageBlockKey } from '@/features/pages/blocks'

describe('fechas de los hitos', () => {
  it('guarda la fecha con la precisión que se conoce', () => {
    expect(toMilestoneDate({ year: 1934, month: 4, day: 1 })).toEqual({
      occurredOn: '1934-04-01',
      precision: 'dia',
    })
    expect(toMilestoneDate({ year: 1984, month: 4, day: null })).toEqual({
      occurredOn: '1984-04-01',
      precision: 'mes',
    })
    expect(toMilestoneDate({ year: 2009, month: null, day: null })).toEqual({
      occurredOn: '2009-01-01',
      precision: 'anio',
    })
  })

  it('rechaza fechas que no existen o un día sin mes', () => {
    expect(toMilestoneDate({ year: 2023, month: 2, day: 30 })).toBeNull()
    expect(toMilestoneDate({ year: 2023, month: 4, day: 31 })).toBeNull()
    expect(toMilestoneDate({ year: 2023, month: null, day: 5 })).toBeNull()
    // 29 de febrero solo en año bisiesto.
    expect(toMilestoneDate({ year: 2024, month: 2, day: 29 })?.precision).toBe('dia')
    expect(toMilestoneDate({ year: 2023, month: 2, day: 29 })).toBeNull()
  })

  it('devuelve al formulario solo las partes que la precisión respalda', () => {
    expect(fromMilestoneDate('1934-04-01', 'dia')).toEqual({ year: 1934, month: 4, day: 1 })
    expect(fromMilestoneDate('1934-04-01', 'mes')).toEqual({ year: 1934, month: 4, day: null })
    expect(fromMilestoneDate('1934-12-31', 'anio')).toEqual({ year: 1934, month: null, day: null })
  })

  it('escribe la fecha en español según lo que se sabe', () => {
    expect(formatMilestoneDate('1934-04-01', 'dia')).toBe('1 de abril de 1934')
    expect(formatMilestoneDate('1934-04-01', 'mes')).toBe('abril de 1934')
    expect(formatMilestoneDate('1934-12-31', 'anio')).toBe('1934')
    // Sin corrimiento por zona horaria en los bordes del año.
    expect(formatMilestoneDate('2034-01-01', 'dia')).toBe('1 de enero de 2034')
    expect(formatMilestoneDate('2034-12-31', 'dia')).toBe('31 de diciembre de 2034')
  })

  it('agrupa por décadas y valida la de la URL', () => {
    expect(yearOf('1934-04-01')).toBe(1934)
    expect(decadeOf(1934)).toBe(1930)
    expect(decadeOf(2000)).toBe(2000)
    const decades = decadesOf([2024, 1934, 1939, 1984, 2034])
    expect(decades).toEqual([1930, 1980, 2020, 2030])
    expect(resolveDecade('1980', decades)).toBe(1980)
    expect(resolveDecade(['2020', '1930'], decades)).toBe(2020)
    for (const param of ['1950', 'abc', '', undefined]) expect(resolveDecade(param, decades)).toBeNull()
  })
})

describe('secciones y textos fijos', () => {
  it('solo reconoce las secciones de Historia y las claves de texto que existen', () => {
    expect(HISTORY_SECTION_KEYS).toEqual(['hitos', 'titulos', 'salon-de-la-fama', 'camisetas'])
    expect(isHistorySection('titulos')).toBe(true)
    for (const value of ['toString', 'constructor', '', null, 3]) expect(isHistorySection(value)).toBe(false)
    expect(isPageBlockKey('historia.intro')).toBe(true)
    for (const value of ['historia', '__proto__', 'hasOwnProperty', undefined]) {
      expect(isPageBlockKey(value)).toBe(false)
    }
  })
})
