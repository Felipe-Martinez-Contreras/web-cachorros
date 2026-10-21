/** Tags de caché centralizados y tipados (especificación 3.4). Toda mutación invalida el conjunto mínimo. */
export const tags = {
  settings: () => 'settings',
  news: () => 'news',
  newsItem: (id: string) => `news:${id}`,
  matches: () => 'matches',
  match: (id: string) => `match:${id}`,
  live: () => 'live',
  standings: (competitionId: string, seriesId: string) => `standings:${competitionId}:${seriesId}`,
  players: () => 'players',
  player: (id: string) => `player:${id}`,
  stats: () => 'stats',
  sponsors: () => 'sponsors',
  events: () => 'events',
  store: () => 'store',
  /** Directiva, documentos de transparencia y horarios de entrenamiento. */
  club: () => 'club',
  history: () => 'history',
  /** Álbumes de fotos y videos. */
  gallery: () => 'gallery',
  /** Textos de páginas editables desde el panel (`page_blocks`). */
  pages: () => 'pages',
  media: () => 'media',
  /** Planes de socio (`membership_plans`) de la página Hazte socio. */
  membership: () => 'membership',
  social: () => 'social',
} as const
