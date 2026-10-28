// Vigilante de /api/health. Docker marca la app «unhealthy» pero no la reinicia (eso solo lo hace Swarm), y un
// contenedor que la reinicie necesitaría el socket de Docker (mínimo privilegio en la VM). Por eso la app se
// cuida sola: si la BD no responde durante `restartAfterMs` seguidos, pide terminar y Docker la levanta de
// nuevo. Una respuesta buena en medio reinicia la cuenta. Lógica pura: el reloj se inyecta.

export type HealthWatchdog = {
  /** Anota el resultado de un chequeo; `true` si ya corresponde terminar el proceso. */
  record(ok: boolean): boolean
  /** Milisegundos que lleva fallando (0 si el último chequeo fue bueno). */
  failingFor(): number
}

export function createHealthWatchdog(options: {
  restartAfterMs: number
  now?: () => number
}): HealthWatchdog {
  const now = options.now ?? Date.now
  let failingSince: number | null = null
  return {
    record(ok) {
      if (ok) {
        failingSince = null
        return false
      }
      const at = now()
      failingSince ??= at
      return options.restartAfterMs > 0 && at - failingSince >= options.restartAfterMs
    },
    failingFor() {
      return failingSince === null ? 0 : now() - failingSince
    },
  }
}
