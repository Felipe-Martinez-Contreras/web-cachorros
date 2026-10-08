import type { EventCardDTO } from '@/features/events/dto'
import type { MatchDTO, MatchEventDTO, StandingsDTO, TeamDTO } from '@/features/matches/dto'
import type { NewsCardDTO } from '@/features/news/dto'
import type { SocialPostDTO } from '@/features/social/dto'
import type { SponsorDTO } from '@/features/sponsors/dto'

// Datos de muestra para la página del sistema de diseño. No vienen de la BD: los nombres son genéricos
// a propósito («Rival A»), para que nadie los confunda con datos del club.

const club: TeamDTO = { name: 'Los Cachorros', shortName: 'Cachorros', crest: null, isOwnClub: true }
const rival = (letter: string): TeamDTO => ({
  name: `Rival ${letter}`,
  shortName: `Rival ${letter}`,
  crest: null,
  isOwnClub: false,
})

const base = {
  seriesName: 'Honor',
  seriesSlug: 'honor',
  competitionName: 'Campeonato de muestra',
  roundLabel: 'Fecha 5',
  periodStartedAt: null,
  halfLengthMinutes: 45,
  resolution: 'normal',
  clubSide: 'local',
  home: club,
  away: rival('A'),
  homePenalties: null,
  awayPenalties: null,
  venue: { name: 'Cancha de muestra', directionsUrl: null },
} as const

export function sampleMatches(now: Date) {
  const inDays = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString()
  const scheduled: MatchDTO = {
    ...base,
    id: 'programado',
    slug: 'muestra',
    kickoffAt: inDays(3),
    status: 'programado',
    period: 'previa',
    homeScore: 0,
    awayScore: 0,
  }
  const live: MatchDTO = {
    ...base,
    id: 'en-vivo',
    slug: 'muestra',
    kickoffAt: inDays(0),
    status: 'en_vivo',
    period: 'primer_tiempo',
    homeScore: 1,
    awayScore: 0,
  }
  const finished: MatchDTO = {
    ...base,
    id: 'finalizado',
    slug: 'muestra',
    kickoffAt: inDays(-4),
    status: 'finalizado',
    period: 'terminado',
    homeScore: 3,
    awayScore: 1,
  }
  return {
    scheduled,
    live,
    finished,
    liveSecond: {
      ...live,
      id: 'en-vivo-2',
      seriesName: 'Senior 45',
      period: 'segundo_tiempo',
      away: rival('B'),
      awayScore: 2,
    } satisfies MatchDTO,
    walkover: {
      ...finished,
      id: 'wo',
      resolution: 'walkover',
      homeScore: 3,
      awayScore: 0,
      away: rival('C'),
    } satisfies MatchDTO,
    penalties: {
      ...finished,
      id: 'penales',
      resolution: 'penales',
      homeScore: 1,
      awayScore: 1,
      homePenalties: 4,
      awayPenalties: 3,
    } satisfies MatchDTO,
    postponed: { ...scheduled, id: 'postergado', status: 'postergado', away: rival('D') } satisfies MatchDTO,
    alsoToday: [
      { ...scheduled, id: 'segunda', seriesName: 'Segunda', kickoffAt: inDays(3) },
      { ...scheduled, id: 'tercera', seriesName: 'Tercera', kickoffAt: inDays(3) },
    ] satisfies MatchDTO[],
  }
}

