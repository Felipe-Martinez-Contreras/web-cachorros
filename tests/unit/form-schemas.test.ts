import { describe, expect, it } from 'vitest'
import {
  checkbox,
  optionalDate,
  optionalInt,
  optionalText,
  optionalUuid,
  requiredDate,
  requiredInt,
  requiredText,
  requiredTime,
} from '@/lib/form-schemas'

describe('piezas de formulario', () => {
  it('el texto obligatorio recorta espacios y rechaza el vacío con su mensaje', () => {
    const schema = requiredText('Escribe el nombre.')
    expect(schema.parse('  Honor ')).toBe('Honor')
    expect(schema.safeParse('   ').error?.issues[0]?.message).toBe('Escribe el nombre.')
    expect(schema.safeParse(null).error?.issues[0]?.message).toBe('Escribe el nombre.')
  })

  it('el texto opcional convierte vacío, espacios e indefinido en null', () => {
    const schema = optionalText(10)
    expect(schema.parse('')).toBeNull()
    expect(schema.parse('   ')).toBeNull()
    expect(schema.parse(undefined)).toBeNull()
    expect(schema.parse(null)).toBeNull()
    expect(schema.parse(' Talca ')).toBe('Talca')
    expect(schema.safeParse('12345678901').success).toBe(false)
  })

  it('los enteros aceptan el texto de un <input> y respetan el rango', () => {
    const required = requiredInt(5, 60, 'Entre 5 y 60.')
    expect(required.parse('45')).toBe(45)
    expect(required.parse(30)).toBe(30)
    for (const bad of ['', '4', '61', '45.5', 'abc']) {
      expect(required.safeParse(bad).error?.issues[0]?.message, bad).toBe('Entre 5 y 60.')
    }
    const optional = optionalInt(1, 99, 'Entre 1 y 99.')
    expect(optional.parse('')).toBeNull()
    expect(optional.parse('10')).toBe(10)
    expect(optional.safeParse('0').success).toBe(false)
  })

  it('las fechas exigen AAAA-MM-DD y un día que exista', () => {
    const schema = requiredDate('Fecha inválida.')
    expect(schema.parse('2026-10-10')).toBe('2026-10-10')
    expect(schema.safeParse('2026-02-30').success).toBe(false)
    expect(schema.safeParse('10/10/2026').success).toBe(false)
    expect(optionalDate().parse('')).toBeNull()
    expect(optionalDate().parse('2026-04-01')).toBe('2026-04-01')
  })

  it('la hora exige HH:MM de 24 horas', () => {
    const schema = requiredTime('Hora inválida.')
    expect(schema.parse('16:00')).toBe('16:00')
    expect(schema.safeParse('24:00').success).toBe(false)
    expect(schema.safeParse('4pm').success).toBe(false)
  })

  it('el uuid opcional convierte vacío en null y rechaza basura', () => {
    expect(optionalUuid().parse('')).toBeNull()
    expect(optionalUuid().safeParse('no-es-uuid').success).toBe(false)
  })

  it('la casilla acepta el booleano de react-hook-form y el «on» de un formulario nativo', () => {
    expect(checkbox().parse(true)).toBe(true)
    expect(checkbox().parse('on')).toBe(true)
    expect(checkbox().parse(false)).toBe(false)
    expect(checkbox().parse(undefined)).toBe(false)
  })
})
