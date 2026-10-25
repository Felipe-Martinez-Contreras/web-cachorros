import { describe, expect, it } from 'vitest'
import { santiagoWallTime } from '@/features/matches/lib/schedule'
import type { CardMatch, MatchCardData, WeekendCardData } from '@/features/share/dto'
import {
  MAX_CAPTION,
  nextMatchCaption,
  resultCaption,
  weekendCaption,
} from '@/features/social-publishing/lib/caption'
import {
  classifyGraphResponse,
  classifyNetworkError,
  isPublishable,
  MAX_PUBLISH_ATTEMPTS,
  nextAttemptAt,
  publicationKindFor,
  publishAvailability,
  redactSecret,
} from '@/features/social-publishing/lib/rules'
import { scheduledAtFor, upcomingWeekend, weeklyDecision } from '@/features/social-publishing/lib/schedule'
import {
  FACEBOOK_DEFAULTS,
  facebookSettingsSchema,
  nextFacebookSettings,
  readFacebookSettings,
} from '@/features/social-publishing/lib/settings'

const at = (day: string, time: string) => santiagoWallTime(day, time).toISOString()

function match(overrides: Partial<CardMatch> = {}): CardMatch {
  return {
    clubSide: 'local',
    home: { name: 'Cachorros', crest: null },
    away: { name: 'Deportivo Ejemplo', crest: null },
    seriesName: 'Honor',
    competitionName: 'Campeonato de ejemplo',
    roundLabel: 'Fecha 7',
    kickoffAt: at('2026-10-31', '15:30'),
    venueName: 'Cancha de ejemplo',
    status: 'programado',
    resolution: 'normal',
    homeScore: 0,
    awayScore: 0,
    homePenalties: null,
    awayPenalties: null,
    ...overrides,
  }
}

const matchCard = (
  data: CardMatch,
  scorers: MatchCardData['scorers'] = { home: [], away: [] },
): MatchCardData => ({
  kind: 'match',
  template: 'proximo',
  clubName: 'Club',
  match: data,
  scorers,
  goal: null,
  matchday: null,
})

const weekend = (matches: CardMatch[]): WeekendCardData => ({
  kind: 'weekend',
  template: 'programacion',
  clubName: 'Club',
  clubCrest: null,
  saturday: '2026-10-31',
  matches,
  sponsor: null,
})

