import { describe, expect, it } from 'vitest'
import { parseIdentifier } from '@/features/privacy/lib/identifier'

describe('buscar a una persona por correo, RUT o celular', () => {
  it('reconoce cada dato y lo deja en el formato en que se guarda', () => {
    expect(parseIdentifier('  Ana@Correo.CL ')).toEqual({ kind: 'email', value: 'ana@correo.cl' })
    expect(parseIdentifier('12345678-5')).toEqual({ kind: 'rut', value: '12.345.678-5' })
    expect(parseIdentifier('12.345.678-5')).toEqual({ kind: 'rut', value: '12.345.678-5' })
    expect(parseIdentifier('9 8765 4321')).toEqual({ kind: 'phone', value: '+56987654321' })
    expect(parseIdentifier('+56 9 8765 4321')).toEqual({ kind: 'phone', value: '+56987654321' })
  })

  it('rechaza lo que no es ninguno: un RUT con mal dígito no se confunde con un celular', () => {
    expect(parseIdentifier('12345678-9')).toBeNull()
    expect(parseIdentifier('ana@')).toBeNull()
    expect(parseIdentifier('Ana Pérez')).toBeNull()
  })
})
