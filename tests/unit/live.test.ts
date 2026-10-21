import { describe, expect, it } from 'vitest'
import { availableTransitions, eventPeriod, resolveTransition } from '@/features/matches/lib/live'

describe('pasos de la consola en vivo', () => {
  it('el partido programado empieza con el 1.er tiempo y el reloj corre', () => {
    expect(resolveTransition({ status: 'programado', period: 'previa' }, 'iniciar_primer_tiempo')).toEqual({
      kind: 'apply',
      period: 'primer_tiempo',
      clockRuns: true,
    })
  })

  it('el entretiempo detiene el reloj', () => {
    expect(
      resolveTransition({ status: 'en_vivo', period: 'primer_tiempo' }, 'terminar_primer_tiempo'),
    ).toEqual({
      kind: 'apply',
      period: 'entretiempo',
      clockRuns: false,
    })
  })

  it('repetir un paso ya aplicado no avanza dos veces', () => {
    expect(
      resolveTransition({ status: 'en_vivo', period: 'primer_tiempo' }, 'iniciar_primer_tiempo'),
    ).toEqual({
      kind: 'already',
    })
    expect(
      resolveTransition({ status: 'en_vivo', period: 'segundo_tiempo' }, 'iniciar_segundo_tiempo'),
    ).toEqual({
      kind: 'already',
    })
  })

  it('rechaza un paso fuera de orden o en un partido que no se juega', () => {
    expect(resolveTransition({ status: 'programado', period: 'previa' }, 'iniciar_segundo_tiempo').kind).toBe(
      'invalid',
    )
    expect(resolveTransition({ status: 'finalizado', period: 'terminado' }, 'iniciar_primer_tiempo')).toEqual(
      {
        kind: 'invalid',
        message: 'El partido ya está finalizado.',
      },
    )
    expect(resolveTransition({ status: 'cancelado', period: 'previa' }, 'iniciar_primer_tiempo').kind).toBe(
      'invalid',
    )
  })

  it('los penales llegan desde el 2.º tiempo o el alargue', () => {
    expect(resolveTransition({ status: 'en_vivo', period: 'alargue' }, 'iniciar_penales')).toEqual({
      kind: 'apply',
      period: 'penales',
      clockRuns: false,
    })
    expect(availableTransitions('segundo_tiempo')).toEqual(['iniciar_alargue', 'iniciar_penales'])
    expect(availableTransitions('previa')).toEqual(['iniciar_primer_tiempo'])
    expect(availableTransitions('terminado')).toEqual([])
  })
})

describe('período de un evento', () => {
  const byMinute = () => 'segundo_tiempo' as const

  it('en vivo y con el reloj corriendo, es el del partido', () => {
    expect(eventPeriod('primer_tiempo', 'en_vivo', byMinute)).toBe('primer_tiempo')
    expect(eventPeriod('penales', 'en_vivo', byMinute)).toBe('penales')
  })

  it('en el entretiempo o en una carga posterior, sale del minuto', () => {
    expect(eventPeriod('entretiempo', 'en_vivo', byMinute)).toBe('segundo_tiempo')
    expect(eventPeriod('terminado', 'finalizado', byMinute)).toBe('segundo_tiempo')
  })
})
