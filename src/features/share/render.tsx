import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'
import type { ReactNode } from 'react'
import { formatDayMonth, formatLongDate, formatTime, toIsoDate } from '@/lib/format'
import { matchStatusLabels } from '@/lib/labels'
import type {
  CardMatch,
  CardTeam,
  JornadaCardData,
  MatchCardData,
  NewsCardData,
  ShareCardData,
  WeekendCardData,
} from './dto'
import { BRAND } from './lib/brand'
import {
  CHAR_EM,
  clampText,
  displayLines,
  fitDisplaySize,
  SERIES_SEPARATOR,
  SHARE_FORMATS,
  type ShareFormat,
  seriesBandLayout,
  weekendTitle,
} from './lib/cards'

// Plantillas de las tarjetas (especificación 2.8) con Satori (`next/og`): solo flexbox, fuentes TTF
// estáticas y escudos como *data URI* PNG (trampa 8). Fondo negro, marcador en display condensada,
// escudos enfrentados y franja de acento.

const INK = BRAND.ink
const PAPER = BRAND.paper
const ACCENT = BRAND.accent
const MUTED = BRAND.neutral400
const LIVE = BRAND.live
const DISPLAY = 'Archivo Condensed'
const TEXT = 'Archivo'

const FONT_DIR = path.join(/* turbopackIgnore: true */ process.cwd(), 'src', 'assets', 'fonts', 'og')
type CardFont = { name: string; data: Buffer; weight: 400 | 500 | 600 | 700 | 800; style: 'normal' }
let fontsPromise: Promise<CardFont[]> | null = null

/** Fuentes TTF de las tarjetas (OFL, con su licencia en la misma carpeta). */
const FONT_FILES: { file: string; name: string; weight: CardFont['weight'] }[] = [
  { file: 'ArchivoCondensed-ExtraBold.ttf', name: DISPLAY, weight: 800 },
  { file: 'Archivo-SemiBold.ttf', name: TEXT, weight: 600 },
  { file: 'BebasNeue-Regular.ttf', name: 'Bebas Neue', weight: 400 },
  { file: 'BarlowCondensed-Medium.ttf', name: 'Barlow Condensed', weight: 500 },
  { file: 'BarlowCondensed-SemiBold.ttf', name: 'Barlow Condensed', weight: 600 },
  { file: 'BarlowCondensed-Bold.ttf', name: 'Barlow Condensed', weight: 700 },
]

function loadFonts() {
  fontsPromise ??= Promise.all(
    FONT_FILES.map(async ({ file, name, weight }) => ({
      name,
      weight,
      style: 'normal' as const,
      data: await readFile(path.join(/* turbopackIgnore: true */ FONT_DIR, file)),
    })),
  )
  // Si falla (por ejemplo, la fuente no llegó a la imagen), el próximo intento vuelve a leerla.
  fontsPromise.catch(() => {
    fontsPromise = null
  })
  return fontsPromise
}

/** Dibuja la tarjeta en PNG (o JPEG ≤ 300 KB para Open Graph). Corre dentro de la cola de 1. */
export async function renderShareCard(data: ShareCardData, format: ShareFormat): Promise<Buffer> {
  const { width, height } = SHARE_FORMATS[format]
  const layout: Layout = { width, height, s: width / 1080, wide: format === 'og', tall: height > 1500 }
  const response = new ImageResponse(<Card data={data} layout={layout} />, {
    width,
    height,
    fonts: await loadFonts(),
  })
  const png = Buffer.from(await response.arrayBuffer())
  if (format !== 'og') return png
  return toOgJpeg(png)
}

const OG_MAX_BYTES = 300 * 1024

/** WhatsApp descarta las imágenes pesadas: JPEG con la calidad más alta que quede bajo 300 KB. */
async function toOgJpeg(png: Buffer): Promise<Buffer> {
  const { default: sharp } = await import('sharp')
  let jpeg = png
  for (const quality of [84, 76, 68, 60, 50]) {
    jpeg = await sharp(png).flatten({ background: INK }).jpeg({ quality, mozjpeg: true }).toBuffer()
    if (jpeg.byteLength <= OG_MAX_BYTES) break
  }
  return jpeg
}

type Layout = { width: number; height: number; s: number; wide: boolean; tall: boolean }

function Card({ data, layout }: { data: ShareCardData; layout: Layout }) {
  const { width, height, s } = layout
  const matchday =
    (data.kind === 'match' && data.template === 'proximo') ||
    (data.kind === 'weekend' && data.template === 'programacion') ||
    data.kind === 'jornada'
  return (
    <div
      style={{
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: INK,
        color: PAPER,
        fontFamily: TEXT,
        position: 'relative',
      }}
    >
      {data.kind === 'match' &&
        (data.template === 'proximo' ? (
          <MatchdayCard data={data} layout={layout} />
        ) : (
          <MatchCard data={data} layout={layout} />
        ))}
      {data.kind === 'weekend' &&
        (data.template === 'programacion' ? (
          <ScheduleCard data={data} layout={layout} />
        ) : (
          <WeekendCard data={data} layout={layout} />
        ))}
      {data.kind === 'jornada' && <JornadaCard data={data} layout={layout} />}
      {data.kind === 'news' && <NewsCard data={data} layout={layout} />}
      {/* Franja de acento al pie (la plantilla matchday no la lleva) */}
      {!matchday && (
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 18 * s,
            backgroundColor: ACCENT,
          }}
        />
      )}
    </div>
  )
}

function Eyebrow({
  children,
  layout,
  color = ACCENT,
}: {
  children: ReactNode
  layout: Layout
  color?: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        fontFamily: DISPLAY,
        fontSize: (layout.wide ? 40 : 52) * layout.s,
        letterSpacing: 2 * layout.s,
        textTransform: 'uppercase',
        color,
      }}
    >
      {children}
    </div>
  )
}

