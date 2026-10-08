// Datos de ejemplo del seed (especificación, sección 13). Los rivales, comercios y personas son FICTICIOS.
// Todo dato real del club que no está confirmado va como marcador [COMPLETAR: …].

export const CLUB = {
  name: 'Club Deportivo Los Cachorros',
  shortName: 'Cachorros',
  slug: 'los-cachorros',
  foundedOn: '1934-04-01',
  commune: 'Sagrada Familia',
  region: 'Región del Maule',
} as const

/** Teléfono de ejemplo, reconocible y no asignable: `pnpm content:pending` lo reporta como pendiente. */
export const EXAMPLE_PHONE = '+56900000000'

export type SeriesSeed = {
  slug: string
  name: string
  shortName: string
  kind: 'adulta' | 'senior' | 'juvenil' | 'formativa'
  containsMinors: boolean
  /** Día (0 = domingo … 6 = sábado) y hora de sus partidos; `null` si la serie no compite en el seed. */
  matchDay: { weekday: number; hour: number; minute: number } | null
  /** Rango de edad de los jugadores de ejemplo. */
  ages: [number, number]
  training: { weekday: number; startsAt: string; endsAt: string }[]
}

export const SERIES: SeriesSeed[] = [
  {
    slug: 'honor',
    name: 'Honor',
    shortName: 'Honor',
    kind: 'adulta',
    containsMinors: false,
    matchDay: { weekday: 0, hour: 16, minute: 0 },
    ages: [20, 32],
    training: [
      { weekday: 2, startsAt: '20:00', endsAt: '21:30' },
      { weekday: 4, startsAt: '20:00', endsAt: '21:30' },
    ],
  },
  {
    slug: 'segunda',
    name: 'Segunda',
    shortName: 'Segunda',
    kind: 'adulta',
    containsMinors: false,
    matchDay: { weekday: 0, hour: 14, minute: 0 },
    ages: [19, 34],
    training: [
      { weekday: 2, startsAt: '20:00', endsAt: '21:30' },
      { weekday: 4, startsAt: '20:00', endsAt: '21:30' },
    ],
  },
  {
    slug: 'tercera',
    name: 'Tercera',
    shortName: 'Tercera',
    kind: 'adulta',
    containsMinors: false,
    matchDay: { weekday: 0, hour: 12, minute: 0 },
    ages: [18, 36],
    training: [{ weekday: 3, startsAt: '20:00', endsAt: '21:30' }],
  },
  {
    slug: 'juvenil',
    name: 'Juvenil',
    shortName: 'Juvenil',
    kind: 'juvenil',
    containsMinors: true,
    matchDay: { weekday: 6, hour: 11, minute: 0 },
    ages: [15, 17],
    training: [
      { weekday: 1, startsAt: '18:30', endsAt: '20:00' },
      { weekday: 3, startsAt: '18:30', endsAt: '20:00' },
    ],
  },
  {
    slug: 'senior-35',
    name: 'Senior 35',
    shortName: 'Senior 35',
    kind: 'senior',
    containsMinors: false,
    matchDay: { weekday: 6, hour: 17, minute: 30 },
    ages: [35, 44],
    training: [{ weekday: 3, startsAt: '21:00', endsAt: '22:00' }],
  },
  {
    slug: 'senior-45',
    name: 'Senior 45',
    shortName: 'Senior 45',
    kind: 'senior',
    containsMinors: false,
    matchDay: { weekday: 6, hour: 16, minute: 0 },
    ages: [45, 49],
    training: [{ weekday: 5, startsAt: '20:30', endsAt: '21:30' }],
  },
  {
    slug: 'senior-50',
    name: 'Senior 50',
    shortName: 'Senior 50',
    kind: 'senior',
    containsMinors: false,
    matchDay: { weekday: 6, hour: 14, minute: 30 },
    ages: [50, 58],
    training: [{ weekday: 5, startsAt: '19:30', endsAt: '20:30' }],
  },
  {
    slug: 'formativas',
    name: 'Formativas',
    shortName: 'Formativas',
    kind: 'formativa',
    containsMinors: true,
    matchDay: null,
    ages: [6, 14],
    training: [
      { weekday: 2, startsAt: '17:30', endsAt: '19:00' },
      { weekday: 4, startsAt: '17:30', endsAt: '19:00' },
    ],
  },
]

