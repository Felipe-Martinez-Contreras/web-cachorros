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
    where: 'Página Divisiones formativas.',
    href: null,
  },
  'socios.beneficios': {
    label: 'Socios · beneficios',
    where: 'Página Hazte socio.',
    href: null,
  },
  'donaciones.uso': {
    label: 'Apoya al club · uso de los aportes',
    where: 'Página Apoya al club.',
    href: null,
  },
  'privacidad.politica': {
    label: 'Política de privacidad',
    where: 'Página Privacidad.',
    href: null,
  },
} as const satisfies Record<string, { label: string; where: string; href: string | null }>

export type PageBlockKey = keyof typeof PAGE_BLOCKS

export function isPageBlockKey(value: unknown): value is PageBlockKey {
  return typeof value === 'string' && Object.hasOwn(PAGE_BLOCKS, value)
}
