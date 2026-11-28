/**
 * Secciones del sitio público que se pueden ocultar, con su ruta. Una sección oculta conserva su código,
 * sus tablas y su módulo del panel. Este módulo no importa nada (lo usa `proxy.ts`). En el sitio:
 * - responde 404 real: `proxy.ts` la reescribe antes del render y su página llama a `hideIfHidden()`
 *   (`src/lib/hidden-section.ts`) como segunda barrera;
 * - no aparece en los menús (`components/site/nav.ts`), la portada, el sitemap ni los enlaces internos.
 */
export const SECTION_PATHS = {
  goleadores: '/partidos/goleadores',
  directiva: '/club/directiva',
  formativas: '/formativas',
  tienda: '/tienda',
  transparencia: '/club/transparencia',
} as const

export type SectionKey = keyof typeof SECTION_PATHS

/** Secciones ocultas. Para volver a mostrar una, quítala de aquí (el `matcher` del proxy ya la cubre). */
export const HIDDEN_SECTIONS: ReadonlySet<SectionKey> = new Set<SectionKey>([
  'goleadores',
  'directiva',
  'formativas',
  'tienda',
  'transparencia',
])

export function isSectionHidden(key: SectionKey): boolean {
  return HIDDEN_SECTIONS.has(key)
}

/** La sección oculta a la que pertenece una dirección (la ruta o una subruta), sin mirar `?` ni `#`. */
export function hiddenSectionOf(href: string): SectionKey | null {
  const path = href.split(/[?#]/, 1)[0] ?? ''
  for (const key of HIDDEN_SECTIONS) {
    const base = SECTION_PATHS[key]
    if (path === base || path.startsWith(`${base}/`)) return key
  }
  return null
}

export function isHiddenPath(href: string): boolean {
  return hiddenSectionOf(href) !== null
}
