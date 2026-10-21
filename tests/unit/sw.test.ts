import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'

// Prueba la regla del service worker desde el archivo que se sirve (public/sw.js), no una copia.
type Strategy = 'bypass' | 'cache-first' | 'network-first'
type SwContext = {
  swStrategy: (
    request: { url: string; method: string; mode: string },
    origin: string,
    rules: unknown,
  ) => Strategy
  SW_RULES: unknown
  VERSION: string
  STATIC_CACHE: string
}

function loadWorker(version = 'sha-abc123'): SwContext {
  const source = readFileSync(path.resolve('public/sw.js'), 'utf8')
  const listeners: string[] = []
  const context = vm.createContext({
    URL,
    self: {
      location: { href: `https://cachorros.test/sw.js?v=${version}`, origin: 'https://cachorros.test' },
      addEventListener: (type: string) => listeners.push(type),
    },
  })
  // Las declaraciones `const` de nivel superior no quedan en el contexto: se exponen al final.
  vm.runInContext(`${source}\nthis.__sw = { swStrategy, SW_RULES, VERSION, STATIC_CACHE }`, context)
  expect(listeners.sort()).toEqual(['activate', 'fetch', 'install', 'message'])
  return (context as unknown as { __sw: SwContext }).__sw
}

const ORIGIN = 'https://cachorros.test'
const sw = loadWorker()
const strategy = (pathname: string, init: { method?: string; mode?: string; origin?: string } = {}) =>
  sw.swStrategy(
    {
      url: `${init.origin ?? ORIGIN}${pathname}`,
      method: init.method ?? 'GET',
      mode: init.mode ?? 'no-cors',
    },
    ORIGIN,
    sw.SW_RULES,
  )

describe('service worker', () => {
  it('nombra sus cachés con la versión de la app', () => {
    expect(sw.VERSION).toBe('sha-abc123')
    expect(sw.STATIC_CACHE).toBe('cachorros-static-sha-abc123')
    expect(loadWorker('').VERSION).toBe('dev')
  })

  it('nunca toca el panel, la API, otros orígenes ni lo que no es GET', () => {
    expect(strategy('/admin', { mode: 'navigate' })).toBe('bypass')
    expect(strategy('/admin/partidos/1/en-vivo', { mode: 'navigate' })).toBe('bypass')
    expect(strategy('/api/live/current')).toBe('bypass')
    expect(strategy('/api/share/resultado/x/og')).toBe('bypass')
    expect(strategy('/r/auspiciador/roble', { mode: 'navigate' })).toBe('bypass')
    expect(strategy('/sw.js')).toBe('bypass')
    expect(strategy('/', { mode: 'navigate', method: 'POST' })).toBe('bypass')
    expect(strategy('/_next/static/a.js', { origin: 'https://otro.test' })).toBe('bypass')
    expect(strategy('/', { mode: 'navigate', origin: 'https://www.instagram.com' })).toBe('bypass')
  })

  it('cache-first para estáticos, medios e íconos; network-first para las páginas', () => {
    expect(strategy('/_next/static/chunks/app.js')).toBe('cache-first')
    expect(strategy('/media/abc/w320.webp')).toBe('cache-first')
    expect(strategy('/icons/icon-192.png')).toBe('cache-first')
    expect(strategy('/', { mode: 'navigate' })).toBe('network-first')
    expect(strategy('/partidos/honor-vs-rival', { mode: 'navigate' })).toBe('network-first')
    // Lo demás (datos de navegación RSC, JSON) pasa directo a la red.
    expect(strategy('/partidos?_rsc=1')).toBe('bypass')
  })
})
