import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { santiagoWallTime } from '@/features/matches/lib/schedule'
import type {
  CardCrest,
  CardMatch,
  CardTeam,
  JornadaCardData,
  MatchCardData,
  MatchdayData,
  ShareCardData,
  WeekendCardData,
} from '@/features/share/dto'
import { treatMatchdayPhoto } from '@/features/share/images'
import { SHARE_FORMATS, type ShareFormat } from '@/features/share/lib/cards'
import { renderShareCard } from '@/features/share/render'
import { crestScale } from '@/lib/images/crest'
import { processImage } from '@/lib/images/process'

// Dibuja las plantillas «Próximo partido», «Jornada» y «Programación» con datos de ejemplo (rivales, canchas y
// auspiciador ficticios, nunca datos del club) en `tmp/tarjetas/`, para revisar un diseño sin la base de
// datos. Incluye escudos de prueba (fondo de color, margen blanco, alto y ancho) procesados como una subida.
// Solo desarrollo: `node scripts/run.mjs share-preview`.

const root = process.cwd()
const OUT = path.join(root, 'tmp', 'tarjetas')

/**
 * Escudo de prueba procesado igual que una subida desde el panel (`processImage`, recorte y medidas), en
 * `tmp/tarjetas/escudos/`: la tarjeta lo dibuja con su escala óptica, como en producción.
 */
async function crest(key: string, input: Buffer): Promise<CardCrest> {
  const uploadsDir = path.join(OUT, 'escudos')
  const processed = await processImage(input, { uploadsDir, kind: 'logo', storageKey: key })
  const png = await readFile(path.join(uploadsDir, processed.variants.png512 ?? processed.variants.master))
  return {
    src: `data:image/png;base64,${png.toString('base64')}`,
    scale: crestScale(processed.width, processed.height, processed.variants.logo).disc,
  }
}

