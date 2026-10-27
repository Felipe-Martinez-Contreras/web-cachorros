import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { santiagoWallTime } from '@/features/matches/lib/schedule'
import { type CrestCardStyle, cardCrestImage, type DarkTreatment } from '@/features/share/crest-card'
import type {
  CardCrest,
  CardMatch,
  CardTeam,
  JornadaCardData,
  MatchCardData,
  MatchdayData,
  MatchdayTopLine,
  ShareCardData,
  WeekendCardData,
} from '@/features/share/dto'
import { treatMatchdayPhoto, whiteLogo } from '@/features/share/images'
import { SHARE_FORMATS, type ShareFormat } from '@/features/share/lib/cards'
import { matchdayFrameBox, renderShareCard } from '@/features/share/render'
import { crestScale } from '@/lib/images/crest'
import { processImage } from '@/lib/images/process'

// Dibuja las plantillas «Próximo partido», «Jornada» y «Programación» con datos de ejemplo (rivales, canchas,
// auspiciador y asociación ficticios, nunca datos del club) en `tmp/tarjetas/`, para revisar un diseño sin la
// base de datos. Incluye escudos de prueba (transparentes, fondo blanco, fondo de color, monocromos) procesados
// como una subida, las 3 líneas superiores y el zoom de las fotos. Deja los bytes de cada archivo en
// `tmp/tarjetas/pesos.txt`. Solo desarrollo: `node scripts/run.mjs share-preview`.

const root = process.cwd()
const OUT = path.join(root, 'tmp', 'tarjetas')

/**
 * Escudo de prueba procesado igual que una subida desde el panel (`processImage`, recorte y medidas), en
 * `tmp/tarjetas/escudos/`: la tarjeta lo dibuja con su escala óptica y, en el matchday, con el tratamiento
 * sin disco (`cardCrestImage`) del estilo pedido, como en producción.
 */
async function crest(
  key: string,
  input: Buffer,
  style: CrestCardStyle = 'color',
  dark?: DarkTreatment,
): Promise<CardCrest> {
  const uploadsDir = path.join(OUT, 'escudos')
  const processed = await processImage(input, { uploadsDir, kind: 'logo', storageKey: key })
  const png = await readFile(path.join(uploadsDir, processed.variants.png512 ?? processed.variants.master))
  return {
    src: `data:image/png;base64,${png.toString('base64')}`,
    scale: crestScale(processed.width, processed.height, processed.variants.logo).disc,
    bare: await cardCrestImage(png, { style, dark }),
  }
}

