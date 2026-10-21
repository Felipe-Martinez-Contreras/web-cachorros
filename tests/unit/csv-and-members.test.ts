import { describe, expect, it } from 'vitest'
import { membershipFormSchema, planSchema } from '@/features/members/schemas'
import { csvCell, toCsv } from '@/lib/csv'

describe('CSV para Excel en Chile', () => {
  it('usa punto y coma, CRLF y BOM UTF-8', () => {
    const csv = toCsv(
      [{ n: 1, name: 'Ñandú' }],
      [
        { header: 'N.º', value: (row) => row.n },
        { header: 'Nombre', value: (row) => row.name },
      ],
    )
    expect(csv).toBe('﻿N.º;Nombre\r\n1;Ñandú\r\n')
  })

  it('entrecomilla lo que trae separador, comillas o saltos de línea', () => {
    expect(csvCell('Pérez; hijo')).toBe('"Pérez; hijo"')
    expect(csvCell('dijo "hola"')).toBe('"dijo ""hola"""')
    expect(csvCell('línea 1\nlínea 2')).toBe('"línea 1\nlínea 2"')
    expect(csvCell(null)).toBe('')
  })

  it('neutraliza las fórmulas (CSV injection) sin tocar los números', () => {
    for (const formula of ['=1+1', '+56 9 1234', '-2+3', '@SUM(A1)', '+A1', '\tx', '\rx']) {
      expect(csvCell(formula).replace(/^"/, '').startsWith("'")).toBe(true)
    }
    // Un número puro no ejecuta nada: el celular en E.164 sale tal cual.
    expect(csvCell('+56912345678')).toBe('+56912345678')
    expect(csvCell('-500')).toBe('-500')
    expect(csvCell(-5)).toBe('-5')
    expect(csvCell('Ana')).toBe('Ana')
  })
})

const PLAN = '0190c8e0-0000-7000-8000-000000000001'

const membership = (overrides: Record<string, unknown> = {}) =>
  membershipFormSchema.safeParse({
    fullName: 'Luis Muñoz',
    email: 'Luis@Correo.cl',
    phone: '9 1234 5678',
    commune: 'Sagrada Familia',
    planId: PLAN,
    rut: '',
    message: '',
    privacy: 'on',
    ...overrides,
  })

const errorFields = (result: ReturnType<typeof membership>) =>
  result.success ? [] : result.error.issues.map((issue) => issue.path[0])

describe('formulario Hazte socio', () => {
  it('acepta el RUT vacío y lo guarda como null; sin comunicaciones si no se marca', () => {
    const result = membership()
    expect(result.success && result.data).toMatchObject({
      rut: null,
      email: 'luis@correo.cl',
      phone: '+56912345678',
      marketing: false,
      message: null,
    })
  })

  it('valida el RUT con módulo 11 y lo deja con puntos y guion', () => {
    expect(membership({ rut: '12345678-5' }).data?.rut).toBe('12.345.678-5')
    expect(membership({ rut: '7.654.321-k' }).success).toBe(false)
    expect(errorFields(membership({ rut: '12345678-9' }))).toEqual(['rut'])
  })

  it('pide celular, comuna, plan y el consentimiento de privacidad (nunca premarcado)', () => {
    expect(errorFields(membership({ phone: '', commune: '', planId: '', privacy: undefined }))).toEqual([
      'phone',
      'commune',
      'planId',
      'privacy',
    ])
  })
})

describe('planes de socio', () => {
  it('un beneficio por línea, sin líneas vacías, con un máximo de 12', () => {
    const base = { name: 'Activo', feeClp: '3000', feePeriod: 'mensual', isActive: true, sortOrder: '0' }
    expect(planSchema.parse({ ...base, benefits: ' Entrada \r\n\r\nVoto ' }).benefits).toEqual([
      'Entrada',
      'Voto',
    ])
    expect(planSchema.parse({ ...base, benefits: '' }).benefits).toEqual([])
    const many = Array.from({ length: 13 }, (_, i) => `Beneficio ${i}`).join('\n')
    expect(planSchema.safeParse({ ...base, benefits: many }).success).toBe(false)
  })
})
