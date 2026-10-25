import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { santiagoWallTime } from '@/features/matches/lib/schedule'
import type {
  CardMatch,
  CardTeam,
  MatchCardData,
  MatchdayData,
  ShareCardData,
  WeekendCardData,
} from '@/features/share/dto'
import { treatMatchdayPhoto } from '@/features/share/images'
import { SHARE_FORMATS, type ShareFormat } from '@/features/share/lib/cards'
import { renderShareCard } from '@/features/share/render'

// Dibuja las plantillas «Próximo partido» y «Programación» con datos de ejemplo (rivales, canchas y
// auspiciador ficticios, nunca datos del club) en `tmp/tarjetas/`, para revisar un diseño sin la base de
// datos. Las fotos de ejemplo son las imágenes del seed en `UPLOADS_DIR` (corre `pnpm db:seed` antes).
// Solo desarrollo: `node scripts/run.mjs share-preview`.

const root = process.cwd()
const OUT = path.join(root, 'tmp', 'tarjetas')

async function crest(file: string): Promise<string> {
  const png = await sharp(path.join(root, 'public', 'placeholder', file), { density: 300 })
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  return `data:image/png;base64,${png.toString('base64')}`
}

async function main() {
  const [clubCrest, rivalCrest] = await Promise.all([crest('escudo.svg'), crest('escudo-generico.svg')])
  const clubName = 'Club Deportivo Los Cachorros'
  const club: CardTeam = { name: 'Cachorros', crest: clubCrest }
  const rival: CardTeam = { name: 'Deportivo Ejemplo', crest: rivalCrest }
  const longRival: CardTeam = { name: 'Unión Villa Los Aromos', crest: null }
  const longestRival: CardTeam = { name: 'Social y Deportivo Población Ejemplo del Sur', crest: null }
  const at = (day: string, time: string) => santiagoWallTime(day, time).toISOString()

  const match = (overrides: Partial<CardMatch>): CardMatch => ({
    clubSide: 'local',
    home: club,
    away: rival,
    seriesName: 'Honor',
    competitionName: 'Campeonato de ejemplo',
    roundLabel: 'Fecha 7',
    kickoffAt: at('2026-10-31', '15:30'),
    venueName: 'Cancha de ejemplo',
    status: 'programado',
    resolution: 'normal',
    homeScore: 0,
    awayScore: 0,
    homePenalties: null,
    awayPenalties: null,
    ...overrides,
  })
  const away = (team: CardTeam, overrides: Partial<CardMatch> = {}) =>
    match({ clubSide: 'visita', home: team, away: club, venueName: 'Estadio de ejemplo', ...overrides })
  // Fotos de muestra: las que dejes en `tmp/fotos-muestra/` (1 en grises, 2 a color, 3 con velo naranjo).
  // Nunca van al repositorio. Si no están, las tarjetas se dibujan con el fondo del club.
  const samples = ['zapatos.jpg', 'balon.jpg', 'estadio.jpg']
  const samplePhotos = await Promise.all(
    samples.map(async (file, index) => {
      const bytes = await readFile(path.join(root, 'tmp', 'fotos-muestra', file)).catch(() => null)
      return bytes ? treatMatchdayPhoto(bytes, { focalX: 0.5, focalY: 0.6 }, index) : null
    }),
  )
  const withPhotos: MatchdayData = {
    sponsor: 'Ferretería de Ejemplo',
    photoSources: [null, null, null],
    photos: samplePhotos,
  }
  const noPhotos: MatchdayData = {
    sponsor: 'Ferretería de Ejemplo',
    photoSources: [null, null, null],
    photos: [null, null, null],
  }
  const next = (data: CardMatch, matchday: MatchdayData = withPhotos): MatchCardData => ({
    kind: 'match',
    template: 'proximo',
    clubName,
    match: data,
    scorers: { home: [], away: [] },
    goal: null,
    matchday,
  })
  const weekend = (
    matches: CardMatch[],
    sponsor: string | null = 'Ferretería de Ejemplo',
  ): WeekendCardData => ({
    kind: 'weekend',
    template: 'programacion',
    clubName,
    clubCrest,
    saturday: '2026-10-31',
    matches,
    sponsor,
  })

  const sameRival = [
    match({ seriesName: 'Infantil', kickoffAt: at('2026-10-31', '10:00') }),
    match({ seriesName: 'Juvenil', kickoffAt: at('2026-10-31', '11:45') }),
    match({ seriesName: 'Senior', kickoffAt: at('2026-10-31', '13:30') }),
    match({ seriesName: 'Honor', kickoffAt: at('2026-10-31', '15:30') }),
  ]
  const mixed = [
    ...sameRival,
    away(rival, { seriesName: 'Súper Senior', kickoffAt: at('2026-11-01', '10:00') }),
    away(longestRival, { seriesName: 'Segunda adulta', kickoffAt: at('2026-11-01', '12:00') }),
  ]
  const all: ShareFormat[] = ['vertical', 'cuadrado', 'historia', 'og']
  const cases: { name: string; formats: ShareFormat[]; data: ShareCardData }[] = [
    { name: 'matchday-con-fotos', formats: all, data: next(match({})) },
    { name: 'matchday-sin-fotos', formats: ['vertical', 'historia'], data: next(match({}), noPhotos) },
    { name: 'matchday-rival-sin-escudo', formats: ['vertical', 'cuadrado'], data: next(away(longRival)) },
    {
      name: 'matchday-nombre-muy-largo',
      formats: ['vertical', 'historia', 'og'],
      data: next(away(longestRival, { seriesName: 'Súper Senior' })),
    },
    { name: 'programacion-varios-rivales', formats: all, data: weekend(mixed) },
    { name: 'programacion-mismo-rival', formats: ['vertical', 'historia'], data: weekend(sameRival) },
    { name: 'programacion-sin-auspiciador', formats: ['vertical'], data: weekend(mixed, null) },
  ]

  await mkdir(OUT, { recursive: true })
  for (const item of cases) {
    for (const format of item.formats) {
      const bytes = await renderShareCard(item.data, format)
      await writeFile(path.join(OUT, `${item.name}-${format}.${SHARE_FORMATS[format].ext}`), bytes)
    }
  }
  console.log(`Listo: ${OUT}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
