import { vi } from 'vitest'

/**
 * Las Server Actions y los Route Handlers corren fuera de Next en estas pruebas: se simulan las cabeceras
 * de la petición (de ahí sale la sesión), la invalidación de caché y la navegación. El estado queda en
 * `globalThis` para que `session.ts` lo comparta con cada archivo de prueba.
 */
const state = vi.hoisted(() => {
  const value = {
    headers: new Headers(),
    updateTag: vi.fn(),
    revalidateTag: vi.fn(),
  }
  ;(globalThis as { __nextTestState?: typeof value }).__nextTestState = value
  return value
})

vi.mock('next/headers', () => ({ headers: async () => state.headers }))
vi.mock('next/cache', () => ({
  updateTag: state.updateTag,
  revalidateTag: state.revalidateTag,
  cacheTag: () => {},
  cacheLife: () => {},
}))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`)
  },
  notFound: () => {
    throw new Error('NOT_FOUND')
  },
}))
