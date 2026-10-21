import { describe, expect, it } from 'vitest'
import { diskPercent, type OpsRunSummary, systemHealth } from '@/features/system/lib/health'

const now = new Date('2026-10-21T12:00:00Z')
const run = (
  status: 'ok' | 'error',
  at: string,
  details: Record<string, unknown> | null = null,
): OpsRunSummary => ({
  status,
  at,
  details,
})
const fresh = run('ok', '2026-10-21T07:15:00Z')

describe('systemHealth', () => {
  it('todo en orden con un respaldo reciente', () => {
    expect(
      systemHealth({ backup: fresh, restoreTest: run('ok', '2026-10-19T08:00:00Z'), disk: null }, now),
    ).toEqual({
      level: 'ok',
      message: 'Todo en orden.',
    })
  })

  it('lo más grave primero', () => {
    const disk = run('error', '2026-10-19T08:30:00Z', { percent: 91 })
    expect(
      systemHealth({ backup: run('error', '2026-10-21T07:15:00Z'), restoreTest: null, disk }, now),
    ).toEqual({
      level: 'error',
      message: 'El último respaldo falló: avisa a soporte.',
    })
    expect(
      systemHealth({ backup: run('ok', '2026-10-19T07:15:00Z'), restoreTest: null, disk }, now).message,
    ).toBe('Hace más de un día que no se hace un respaldo: avisa a soporte.')
    expect(
      systemHealth({ backup: fresh, restoreTest: run('error', '2026-10-19T08:00:00Z'), disk }, now).level,
    ).toBe('error')
    expect(systemHealth({ backup: fresh, restoreTest: null, disk }, now)).toEqual({
      level: 'aviso',
      message: 'El disco del servidor está al 91 %: avisa a soporte.',
    })
  })

  it('disco al límite sin datos de porcentaje, y sin respaldos todavía', () => {
    expect(
      systemHealth({ backup: fresh, restoreTest: null, disk: run('error', now.toISOString()) }, now).message,
    ).toBe('El disco del servidor está casi lleno: avisa a soporte.')
    expect(systemHealth({ backup: null, restoreTest: null, disk: null }, now)).toEqual({
      level: 'aviso',
      message: 'Todavía no hay respaldos registrados.',
    })
  })

  it('lee el porcentaje del disco solo si es un número', () => {
    expect(diskPercent(run('ok', now.toISOString(), { percent: 42 }))).toBe(42)
    expect(diskPercent(run('ok', now.toISOString(), { percent: '42' }))).toBeNull()
    expect(diskPercent(null)).toBeNull()
  })
})
