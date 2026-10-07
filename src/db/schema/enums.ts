import { pgEnum } from 'drizzle-orm/pg-core'

// Los enums se agregan con las tablas que los usan (especificación 8.3). Agregar un valor = nueva migración.
export const opsRunKind = pgEnum('ops_run_kind', ['respaldo', 'prueba_restauracion', 'limpieza', 'disco'])
export const opsRunStatus = pgEnum('ops_run_status', ['ok', 'error'])
