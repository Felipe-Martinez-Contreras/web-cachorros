// Navegación del sitio público (especificación 5.2). Las rutas son las del mapa de 5.1. Las secciones ocultas
// (`src/config/secciones.ts`) se quitan aquí mismo: ningún menú las recibe.
import { isHiddenPath } from '@/config/secciones'

export type NavItem = { href: string; label: string }

const visible = (items: NavItem[]): NavItem[] => items.filter((item) => !isHiddenPath(item.href))

export const EVENTS_HREF = '/eventos'

/** Menú horizontal de escritorio. */
export const MAIN_NAV: NavItem[] = visible([
  { href: '/noticias', label: 'Noticias' },
  { href: '/partidos', label: 'Partidos' },
  { href: '/plantel', label: 'Plantel' },
  { href: '/historia', label: 'Historia' },
])

/**
 * Desplegable «Club» (escritorio) y hoja «Más» (celular). «Eventos» solo se muestra con un evento próximo:
 * pasa por `clubNav()`. Las formas de apoyar al club están en «Hazte socio» (`/socios`).
 */
export const CLUB_NAV: NavItem[] = visible([
  { href: '/club/directiva', label: 'Directiva' },
  { href: '/club/transparencia', label: 'Transparencia' },
  { href: '/club/la-cancha', label: 'La cancha' },
  { href: '/formativas', label: 'Formativas' },
  { href: EVENTS_HREF, label: 'Eventos' },
  { href: '/galeria', label: 'Galería' },
  { href: '/auspiciadores', label: 'Auspiciadores' },
])

const STORE: NavItem = { href: '/tienda', label: 'Tienda' }
/** «Tienda» en el menú, o `null` si la sección está oculta. */
export const STORE_NAV: NavItem | null = isHiddenPath(STORE.href) ? null : STORE
export const MEMBERSHIP_NAV: NavItem = { href: '/socios', label: 'Hazte socio' }

export const FOOTER_NAV: NavItem[] = visible([
  { href: '/contacto', label: 'Contacto' },
  { href: '/club/transparencia', label: 'Transparencia' },
  { href: '/privacidad', label: 'Privacidad' },
])

/** Lo que el menú necesita saber de los datos: lo lee el marco del sitio (`loadNavState()`). */
export type NavState = { hasUpcomingEvent: boolean }

/** El menú «Club» según los datos: sin «Eventos» si no hay ningún evento próximo. */
export function clubNav(state: NavState): NavItem[] {
  return state.hasUpcomingEvent ? CLUB_NAV : CLUB_NAV.filter((item) => item.href !== EVENTS_HREF)
}

/** Las secciones principales, con la tienda si está visible. */
export function mainNavWithStore(): NavItem[] {
  return STORE_NAV ? [...MAIN_NAV, STORE_NAV] : MAIN_NAV
}
