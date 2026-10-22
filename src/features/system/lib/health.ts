// «Estado del sistema» del panel (especificación 12.9): a partir de las últimas ejecuciones de ops, un
// mensaje en lenguaje simple para la directiva. Lógica pura.

export type OpsRunSummary = {
  status: 'ok' | 'error'
  /** Instante ISO de término (o de inicio, si no terminó). */
  at: string
  details: Record<string, unknown> | null
}

export type SystemRuns = {
  backup: OpsRunSummary | null
  restoreTest: OpsRunSummary | null
  disk: OpsRunSummary | null
}

export type SystemHealth = { level: 'ok' | 'aviso' | 'error'; message: string }

/** Un respaldo diario que lleva más de esto sin llegar ya es una falla. */
export const BACKUP_MAX_AGE_HOURS = 36
export const DISK_WARNING_PERCENT = 80

const HOUR = 3_600_000

/** Uso del disco registrado por el último chequeo, o `null`. */
export function diskPercent(disk: OpsRunSummary | null): number | null {
  const value = disk?.details?.percent
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Lo más grave primero: un respaldo que falló o no llega, una prueba de restauración fallida y, como aviso,
 * el disco lleno o la falta de respaldos (normal antes de publicar el sitio).
 */
export function systemHealth(runs: SystemRuns, now: Date): SystemHealth {
  const { backup, restoreTest, disk } = runs
  if (backup?.status === 'error')
    return { level: 'error', message: 'El último respaldo falló: avisa a soporte.' }
  if (backup && now.getTime() - Date.parse(backup.at) > BACKUP_MAX_AGE_HOURS * HOUR) {
    return { level: 'error', message: 'Hace más de un día que no se hace un respaldo: avisa a soporte.' }
  }
  if (restoreTest?.status === 'error') {
    return { level: 'error', message: 'La última prueba de restauración falló: avisa a soporte.' }
  }
  const percent = diskPercent(disk)
  if (disk?.status === 'error' || (percent !== null && percent >= DISK_WARNING_PERCENT)) {
    return {
      level: 'aviso',
      message: `El disco del servidor está ${percent !== null ? `al ${percent} %` : 'casi lleno'}: avisa a soporte.`,
    }
  }
  if (!backup) return { level: 'aviso', message: 'Todavía no hay respaldos registrados.' }
  return { level: 'ok', message: 'Todo en orden.' }
}