describe('texto de las publicaciones', () => {
  it('próximo partido: equipos, fecha, hora, cancha con local o visita y enlace', () => {
    const text = nextMatchCaption(matchCard(match()), 'https://sitio/partidos/honor')
    expect(text).toBe(
      [
        '⚽ Próximo partido · Honor',
        'Cachorros vs Deportivo Ejemplo',
        '',
        '📅 Sábado 31 de octubre, 15:30 h',
        '📍 Cancha de ejemplo (local)',
        'Campeonato de ejemplo · Fecha 7',
        '',
        'Más información: https://sitio/partidos/honor',
      ].join('\n'),
    )
    const away = nextMatchCaption(
      matchCard(match({ clubSide: 'visita', venueName: null, roundLabel: null })),
      'https://sitio/x',
    )
    expect(away).toContain('📍 De visita')
    expect(away).toContain('\nCampeonato de ejemplo\n')
  })

  it('un partido postergado no anuncia la hora', () => {
    const text = nextMatchCaption(matchCard(match({ status: 'postergado' })), 'https://sitio/x')
    expect(text).toContain('Partido postergado · Honor')
    expect(text).not.toContain('15:30')
  })

  it('resultado: marcador, penales y goleadores del club (los menores ya vienen con inicial)', () => {
    const data = matchCard(
      match({ status: 'finalizado', homeScore: 2, awayScore: 2, homePenalties: 4, awayPenalties: 3 }),
      { home: ["Juan P. 12'", "Pedro S. 70' (p)"], away: ["Gol 30'"] },
    )
    const text = resultCaption(data, 'https://sitio/partidos/honor')
    expect(text).toContain('Cachorros 2–2 Deportivo Ejemplo\n(4–3 en penales)')
    expect(text).toContain("⚽ Juan P. 12' · Pedro S. 70' (p)")
    expect(text).not.toContain('Gol 30')
  })

  it('programación: agrupada por día, competencia una vez y estados en vez de hora', () => {
    const text = weekendCaption(
      weekend([
        match({ seriesName: 'Infantil', kickoffAt: at('2026-10-31', '10:00') }),
        match({ seriesName: 'Honor' }),
        match({
          seriesName: 'Senior',
          clubSide: 'visita',
          home: { name: 'Unión Ejemplo', crest: null },
          away: { name: 'Cachorros', crest: null },
          kickoffAt: at('2026-11-01', '11:00'),
          status: 'postergado',
          venueName: null,
        }),
      ]),
      'https://sitio/partidos',
    )
    expect(text).toBe(
      [
        '⚽ Programación del fin de semana',
        'Sábado 31 de octubre y domingo 1 de noviembre',
        'Campeonato de ejemplo',
        '',
        'Sábado 31 de octubre',
        '• 10:00 Infantil: Cachorros vs Deportivo Ejemplo (Cancha de ejemplo)',
        '• 15:30 Honor: Cachorros vs Deportivo Ejemplo (Cancha de ejemplo)',
        '',
        'Domingo 1 de noviembre',
        '• postergado Senior: Unión Ejemplo vs Cachorros',
        '',
        'Todos los partidos: https://sitio/partidos',
      ].join('\n'),
    )
  })

  it('los marcadores de contenido pendiente no salen y el texto tiene tope', () => {
    const text = nextMatchCaption(
      matchCard(match({ competitionName: 'Campeonato [COMPLETAR: nombre de la asociación]' })),
      'https://sitio/x',
    )
    expect(text).not.toContain('COMPLETAR')
    const many = Array.from({ length: 200 }, (_, index) =>
      match({ seriesName: `Serie ${index}`, competitionName: `Copa ${index}` }),
    )
    expect(weekendCaption(weekend(many), 'https://sitio/partidos').length).toBeLessThanOrEqual(MAX_CAPTION)
  })
})

describe('hora de la programación (America/Santiago)', () => {
  it('viernes 12:00 de la semana del sábado', () => {
    // Octubre: horario de verano (UTC−3).
    expect(scheduledAtFor('2026-10-31', 5, '12:00').toISOString()).toBe('2026-10-30T15:00:00.000Z')
    expect(scheduledAtFor('2026-10-31', 1, '09:30').toISOString()).toBe('2026-10-26T12:30:00.000Z')
    expect(scheduledAtFor('2026-10-31', 6, '08:00').toISOString()).toBe('2026-10-31T11:00:00.000Z')
  })

  it('respeta los dos cambios de horario de Chile', () => {
    // Abril: el viernes previo al cambio sigue en verano (UTC−3); el siguiente, en invierno (UTC−4).
    expect(scheduledAtFor('2026-04-04', 5, '12:00').toISOString()).toBe('2026-04-03T15:00:00.000Z')
    expect(scheduledAtFor('2026-04-11', 5, '12:00').toISOString()).toBe('2026-04-10T16:00:00.000Z')
    // Septiembre: el viernes previo al cambio sigue en invierno; el siguiente, en verano.
    expect(scheduledAtFor('2026-09-05', 5, '12:00').toISOString()).toBe('2026-09-04T16:00:00.000Z')
    expect(scheduledAtFor('2026-09-12', 5, '12:00').toISOString()).toBe('2026-09-11T15:00:00.000Z')
  })

  it('el fin de semana que corresponde según el día', () => {
    expect(upcomingWeekend(new Date(at('2026-10-26', '08:00')))).toBe('2026-10-31')
    expect(upcomingWeekend(new Date(at('2026-10-30', '23:59')))).toBe('2026-10-31')
    // El domingo sigue siendo el mismo fin de semana (ya empezado).
    expect(upcomingWeekend(new Date(at('2026-11-01', '10:00')))).toBe('2026-10-31')
  })

  const base = {
    weekday: 5,
    time: '12:00',
    enabledAt: '2026-10-01T00:00:00.000Z',
    firstKickoff: new Date(at('2026-10-31', '10:00')),
  }

  it('publica desde la hora programada hasta el primer partido', () => {
    expect(weeklyDecision({ ...base, now: new Date(at('2026-10-30', '11:59')) })).toEqual({
      publish: false,
      reason: 'antes_de_la_hora',
    })
    expect(weeklyDecision({ ...base, now: new Date(at('2026-10-30', '12:00')) })).toMatchObject({
      publish: true,
      saturday: '2026-10-31',
    })
    // Si el tick se atrasó, todavía publica antes del primer partido.
    expect(weeklyDecision({ ...base, now: new Date(at('2026-10-31', '09:00')) }).publish).toBe(true)
    expect(weeklyDecision({ ...base, now: new Date(at('2026-10-31', '10:00')) })).toEqual({
      publish: false,
      reason: 'ya_empezo',
    })
  })

  it('no publica sin partidos ni lo programado antes de activarla', () => {
    const now = new Date(at('2026-10-30', '13:00'))
    expect(weeklyDecision({ ...base, now, firstKickoff: null })).toEqual({
      publish: false,
      reason: 'sin_partidos',
    })
    expect(weeklyDecision({ ...base, now, enabledAt: at('2026-10-30', '12:30') })).toEqual({
      publish: false,
      reason: 'activada_despues',
    })
    expect(weeklyDecision({ ...base, now, enabledAt: undefined }).publish).toBe(false)
  })
})