/** Clubes rivales ficticios, con sabor local. Nunca nombres de clubes reales de la comuna. */
export const RIVALS = [
  { slug: 'deportivo-los-litres', name: 'Deportivo Los Litres', shortName: 'Los Litres', initials: 'DLL' },
  { slug: 'union-el-boldo', name: 'Unión El Boldo', shortName: 'El Boldo', initials: 'UEB' },
  {
    slug: 'juventud-los-maitenes',
    name: 'Juventud Los Maitenes',
    shortName: 'Los Maitenes',
    initials: 'JLM',
  },
  { slug: 'atletico-las-diucas', name: 'Atlético Las Diucas', shortName: 'Las Diucas', initials: 'ALD' },
  { slug: 'estrella-del-quillay', name: 'Estrella del Quillay', shortName: 'El Quillay', initials: 'EQ' },
  { slug: 'deportivo-el-arrayan', name: 'Deportivo El Arrayán', shortName: 'El Arrayán', initials: 'DEA' },
  { slug: 'union-los-peumos', name: 'Unión Los Peumos', shortName: 'Los Peumos', initials: 'ULP' },
  { slug: 'real-los-espinos', name: 'Real Los Espinos', shortName: 'Los Espinos', initials: 'RLE' },
  {
    slug: 'independiente-el-canelo',
    name: 'Independiente El Canelo',
    shortName: 'El Canelo',
    initials: 'IEC',
  },
  {
    slug: 'defensor-las-tortolas',
    name: 'Defensor Las Tórtolas',
    shortName: 'Las Tórtolas',
    initials: 'DLT',
  },
  { slug: 'deportivo-la-patagua', name: 'Deportivo La Patagua', shortName: 'La Patagua', initials: 'DLP' },
] as const

export const FIRST_NAMES = [
  'Matías',
  'Sebastián',
  'Cristóbal',
  'Felipe',
  'Nicolás',
  'Diego',
  'Ignacio',
  'Benjamín',
  'Vicente',
  'Tomás',
  'Joaquín',
  'Martín',
  'Francisco',
  'Rodrigo',
  'Gonzalo',
  'Claudio',
  'Patricio',
  'Marcelo',
  'Héctor',
  'Luis',
  'Juan Pablo',
  'José Miguel',
  'Cristian',
  'Mauricio',
  'Álvaro',
  'Esteban',
  'Camilo',
  'Bastián',
  'Maximiliano',
  'Alexis',
  'Jorge',
  'Pedro',
  'Ricardo',
  'Sergio',
  'Víctor',
  'Manuel',
  'Óscar',
  'Hernán',
  'Raúl',
  'Eduardo',
] as const

export const LAST_NAMES = [
  'González',
  'Muñoz',
  'Rojas',
  'Díaz',
  'Pérez',
  'Soto',
  'Contreras',
  'Silva',
  'Martínez',
  'Sepúlveda',
  'Morales',
  'Rodríguez',
  'López',
  'Fuentes',
  'Hernández',
  'Torres',
  'Araya',
  'Flores',
  'Espinoza',
  'Valenzuela',
  'Castillo',
  'Tapia',
  'Reyes',
  'Gutiérrez',
  'Castro',
  'Pizarro',
  'Álvarez',
  'Vásquez',
  'Sánchez',
  'Fernández',
  'Ramírez',
  'Carrasco',
  'Gómez',
  'Cortés',
  'Herrera',
  'Núñez',
  'Jara',
  'Vergara',
  'Rivera',
  'Figueroa',
  'Riquelme',
  'García',
  'Miranda',
  'Bravo',
  'Vera',
  'Molina',
  'Vega',
  'Campos',
  'Sandoval',
  'Orellana',
] as const

