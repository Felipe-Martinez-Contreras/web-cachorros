import { describe, expect, it } from 'vitest'
import { santiagoWallTime } from '@/features/matches/lib/schedule'
import { isPublishable } from '@/features/social-publishing/lib/rules'
import {
  defaultScheduleAt,
  firstKickoffOf,
  type GuardMatch,
  rivalOf,
  scheduleGuard,
  scheduleSnapshot,
  validateScheduledAt,
  withFallbackPhotos,
} from '@/features/social-publishing/lib/scheduling'
import {
  FACEBOOK_DEFAULTS,
  readFacebookSettings,
  weeklyActiveSince,
} from '@/features/social-publishing/lib/settings'

// Publicaciones programadas de una jornada o un partido: hora elegida, hora sugerida, seguros y fotos.

const wall = santiagoWallTime
const RIVAL = '0192f1d2-0000-7000-8000-0000000000aa'
const OTHER = '0192f1d2-0000-7000-8000-0000000000bb'
const A = '0192f1d2-0000-7000-8000-000000000001'
const B = '0192f1d2-0000-7000-8000-000000000002'

describe('hora elegida', () => {
  const kickoff = wall('2030-11-02', '15:00')

  it('al menos 5 minutos en el futuro y antes del inicio', () => {
    const now = wall('2030-11-01', '09:00')
    expect(validateScheduledAt({ at: wall('2030-11-01', '10:00'), now, firstKickoff: kickoff })).toEqual({
      ok: true,
    })
    expect(validateScheduledAt({ at: wall('2030-11-01', '09:05'), now, firstKickoff: kickoff }).ok).toBe(true)
    expect(validateScheduledAt({ at: wall('2030-11-01', '09:04'), now, firstKickoff: kickoff })).toEqual({
      ok: false,
      message: 'Elige una hora al menos 5 minutos en el futuro.',
    })
    expect(validateScheduledAt({ at: wall('2030-10-31', '10:00'), now, firstKickoff: kickoff }).ok).toBe(
      false,
    )
  })

  it('nunca a la hora del partido ni después', () => {
    const now = wall('2030-11-01', '09:00')
    const atKickoff = validateScheduledAt({ at: kickoff, now, firstKickoff: kickoff })
    expect(atKickoff).toEqual({
      ok: false,
      message: 'Elige una hora anterior al inicio del partido (sábado 2 de noviembre de 2030, 15:00 h).',
    })
    expect(validateScheduledAt({ at: wall('2030-11-02', '14:59'), now, firstKickoff: kickoff }).ok).toBe(true)
    expect(validateScheduledAt({ at: wall('2030-11-02', '16:00'), now, firstKickoff: kickoff }).ok).toBe(
      false,
    )
    expect(validateScheduledAt({ at: new Date(Number.NaN), now, firstKickoff: kickoff }).ok).toBe(false)
  })
})

describe('hora sugerida', () => {
  const kickoff = wall('2030-11-02', '15:00')

  it('el día anterior a las 10:00 de Chile si todavía está a tiempo', () => {
    expect(defaultScheduleAt({ firstKickoff: kickoff, now: wall('2030-10-28', '18:00') })).toEqual(
      wall('2030-11-01', '10:00'),
    )
    expect(defaultScheduleAt({ firstKickoff: kickoff, now: wall('2030-11-01', '09:55') })).toEqual(
      wall('2030-11-01', '10:00'),
    )
  })

  it('si ya pasó, la próxima hora en punto con 5 minutos de margen', () => {
    expect(defaultScheduleAt({ firstKickoff: kickoff, now: wall('2030-11-01', '09:56') })).toEqual(
      wall('2030-11-01', '11:00'),
    )
    expect(defaultScheduleAt({ firstKickoff: kickoff, now: wall('2030-11-02', '08:20') })).toEqual(
      wall('2030-11-02', '09:00'),
    )
    expect(defaultScheduleAt({ firstKickoff: kickoff, now: wall('2030-11-02', '09:00') })).toEqual(
      wall('2030-11-02', '10:00'),
    )
  })

  it('siempre antes del inicio: si no queda ninguna hora en punto, nada', () => {
    expect(defaultScheduleAt({ firstKickoff: kickoff, now: wall('2030-11-02', '13:30') })).toEqual(
      wall('2030-11-02', '14:00'),
    )
    expect(defaultScheduleAt({ firstKickoff: kickoff, now: wall('2030-11-02', '13:56') })).toBeNull()
    expect(defaultScheduleAt({ firstKickoff: kickoff, now: wall('2030-11-02', '16:00') })).toBeNull()
  })

  it('respeta los cambios de horario de Chile', () => {
    // Abril 2030: Chile vuelve a UTC−4 el primer domingo; septiembre: a UTC−3.
    const april = wall('2030-04-07', '11:00')
    expect(defaultScheduleAt({ firstKickoff: april, now: wall('2030-04-01', '10:00') })).toEqual(
      wall('2030-04-06', '10:00'),
    )
    const september = wall('2030-09-08', '11:00')
    expect(defaultScheduleAt({ firstKickoff: september, now: wall('2030-09-01', '10:00') })).toEqual(
      wall('2030-09-07', '10:00'),
    )
  })
})