function Header({ title, subtitle, layout }: { title: string; subtitle: string; layout: Layout }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 * layout.s }}>
      <div
        style={{
          display: 'flex',
          fontSize: 30 * layout.s,
          color: MUTED,
          textTransform: 'uppercase',
          letterSpacing: 1.5 * layout.s,
        }}
      >
        {clampText(title, 48)}
      </div>
      <div style={{ display: 'flex', fontSize: 34 * layout.s }}>{clampText(subtitle, 56)}</div>
    </div>
  )
}

function Crest({ team, size }: { team: CardTeam; size: number }) {
  if (team.crest) {
    // Disco blanco, como `.crest` en las secciones oscuras del sitio: los escudos con partes negras se leen.
    // El escudo se escala según lo visible (`crestScale`, la misma regla del sitio) y el disco lo recorta.
    const inner = Math.round(size * team.crest.scale)
    return (
      <div
        style={{
          display: 'flex',
          width: size,
          height: size,
          flexShrink: 0,
          borderRadius: size,
          overflow: 'hidden',
          backgroundColor: PAPER,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* biome-ignore lint/performance/noImgElement: Satori dibuja <img>; no es una página. */}
        <img src={team.crest.src} width={inner} height={inner} alt="" style={{ objectFit: 'contain' }} />
      </div>
    )
  }
  return (
    <div
      style={{
        display: 'flex',
        width: size,
        height: size,
        borderRadius: size,
        backgroundColor: '#2b2b2b',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: DISPLAY,
        fontSize: size * 0.5,
      }}
    >
      {team.name.slice(0, 1).toUpperCase()}
    </div>
  )
}

function matchEyebrow(data: MatchCardData): { text: string; color: string } {
  if (data.template === 'gol') return { text: '¡Gol!', color: ACCENT }
  if (data.match.status === 'en_vivo') return { text: 'En vivo', color: LIVE }
  if (data.match.status === 'suspendido') return { text: matchStatusLabels.suspendido, color: ACCENT }
  return { text: 'Resultado final', color: ACCENT }
}

function competitionLine(match: CardMatch): string {
  return [match.seriesName, match.competitionName, match.roundLabel].filter(Boolean).join(' · ')
}

function penaltiesLine(match: CardMatch): string | null {
  if (match.homePenalties === null || match.awayPenalties === null) return null
  return `${match.homePenalties}–${match.awayPenalties} en penales`
}

/** Tamaños por formato: el 1:1 es el más justo de ancho; la historia tiene alto de sobra. */
function matchSizes(layout: Layout) {
  if (layout.wide) return { crest: 150, score: 150, name: 36, pad: 48, gap: 14 }
  if (layout.height > 1500) return { crest: 260, score: 230, name: 56, pad: 80, gap: 48 }
  if (layout.height > 1200) return { crest: 260, score: 230, name: 52, pad: 72, gap: 36 }
  return { crest: 220, score: 200, name: 46, pad: 64, gap: 24 }
}

function MatchCard({ data, layout }: { data: MatchCardData; layout: Layout }) {
  const { match } = data
  const { s, wide } = layout
  const size = matchSizes(layout)
  const eyebrow = matchEyebrow(data)
  const penalties = penaltiesLine(match)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1,
        padding: size.pad * s,
        gap: size.gap * s,
      }}
    >
      <Header title={data.clubName} subtitle={competitionLine(match)} layout={layout} />
      <Eyebrow layout={layout} color={eyebrow.color}>
        {eyebrow.text}
      </Eyebrow>
      {data.goal && (
        <div
          style={{ display: 'flex', alignItems: 'baseline', gap: 24 * s, fontFamily: DISPLAY, lineHeight: 1 }}
        >
          <div style={{ display: 'flex', fontSize: (wide ? 72 : 112) * s }}>
            {clampText(data.goal.scorer || data.clubName, 22)}
          </div>
          <div style={{ display: 'flex', fontSize: (wide ? 56 : 88) * s, color: ACCENT }}>
            {data.goal.minute}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center' }}>
        <TeamColumn team={match.home} crestSize={size.crest * s} nameSize={size.name * s} />
        <div
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: `0 ${12 * s}px` }}
        >
          <div
            style={{
              display: 'flex',
              fontFamily: DISPLAY,
              fontSize: size.score * s,
              lineHeight: 1,
              color: PAPER,
            }}
          >
            {`${match.homeScore}–${match.awayScore}`}
          </div>
          {penalties && <div style={{ display: 'flex', fontSize: 30 * s, color: MUTED }}>{penalties}</div>}
        </div>
        <TeamColumn team={match.away} crestSize={size.crest * s} nameSize={size.name * s} />
      </div>
      {data.template === 'resultado' && (
        <div style={{ display: 'flex', gap: 32 * s, fontSize: (wide ? 24 : 32) * s, paddingBottom: 16 * s }}>
          <ScorerList lines={data.scorers.home} align="flex-start" max={wide ? 2 : 5} />
          <ScorerList lines={data.scorers.away} align="flex-end" max={wide ? 2 : 5} />
        </div>
      )}
    </div>
  )
}

function TeamColumn({ team, crestSize, nameSize }: { team: CardTeam; crestSize: number; nameSize: number }) {
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: nameSize * 0.3, flex: 1 }}
    >
      <Crest team={team} size={crestSize} />
      <div
        style={{
          display: 'flex',
          fontFamily: DISPLAY,
          fontSize: nameSize,
          lineHeight: 1.05,
          textAlign: 'center',
          textTransform: 'uppercase',
          justifyContent: 'center',
        }}
      >
        {clampText(team.name, 22)}
      </div>
    </div>
  )
}

