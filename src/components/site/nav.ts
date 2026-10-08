// Navegación del sitio público (especificación 5.2). Las rutas son las del mapa de 5.1.

export type NavItem = { href: string; label: string }

/** Menú horizontal de escritorio. */
export const MAIN_NAV: NavItem[] = [
  { href: '/noticias', label: 'Noticias' },
  { href: '/partidos', label: 'Partidos' },
  { href: '/plantel', label: 'Plantel' },
  { href: '/historia', label: 'Historia' },
]

/** Desplegable «Club» (escritorio) y hoja «Más» (celular). */
export const CLUB_NAV: NavItem[] = [
  { href: '/club/directiva', label: 'Directiva' },
  { href: '/club/transparencia', label: 'Transparencia' },
  { href: '/club/la-cancha', label: 'La cancha' },
  { href: '/formativas', label: 'Formativas' },
  { href: '/eventos', label: 'Eventos' },
  { href: '/galeria', label: 'Galería' },
  { href: '/auspiciadores', label: 'Auspiciadores' },
  { href: '/apoya-al-club', label: 'Apoya al club' },
]

export const STORE_NAV: NavItem = { href: '/tienda', label: 'Tienda' }
export const MEMBERSHIP_NAV: NavItem = { href: '/socios', label: 'Hazte socio' }

export const FOOTER_NAV: NavItem[] = [
  { href: '/contacto', label: 'Contacto' },
  { href: '/club/transparencia', label: 'Transparencia' },
  { href: '/privacidad', label: 'Privacidad' },
]
