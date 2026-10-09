import { eq } from 'drizzle-orm'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { testDb } from './db-urls'
import { cleanSport } from './fixtures'

const { db, sql } = await import('@/db/client')
const { series, slugRedirects } = await import('@/db/schema')
const { recordSlugChange, resolveSlug } = await import('@/lib/slug-redirects')

const admin = postgres(testDb.adminUrl, { max: 1, onnotice: () => {} })

async function createSeries(name: string, slug: string): Promise<string> {
  const [row] = await db
    .insert(series)
    .values({ name, slug, shortName: name, kind: 'adulta' })
    .returning({ id: series.id })
  if (!row) throw new Error('No se pudo crear la serie de prueba.')
  return row.id
}

beforeAll(async () => {
  await cleanSport(admin)
  await admin`delete from slug_redirects`
})

afterAll(async () => {
  await cleanSport(admin)
  await admin`delete from slug_redirects`
  await admin.end()
  await sql.end()
})

describe('slugs únicos y redirecciones', () => {
  it('agrega el sufijo -2, -3 cuando el slug ya existe, y no choca consigo misma', async () => {
    const first = await createSeries('Senior 35', 'senior-35')
    await db.transaction(async (tx) => {
      expect(await resolveSlug(tx, series, 'Señor 35')).toBe('senor-35')
      expect(await resolveSlug(tx, series, 'Senior 35')).toBe('senior-35-2')
      // Al editar la misma fila, su propio slug no cuenta como tomado.
      expect(await resolveSlug(tx, series, 'Senior 35', first)).toBe('senior-35')
    })
    await createSeries('Senior 35 B', 'senior-35-2')
    await db.transaction(async (tx) => {
      expect(await resolveSlug(tx, series, 'Senior 35')).toBe('senior-35-3')
    })
  })

  it('guarda el slug anterior y, si se vuelve a él, deja de ser una redirección', async () => {
    const id = await createSeries('Tercera', 'tercera')
    await db.transaction((tx) => recordSlugChange(tx, 'series', id, 'tercera', 'tercera-serie'))
    let rows = await db.select().from(slugRedirects).where(eq(slugRedirects.entityId, id))
    expect(rows.map((row) => row.oldSlug)).toEqual(['tercera'])

    // Sin cambio no se escribe nada.
    await db.transaction((tx) => recordSlugChange(tx, 'series', id, 'tercera-serie', 'tercera-serie'))
    // De vuelta al original: «tercera» ya no redirige y «tercera-serie» pasa a hacerlo.
    await db.transaction((tx) => recordSlugChange(tx, 'series', id, 'tercera-serie', 'tercera'))
    rows = await db.select().from(slugRedirects).where(eq(slugRedirects.entityId, id))
    expect(rows.map((row) => row.oldSlug)).toEqual(['tercera-serie'])
  })

  it('un slug antiguo reutilizado por otra entidad apunta a la nueva dueña', async () => {
    const a = await createSeries('Juvenil', 'juvenil')
    const b = await createSeries('Juveniles B', 'juveniles-b')
    await db.transaction((tx) => recordSlugChange(tx, 'series', a, 'sub-17', 'juvenil'))
    await db.transaction((tx) => recordSlugChange(tx, 'series', b, 'sub-17', 'juveniles-b'))
    const rows = await db.select().from(slugRedirects).where(eq(slugRedirects.oldSlug, 'sub-17'))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.entityId).toBe(b)
  })
})