export const sampleEvents: MatchEventDTO[] = [
  {
    id: '1',
    type: 'gol',
    period: 'primer_tiempo',
    minute: 12,
    stoppageMinute: null,
    side: 'home',
    playerName: 'Jugador Uno',
    relatedPlayerName: null,
    comment: null,
  },
  {
    id: '2',
    type: 'tarjeta_amarilla',
    period: 'primer_tiempo',
    minute: 30,
    stoppageMinute: null,
    side: 'away',
    playerName: null,
    relatedPlayerName: null,
    comment: null,
  },
  {
    id: '3',
    type: 'gol_penal',
    period: 'primer_tiempo',
    minute: 45,
    stoppageMinute: 2,
    side: 'home',
    playerName: 'Jugador Dos',
    relatedPlayerName: null,
    comment: null,
  },
  {
    id: '4',
    type: 'comentario',
    period: 'entretiempo',
    minute: 45,
    stoppageMinute: null,
    side: null,
    playerName: null,
    relatedPlayerName: null,
    comment: 'Termina el primer tiempo.',
  },
  {
    id: '5',
    type: 'cambio',
    period: 'segundo_tiempo',
    minute: 60,
    stoppageMinute: null,
    side: 'home',
    playerName: 'Jugador Uno',
    relatedPlayerName: 'Jugador Tres',
    comment: null,
  },
  {
    id: '6',
    type: 'autogol',
    period: 'segundo_tiempo',
    minute: 71,
    stoppageMinute: null,
    side: 'home',
    playerName: 'Jugador Cuatro',
    relatedPlayerName: null,
    comment: null,
  },
  {
    id: '7',
    type: 'segunda_amarilla',
    period: 'segundo_tiempo',
    minute: 80,
    stoppageMinute: null,
    side: 'away',
    playerName: null,
    relatedPlayerName: null,
    comment: null,
  },
  {
    id: '8',
    type: 'tarjeta_roja',
    period: 'segundo_tiempo',
    minute: 85,
    stoppageMinute: null,
    side: 'home',
    playerName: 'Jugador Cinco',
    relatedPlayerName: null,
    comment: null,
  },
  {
    id: '9',
    type: 'penal_errado',
    period: 'segundo_tiempo',
    minute: 90,
    stoppageMinute: 3,
    side: 'away',
    playerName: null,
    relatedPlayerName: null,
    comment: null,
  },
]

export const sampleStandings: StandingsDTO = {
  seriesName: 'Honor',
  seriesSlug: 'honor',
  competitionName: 'Campeonato de muestra',
  asOf: '2026-10-04',
  sourceNote: 'Datos de muestra.',
  rows: ['A', 'B', 'Cachorros', 'C', 'D', 'E'].map((name, index) => ({
    position: index + 1,
    team: name === 'Cachorros' ? club : rival(name),
    played: 7,
    won: 6 - index,
    drawn: 1,
    lost: index,
    goalsFor: 18 - index * 2,
    goalsAgainst: 5 + index * 2,
    goalDiff: 13 - index * 4,
    points: (6 - index) * 3 + 1,
  })),
}

export const sampleNews: NewsCardDTO[] = [
  {
    id: 'n1',
    slug: 'muestra',
    title: 'Titular de muestra de una noticia destacada del club',
    excerpt: 'Bajada de muestra: una o dos líneas que resumen la noticia y la invitan a leer completa.',
    type: 'cronica',
    categoryName: 'Primer equipo',
    publishedAt: '2026-10-04T23:00:00Z',
    cover: null,
  },
  {
    id: 'n2',
    slug: 'muestra',
    title: 'Comunicado de muestra de la directiva',
    excerpt: 'Bajada de muestra del comunicado.',
    type: 'comunicado',
    categoryName: 'Institucional',
    publishedAt: '2026-10-02T15:00:00Z',
    cover: null,
  },
]

export const sampleEvent: EventCardDTO = {
  id: 'e1',
  slug: 'muestra',
  title: 'Evento de muestra',
  type: 'completada',
  startsAt: '2026-10-17T16:00:00Z',
  locationText: 'Lugar de muestra',
  priceText: null,
  poster: null,
}

export const sampleSponsors: SponsorDTO[] = [
  { id: 's1', slug: 'muestra', name: 'Auspiciador principal', tier: 'principal', logo: null, hasLink: false },
  { id: 's2', slug: 'muestra', name: 'Auspiciador oficial', tier: 'oficial', logo: null, hasLink: false },
  { id: 's3', slug: 'muestra', name: 'Colaborador uno', tier: 'colaborador', logo: null, hasLink: false },
  { id: 's4', slug: 'muestra', name: 'Colaborador dos', tier: 'colaborador', logo: null, hasLink: false },
]

export const sampleSocialPosts: SocialPostDTO[] = [
  { id: 'p1', platform: 'instagram', permalink: null, excerpt: 'Publicación de muestra', image: null },
  { id: 'p2', platform: 'facebook', permalink: null, excerpt: 'Otra publicación de muestra', image: null },
]
