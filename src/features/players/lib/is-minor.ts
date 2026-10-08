import { yearsBetween } from '@/lib/format'

const ADULT_AGE = 18

type PlayerAge = { birthDate: string | null }
type RegistrationSeries = { containsMinors: boolean }

/**
 * Única regla para tratar a un jugador como menor de edad (especificación 6.3 y 8.6). La usan todos los
 * DTOs públicos, el JSON-LD y el sitemap.
 *
 * - Con fecha de nacimiento: es menor si tiene menos de 18 años hoy (un juvenil que juega en una serie
 *   adulta sigue siendo menor).
 * - Sin fecha registrada: es menor si está inscrito en alguna serie con `contains_minors`.
 *
 * `today` es la fecha de calendario en Santiago (`YYYY-MM-DD`).
 */
export function isMinor(
  player: PlayerAge,
  registrations: readonly RegistrationSeries[],
  today: string,
): boolean {
  if (player.birthDate) return yearsBetween(player.birthDate, today) < ADULT_AGE
  return registrations.some((registration) => registration.containsMinors)
}

type PlayerName = { firstName: string; lastName: string; nickname?: string | null }

/** Nombre público: completo para adultos; nombre + inicial del apellido para menores (sin apodo). */
export function publicPlayerName(player: PlayerName, minor: boolean): string {
  if (!minor) return `${player.firstName} ${player.lastName}`
  const initial = player.lastName.trim().charAt(0).toUpperCase()
  return initial ? `${player.firstName} ${initial}.` : player.firstName
}
