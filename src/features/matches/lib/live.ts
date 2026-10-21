import type { matchPeriod, matchStatus } from '@/db/schema/enums'

type Period = (typeof matchPeriod.enumValues)[number]
type Status = (typeof matchStatus.enumValues)[number]

/**
 * Pasos de la consola en vivo (especificación 7.3). Cada uno lleva de un período a otro; «Finalizar» es
 * aparte (`finalizarPartido`), porque pide confirmar el marcador y la forma de resolución.
 */
export const PERIOD_TRANSITIONS = {
  iniciar_primer_tiempo: { from: ['previa'], to: 'primer_tiempo' },
  terminar_primer_tiempo: { from: ['primer_tiempo'], to: 'entretiempo' },
  iniciar_segundo_tiempo: { from: ['entretiempo'], to: 'segundo_tiempo' },
  iniciar_alargue: { from: ['segundo_tiempo'], to: 'alargue' },
  iniciar_penales: { from: ['segundo_tiempo', 'alargue'], to: 'penales' },
} as const satisfies Record<string, { from: readonly Period[]; to: Period }>

export type PeriodTransition = keyof typeof PERIOD_TRANSITIONS

export const PERIOD_TRANSITION_KEYS = Object.keys(PERIOD_TRANSITIONS) as PeriodTransition[]

/** Períodos en que corre el reloj: al entrar en ellos se anota `period_started_at`. */
const RUNNING: ReadonlySet<Period> = new Set(['primer_tiempo', 'segundo_tiempo', 'alargue'])

export type TransitionResult =
  /** Se aplica: el partido pasa a `period` y queda en vivo. */
  | { kind: 'apply'; period: Period; clockRuns: boolean }
  /** Ya estaba en ese período: es un reintento (doble toque o cola sin conexión). No se hace nada. */
  | { kind: 'already' }
  | { kind: 'invalid'; message: string }

/**
 * Decide qué hacer con un paso de la consola. Es idempotente: si el partido ya está en el período al que
 * lleva el paso, se informa `already` y el reintento no avanza dos veces.
 */
export function resolveTransition(
  current: { status: Status; period: Period },
  transition: PeriodTransition,
): TransitionResult {
  const step = PERIOD_TRANSITIONS[transition]
  if (current.status === 'finalizado') {
    return { kind: 'invalid', message: 'El partido ya está finalizado.' }
  }
  if (current.status === 'cancelado' || current.status === 'postergado') {
    return { kind: 'invalid', message: 'Este partido no se está jugando: vuelve a programarlo primero.' }
  }
  if (current.period === step.to && current.status === 'en_vivo') return { kind: 'already' }
  if (!(step.from as readonly Period[]).includes(current.period)) {
    return { kind: 'invalid', message: 'Ese paso no corresponde al momento del partido. Recarga la consola.' }
  }
  return { kind: 'apply', period: step.to, clockRuns: RUNNING.has(step.to) }
}

/** Pasos que ofrece la consola según el período actual, en el orden en que se muestran. */
export function availableTransitions(period: Period): PeriodTransition[] {
  return PERIOD_TRANSITION_KEYS.filter((key) =>
    (PERIOD_TRANSITIONS[key].from as readonly Period[]).includes(period),
  )
}

/**
 * Período de un evento registrado en vivo: el del partido si está en juego o en penales; si no (carga
 * posterior o entretiempo), se deduce del minuto con `fallback`.
 */
export function eventPeriod(matchPeriod: Period, status: Status, fallback: () => Period): Period {
  if (status === 'en_vivo' && (RUNNING.has(matchPeriod) || matchPeriod === 'penales')) return matchPeriod
  return fallback()
}
