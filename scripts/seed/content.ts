import { eq, inArray } from 'drizzle-orm'
import type { Tx } from '@/db/client'
import {
  albumItems,
  albums,
  hallOfFame,
  historicKits,
  historyMilestones,
  honours,
  news,
  newsCategories,
  newsSeries,
  pageBlocks,
  socialPosts,
  videos,
} from '@/db/schema'
import { santiagoDateTime } from '@/features/matches/lib/countdown'
import { formatLongDate, toIsoDate } from '@/lib/format'
import type { ClubSeed } from './club'
import { CLUB, NEWS_CATEGORIES } from './data'
import type { SeedMedia } from './media'
import type { SportSeed } from './sport'
import { must, plainText, richText, seedId, upsert } from './util'

type Options = { tx: Tx; now: Date; media: SeedMedia; sport: SportSeed; club: ClubSeed }

function listNames(names: string[]): string {
  const unique = [...new Set(names)]
  if (unique.length <= 1) return unique[0] ?? ''
  return `${unique.slice(0, -1).join(', ')} y ${unique.at(-1)}`
}

export async function seedContent({ tx, now, media, sport, club }: Options): Promise<void> {
  const categoryId = (slug: string) => seedId(`news-category:${slug}`)
  await upsert(
    tx,
    newsCategories,
    NEWS_CATEGORIES.map((category, index) => ({
      id: categoryId(category.slug),
      name: category.name,
      slug: category.slug,
      sortOrder: index + 1,
    })),
  )

  // ── Álbumes ──────────────────────────────────────────────────────────────────────────────────
  const honor = sport.lastPlayed('honor')
  const senior = sport.lastPlayed('senior-45')
  const albumDefs = [
    {
      key: 'honor',
      title: `Honor vs ${honor.rivalName} · Fecha ${honor.round}`,
      slug: `honor-fecha-${honor.round}-${sport.year}`,
      takenOn: toIsoDate(honor.kickoffAt),
      matchId: honor.id,
      eventId: null,
    },
    {
      key: 'aniversario',
      title: `Aniversario ${club.anniversary.number} del club`,
      slug: `aniversario-${club.anniversary.number}`,
      takenOn: club.anniversary.date,
      matchId: null,
      eventId: club.eventId('aniversario'),
    },
    {
      key: 'senior',
      title: `Senior 45 vs ${senior.rivalName} · Fecha ${senior.round}`,
      slug: `senior-45-fecha-${senior.round}-${sport.year}`,
      takenOn: toIsoDate(senior.kickoffAt),
      matchId: senior.id,
      eventId: null,
    },
  ]
  const albumId = (key: string) => seedId(`album:${key}`)
  await upsert(
    tx,
    albums,
    albumDefs.map((album, index) => ({
      id: albumId(album.key),
      title: album.title,
      slug: album.slug,
      takenOn: album.takenOn,
      coverMediaId: media.id(`album:${index}:0`),
      matchId: album.matchId,
      eventId: album.eventId,
      isPublished: true,
    })),
  )
  await upsert(
    tx,
    albumItems,
    albumDefs.flatMap((album, index) =>
      [0, 1, 2, 3].map((item) => ({
        id: seedId(`album-item:${album.key}:${item}`),
        albumId: albumId(album.key),
        mediaId: media.id(`album:${index}:${item}`),
        sortOrder: item,
        caption: 'Foto de ejemplo. [COMPLETAR: fotos reales del club]',
      })),
    ),
  )

  // ── Noticias (6) ─────────────────────────────────────────────────────────────────────────────
  const result = (m: typeof honor) => `${m.ownScore}-${m.rivalScore}`
  const where = (m: typeof honor) => (m.isHome ? 'en casa' : 'de visita')
  const daysAgo = (days: number, hour: number) => santiagoDateTime(now, -days, hour)

  const newsDefs = [
    {
      key: 'cronica-honor',
      title: `Honor se impuso ${result(honor)} ante ${honor.rivalName}`,
      type: 'cronica' as const,
      category: 'primer-equipo',
      series: ['honor'],
      matchId: honor.id,
      publishedAt: new Date(honor.kickoffAt.getTime() + 4 * 3600_000),
      isFeatured: true,
      paragraphs: [
        `Los Cachorros se quedaron con los tres puntos ${where(honor)} al vencer ${result(honor)} a ${honor.rivalName} por la fecha ${honor.round} del campeonato.`,
        honor.scorers.length > 0
          ? `Los goles del club fueron obra de ${listNames(honor.scorers)}. El equipo mostró orden en el fondo y supo aprovechar sus momentos frente al arco.`
          : 'El equipo mostró orden en el fondo y supo aprovechar sus momentos frente al arco.',
        'La serie de Honor vuelve a la cancha el próximo fin de semana. Revisa la programación completa en la sección Partidos.',
      ],
    },
    {
      key: 'triunfo-senior-45',
      title: `Senior 45 celebró un triunfo por ${result(senior)}`,
      type: 'noticia' as const,
      category: 'senior',
      series: ['senior-45'],
      matchId: senior.id,
      publishedAt: new Date(senior.kickoffAt.getTime() + 5 * 3600_000),
      paragraphs: [
        `La Senior 45 derrotó ${result(senior)} a ${senior.rivalName} ${where(senior)} y sumó tres puntos importantes en la tabla.`,
        'Experiencia y buen trato de balón marcaron un partido que el equipo controló de principio a fin.',
      ],
    },
    {
      key: 'completada',
      title: 'Este fin de semana hay completada a beneficio de las series',
      type: 'noticia' as const,
      category: 'eventos',
      series: [],
      matchId: null,
      publishedAt: daysAgo(3, 10),
      paragraphs: [
        'El club invita a toda la comunidad a la completada a beneficio de sus series. Lo reunido se destina a implementación deportiva y traslados.',
        'Valores, horario y forma de reservar: [COMPLETAR: datos reales de la completada].',
        'Revisa el detalle en la sección Eventos. ¡Te esperamos con la familia!',
      ],
    },
    {
      key: 'convocatoria-formativas',
      title: 'Abierta la convocatoria a las divisiones formativas',
      type: 'comunicado' as const,
      category: 'formativas',
      series: ['formativas'],
      matchId: null,
      publishedAt: daysAgo(5, 12),
      paragraphs: [
        'El club abre la convocatoria para niños, niñas y jóvenes que quieran sumarse a sus divisiones formativas.',
        'Categorías, edades, horarios y requisitos: [COMPLETAR: información real de la escuela de fútbol].',
        'La inscripción la realiza siempre un adulto responsable. Escríbenos por WhatsApp o desde la página de Contacto.',
      ],
    },
    {
      key: 'nueva-camiseta',
      title: 'Ya está disponible la nueva camiseta del club',
      type: 'noticia' as const,
      category: 'socios',
      series: [],
      matchId: null,
      publishedAt: daysAgo(8, 18),
      paragraphs: [
        'La nueva camiseta oficial ya se puede pedir en la tienda del club, en tallas de adulto e infantiles.',
        'Los pedidos se hacen por WhatsApp desde la sección Tienda. Precio y fecha de entrega: [COMPLETAR: datos reales de la camiseta].',
      ],
    },
    {
      key: 'aniversario',
      title: `Los Cachorros celebraron su aniversario número ${club.anniversary.number}`,
      type: 'noticia' as const,
      category: 'institucional',
      series: [],
      matchId: null,
      publishedAt: new Date(`${club.anniversary.date}T22:00:00Z`),
      paragraphs: [
        `El ${formatLongDate(new Date(`${club.anniversary.date}T16:00:00Z`))} el ${CLUB.name} cumplió ${club.anniversary.number} años de historia, desde su fundación el 1 de abril de 1934 en Sagrada Familia.`,
        'Socios, jugadores, exjugadores y familias se reunieron para celebrar una nueva vuelta al sol del club.',
        'Detalles de la celebración: [COMPLETAR: relato real del aniversario].',
      ],
    },
  ]

  const newsId = (key: string) => seedId(`news:${key}`)
  await upsert(
    tx,
    news,
    newsDefs.map((item, index) => ({
      id: newsId(item.key),
      title: item.title,
      slug: item.key,
      type: item.type,
      excerpt: must(item.paragraphs[0], 'primer párrafo'),
      body: richText(...item.paragraphs),
      bodyText: plainText(...item.paragraphs),
      coverMediaId: media.id(`news:${index}`),
      categoryId: categoryId(item.category),
      status: 'publicada' as const,
      publishedAt: item.publishedAt,
      isFeatured: item.isFeatured ?? false,
      matchId: item.matchId,
    })),
  )
  const seededNewsIds = newsDefs.map((item) => newsId(item.key))
  await tx.delete(newsSeries).where(inArray(newsSeries.newsId, seededNewsIds))
  const seriesLinks = newsDefs.flatMap((item) =>
    item.series.map((slug) => ({ newsId: newsId(item.key), seriesId: sport.seriesId(slug) })),
  )
  await tx.insert(newsSeries).values(seriesLinks)

  // ── Videos y redes ───────────────────────────────────────────────────────────────────────────
  await upsert(tx, videos, [
    {
      id: seedId('video:0'),
      title: 'Resumen del último partido de Honor',
      provider: 'youtube',
      url: '[COMPLETAR: URL del video]',
      publishedOn: toIsoDate(honor.kickoffAt),
      matchId: honor.id,
      isPublished: true,
    },
    {
      id: seedId('video:1'),
      title: 'Saludo de aniversario del club',
      provider: 'facebook',
      url: '[COMPLETAR: URL del video]',
      publishedOn: club.anniversary.date,
      isPublished: true,
    },
  ])

  const socialExcerpts = [
    'Así se vivió la última fecha en nuestra cancha.',
    '¡Vamos, Cachorros! Programación del fin de semana.',
    'Las formativas entrenan con todo.',
    'Gracias a nuestros auspiciadores por el apoyo.',
    'Se viene la completada del club.',
    'Postales de un nuevo aniversario.',
  ]
  await upsert(
    tx,
    socialPosts,
    socialExcerpts.map((excerpt, index) => ({
      id: seedId(`social:${index}`),
      platform: index % 3 === 2 ? ('facebook' as const) : ('instagram' as const),
      permalink: '[COMPLETAR: URL de la publicación]',
      imageMediaId: media.id(`social:${index}`),
      excerpt,
      postedOn: toIsoDate(santiagoDateTime(now, -(index * 3 + 1), 12)),
      sortOrder: index,
      isPublished: true,
    })),
  )

  // ── Historia: un solo hito real; el resto son marcadores por completar ───────────────────────
  const placeholderBody = '[COMPLETAR: relato, fecha exacta y foto de este hito]'
  const milestones = [
    {
      key: 'fundacion',
      occurredOn: CLUB.foundedOn,
      precision: 'dia' as const,
      title: 'Fundación del club',
      body: `El ${CLUB.name} se funda el 1 de abril de 1934 en Sagrada Familia, Región del Maule. [COMPLETAR: relato de la fundación y nombres de los fundadores]`,
      isPlaceholder: false,
    },
    {
      key: 'primer-titulo',
      occurredOn: '1934-12-31',
      precision: 'anio' as const,
      title: 'Primer título [COMPLETAR: año]',
    },
    {
      key: 'cancha',
      occurredOn: '1934-12-31',
      precision: 'anio' as const,
      title: 'Inauguración de la cancha [COMPLETAR: año]',
    },
    { key: '50', occurredOn: '1984-04-01', precision: 'dia' as const, title: '50 años del club' },
    { key: '75', occurredOn: '2009-04-01', precision: 'dia' as const, title: '75 años del club' },
    { key: '90', occurredOn: '2024-04-01', precision: 'dia' as const, title: '90 años del club' },
    { key: 'centenario', occurredOn: '2034-04-01', precision: 'dia' as const, title: 'Centenario 2034' },
  ]
  await upsert(
    tx,
    historyMilestones,
    milestones.map((milestone, index) => ({
      id: seedId(`milestone:${milestone.key}`),
      occurredOn: milestone.occurredOn,
      datePrecision: milestone.precision,
      title: milestone.title,
      body: milestone.body ?? placeholderBody,
      sortOrder: index,
      isPlaceholder: milestone.isPlaceholder ?? true,
    })),
  )

  await upsert(
    tx,
    honours,
    [0, 1, 2].map((index) => ({
      id: seedId(`honour:${index}`),
      name: '[COMPLETAR: título o campeonato obtenido]',
      competitionName: '[COMPLETAR: competencia]',
      description: '[COMPLETAR: año, serie y relato del título]',
    })),
  )
  await upsert(
    tx,
    hallOfFame,
    [0, 1, 2].map((index) => ({
      id: seedId(`hall-of-fame:${index}`),
      fullName: '[COMPLETAR: nombre del ídolo]',
      eraLabel: '[COMPLETAR: época]',
      bio: '[COMPLETAR: trayectoria en el club]',
      sortOrder: index,
    })),
  )
  await upsert(
    tx,
    historicKits,
    [0, 1, 2].map((index) => ({
      id: seedId(`kit:${index}`),
      description: '[COMPLETAR: camiseta histórica, años en que se usó y foto]',
      sortOrder: index,
    })),
  )

  // ── Textos de páginas ────────────────────────────────────────────────────────────────────────
  const blocks = [
    [
      'historia.intro',
      'Nuestra historia',
      `El ${CLUB.name} nace el 1 de abril de 1934 en Sagrada Familia. [COMPLETAR: relato de la historia del club]`,
    ],
    [
      'formativas.info',
      'Divisiones formativas',
      '[COMPLETAR: filosofía de la escuela, categorías, edades, horarios, requisitos y costos]',
    ],
    ['socios.beneficios', 'Beneficios de ser socio', '[COMPLETAR: beneficios de cada tipo de socio]'],
    ['donaciones.uso', '¿En qué se usan los aportes?', '[COMPLETAR: destino de los aportes y donaciones]'],
    [
      'privacidad.politica',
      'Política de privacidad',
      '[COMPLETAR: datos legales del club (personalidad jurídica, RUT, representante) y texto revisado de la política] [VERIFICAR: con asesoría legal, Ley 19.628 y Ley 21.719]',
    ],
  ] as const
  await upsert(
    tx,
    pageBlocks,
    blocks.map(([key, title, body]) => ({
      id: seedId(`page-block:${key}`),
      key,
      title,
      body: richText(body),
    })),
  )

  // La crónica de Honor queda enlazada a su álbum.
  await tx
    .update(news)
    .set({ albumId: albumId('honor') })
    .where(eq(news.id, newsId('cronica-honor')))
}