export const NICKNAMES = [
  'Chino',
  'Negro',
  'Flaco',
  'Pelao',
  'Chico',
  'Mago',
  'Tanque',
  'Rucio',
  'Guatón',
  'Pollo',
  'Gato',
  'Loco',
  'Huaso',
  'Zurdo',
  'Maestro',
  'Colocho',
  'Tito',
  'Lalo',
  'Nacho',
  'Pipe',
] as const

/** Plantel de 15: 2 arqueros, 5 defensas, 5 mediocampistas y 3 delanteros. */
export const SQUAD_SHAPE = [
  { position: 'arquero', count: 2, details: [null, null] },
  {
    position: 'defensa',
    count: 5,
    details: ['central', 'central', 'lateral_derecho', 'lateral_izquierdo', 'central'],
  },
  {
    position: 'mediocampista',
    count: 5,
    details: [
      'volante_contencion',
      'volante_mixto',
      'volante_creativo',
      'volante_mixto',
      'volante_contencion',
    ],
  },
  { position: 'delantero', count: 3, details: ['centrodelantero', 'extremo_derecho', 'extremo_izquierdo'] },
] as const

export const NEWS_CATEGORIES = [
  { slug: 'primer-equipo', name: 'Primer equipo' },
  { slug: 'senior', name: 'Senior' },
  { slug: 'formativas', name: 'Formativas' },
  { slug: 'institucional', name: 'Institucional' },
  { slug: 'socios', name: 'Socios' },
  { slug: 'eventos', name: 'Eventos' },
] as const

export const SPONSORS = [
  { slug: 'ferreteria-el-roble', name: 'Ferretería El Roble (ejemplo)', mark: 'El Roble', tier: 'principal' },
  { slug: 'panaderia-la-espiga', name: 'Panadería La Espiga (ejemplo)', mark: 'La Espiga', tier: 'oficial' },
  {
    slug: 'minimarket-don-tito',
    name: 'Minimarket Don Tito (ejemplo)',
    mark: 'Don Tito',
    tier: 'colaborador',
  },
  {
    slug: 'transportes-ruta-sur',
    name: 'Transportes Ruta Sur (ejemplo)',
    mark: 'Ruta Sur',
    tier: 'colaborador',
  },
] as const

export const PRODUCTS = [
  {
    slug: 'camiseta-oficial-local',
    name: 'Camiseta oficial (local)',
    category: 'indumentaria',
    garment: 'camiseta',
    fill: '#0b0b0c',
    priceClp: 18000,
    sizes: ['S', 'M', 'L', 'XL', 'XXL', '8 años', '10 años', '12 años', '14 años'],
    description: 'Camiseta de juego del club. [COMPLETAR: descripción, tela y fotos reales del producto]',
  },
  {
    slug: 'camiseta-oficial-alternativa',
    name: 'Camiseta oficial (alternativa)',
    category: 'indumentaria',
    garment: 'camiseta',
    fill: '#ffffff',
    priceClp: 18000,
    sizes: ['S', 'M', 'L', 'XL', 'XXL', '8 años', '10 años', '12 años', '14 años'],
    description: 'Camiseta alternativa del club. [COMPLETAR: descripción, tela y fotos reales del producto]',
  },
  {
    slug: 'poleron-del-club',
    name: 'Polerón del club',
    category: 'indumentaria',
    garment: 'poleron',
    fill: '#2b2b2b',
    priceClp: 25000,
    sizes: ['S', 'M', 'L', 'XL', '10 años', '12 años', '14 años'],
    description: 'Polerón con el escudo bordado. [COMPLETAR: descripción y fotos reales del producto]',
  },
  {
    slug: 'jockey-del-club',
    name: 'Jockey del club',
    category: 'accesorios',
    garment: 'jockey',
    fill: '#0b0b0c',
    priceClp: 8000,
    sizes: ['Talla única'],
    description: 'Jockey ajustable con el escudo. [COMPLETAR: descripción y fotos reales del producto]',
  },
  {
    slug: 'bufanda-del-club',
    name: 'Bufanda del club',
    category: 'accesorios',
    garment: 'bufanda',
    fill: '#f27604',
    priceClp: 10000,
    sizes: ['Talla única'],
    description: 'Bufanda para alentar en la cancha. [COMPLETAR: descripción y fotos reales del producto]',
  },
] as const
