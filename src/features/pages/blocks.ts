/**
 * Textos de páginas que se editan desde el panel (especificación 7.2 y 8.4). Las claves son fijas: cada
 * una corresponde a un lugar del sitio que sabe dibujarla. Lógica pura.
 */
export const PAGE_BLOCKS = {
  'historia.intro': {
    label: 'Historia · relato del club',
    where: 'Abre la página Historia, antes de la línea de tiempo.',
    href: '/historia',
  },
  'formativas.info': {
    label: 'Formativas · información',
    where: 'Página Divisiones formativas: filosofía, categorías y edades, requisitos y costo.',
    href: '/formativas',
  },
  'formativas.preguntas': {
    label: 'Formativas · preguntas frecuentes',
    where:
      'Página Divisiones formativas, al final. Cada pregunta como título y su respuesta debajo (incluye la política de fotos de menores).',
    href: '/formativas#preguntas',
  },
  'tienda.guia-tallas': {
    label: 'Tienda · guía de tallas',
    where: 'Ficha de cada producto de la tienda, en «Guía de tallas».',
    href: '/tienda',
  },
  'socios.beneficios': {
    label: 'Socios · beneficios',
    where: 'Página Hazte socio, antes de los planes.',
    href: '/socios',
  },
  'socios.preguntas': {
    label: 'Socios · preguntas frecuentes',
    where: 'Página Hazte socio, después del formulario. Cada pregunta como título y su respuesta debajo.',
    href: '/socios#preguntas',
  },
  'auspiciadores.beneficios': {
    label: 'Auspiciadores · beneficios por nivel',
    where: 'Página Auspiciadores, en «¿Quieres auspiciar al club?».',
    href: '/auspiciadores#auspiciar',
  },
  'donaciones.uso': {
    label: 'Apoya al club · uso de los aportes',
    where: 'Página Apoya al club, antes de los datos de transferencia.',
    href: '/apoya-al-club',
  },
  'privacidad.politica': {
    label: 'Política de privacidad',
    where:
      'Página Privacidad. Cada vez que la guardas cambia su versión: los formularios registran la versión que aceptó cada persona.',
    href: '/privacidad',
  },
} as const satisfies Record<string, { label: string; where: string; href: string | null }>

export type PageBlockKey = keyof typeof PAGE_BLOCKS

export function isPageBlockKey(value: unknown): value is PageBlockKey {
  return typeof value === 'string' && Object.hasOwn(PAGE_BLOCKS, value)
}
