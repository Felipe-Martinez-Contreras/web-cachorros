import { eq } from 'drizzle-orm'
import type { Mock } from 'vitest'

type NextTestState = { headers: Headers; updateTag: Mock; revalidateTag: Mock }

/** Estado simulado de Next que prepara `next-mocks.ts` (archivo de `setupFiles`). */
export const nextState = (globalThis as unknown as { __nextTestState: NextTestState }).__nextTestState

const PASSWORD = 'clave-de-pruebas-2026'
export const TEST_ADMIN = {
  name: 'Admin Acciones',
  email: 'acciones-admin@cachorros.test',
  password: PASSWORD,
}
export const TEST_PRENSA = {
  name: 'Prensa Acciones',
  email: 'acciones-prensa@cachorros.test',
  password: PASSWORD,
}

/** Crea (si faltan) un administrador y un usuario sin permisos para probar la autorización. */
export async function ensureTestUsers(): Promise<{ adminId: string }> {
  const { db } = await import('@/db/client')
  const { user } = await import('@/db/schema')
  const { createAdmin } = await import('@/lib/auth/create-admin')
  await createAdmin(TEST_ADMIN, { reset: true })
  await createAdmin(TEST_PRENSA, { reset: true })
  await db.update(user).set({ role: 'prensa' }).where(eq(user.email, TEST_PRENSA.email))
  const [admin] = await db.select({ id: user.id }).from(user).where(eq(user.email, TEST_ADMIN.email))
  if (!admin) throw new Error('No se pudo crear el administrador de pruebas.')
  return { adminId: admin.id }
}

async function sessionHeaders(credentials: { email: string; password: string }): Promise<Headers> {
  const { getAuth } = await import('@/lib/auth')
  const { headers } = await getAuth().api.signInEmail({
    body: { email: credentials.email, password: credentials.password },
    returnHeaders: true,
  })
  const cookie = headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ')
  return new Headers({ cookie })
}

const cache = new Map<string, Headers>()

/** Deja la «petición» siguiente con la sesión indicada (o sin sesión) y limpia los espías de caché. */
export async function actAs(who: 'admin' | 'prensa' | 'nadie'): Promise<void> {
  nextState.updateTag.mockClear()
  nextState.revalidateTag.mockClear()
  if (who === 'nadie') {
    nextState.headers = new Headers()
    return
  }
  const credentials = who === 'admin' ? TEST_ADMIN : TEST_PRENSA
  let headers = cache.get(credentials.email)
  if (!headers) {
    headers = await sessionHeaders(credentials)
    cache.set(credentials.email, headers)
  }
  nextState.headers = new Headers(headers)
}

/** Tags invalidados por la última acción (con `updateTag` o `revalidateTag`). */
export function invalidatedTags(): string[] {
  return [...nextState.updateTag.mock.calls, ...nextState.revalidateTag.mock.calls].map((call) =>
    String(call[0]),
  )
}
