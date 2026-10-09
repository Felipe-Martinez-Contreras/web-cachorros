import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { runMigrations } from '../../scripts/lib/migrate'
import { testDb } from './db-urls'

const app = postgres(testDb.appUrl, { max: 1, onnotice: () => {} })
const admin = postgres(testDb.adminUrl, { max: 1, onnotice: () => {} })

afterAll(async () => {
  await Promise.all([app.end(), admin.end()])
})

describe('migraciones', () => {
  it('crean las tablas del modelo completo y la vista de estadísticas', async () => {
    const rows = await admin<{ table_name: string; table_type: string }[]>`
      select table_name, table_type from information_schema.tables where table_schema = 'public' order by 1`
    const tables = rows.filter((r) => r.table_type === 'BASE TABLE').map((r) => r.table_name)
    // 52 del modelo + `two_factor` (verificación en dos pasos, migración 0003).
    expect(tables).toHaveLength(53)
    expect(tables).toEqual(
      expect.arrayContaining([
        'account',
        'audit_log',
        'matches',
        'media_assets',
        'news',
        'ops_runs',
        'rate_limit',
        'session',
        'site_settings',
        'sponsors',
        'two_factor',
        'user',
        'verification',
      ]),
    )
    expect(rows.filter((r) => r.table_type === 'VIEW').map((r) => r.table_name)).toEqual([
      'v_player_season_stats',
    ])
  })

  it('deja la fila única de configuración con los datos confirmados del club', async () => {
    const rows = await app`select id, club_name, short_name, founded_on::text from site_settings`
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: 1,
      club_name: 'Club Deportivo Los Cachorros',
      founded_on: '1934-04-01',
    })
  })

  it('no permite una segunda fila de configuración', async () => {
    await expect(
      admin`insert into site_settings (id, club_name, short_name, founded_on) values (2, 'x', 'x', '1934-04-01')`,
    ).rejects.toThrow(/site_settings_single_row/)
  })

  it('genera ids con uuidv7() nativo', async () => {
    const [row] = await admin<{ id: string }[]>`
      insert into ops_runs (kind, status, started_at) values ('respaldo', 'ok', now()) returning id`
    expect(row?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/)
    await admin`delete from ops_runs`
  })

  it('es idempotente: volver a migrar no falla ni duplica', async () => {
    await runMigrations({ adminUrl: testDb.adminUrl, appUrl: testDb.appUrl })
    const [row] = await admin<{ n: number }[]>`select count(*)::int as n from site_settings`
    expect(row?.n).toBe(1)
  })
})

describe('rol restringido de la app (especificación 9.7)', () => {
  it('puede leer y escribir datos', async () => {
    const [row] = await app<{ n: number }[]>`select count(*)::int as n from site_settings`
    expect(row?.n).toBe(1)
    await app`insert into audit_log (action) values ('prueba.rol')`
    await app`delete from audit_log where action = 'prueba.rol'`
  })

  it('no puede cambiar el esquema ni vaciar tablas', async () => {
    await expect(app`create table intrusa (id int)`).rejects.toThrow(/permission denied/)
    await expect(app`drop table audit_log`).rejects.toThrow(/must be owner/)
    await expect(app`alter table "user" add column x int`).rejects.toThrow(/must be owner/)
    await expect(app`truncate audit_log`).rejects.toThrow(/permission denied/)
  })

  it('no es superusuario ni puede crear roles o bases', async () => {
    const [row] = await app<{ rolsuper: boolean; rolcreaterole: boolean; rolcreatedb: boolean }[]>`
      select rolsuper, rolcreaterole, rolcreatedb from pg_roles where rolname = current_user`
    expect(row).toEqual({ rolsuper: false, rolcreaterole: false, rolcreatedb: false })
  })
})
