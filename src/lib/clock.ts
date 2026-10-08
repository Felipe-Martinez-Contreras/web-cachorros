/** Zona horaria del club: todo se muestra y se razona aquí (especificación 3.8). */
export const TIME_ZONE = 'America/Santiago'

/** Reloj inyectable: la lógica que depende de «ahora» lo recibe para poder probarse con una hora fija. */
export type Clock = { now: () => Date }

export const systemClock: Clock = { now: () => new Date() }

export function fixedClock(at: Date | string): Clock {
  const instant = new Date(at)
  return { now: () => new Date(instant) }
}
