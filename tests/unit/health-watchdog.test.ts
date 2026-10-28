import { describe, expect, it } from 'vitest'
import { createHealthWatchdog } from '@/lib/health-watchdog'

describe('vigilante de /api/health', () => {
  it('pide terminar solo cuando la BD lleva el plazo completo sin responder', () => {
    let now = 0
    const watchdog = createHealthWatchdog({ restartAfterMs: 180_000, now: () => now })
    expect(watchdog.record(false)).toBe(false)
    now = 179_000
    expect(watchdog.record(false)).toBe(false)
    expect(watchdog.failingFor()).toBe(179_000)
    now = 180_000
    expect(watchdog.record(false)).toBe(true)
  })

  it('una respuesta buena en medio reinicia la cuenta', () => {
    let now = 0
    const watchdog = createHealthWatchdog({ restartAfterMs: 180_000, now: () => now })
    watchdog.record(false)
    now = 170_000
    expect(watchdog.record(true)).toBe(false)
    expect(watchdog.failingFor()).toBe(0)
    now = 200_000
    expect(watchdog.record(false)).toBe(false)
    now = 379_000
    expect(watchdog.record(false)).toBe(false)
    now = 380_000
    expect(watchdog.record(false)).toBe(true)
  })

  it('con 0 nunca pide terminar', () => {
    let now = 0
    const watchdog = createHealthWatchdog({ restartAfterMs: 0, now: () => now })
    watchdog.record(false)
    now = 10_000_000
    expect(watchdog.record(false)).toBe(false)
  })
})