describe('reglas de publicación', () => {
  const now = new Date('2026-10-30T15:00:00Z')

  it('idempotencia: lo publicado, en curso o incierto nunca se reenvía solo', () => {
    const row = { attempts: 1, nextAttemptAt: new Date(now.getTime() - 1000) }
    expect(isPublishable({ ...row, status: 'pendiente' }, now)).toBe(true)
    expect(isPublishable({ ...row, status: 'error' }, now)).toBe(true)
    for (const status of ['publicado', 'publicando', 'incierto', 'descartado'] as const) {
      expect(isPublishable({ ...row, status }, now)).toBe(false)
    }
    // Un error espera su hora y se detiene al llegar al máximo.
    expect(
      isPublishable({ status: 'error', attempts: 1, nextAttemptAt: new Date(now.getTime() + 1000) }, now),
    ).toBe(false)
    expect(isPublishable({ status: 'error', attempts: 1, nextAttemptAt: null }, now)).toBe(false)
    expect(isPublishable({ ...row, status: 'error', attempts: MAX_PUBLISH_ATTEMPTS }, now)).toBe(false)
  })

  it('reintentos con espera creciente y solo para fallas transitorias', () => {
    const transient = { kind: 'transitorio', message: '' } as const
    const minutes = (attempts: number) =>
      ((nextAttemptAt(attempts, now, transient)?.getTime() ?? 0) - now.getTime()) / 60_000
    expect([1, 2, 3, 4].map(minutes)).toEqual([5, 15, 45, 120])
    expect(nextAttemptAt(MAX_PUBLISH_ATTEMPTS, now, transient)).toBeNull()
    expect(nextAttemptAt(1, now, { kind: 'definitivo', message: '' })).toBeNull()
    expect(nextAttemptAt(1, now, { kind: 'incierto', message: '' })).toBeNull()
  })

  it('clasifica las respuestas de la Graph API', () => {
    expect(classifyGraphResponse(400, { error: { message: 'Limit', code: 4 } }).kind).toBe('transitorio')
    expect(classifyGraphResponse(400, { error: { message: 'Session expired', code: 190 } })).toMatchObject({
      kind: 'definitivo',
      message: expect.stringContaining('token'),
    })
    expect(classifyGraphResponse(403, { error: { message: 'No permission', code: 200 } })).toEqual({
      kind: 'definitivo',
      message: 'Facebook respondió: No permission (código 200)',
    })
    expect(classifyGraphResponse(502, null).kind).toBe('incierto')
    expect(classifyGraphResponse(429, null).kind).toBe('transitorio')
  })

  it('clasifica los errores de red: sin conexión se reintenta, un corte a medias no', () => {
    expect(classifyNetworkError(Object.assign(new Error('x'), { name: 'TimeoutError' })).kind).toBe(
      'incierto',
    )
    expect(
      classifyNetworkError(new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } })).kind,
    ).toBe('transitorio')
    expect(classifyNetworkError(new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } })).kind).toBe(
      'incierto',
    )
  })

  it('el token nunca queda en un mensaje', () => {
    expect(redactSecret('token EAAB123 inválido', 'EAAB123')).toBe('token *** inválido')
    expect(redactSecret('sin token', undefined)).toBe('sin token')
  })

  it('qué se publica de un partido según su estado', () => {
    expect(publicationKindFor('programado')).toBe('proximo')
    expect(publicationKindFor('postergado')).toBe('proximo')
    expect(publicationKindFor('finalizado')).toBe('resultado')
    expect(publicationKindFor('en_vivo')).toBeNull()
    expect(publicationKindFor('cancelado')).toBeNull()
  })

  it('solo publica con página configurada, entorno permitido y activada', () => {
    const ready = {
      pageId: '123',
      token: 'x'.repeat(30),
      siteEnv: 'production',
      allowNonProduction: false,
      enabled: true,
    }
    expect(publishAvailability(ready)).toEqual({ ok: true })
    expect(publishAvailability({ ...ready, pageId: undefined, token: undefined })).toMatchObject({
      reason: 'sin_configurar',
    })
    expect(publishAvailability({ ...ready, token: undefined })).toMatchObject({
      reason: 'configuracion_incompleta',
    })
    expect(publishAvailability({ ...ready, siteEnv: 'staging' })).toMatchObject({ reason: 'entorno' })
    expect(publishAvailability({ ...ready, siteEnv: 'staging', allowNonProduction: true })).toEqual({
      ok: true,
    })
    expect(publishAvailability({ ...ready, enabled: false })).toMatchObject({ reason: 'desactivada' })
  })
})

