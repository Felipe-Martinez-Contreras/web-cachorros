import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CLUB_NAV,
  clubNav,
  EVENTS_HREF,
  FOOTER_NAV,
  MAIN_NAV,
  mainNavWithStore,
  STORE_NAV,
} from '@/components/site/nav'
import { HIDDEN_SECTIONS, hiddenSectionOf, isHiddenPath, SECTION_PATHS } from '@/config/secciones'
import { galleryView, galleryViewHref } from '@/features/gallery/lib/view'

const hiddenPaths = [...HIDDEN_SECTIONS].map((key) => SECTION_PATHS[key])

describe('secciones ocultas', () => {
  it('reconoce la ruta, sus subrutas y sus parámetros, pero no un prefijo parecido', () => {
    expect(hiddenSectionOf('/tienda')).toBe('tienda')
    expect(hiddenSectionOf('/tienda/camiseta-oficial-local/pedido')).toBe('tienda')
    expect(hiddenSectionOf('/club/transparencia?categoria=rendicion')).toBe('transparencia')
    expect(hiddenSectionOf('/partidos/goleadores#tabla')).toBe('goleadores')
    expect(hiddenSectionOf('/tiendas')).toBeNull()
    expect(hiddenSectionOf('/partidos/posiciones')).toBeNull()
    expect(hiddenSectionOf('/club/la-cancha')).toBeNull()
  })

  it('ningún menú enlaza una sección oculta', () => {
    const links = [...MAIN_NAV, ...CLUB_NAV, ...FOOTER_NAV, ...mainNavWithStore()]
    if (STORE_NAV) links.push(STORE_NAV)
    expect(links.filter((item) => isHiddenPath(item.href))).toEqual([])
  })

  it('las secciones fusionadas ya no están en el menú', () => {
    expect(CLUB_NAV.map((item) => item.href)).not.toContain('/apoya-al-club')
    expect(CLUB_NAV.map((item) => item.href)).not.toContain('/videos')
  })

  it('el matcher del proxy cubre cada sección oculta (el 404 se decide antes del render)', () => {
    const source = readFileSync(path.resolve(import.meta.dirname, '../../src/proxy.ts'), 'utf8')
    const block = source.slice(source.indexOf('matcher: ['))
    const patterns = [...block.matchAll(/'([^']+)'/g)].map(([, pattern]) => pattern ?? '')
    const matches = (pattern: string, target: string) =>
      new RegExp(`^${pattern.replace(/\/:[\w]+\*/g, '(?:/.*)?').replace(/:[\w]+/g, '[^/]+')}$`).test(target)
    for (const target of hiddenPaths) {
      expect(
        patterns.some((pattern) => matches(pattern, target)),
        target,
      ).toBe(true)
    }
    expect(patterns.some((pattern) => matches(pattern, '/tienda/camiseta/pedido'))).toBe(true)
  })
})

describe('menú «Club»', () => {
  it('muestra «Eventos» solo cuando hay un evento próximo', () => {
    expect(clubNav({ hasUpcomingEvent: true }).map((item) => item.href)).toContain(EVENTS_HREF)
    expect(clubNav({ hasUpcomingEvent: false }).map((item) => item.href)).not.toContain(EVENTS_HREF)
  })
})

describe('pestañas de la galería', () => {
  it('solo `?vista=videos` abre los videos', () => {
    expect(galleryView('videos')).toBe('videos')
    expect(galleryView(undefined)).toBe('fotos')
    expect(galleryView(['videos', 'fotos'])).toBe('fotos')
    expect(galleryView('cualquiera')).toBe('fotos')
    expect(galleryViewHref('videos')).toBe('/galeria?vista=videos')
    expect(galleryViewHref('fotos')).toBe('/galeria')
  })
})