const placeholder = (file: string) => readFile(path.join(root, 'public', 'placeholder', file))
const svg = (width: number, height: number, body: string) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${body}</svg>`)

/** Escudos ficticios que cubren los casos difíciles: fondo de color, margen blanco, alto y ancho. */
const TEST_CRESTS = {
  // Cuadrado con fondo de color hasta el borde: no se recorta y debe caber entero en el disco.
  cuadrado: svg(
    600,
    600,
    `<rect width="600" height="600" fill="#1f4fa3"/><rect x="30" y="30" width="540" height="540" fill="none" stroke="#f2c230" stroke-width="18"/>
     <circle cx="300" cy="300" r="170" fill="#fff"/><text x="300" y="360" font-family="Arial" font-weight="700" font-size="170" text-anchor="middle" fill="#1f4fa3">DE</text>`,
  ),
  // Escudo pequeño en una imagen blanca enorme: el recorte debe dejarlo del mismo tamaño que los demás.
  margen: svg(
    1200,
    1200,
    `<rect width="1200" height="1200" fill="#fff"/><path d="M600 420 760 470v130c0 92-64 152-160 186-96-34-160-94-160-186V470Z" fill="#2e7d32" stroke="#0b0b0c" stroke-width="10"/>
     <text x="600" y="640" font-family="Arial" font-weight="700" font-size="110" text-anchor="middle" fill="#fff">M</text>`,
  ),
  // Alto y angosto, con fondo transparente.
  alto: svg(
    260,
    620,
    `<path d="M10 10h240v420c0 90-60 150-120 180C70 580 10 520 10 430Z" fill="#8e1b1b" stroke="#0b0b0c" stroke-width="12"/>
     <rect x="60" y="80" width="140" height="300" fill="#fff"/><text x="130" y="290" font-family="Arial" font-weight="700" font-size="150" text-anchor="middle" fill="#8e1b1b">A</text>`,
  ),
  // Ancho (óvalo apaisado), con fondo transparente.
  ancho: svg(
    760,
    360,
    `<ellipse cx="380" cy="180" rx="370" ry="170" fill="#f2c230" stroke="#0b0b0c" stroke-width="14"/>
     <text x="380" y="235" font-family="Arial" font-weight="700" font-size="150" text-anchor="middle" fill="#0b0b0c">ANCHO</text>`,
  ),
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const clubCrest = await crest('club', await placeholder('escudo.svg'))
  const rivalCrest = await crest('generico', await placeholder('escudo-generico.svg'))
  const test = {
    cuadrado: await crest('cuadrado', TEST_CRESTS.cuadrado),
    margen: await crest('margen', TEST_CRESTS.margen),
    alto: await crest('alto', TEST_CRESTS.alto),
    ancho: await crest('ancho', TEST_CRESTS.ancho),
  }
  const clubName = 'Club Deportivo Los Cachorros'
  const club: CardTeam = { name: 'Cachorros', crest: clubCrest }
  const rival: CardTeam = { name: 'Deportivo Ejemplo', crest: rivalCrest }
  const squareRival: CardTeam = { name: 'Deportivo Cuadrado', crest: test.cuadrado }
  const marginRival: CardTeam = { name: 'Margen Blanco', crest: test.margen }
  const tallRival: CardTeam = { name: 'Atlético Alto', crest: test.alto }
  const wideRival: CardTeam = { name: 'Unión Ancha', crest: test.ancho }
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
  // Un partido por escudo de prueba: todos deben verse del mismo tamaño y dentro de su disco.
  const crestTest = [
    match({ seriesName: 'Infantil', away: squareRival, kickoffAt: at('2026-10-31', '10:00') }),
    match({ seriesName: 'Juvenil', away: marginRival, kickoffAt: at('2026-10-31', '11:45') }),
    away(tallRival, { seriesName: 'Senior', kickoffAt: at('2026-10-31', '13:30') }),
    away(wideRival, { seriesName: 'Honor', kickoffAt: at('2026-11-01', '15:30') }),
    match({ seriesName: 'Súper Senior', kickoffAt: at('2026-11-01', '17:00') }),
  ]
  const result = (data: CardMatch): MatchCardData => ({
    kind: 'match',
    template: 'resultado',
    clubName,
    match: { ...data, status: 'finalizado', homeScore: 2, awayScore: 1 },
    scorers: { home: ["J. Ejemplo 12'", "P. Muestra 67'"], away: ["R. Prueba 80'"] },
    goal: null,
    matchday: null,
  })
  const jornada = (data: CardMatch, series: string[], at0 = '10:00'): JornadaCardData => ({
    kind: 'jornada',
    template: 'jornada',
    clubName,
    match: { ...data, kickoffAt: at('2026-10-31', at0) },
    series,
    matchday: withPhotos,
  })
  const fiveSeries = ['Tercera', 'Segunda', 'Juvenil', 'Senior', 'Honor']
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
    { name: 'jornada-5-series-local', formats: all, data: jornada(match({}), fiveSeries) },
    {
      name: 'jornada-3-series-visita',
      formats: all,
      data: jornada(away(rival), ['Juvenil', 'Senior', 'Honor'], '12:00'),
    },
    { name: 'jornada-rival-sin-escudo', formats: all, data: jornada(away(longRival), fiveSeries) },
    {
      name: 'jornada-rival-nombre-largo',
      formats: all,
      data: jornada(away(longestRival), fiveSeries, '09:30'),
    },
    {
      name: 'jornada-6-series',
      formats: all,
      data: jornada(match({}), ['Tercera', 'Segunda', 'Juvenil', 'Senior', 'Súper Senior', 'Honor']),
    },
    { name: 'programacion-varios-rivales', formats: all, data: weekend(mixed) },
    { name: 'programacion-mismo-rival', formats: ['vertical', 'historia'], data: weekend(sameRival) },
    { name: 'programacion-sin-auspiciador', formats: ['vertical'], data: weekend(mixed, null) },
    { name: 'escudos-programacion', formats: ['vertical', 'historia'], data: weekend(crestTest) },
    { name: 'escudos-cuadrado', formats: ['vertical'], data: next(match({ away: squareRival })) },
    { name: 'escudos-margen', formats: ['vertical'], data: next(match({ away: marginRival })) },
    { name: 'escudos-alto', formats: ['vertical'], data: next(away(tallRival)) },
    { name: 'escudos-ancho', formats: ['vertical'], data: next(match({ away: wideRival })) },
    { name: 'escudos-resultado-cuadrado', formats: ['cuadrado'], data: result(match({ away: squareRival })) },
    { name: 'escudos-resultado-alto', formats: ['cuadrado'], data: result(away(tallRival)) },
  ]

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