describe('seguros de una programada', () => {
  const now = wall('2030-11-01', '12:00')
  const scheduledAt = wall('2030-11-02', '10:00')
  const snapshot = scheduleSnapshot(RIVAL, [
    { id: A, kickoffAt: wall('2030-11-02', '12:00') },
    { id: B, kickoffAt: wall('2030-11-02', '15:30') },
  ])
  const current = (changes: Partial<Record<string, Partial<GuardMatch>>> = {}): GuardMatch[] =>
    [
      { id: A, kickoffAt: wall('2030-11-02', '12:00'), status: 'programado' as const, rivalId: RIVAL },
      { id: B, kickoffAt: wall('2030-11-02', '15:30'), status: 'programado' as const, rivalId: RIVAL },
    ].map((match) => ({ ...match, ...changes[match.id] }))
  const guard = (matches: GuardMatch[], extra: { messageEdited?: boolean; at?: Date; now?: Date } = {}) =>
    scheduleGuard({
      snapshot,
      current: matches,
      scheduledAt: extra.at ?? scheduledAt,
      messageEdited: extra.messageEdited ?? false,
      now: extra.now ?? now,
    })

  it('guarda el día en Chile, el rival y los partidos en orden', () => {
    expect(snapshot).toEqual({
      day: '2030-11-02',
      rivalId: RIVAL,
      matches: [
        { id: A, kickoffAt: wall('2030-11-02', '12:00').toISOString() },
        { id: B, kickoffAt: wall('2030-11-02', '15:30').toISOString() },
      ],
    })
    expect(rivalOf({ clubSide: 'local', homeTeamId: OTHER, awayTeamId: RIVAL })).toBe(RIVAL)
    expect(rivalOf({ clubSide: 'visita', homeTeamId: RIVAL, awayTeamId: OTHER })).toBe(RIVAL)
    expect(firstKickoffOf(current())).toEqual(wall('2030-11-02', '12:00'))
    expect(firstKickoffOf([])).toBeNull()
  })

  it('sin cambios, sigue', () => {
    expect(guard(current())).toEqual({ ok: true })
  })

  it('cambia la hora el mismo día con el texto sugerido: sigue (sale con la hora nueva)', () => {
    expect(guard(current({ [A]: { kickoffAt: wall('2030-11-02', '11:00') } }))).toEqual({ ok: true })
  })

  it('cambia la hora y el texto se escribió a mano: descartada', () => {
    expect(
      guard(current({ [A]: { kickoffAt: wall('2030-11-02', '11:00') } }), { messageEdited: true }),
    ).toMatchObject({ ok: false, code: 'hora_texto' })
    // Sin cambio de hora, el texto escrito a mano no importa.
    expect(guard(current(), { messageEdited: true })).toEqual({ ok: true })
  })

  it('el partido ahora empieza antes de la hora programada: descartada', () => {
    expect(guard(current({ [A]: { kickoffAt: wall('2030-11-02', '09:30') } }))).toMatchObject({
      ok: false,
      code: 'hora_tarde',
      message: 'La jornada ahora empieza antes de la hora programada.',
    })
    expect(guard(current({ [A]: { kickoffAt: scheduledAt } }))).toMatchObject({ code: 'hora_tarde' })
  })

  it('cambia el día: descartada', () => {
    expect(guard(current({ [B]: { kickoffAt: wall('2030-11-03', '15:30') } }))).toMatchObject({
      ok: false,
      code: 'dia',
      message: 'Cambió el día de un partido de la jornada.',
    })
  })

  it('cambia el rival: descartada', () => {
    expect(guard(current({ [B]: { rivalId: OTHER } }))).toMatchObject({ ok: false, code: 'rival' })
  })

  it('se cancela, se posterga o se suspende: descartada', () => {
    expect(guard(current({ [A]: { status: 'cancelado' } }))).toMatchObject({
      ok: false,
      code: 'cancelado',
      message: 'Se canceló un partido de la jornada.',
    })
    expect(guard(current({ [B]: { status: 'postergado' } }))).toMatchObject({ code: 'postergado' })
    expect(guard(current({ [B]: { status: 'suspendido' } }))).toMatchObject({ code: 'postergado' })
  })

  it('se eliminó un partido (o su serie): descartada', () => {
    expect(guard(current().slice(0, 1))).toMatchObject({ ok: false, code: 'eliminado' })
  })

  it('el partido ya empezó: descartada, nunca sale tarde', () => {
    expect(guard(current(), { now: wall('2030-11-02', '12:00') })).toMatchObject({
      ok: false,
      code: 'empezo',
    })
    expect(guard(current({ [A]: { status: 'en_vivo' } }))).toMatchObject({ code: 'empezo' })
  })

  it('un solo partido habla del partido', () => {
    const single = scheduleSnapshot(RIVAL, [{ id: A, kickoffAt: wall('2030-11-02', '12:00') }])
    expect(
      scheduleGuard({
        snapshot: single,
        current: [],
        scheduledAt,
        messageEdited: false,
        now,
      }),
    ).toMatchObject({ message: 'Se eliminó el partido.' })
  })
})

