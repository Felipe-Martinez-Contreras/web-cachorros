import { describe, expect, it } from 'vitest'
import { can, PERMISSIONS } from '@/lib/permissions'

describe('can', () => {
  it('niega todo sin usuario', () => {
    expect(can(null, 'panel:access')).toBe(false)
    expect(can(undefined, 'panel:access')).toBe(false)
  })

  it('el admin tiene todos los permisos', () => {
    for (const permission of PERMISSIONS) {
      expect(can({ role: 'admin' }, permission)).toBe(true)
    }
  })

  it('una cuenta desactivada no tiene permisos aunque sea admin', () => {
    expect(can({ role: 'admin', banned: true }, 'panel:access')).toBe(false)
  })

  it('los roles futuros todavía no tienen permisos', () => {
    for (const role of ['editor', 'delegado', 'prensa']) {
      expect(can({ role }, 'panel:access')).toBe(false)
    }
  })

  it('ignora roles desconocidos o vacíos', () => {
    expect(can({ role: 'user' }, 'panel:access')).toBe(false)
    expect(can({ role: null }, 'panel:access')).toBe(false)
    expect(can({}, 'panel:access')).toBe(false)
    expect(can({ role: 'superadmin' }, 'settings:write')).toBe(false)
  })

  it('acepta varios roles separados por coma', () => {
    expect(can({ role: 'prensa, admin' }, 'settings:write')).toBe(true)
  })
})