function ScorerList({
  lines,
  align,
  max,
}: {
  lines: string[]
  align: 'flex-start' | 'flex-end'
  max: number
}) {
  const shown = lines.slice(0, max)
  const rest = lines.length - shown.length
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        alignItems: align,
        gap: 6,
        color: '#dcdcdc',
      }}
    >
      {shown.map((line) => (
        <div key={line} style={{ display: 'flex', textAlign: align === 'flex-end' ? 'right' : 'left' }}>
          {clampText(line, 60)}
        </div>
      ))}
      {rest > 0 && <div style={{ display: 'flex', color: MUTED }}>{`y ${rest} más`}</div>}
    </div>
  )
}

/** Partidos que caben en una tarjeta de fin de semana según el alto. */
function weekendCapacity(layout: Layout): number {
  if (layout.wide) return 3
  return layout.height > 1500 ? 8 : layout.height > 1200 ? 5 : 4
}

function weekendScore(match: CardMatch): string {
  if (match.status === 'finalizado') return `${match.homeScore}–${match.awayScore}`
  if (match.status === 'programado' || match.status === 'en_vivo') return formatTime(match.kickoffAt)
  return matchStatusLabels[match.status]
}

function WeekendCard({ data, layout }: { data: WeekendCardData; layout: Layout }) {
  const { s, wide } = layout
  const rows = data.matches.slice(0, weekendCapacity(layout))
  const rest = data.matches.length - rows.length
  const crest = (wide ? 40 : 56) * s
  const text = (wide ? 28 : 36) * s
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1,
        padding: (wide ? 48 : 72) * s,
        gap: (wide ? 14 : 32) * s,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 * s }}>
        <Crest team={{ name: data.clubName, crest: data.clubCrest }} size={(wide ? 72 : 120) * s} />
        <Header title={data.clubName} subtitle={weekendTitle(data.saturday)} layout={layout} />
      </div>
      <Eyebrow layout={layout}>{data.template === 'programacion' ? 'Programación' : 'Resultados'}</Eyebrow>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          justifyContent: 'center',
          gap: (wide ? 8 : 20) * s,
        }}
      >
        {rows.map((match) => (
          <div
            key={`${match.kickoffAt}-${match.home.name}-${match.away.name}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 20 * s,
              paddingBottom: (wide ? 8 : 18) * s,
              borderBottom: `${2 * s}px solid #2b2b2b`,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', width: 250 * s, flexShrink: 0 }}>
              <div
                style={{
                  display: 'flex',
                  fontSize: (wide ? 20 : 26) * s,
                  color: MUTED,
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}
              >
                {clampText(
                  `${match.seriesName} · ${formatDayMonth(match.kickoffAt).split(' ').slice(0, 2).join(' ')}`,
                  22,
                )}
              </div>
              <div
                style={{
                  display: 'flex',
                  fontFamily: DISPLAY,
                  fontSize: (wide ? 40 : 56) * s,
                  lineHeight: 1,
                  color: match.status === 'finalizado' ? PAPER : ACCENT,
                }}
              >
                {weekendScore(match)}
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                flex: 1,
                alignItems: 'center',
                gap: 14 * s,
                fontFamily: DISPLAY,
                fontSize: text,
                textTransform: 'uppercase',
              }}
            >
              <Crest team={match.home} size={crest} />
              <div style={{ display: 'flex', whiteSpace: 'nowrap' }}>{clampText(match.home.name, 14)}</div>
              <div style={{ display: 'flex', color: MUTED, fontSize: text * 0.7 }}>vs</div>
              <div style={{ display: 'flex', whiteSpace: 'nowrap' }}>{clampText(match.away.name, 14)}</div>
              <Crest team={match.away} size={crest} />
            </div>
          </div>
        ))}
        {rest > 0 && (
          <div
            style={{ display: 'flex', fontSize: 30 * s, color: MUTED }}
          >{`y ${rest} partidos más en el sitio`}</div>
        )}
      </div>
    </div>
  )
}

function NewsCard({ data, layout }: { data: NewsCardData; layout: Layout }) {
  const { width, height, s } = layout
  return (
    <div style={{ display: 'flex', flexGrow: 1, position: 'relative' }}>
      {data.photo && (
        // biome-ignore lint/performance/noImgElement: Satori dibuja <img>; no es una página.
        <img
          src={data.photo}
          width={width}
          height={height}
          alt=""
          style={{ position: 'absolute', left: 0, top: 0, objectFit: 'cover' }}
        />
      )}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          left: 0,
          top: 0,
          width,
          height,
          backgroundImage: 'linear-gradient(180deg, rgba(11,11,12,0.15) 0%, rgba(11,11,12,0.92) 70%)',
        }}
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          flexGrow: 1,
          padding: 56 * s,
          paddingBottom: 64 * s,
          gap: 14 * s,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 * s }}>
          <Crest team={{ name: data.clubName, crest: data.clubCrest }} size={64 * s} />
          <div style={{ display: 'flex', fontSize: 26 * s, textTransform: 'uppercase', color: '#dcdcdc' }}>
            {clampText([data.categoryName ?? 'Noticias', formatLongDate(data.publishedAt)].join(' · '), 60)}
          </div>
        </div>
        <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 64 * s, lineHeight: 1.05 }}>
          {clampText(data.title, 90)}
        </div>
      </div>
    </div>
  )
}

// ─── Matchday: «Próximo partido» y «Programación» (plantilla del club, docs/diseno) ────────────────────

const SIDE_LABEL = { local: 'Local', visita: 'Visita' } as const
/** Fuentes de la plantilla matchday: títulos en Bebas Neue y textos en Barlow Condensed. */
const MD_DISPLAY = 'Bebas Neue'
const MD_TEXT = 'Barlow Condensed'
/** El naranja del club con transparencia (Satori no tiene `color-mix`). */
const accentAlpha = (alpha: number) => `rgba(242, 116, 5, ${alpha})`
const whiteAlpha = (alpha: number) => `rgba(255, 255, 255, ${alpha})`