describe('fotos al publicar una programada', () => {
  const ok1 = '0192f1d2-0000-7000-8000-0000000000f1'
  const ok2 = '0192f1d2-0000-7000-8000-0000000000f2'
  const minors = '0192f1d2-0000-7000-8000-0000000000f3'
  const fallback = '0192f1d2-0000-7000-8000-0000000000f4'

  it('una foto vetada usa la de respaldo de la misma posición; si tampoco sirve, gris', () => {
    const usable = new Set([ok1, ok2, fallback])
    expect(withFallbackPhotos([ok1, minors, ok2], [null, fallback, null], usable)).toEqual({
      photos: [ok1, fallback, ok2],
      replaced: 1,
    })
    expect(withFallbackPhotos([minors, null, ok2], [minors, fallback, null], usable)).toEqual({
      photos: [null, null, ok2],
      replaced: 1,
    })
    expect(withFallbackPhotos([ok1, ok2, null], [null, null, null], usable)).toEqual({
      photos: [ok1, ok2, null],
      replaced: 0,
    })
  })
})

describe('estado «programada» y la semanal', () => {
  const now = new Date('2030-11-01T15:00:00Z')

  it('una programada sale desde su hora, nunca antes', () => {
    const row = { status: 'programada' as const, attempts: 0, nextAttemptAt: null }
    expect(isPublishable({ ...row, scheduledAt: new Date(now.getTime() + 60_000) }, now)).toBe(false)
    expect(isPublishable({ ...row, scheduledAt: now }, now)).toBe(true)
    expect(isPublishable({ ...row, scheduledAt: null }, now)).toBe(false)
  })

  it('la semanal viene apagada y necesita el interruptor general', () => {
    expect(FACEBOOK_DEFAULTS.weekly).toBe(false)
    // Lo guardado antes de este cambio (sin `weekly`) queda con la semanal apagada.
    const before = readFacebookSettings({
      facebook: { enabled: true, weekday: 5, time: '12:00', publishResults: false, enabledAt: '2026-01-01' },
    })
    expect(before.weekly).toBe(false)
    expect(weeklyActiveSince(before)).toBeUndefined()
    const on = { ...before, weekly: true, weeklyEnabledAt: '2026-10-01T00:00:00.000Z' }
    expect(weeklyActiveSince(on)).toBe('2026-10-01T00:00:00.000Z')
    expect(weeklyActiveSince({ ...on, enabled: false })).toBeUndefined()
  })
})
