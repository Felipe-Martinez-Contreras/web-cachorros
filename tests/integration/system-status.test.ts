import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { testDb } from './db-urls'

const { sql } = await import('@/db/client')
const { getSystemRuns } = await import('@/features/system/queries')

const admin = postgres(testDb.adminUrl, { max: 1, onnotice: () => {} })

beforeAll(async () => {
  await admin`delete from ops_runs`
})

afterAll(async () => {
  await admin`delete from ops_runs`
  await admin.end()
  await sql.end()
})

describe('Estado del sistema (ops_runs)', () => {
  it('sin ejecuciones, nada', async () => {
    expect(await getSystemRuns()).toEqual({ backup: null, restoreTest: null, disk: null })
  })

  it('toma la última ejecución de cada tarea, con sus detalles', async () => {
    // Como las escribe ops (docker/ops/lib/common.sh, record_run).
    await admin`insert into ops_runs (kind, status, started_at, finished_at, details) values
      ('respaldo', 'ok', '2026-10-19T07:15:00Z', '2026-10-19T07:16:00Z', '{"dump_bytes": 10}'),
      ('respaldo', 'error', '2026-10-20T07:15:00Z', '2026-10-20T07:15:30Z', '{"paso": "subida del volcado"}'),
      ('prueba_restauracion', 'ok', '2026-10-19T08:00:00Z', null, null),
      ('disco', 'ok', '2026-10-19T08:30:00Z', '2026-10-19T08:30:01Z', '{"percent": 37}')`
    const runs = await getSystemRuns()
    expect(runs.backup).toEqual({
      status: 'error',
      at: '2026-10-20T07:15:30.000Z',
      details: { paso: 'subida del volcado' },
    })
    expect(runs.restoreTest).toEqual({ status: 'ok', at: '2026-10-19T08:00:00.000Z', details: null })
    expect(runs.disk?.details).toEqual({ percent: 37 })
  })
})