describe('ajustes de Facebook', () => {
  it('valores por defecto si no hay nada guardado o no es válido', () => {
    expect(readFacebookSettings(null)).toEqual(FACEBOOK_DEFAULTS)
    expect(readFacebookSettings({ facebook: { weekday: 9 } as never })).toEqual(FACEBOOK_DEFAULTS)
    expect(FACEBOOK_DEFAULTS).toMatchObject({ enabled: false, weekday: 5, time: '12:00' })
  })

  it('valida el formulario: de lunes a sábado y una hora válida', () => {
    expect(facebookSettingsSchema.safeParse({ enabled: 'on', weekday: '5', time: '12:00' }).data).toEqual({
      enabled: true,
      weekday: 5,
      time: '12:00',
      publishResults: false,
      photo1: null,
      photo2: null,
      photo3: null,
    })
    expect(facebookSettingsSchema.safeParse({ weekday: '7', time: '12:00' }).success).toBe(false)
    expect(facebookSettingsSchema.safeParse({ weekday: '5', time: '25:00' }).success).toBe(false)
  })

  it('anota desde cuándo está activa y lo conserva mientras siga activa', () => {
    const t1 = new Date('2026-10-01T00:00:00Z')
    const t2 = new Date('2026-10-02T00:00:00Z')
    const on = nextFacebookSettings(
      FACEBOOK_DEFAULTS,
      {
        enabled: true,
        weekday: 5,
        time: '12:00',
        publishResults: true,
        photo1: null,
        photo2: null,
        photo3: null,
      },
      t1,
    )
    expect(on).toMatchObject({ enabledAt: t1.toISOString(), resultsEnabledAt: t1.toISOString() })
    const again = nextFacebookSettings(
      on,
      {
        enabled: true,
        weekday: 4,
        time: '18:00',
        publishResults: true,
        photo1: null,
        photo2: null,
        photo3: null,
      },
      t2,
    )
    expect(again).toMatchObject({
      weekday: 4,
      enabledAt: t1.toISOString(),
      resultsEnabledAt: t1.toISOString(),
    })
    const off = nextFacebookSettings(
      again,
      {
        enabled: false,
        weekday: 4,
        time: '18:00',
        publishResults: false,
        photo1: null,
        photo2: null,
        photo3: null,
      },
      t2,
    )
    expect(off.enabledAt).toBeUndefined()
    expect(off.resultsEnabledAt).toBeUndefined()
  })
})