/** Fondo de la plantilla: degradado negro, líneas diagonales, resplandores naranja y blanco y viñeta. */
function MatchdayBackground({ layout }: { layout: Layout }) {
  const { width, height } = layout
  const layer = { display: 'flex', position: 'absolute', left: 0, top: 0, width, height } as const
  return (
    <>
      <div
        style={{
          ...layer,
          backgroundImage: 'linear-gradient(180deg, rgb(14, 14, 14) 0%, rgb(8, 8, 8) 60%, rgb(3, 3, 3) 100%)',
        }}
      />
      <div
        style={{
          ...layer,
          height: height * 0.57,
          backgroundImage: `repeating-linear-gradient(115deg, ${whiteAlpha(0.06)} 0px, ${whiteAlpha(0.06)} 2px, transparent 2px, transparent 54px)`,
        }}
      />
      {/* Las líneas se desvanecen hacia abajo (la plantilla usa una máscara, que Satori no tiene). */}
      <div
        style={{
          ...layer,
          height: height * 0.57,
          backgroundImage: 'linear-gradient(180deg, rgba(10, 10, 10, 0) 0%, rgb(8, 8, 8) 100%)',
        }}
      />
      <div
        style={{
          ...layer,
          backgroundImage: `radial-gradient(circle at 0% 38%, ${accentAlpha(0.55)} 0%, ${accentAlpha(0.18)} 30%, transparent 55%)`,
        }}
      />
      <div
        style={{
          ...layer,
          backgroundImage: `radial-gradient(circle at 100% 72%, ${whiteAlpha(0.14)} 0%, transparent 45%)`,
        }}
      />
      <div
        style={{
          ...layer,
          backgroundImage: 'radial-gradient(circle at 50% 50%, transparent 55%, rgba(0, 0, 0, 0.6) 100%)',
        }}
      />
    </>
  )
}

/** Fondo de cada panel sin foto: los degradados de la plantilla (gris, naranja con luz, naranja). */
const PANEL_FALLBACK = [
  'radial-gradient(circle at 30% 25%, rgb(138, 138, 138) 0%, transparent 55%), linear-gradient(165deg, rgb(92, 92, 92) 0%, rgb(28, 28, 28) 65%, rgb(10, 10, 10) 100%)',
  'radial-gradient(circle at 50% 30%, rgb(248, 179, 118) 0%, transparent 60%), linear-gradient(170deg, rgb(190, 96, 12) 0%, rgb(16, 16, 16) 85%)',
  'linear-gradient(170deg, rgb(242, 116, 5) 0%, rgb(133, 64, 3) 100%)',
] as const

function Panel({
  index,
  photo,
  width,
  height,
}: {
  index: number
  photo: string | null
  width: number
  height: number
}) {
  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width,
        height,
        overflow: 'hidden',
        backgroundImage: PANEL_FALLBACK[index] ?? PANEL_FALLBACK[0],
      }}
    >
      {photo && (
        // biome-ignore lint/performance/noImgElement: Satori dibuja <img>; no es una página.
        <img
          src={photo}
          width={width}
          height={height}
          alt=""
          style={{ position: 'absolute', left: 0, top: 0, objectFit: 'cover' }}
        />
      )}
      {photo && index === 2 && (
        // Velo naranja de la tercera foto, como en la plantilla.
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            left: 0,
            top: 0,
            width,
            height,
            backgroundImage: `linear-gradient(170deg, ${accentAlpha(0.62)} 0%, rgba(133, 64, 3, 0.78) 100%)`,
          }}
        />
      )}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          left: 0,
          bottom: 0,
          width,
          height: Math.min(height * 0.35, 320 * (width / 270)),
          backgroundImage: 'linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.75) 100%)',
        }}
      />
    </div>
  )
}

/** Iniciales de un equipo sin escudo: «Unión Villa Los Aromos» → «UVA». */
function initials(name: string): string {
  const words = name.split(/\s+/).filter((word) => !/^(de|del|la|las|los|el|y)$/i.test(word))
  return (words.length > 0 ? words : [name])
    .slice(0, 3)
    .map((word) => word.slice(0, 1).toUpperCase())
    .join('')
}

/** Escudo en un disco blanco (como `.crest` en las secciones oscuras) o, sin escudo, sus iniciales. */
function MatchdayCrest({ team, size }: { team: CardTeam; size: number }) {
  if (team.crest) return <Crest team={team} size={size} />
  return (
    <div
      style={{
        display: 'flex',
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: size,
        border: `${Math.max(2, size * 0.02)}px solid ${whiteAlpha(0.65)}`,
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: MD_DISPLAY,
        fontSize: size * 0.4,
        color: PAPER,
      }}
    >
      {initials(team.name)}
    </div>
  )
}

/** Ancho medio de una mayúscula de Barlow Condensed Bold, en em, con el espaciado de la línea de cuándo. */
const WHEN_CHAR_EM = 0.42

/**
 * «15:30 H | 25.10 | LOCAL»: la hora (o «Postergado»), la fecha y de qué lado juega el club. La jornada
 * antepone «Inicio» y, si así no cabe en `width`, se achica la letra.
 */
