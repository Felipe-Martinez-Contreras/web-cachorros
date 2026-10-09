/** Las cuatro partes de Historia que se administran desde el panel (especificación 6.4). Lógica pura. */
export const HISTORY_SECTIONS = {
  hitos: {
    label: 'Línea de tiempo',
    one: 'hito',
    newLabel: 'Nuevo hito',
    description:
      'Los momentos importantes del club, en orden. Los que marques «por confirmar» se muestran así.',
    empty: 'Agrega el primero: la fundación, un título, la inauguración de la cancha.',
    publicHref: '/historia',
    sortable: false,
  },
  titulos: {
    label: 'Títulos',
    one: 'título',
    newLabel: 'Nuevo título',
    description: 'Campeonatos y copas ganados por cualquier serie.',
    empty: 'Agrega el primer título del club.',
    publicHref: '/historia/titulos',
    sortable: false,
  },
  'salon-de-la-fama': {
    label: 'Salón de la fama',
    one: 'ídolo',
    newLabel: 'Nuevo ídolo',
    description: 'Las personas que marcaron la historia del club.',
    empty: 'Agrega al primer ídolo del club.',
    publicHref: '/historia/salon-de-la-fama',
    sortable: true,
  },
  camisetas: {
    label: 'Camisetas históricas',
    one: 'camiseta',
    newLabel: 'Nueva camiseta',
    description: 'Las camisetas que ha usado el club a lo largo de los años.',
    empty: 'Agrega la primera camiseta, con su foto.',
    publicHref: '/historia/camisetas',
    sortable: true,
  },
} as const

export type HistorySection = keyof typeof HISTORY_SECTIONS

export const HISTORY_SECTION_KEYS = Object.keys(HISTORY_SECTIONS) as HistorySection[]

export function isHistorySection(value: unknown): value is HistorySection {
  return typeof value === 'string' && Object.hasOwn(HISTORY_SECTIONS, value)
}