const placeholder = (file: string) => readFile(path.join(root, 'public', 'placeholder', file))
const svg = (width: number, height: number, body: string) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${body}</svg>`)

/** Escudos ficticios que cubren los casos difíciles: fondo de color, fondo blanco, alto y ancho. */
const TEST_CRESTS = {
  // Cuadrado con fondo de color hasta el borde: no se recorta; en el matchday va en un círculo discreto.
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
  // Redondo sobre un cuadrado blanco (como un JPEG): el blanco de afuera se quita y el de adentro queda.
  blanco: svg(
    800,
    800,
    `<rect width="800" height="800" fill="#fff"/><circle cx="400" cy="400" r="330" fill="#c62828" stroke="#0b0b0c" stroke-width="14"/>
     <circle cx="400" cy="400" r="230" fill="#fff"/><text x="400" y="460" font-family="Arial" font-weight="700" font-size="170" text-anchor="middle" fill="#0b0b0c">RB</text>`,
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

/** Logo ficticio para la línea superior en modo «logo» (sobre fondo blanco, sin transparencia). */
const TEST_LOGO = svg(
  900,
  220,
  `<rect width="900" height="220" fill="#fff"/><circle cx="110" cy="110" r="80" fill="#1f4fa3"/>
   <text x="220" y="145" font-family="Arial" font-weight="700" font-size="110" fill="#1f4fa3">EJEMPLO</text>`,
)

async function main() {
  await mkdir(OUT, { recursive: true })
  const clubSvg = await placeholder('escudo.svg')
  const clubCrest = await crest('club', clubSvg)
  const clubGlow = await crest('club', clubSvg, 'color', 'resplandor')
  const rivalCrest = await crest('generico', await placeholder('escudo-generico.svg'))
  const test = {
    cuadrado: await crest('cuadrado', TEST_CRESTS.cuadrado),
    margen: await crest('margen', TEST_CRESTS.margen),
    blanco: await crest('blanco', TEST_CRESTS.blanco),
    alto: await crest('alto', TEST_CRESTS.alto),
    ancho: await crest('ancho', TEST_CRESTS.ancho),
    anchoBlanco: await crest('ancho', TEST_CRESTS.ancho, 'blanco'),
    anchoGrises: await crest('ancho', TEST_CRESTS.ancho, 'grises'),
    cuadradoBlanco: await crest('cuadrado', TEST_CRESTS.cuadrado, 'blanco'),
  }
  const clubName = 'Club Deportivo Los Cachorros'
  const club: CardTeam = { name: 'Cachorros', crest: clubCrest }
  const clubWithGlow: CardTeam = { name: 'Cachorros', crest: clubGlow }
  const rival: CardTeam = { name: 'Deportivo Ejemplo', crest: rivalCrest }
  const squareRival: CardTeam = { name: 'Deportivo Cuadrado', crest: test.cuadrado }
  const marginRival: CardTeam = { name: 'Margen Blanco', crest: test.margen }
  const whiteRival: CardTeam = { name: 'Rojo Blanco', crest: test.blanco }
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

  // Fotos de muestra: las que dejes en `tmp/fotos-muestra/` (izquierda, centro y derecha; todas en blanco y
  // negro). Nunca van al repositorio. Si no están, las tarjetas se dibujan con el fondo del club.
  const samples = ['zapatos.jpg', 'balon.jpg', 'estadio.jpg']
  const sampleBytes = await Promise.all(
    samples.map((file) => readFile(path.join(root, 'tmp', 'fotos-muestra', file)).catch(() => null)),
  )
  const treat = async (index: number, focalZoom = 1) => {
    const bytes = sampleBytes[index]
    return bytes ? treatMatchdayPhoto(bytes, { focalX: 0.5, focalY: 0.6, focalZoom }) : null
  }
  const samplePhotos = await Promise.all([treat(0), treat(1), treat(2)])
  // El encuadre de la captura de Medios: la misma foto (a 1920 × 1080), punto focal y zoom, para compararla
  // con la vista previa del panel (`encuadre-medios.json` trae la caja del panel en la tarjeta).
  const { default: sharp } = await import('sharp')
  const framing = { focalX: 0.62, focalY: 0.4, focalZoom: 1.8 }
  const framed = sampleBytes[0]
    ? await treatMatchdayPhoto(
        await sharp(sampleBytes[0]).resize(1920, 1080, { fit: 'cover' }).jpeg({ quality: 92 }).toBuffer(),
        framing,
      )
    : null
  const zoomedPhotos = await Promise.all([treat(0, 2), treat(1, 2), treat(2, 2)])

  const sponsorLine: MatchdayTopLine = { kind: 'texto', text: 'Powered by Ferretería de Ejemplo' }
  const textLine: MatchdayTopLine = { kind: 'texto', text: 'ANFA · Asociación de fútbol de ejemplo' }
  const logoLine: MatchdayTopLine = { kind: 'logo', file: '', src: await whiteLogo(TEST_LOGO) }
  const matchdayWith = (
    topLine: MatchdayTopLine | null,
    photos: (string | null)[] = samplePhotos,
  ): MatchdayData => ({ topLine, photoSources: [null, null, null], photos })
  const withPhotos = matchdayWith(sponsorLine)
  const noPhotos = matchdayWith(sponsorLine, [null, null, null])

  const next = (data: CardMatch, matchday: MatchdayData = withPhotos): MatchCardData => ({
    kind: 'match',
    template: 'proximo',
    clubName,
    match: data,
    scorers: { home: [], away: [] },
    goal: null,
    matchday,
  })
  const weekend = (matches: CardMatch[], topLine: MatchdayTopLine | null = sponsorLine): WeekendCardData => ({
    kind: 'weekend',
    template: 'programacion',
    clubName,
    clubCrest,
    saturday: '2026-10-31',
    matches,
    topLine,
  })
  const jornada = (
    data: CardMatch,
    series: string[],
    at0 = '10:00',
    matchday: MatchdayData = withPhotos,
  ): JornadaCardData => ({
    kind: 'jornada',
    template: 'jornada',
    clubName,
    match: { ...data, kickoffAt: at('2026-10-31', at0) },
    series,
    matchday,
  })
  const result = (data: CardMatch): MatchCardData => ({
    kind: 'match',
    template: 'resultado',
    clubName,
    match: { ...data, status: 'finalizado', homeScore: 2, awayScore: 1 },
    scorers: { home: ["J. Ejemplo 12'", "P. Muestra 67'"], away: ["R. Prueba 80'"] },
    goal: null,
    matchday: null,
  })

  const sameRival = [
    match({ seriesName: 'Infantil', kickoffAt: at('2026-10-31', '10:00') }),
    match({ seriesName: 'Juvenil', kickoffAt: at('2026-10-31', '11:45') }),
    match({ seriesName: 'Senior', kickoffAt: at('2026-10-31', '13:30') }),
    match({ seriesName: 'Honor', kickoffAt: at('2026-10-31', '15:30') }),
  ]
  const mixed = [
    match({ seriesName: 'Infantil', kickoffAt: at('2026-10-31', '10:00') }),
    match({ seriesName: 'Juvenil', away: whiteRival, kickoffAt: at('2026-10-31', '11:45') }),
    away(squareRival, { seriesName: 'Senior', kickoffAt: at('2026-10-31', '13:30') }),
    match({ seriesName: 'Honor', away: tallRival, kickoffAt: at('2026-10-31', '15:30') }),
    away(rival, { seriesName: 'Súper Senior', kickoffAt: at('2026-11-01', '10:00') }),
    away(longestRival, { seriesName: 'Segunda adulta', kickoffAt: at('2026-11-01', '12:00') }),
  ]
  const fiveSeries = ['Tercera', 'Segunda', 'Juvenil', 'Senior', 'Honor']
  const all: ShareFormat[] = ['vertical', 'cuadrado', 'historia', 'og']
  const cases: { name: string; formats: ShareFormat[]; data: ShareCardData }[] = [
    // Próximo partido y jornada, con y sin fotos.
    { name: 'matchday-con-fotos', formats: all, data: next(match({})) },
    { name: 'matchday-sin-fotos', formats: ['vertical', 'historia'], data: next(match({}), noPhotos) },
    { name: 'matchday-visita-nombre-largo', formats: ['vertical', 'og'], data: next(away(longestRival)) },
    { name: 'jornada-con-fotos', formats: all, data: jornada(match({}), fiveSeries) },
    {
      name: 'jornada-sin-fotos',
      formats: ['vertical', 'historia'],
      data: jornada(away(rival), ['Juvenil', 'Senior', 'Honor'], '12:00', noPhotos),
    },
    // Escudos: transparente, fondo blanco, fondo de color, monocromo y el del club (contorno o resplandor).
    { name: 'escudo-transparente-alto', formats: ['vertical'], data: next(away(tallRival)) },
    { name: 'escudo-transparente-ancho', formats: ['vertical'], data: next(match({ away: wideRival })) },
    { name: 'escudo-fondo-blanco', formats: ['vertical', 'og'], data: next(match({ away: whiteRival })) },
    { name: 'escudo-fondo-blanco-margen', formats: ['vertical'], data: next(match({ away: marginRival })) },
    { name: 'escudo-fondo-color', formats: ['vertical'], data: next(match({ away: squareRival })) },
    {
      name: 'escudo-monocromo-blanco',
      formats: ['vertical'],
      data: next(match({ away: { ...wideRival, crest: test.anchoBlanco } })),
    },
    {
      name: 'escudo-monocromo-grises',
      formats: ['vertical'],
      data: next(match({ away: { ...wideRival, crest: test.anchoGrises } })),
    },
    {
      name: 'escudo-monocromo-blanco-fondo-color',
      formats: ['vertical'],
      data: next(match({ away: { ...squareRival, crest: test.cuadradoBlanco } })),
    },
    { name: 'escudo-club-contorno', formats: ['vertical', 'cuadrado'], data: next(match({})) },
    {
      name: 'escudo-club-resplandor',
      formats: ['vertical', 'cuadrado'],
      data: next(match({ home: clubWithGlow })),
    },
    { name: 'escudo-rival-sin-escudo', formats: ['vertical'], data: next(away(longRival)) },
    // Línea superior: auspiciador, texto, logo y sin línea.
    {
      name: 'linea-auspiciador',
      formats: ['vertical', 'og'],
      data: next(match({}), matchdayWith(sponsorLine)),
    },
    { name: 'linea-texto', formats: ['vertical', 'og'], data: next(match({}), matchdayWith(textLine)) },
    {
      name: 'linea-logo',
      formats: ['vertical', 'historia', 'og'],
      data: next(match({}), matchdayWith(logoLine)),
    },
    { name: 'linea-ninguna', formats: ['vertical'], data: next(match({}), matchdayWith(null)) },
    // Zoom de las fotos: 100 % y 200 % sobre el mismo punto focal.
    { name: 'foto-zoom-100', formats: ['vertical'], data: next(match({})) },
    {
      name: 'foto-zoom-200',
      formats: ['vertical'],
      data: next(match({}), matchdayWith(sponsorLine, zoomedPhotos)),
    },
    {
      name: 'encuadre-medios',
      formats: ['vertical'],
      data: next(match({}), matchdayWith(sponsorLine, [framed, framed, framed])),
    },
    // Programación con la v2: varios rivales (uno con escudo de fondo blanco) y mismo rival.
    { name: 'programacion-varios-rivales', formats: all, data: weekend(mixed) },
    { name: 'programacion-mismo-rival', formats: ['vertical', 'historia'], data: weekend(sameRival) },
    { name: 'programacion-linea-texto', formats: ['vertical'], data: weekend(mixed, textLine) },
    // Las demás plantillas no cambian (escudos con disco).
    { name: 'resultado-sin-cambios', formats: ['cuadrado'], data: result(match({ away: squareRival })) },
  ]

  const sizes: string[] = []
  for (const item of cases) {
    for (const format of item.formats) {
      const bytes = await renderShareCard(item.data, format)
      const file = `${item.name}-${format}.${SHARE_FORMATS[format].ext}`
      await writeFile(path.join(OUT, file), bytes)
      sizes.push(`${String(bytes.byteLength).padStart(9)}  ${file}`)
    }
  }
  await writeFile(path.join(OUT, 'pesos.txt'), `${sizes.join('\n')}\n`)
  const box = matchdayFrameBox(match({}), 'vertical', sponsorLine)
  const panel = { left: box.panelLeft, top: box.panelTop, width: box.panelWidth, height: box.panelHeight }
  await writeFile(path.join(OUT, 'encuadre-medios.json'), JSON.stringify({ ...framing, ...panel }))
  for (const format of ['vertical', 'cuadrado', 'historia'] as const) {
    const { panelWidth, panelHeight } = matchdayFrameBox(match({}), format, sponsorLine)
    console.log(`Panel ${format}: ${(panelWidth / panelHeight).toFixed(3)}`)
  }
  console.log(`Listo: ${OUT}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