function MatchdayWhen({
  match,
  size,
  prefix,
  width,
}: {
  match: CardMatch
  size: number
  prefix?: string
  width?: number
}) {
  const [, month, day] = toIsoDate(match.kickoffAt).split('-')
  const time = match.status === 'postergado' ? 'Postergado' : `${formatTime(match.kickoffAt)} h`
  const when = prefix ? `${prefix} ${time}` : time
  // Hora, fecha («31.10») y lado, más las dos barras con su separación (≈ 3 caracteres cada una).
  const chars = when.length + 5 + SIDE_LABEL[match.clubSide].length + 6
  const fontSize = prefix && width ? Math.min(size, width / (chars * WHEN_CHAR_EM)) : size
  const bar = <div style={{ display: 'flex', opacity: 0.5 }}>|</div>
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        gap: fontSize * 0.4,
        fontFamily: MD_TEXT,
        fontWeight: 700,
        fontSize,
        letterSpacing: fontSize * 0.04,
        textTransform: 'uppercase',
        lineHeight: 1.15,
      }}
    >
      <div style={{ display: 'flex' }}>{when}</div>
      {bar}
      <div style={{ display: 'flex' }}>{`${day}.${month}`}</div>
      {bar}
      <div style={{ display: 'flex', color: ACCENT }}>{SIDE_LABEL[match.clubSide]}</div>
    </div>
  )
}

/**
 * Tamaño de los dos nombres (Bebas Neue, sin cortar): los dos con la misma letra, cada uno en una línea si
 * cabe achicándola un poco; si no, en dos líneas.
 */
function matchdayNames(home: string, away: string, width: number, size: number) {
  const sizeFor = (name: string) => {
    const single = fitDisplaySize(name, width, size, 1, size * 0.72, CHAR_EM.bebas)
    return displayLines(name, width, single, CHAR_EM.bebas) === 1
      ? single
      : fitDisplaySize(name, width, size, 2, size * 0.5, CHAR_EM.bebas)
  }
  const common = Math.min(sizeFor(home), sizeFor(away))
  return {
    size: common,
    lines:
      displayLines(home, width, common, CHAR_EM.bebas) + displayLines(away, width, common, CHAR_EM.bebas),
  }
}

type InfoSizes = { names: number; series: number; venue: number; when: number }

/** Ancho medio de una mayúscula de Barlow Condensed SemiBold, en em, con el espaciado de la línea naranja. */
const SERIES_CHAR_EM = 0.55

const seriesLine = (match: CardMatch) =>
  clampText([match.seriesName, match.competitionName, match.roundLabel].filter(Boolean).join(' · '), 80)

/** La línea naranja de serie · competencia · fecha va siempre en una línea: si no cabe, se achica la letra. */
function seriesFontSize(text: string, width: number, size: number): number {
  return Math.min(size, width / (text.length * SERIES_CHAR_EM))
}

/** Alto que ocupa el pie (para dar a los paneles justo el resto). */
function matchdayInfoHeight(match: CardMatch, width: number, sizes: InfoSizes): number {
  const names = matchdayNames(
    clampText(match.home.name, 80),
    clampText(match.away.name, 80),
    width,
    sizes.names,
  )
  const gap = sizes.series * 0.3
  return (
    sizes.series * 1.25 +
    names.size * names.lines * 1.02 +
    sizes.names * 0.45 +
    (match.venueName ? sizes.venue * 1.2 + gap : 0) +
    sizes.when * 1.15 +
    gap * 4
  )
}

/** Textos del pie: serie y competencia, los dos equipos con «VS» en medio (sin cortar), la cancha y cuándo. */
function MatchdayInfo({
  match,
  width,
  sizes,
  whenPrefix,
}: {
  match: CardMatch
  width: number
  sizes: InfoSizes
  whenPrefix?: string
}) {
  const home = clampText(match.home.name, 80)
  const away = clampText(match.away.name, 80)
  const names = matchdayNames(home, away, width, sizes.names)
  const series = seriesLine(match)
  const seriesSize = seriesFontSize(series, width, sizes.series)
  const name = (text: string) => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        fontFamily: MD_DISPLAY,
        fontSize: names.size,
        lineHeight: 1,
        letterSpacing: names.size * 0.015,
        textAlign: 'center',
        textTransform: 'uppercase',
      }}
    >
      {text}
    </div>
  )
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width,
        gap: sizes.series * 0.3,
      }}
    >
      <div
        style={{
          display: 'flex',
          fontFamily: MD_TEXT,
          fontWeight: 600,
          fontSize: seriesSize,
          letterSpacing: seriesSize * 0.12,
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          color: ACCENT,
        }}
      >
        {series}
      </div>
      {name(home)}
      <div
        style={{
          display: 'flex',
          fontFamily: MD_DISPLAY,
          fontSize: sizes.names * 0.45,
          lineHeight: 1,
          color: ACCENT,
        }}
      >
        VS
      </div>
      {name(away)}
      {match.venueName && (
        <div
          style={{
            display: 'flex',
            fontFamily: MD_TEXT,
            fontWeight: 500,
            fontSize: sizes.venue,
            letterSpacing: sizes.venue * 0.05,
            textTransform: 'uppercase',
            color: whiteAlpha(0.9),
            lineHeight: 1.2,
            textAlign: 'center',
          }}
        >
          {clampText(match.venueName, 44)}
        </div>
      )}
      <MatchdayWhen match={match} size={sizes.when} prefix={whenPrefix} width={width} />
    </div>
  )
}

/** Tamaños por formato (en px de 1080 de ancho). El pie manda: los paneles se quedan con el resto. */
function matchdaySizes(layout: Layout) {
  if (layout.tall) {
    return {
      top: 140,
      sponsor: 34,
      title: 300,
      crest: 190,
      info: { names: 118, series: 32, venue: 38, when: 58 },
      gap: 48,
      bottom: 100,
      panelGap: 60,
      band: { size: 104, min: 64 },
    }
  }
  if (layout.height > 1200) {
    return {
      top: 52,
      sponsor: 28,
      title: 270,
      crest: 140,
      info: { names: 98, series: 27, venue: 32, when: 50 },
      gap: 30,
      bottom: 44,
      panelGap: 50,
      band: { size: 86, min: 52 },
    }
  }
  return {
    top: 38,
    sponsor: 23,
    title: 220,
    crest: 120,
    info: { names: 78, series: 22, venue: 26, when: 40 },
    gap: 22,
    bottom: 30,
    panelGap: 40,
    band: { size: 66, min: 42 },
  }
}

