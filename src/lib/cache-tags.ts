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
  history: () => 'history',
  media: () => 'media',
  social: () => 'social',
} as const