const scaleInfo = (info: InfoSizes, s: number): InfoSizes => ({
  names: info.names * s,
  series: info.series * s,
  venue: info.venue * s,
  when: info.when * s,
})

/** «MATCHDAY» en Bebas Neue, con la sombra de la plantilla. */
function MatchdayTitle({ size }: { size: number }) {
  return (
    <div
      style={{
        display: 'flex',
        fontFamily: MD_DISPLAY,
        fontSize: size,
        lineHeight: 0.78,
        letterSpacing: -size * 0.01,
        color: PAPER,
        textShadow: `0px ${size * 0.028}px ${size * 0.14}px rgba(0, 0, 0, 0.45)`,
      }}
    >
      MATCHDAY
    </div>
  )
}

/** «POWERED BY …» con el auspiciador de las tarjetas (si no hay, no se dibuja). */
function Sponsor({ name, size }: { name: string; size: number }) {
  return (
    <div
      style={{
        display: 'flex',
        fontFamily: MD_TEXT,
        fontWeight: 600,
        fontSize: size,
        letterSpacing: size * 0.15,
        textTransform: 'uppercase',
        lineHeight: 1.2,
      }}
    >
      {clampText(`Powered by ${name}`, 44)}
    </div>
  )
}

/** «Próximo partido» con la composición matchday del club: título, tres paneles de fotos y el pie. */
function MatchdayCard({ data, layout }: { data: MatchCardData; layout: Layout }) {
  const sponsor = data.matchday?.sponsor ?? null
  const photos = data.matchday?.photos ?? [null, null, null]
  const props = { match: data.match, layout, sponsor, photos }
  return layout.wide ? <MatchdayWide {...props} /> : <MatchdayFrame {...props} />
}

/**
 * «Jornada»: el matchday con las series que juegan en una banda bajo los paneles y la hora de inicio de la
 * jornada (la del primer partido) en vez de la de cada serie.
 */
function JornadaCard({ data, layout }: { data: JornadaCardData; layout: Layout }) {
  const { sponsor, photos } = data.matchday
  // La línea naranja lleva la competencia (si todas son de la misma) en lugar de la serie.
  const match: CardMatch = {
    ...data.match,
    seriesName: '',
    roundLabel: null,
    competitionName: data.match.competitionName || 'Jornada',
  }
  const props = { match, layout, sponsor, photos, series: data.series, whenPrefix: 'Inicio' }
  return layout.wide ? <MatchdayWide {...props} /> : <MatchdayFrame {...props} />
}

type MatchdayProps = {
  match: CardMatch
  layout: Layout
  sponsor: string | null
  photos: (string | null)[]
  /** Solo la jornada: las series de la banda bajo los paneles y «Inicio» antes de la hora. */
  series?: readonly string[]
  whenPrefix?: string
}

/** Banda de series de la jornada: los nombres en blanco y los separadores en naranja, en 1 o 2 líneas. */
function SeriesBand({ lines, size }: { lines: string[][]; size: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: size * 0.08 }}>
      {lines.map((line) => (
        <div
          key={line.join('|')}
          style={{
            display: 'flex',
            fontFamily: MD_DISPLAY,
            fontSize: size,
            lineHeight: 1,
            letterSpacing: size * 0.015,
            color: PAPER,
            whiteSpace: 'nowrap',
          }}
        >
          {line.map((name, index) => (
            <div key={name} style={{ display: 'flex' }}>
              {index > 0 && (
                <div style={{ display: 'flex', color: ACCENT, whiteSpace: 'pre' }}>{SERIES_SEPARATOR}</div>
              )}
              {name}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

const bandHeight = (lines: number, size: number) => (lines > 0 ? lines * size + (lines - 1) * size * 0.08 : 0)

/** Nombres de serie para la banda (sin marcadores de contenido pendiente y con un largo razonable). */
const clampSeries = (series: readonly string[]) => series.map((name) => clampText(name, 24))

/** La composición matchday vertical o cuadrada: título, tres paneles de fotos, la banda de series y el pie. */
function MatchdayFrame({ match, layout, sponsor, photos, series, whenPrefix }: MatchdayProps) {
  const { s, width, height } = layout
  const z = matchdaySizes(layout)
  const info = scaleInfo(z.info, s)
  const contentWidth = 930 * s
  const sponsorHeight = sponsor ? (z.sponsor * 1.2 + 14) * s : 0
  const titleBox = z.title * 0.78 * s
  // El título monta la mitad de su alto sobre los paneles (en la plantilla, margin-bottom negativo).
  const titleOverlap = titleBox * 0.5
  const crest = z.crest * s
  const infoWidth = contentWidth - crest * 2 - 40 * s
  const bottomRow = Math.max(crest, matchdayInfoHeight(match, infoWidth, info))
  const band = series
    ? seriesBandLayout(clampSeries(series), contentWidth, z.band.size * s, z.band.min * s)
    : null
  const bandBlock = band ? bandHeight(band.lines.length, band.size) + z.gap * s : 0
  const panelHeight =
    height -
    z.top * s -
    sponsorHeight -
    (titleBox - titleOverlap) -
    z.gap * s -
    bandBlock -
    bottomRow -
    z.bottom * s
  const panelWidth = (contentWidth - z.panelGap * s * 2) / 3

  return (
    <div style={{ display: 'flex', position: 'relative', width, height }}>
      <MatchdayBackground layout={layout} />
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          left: 0,
          top: 0,
          width,
          height,
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: z.top * s,
        }}
      >
        {sponsor && (
          <div style={{ display: 'flex', marginBottom: 14 * s }}>
            <Sponsor name={sponsor} size={z.sponsor * s} />
          </div>
        )}
        <div style={{ display: 'flex', height: titleBox - titleOverlap }} />
        <div style={{ display: 'flex', gap: z.panelGap * s }}>
          {photos.map((photo, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: los tres paneles son fijos.
            <Panel key={index} index={index} photo={photo} width={panelWidth} height={panelHeight} />
          ))}
        </div>
        {band && (
          <div style={{ display: 'flex', marginTop: z.gap * s }}>
            <SeriesBand lines={band.lines} size={band.size} />
          </div>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: contentWidth,
            height: bottomRow,
            marginTop: z.gap * s,
          }}
        >
          <MatchdayCrest team={match.home} size={crest} />
          <MatchdayInfo match={match} width={infoWidth} sizes={info} whenPrefix={whenPrefix} />
          <MatchdayCrest team={match.away} size={crest} />
        </div>
      </div>
      {/* El título va al final: Satori pinta en orden y no tiene z-index, así queda sobre los paneles. */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          left: 0,
          top: z.top * s + sponsorHeight,
          width,
          justifyContent: 'center',
        }}
      >
        <MatchdayTitle size={z.title * s} />
      </div>
    </div>
  )
}

/** Open Graph (1200 × 630): título y datos a la izquierda, los tres paneles a la derecha. */
function MatchdayWide({ match, layout, sponsor, photos, series, whenPrefix }: MatchdayProps) {
  const { width, height } = layout
  const pad = 40
  const panelGap = 14
  const panelsWidth = 420
  const panelWidth = (panelsWidth - panelGap * 2) / 3
  const leftWidth = width - pad * 3 - panelsWidth
  const crest = 96
  const band = series ? seriesBandLayout(clampSeries(series), leftWidth, 40, 24) : null
  return (
    <div style={{ display: 'flex', position: 'relative', width, height }}>
      <MatchdayBackground layout={layout} />
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          left: 0,
          top: 0,
          width,
          height,
          padding: pad,
          gap: pad,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 24,
            width: leftWidth,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            {sponsor && <Sponsor name={sponsor} size={19} />}
            <MatchdayTitle size={140} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <MatchdayCrest team={match.home} size={crest} />
            <MatchdayInfo
              match={match}
              width={leftWidth - crest * 2 - 24}
              sizes={
                band
                  ? { names: 44, series: 16, venue: 18, when: 24 }
                  : { names: 50, series: 16, venue: 19, when: 26 }
              }
              whenPrefix={whenPrefix}
            />
            <MatchdayCrest team={match.away} size={crest} />
          </div>
          {band && <SeriesBand lines={band.lines} size={band.size} />}
        </div>
        <div style={{ display: 'flex', gap: panelGap }}>
          {photos.map((photo, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: los tres paneles son fijos.
            <Panel key={index} index={index} photo={photo} width={panelWidth} height={height - pad * 2} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Programación del fin de semana (grilla por serie, con las fuentes y el fondo del matchday) ─────

const rivalOf = (match: CardMatch): CardTeam => (match.clubSide === 'local' ? match.away : match.home)

/** Cuántos partidos caben y en cuántas columnas. */
function scheduleGrid(layout: Layout, count: number): { max: number; columns: number } {
  if (layout.wide) return { max: 4, columns: Math.min(Math.max(count, 1), 4) }
  // Con pocos partidos, una columna: las tarjetas a lo ancho llenan el alto sin quedar vacías.
  const single = count <= (layout.tall ? 4 : layout.height > 1200 ? 3 : 2)
  return { max: layout.height > 1200 ? 8 : 6, columns: single ? 1 : 2 }
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = []
  for (let index = 0; index < items.length; index += size) rows.push(items.slice(index, index + size))
  return rows
}

/** Hora del partido, o su estado si ya no se juega a esa hora (postergado, suspendido). */
function matchTime(match: CardMatch): string {
  return match.status === 'programado' || match.status === 'en_vivo'
    ? formatTime(match.kickoffAt)
    : matchStatusLabels[match.status]
}

/** Una tarjeta por serie con la hora en display; si todas juegan contra el mismo rival, va una vez arriba. */
function ScheduleCard({ data, layout }: { data: WeekendCardData; layout: Layout }) {
  const { s, wide, width, height } = layout
  const pad = (wide ? 40 : 64) * s
  const gap = (wide ? 12 : 16) * s
  const { max, columns } = scheduleGrid(layout, data.matches.length)
  const shown = data.matches.slice(0, max)
  const rest = data.matches.length - shown.length
  const rows = chunk(shown, columns)
  const first = data.matches[0]
  const shared =
    first && new Set(data.matches.map((match) => rivalOf(match).name)).size === 1 ? rivalOf(first) : null
  const sharedName = shared ? clampText(shared.name, 80) : ''
  const tileWidth = (width - pad * 2 - gap * (columns - 1)) / columns
  // Alto disponible por fila, para escalar la hora: las filas llenan el alto de la tarjeta.
  const sponsorHeight = data.sponsor ? (wide ? 34 : 50) * s : 0
  const headerHeight =
    (wide ? 110 : 190) * s + sponsorHeight + (shared ? (wide ? 70 : 120) * s : 0) + (rest > 0 ? 50 * s : 0)
  const rowHeight = (height - pad * 2 - headerHeight - gap * rows.length) / rows.length
  // Con filas altas (pocos partidos) todo crece, para no dejar la tarjeta vacía.
  const grow = wide ? 1 : Math.min(Math.max(rowHeight / (300 * s), 1), 1.6)
  const timeCap = Math.min(rowHeight * (shared ? 0.48 : 0.38), (wide ? 80 : columns === 1 ? 320 : 230) * s)
  const crestCap = (wide ? 48 : 110) * s * grow
  const label = (wide ? 28 : 38) * s * grow
  const detail = (wide ? 20 : 27) * s * grow

  return (
    <div style={{ display: 'flex', position: 'relative', width, height }}>
      <MatchdayBackground layout={layout} />
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          left: 0,
          top: 0,
          width,
          height,
          flexDirection: 'column',
          padding: pad,
          gap: gap * 1.5,
          fontFamily: MD_TEXT,
        }}
      >
        {data.sponsor && <Sponsor name={data.sponsor} size={(wide ? 18 : 26) * s} />}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 * s }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                display: 'flex',
                fontFamily: MD_DISPLAY,
                fontSize: (wide ? 76 : 124) * s,
                lineHeight: 0.9,
                textTransform: 'uppercase',
              }}
            >
              Programación
            </div>
            <div
              style={{
                display: 'flex',
                fontWeight: 600,
                fontSize: (wide ? 26 : 36) * s,
                letterSpacing: 1.5 * s,
                textTransform: 'uppercase',
                color: ACCENT,
              }}
            >
              {weekendTitle(data.saturday)}
            </div>
          </div>
          <Crest team={{ name: data.clubName, crest: data.clubCrest }} size={(wide ? 80 : 130) * s} />
        </div>
        {shared && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18 * s,
              borderTop: `${2 * s}px solid ${whiteAlpha(0.18)}`,
              paddingTop: 16 * s,
            }}
          >
            <div
              style={{
                display: 'flex',
                fontWeight: 600,
                fontSize: (wide ? 24 : 30) * s,
                letterSpacing: 2 * s,
                color: whiteAlpha(0.7),
                textTransform: 'uppercase',
              }}
            >
              Contra
            </div>
            <MatchdayCrest team={shared} size={(wide ? 48 : 80) * s} />
            <div
              style={{
                display: 'flex',
                flex: 1,
                fontFamily: MD_DISPLAY,
                fontSize: fitDisplaySize(
                  sharedName,
                  width - pad * 2 - 260 * s,
                  (wide ? 48 : 72) * s,
                  2,
                  (wide ? 24 : 36) * s,
                  CHAR_EM.bebas,
                ),
                lineHeight: 1,
                textTransform: 'uppercase',
              }}
            >
              {sharedName}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, gap }}>
          {rows.map((row) => (
            <div
              key={row.map((match) => match.kickoffAt + match.seriesName).join()}
              style={{ display: 'flex', flex: 1, gap }}
            >
              {row.map((match) => {
                const rival = rivalOf(match)
                const versus = `vs ${clampText(rival.name, 80)}`
                const time = matchTime(match)
                const inner = tileWidth - (wide ? 28 : 44) * s
                const versusSize = fitDisplaySize(versus, inner, label * 1.05, 2, label * 0.5, CHAR_EM.bebas)
                // Un rival en dos líneas le quita alto a la hora: así la tarjeta conserva su margen interno.
                const versusExtra = shared
                  ? 0
                  : (displayLines(versus, inner, versusSize, CHAR_EM.bebas) - 1) * versusSize
                const crestSize = Math.min(timeCap - versusExtra, crestCap)
                // La hora también debe caber a lo ancho, junto al escudo del rival.
                const free = inner - (shared ? 0 : crestSize + 12 * s)
                const timeSize = Math.min(timeCap - versusExtra, free / (time.length * CHAR_EM.bebas))
                return (
                  <div
                    key={`${match.kickoffAt}-${match.seriesName}`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      width: tileWidth,
                      backgroundColor: 'rgba(20, 20, 20, 0.82)',
                      borderTop: `${8 * s}px solid ${ACCENT}`,
                      padding: `${(wide ? 10 : 18) * s}px ${(wide ? 14 : 22) * s}px`,
                      gap: 2 * s,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        fontFamily: MD_DISPLAY,
                        fontSize: label,
                        letterSpacing: label * 0.03,
                        color: ACCENT,
                        textTransform: 'uppercase',
                      }}
                    >
                      {clampText(match.seriesName, 24)}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12 * s,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          fontFamily: MD_DISPLAY,
                          fontSize: timeSize,
                          lineHeight: 0.95,
                        }}
                      >
                        {time}
                      </div>
                      {!shared && <MatchdayCrest team={rival} size={crestSize} />}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        fontWeight: 600,
                        fontSize: detail,
                        letterSpacing: detail * 0.04,
                        textTransform: 'uppercase',
                      }}
                    >
                      {[formatDayMonth(match.kickoffAt), SIDE_LABEL[match.clubSide]].join(' · ')}
                    </div>
                    {match.venueName && (
                      <div
                        style={{
                          display: 'flex',
                          fontWeight: 500,
                          fontSize: detail,
                          letterSpacing: detail * 0.04,
                          textTransform: 'uppercase',
                          color: whiteAlpha(0.7),
                        }}
                      >
                        {clampText(match.venueName, columns > 2 ? 22 : 34)}
                      </div>
                    )}
                    {!shared && (
                      <div
                        style={{
                          display: 'flex',
                          fontFamily: MD_DISPLAY,
                          fontSize: versusSize,
                          lineHeight: 1,
                          textTransform: 'uppercase',
                          marginTop: 4 * s,
                        }}
                      >
                        {versus}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        {rest > 0 && (
          <div
            style={{ display: 'flex', fontWeight: 600, fontSize: 28 * s, color: whiteAlpha(0.7) }}
          >{`y ${rest} partidos más en el sitio`}</div>
        )}
      </div>
    </div>
  )
}
