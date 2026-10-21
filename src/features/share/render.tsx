import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'
import type { ReactNode } from 'react'
import { formatDayMonth, formatLongDate, formatTime } from '@/lib/format'
import { matchStatusLabels } from '@/lib/labels'
import type { CardMatch, CardTeam, MatchCardData, NewsCardData, ShareCardData, WeekendCardData } from './dto'
import { clampText, SHARE_FORMATS, type ShareFormat, weekendTitle } from './lib/cards'

// Plantillas de las tarjetas (especificación 2.8) con Satori (`next/og`): solo flexbox, fuentes TTF
// estáticas y escudos como *data URI* PNG (trampa 8). Fondo negro, marcador en display condensada,
// escudos enfrentados y franja de acento.

const INK = '#0b0b0c'
const PAPER = '#ffffff'
const ACCENT = '#f27604'
const MUTED = '#9e9e9e'
const LIVE = '#d7263d'
const DISPLAY = 'Archivo Condensed'
const TEXT = 'Archivo'

const FONT_DIR = path.join(/* turbopackIgnore: true */ process.cwd(), 'src', 'assets', 'fonts', 'og')
let fontsPromise: Promise<{ name: string; data: Buffer; weight: 600 | 800; style: 'normal' }[]> | null = null

function loadFonts() {
  fontsPromise ??= Promise.all([
    readFile(path.join(/* turbopackIgnore: true */ FONT_DIR, 'ArchivoCondensed-ExtraBold.ttf')),
    readFile(path.join(/* turbopackIgnore: true */ FONT_DIR, 'Archivo-SemiBold.ttf')),
  ]).then(([display, text]) => [
    { name: DISPLAY, data: display, weight: 800, style: 'normal' },
    { name: TEXT, data: text, weight: 600, style: 'normal' },
  ])
  // Si falla (por ejemplo, la fuente no llegó a la imagen), el próximo intento vuelve a leerla.
  fontsPromise.catch(() => {
    fontsPromise = null
  })
  return fontsPromise
}

/** Dibuja la tarjeta en PNG (o JPEG ≤ 300 KB para Open Graph). Corre dentro de la cola de 1. */
export async function renderShareCard(data: ShareCardData, format: ShareFormat): Promise<Buffer> {
  const { width, height } = SHARE_FORMATS[format]
  const layout: Layout = { width, height, s: width / 1080, wide: format === 'og' }
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

type Layout = { width: number; height: number; s: number; wide: boolean }

function Card({ data, layout }: { data: ShareCardData; layout: Layout }) {
  const { width, height, s } = layout
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
      {data.kind === 'match' && <MatchCard data={data} layout={layout} />}
      {data.kind === 'weekend' && <WeekendCard data={data} layout={layout} />}
      {data.kind === 'news' && <NewsCard data={data} layout={layout} />}
      {/* Franja de acento al pie */}
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
    const inner = Math.round(size * 0.8)
    return (
      <div
        style={{
          display: 'flex',
          width: size,
          height: size,
          borderRadius: size,
          backgroundColor: PAPER,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* biome-ignore lint/performance/noImgElement: Satori dibuja <img>; no es una página. */}
        <img src={team.crest} width={inner} height={inner} alt="" style={{ objectFit: 'contain' }} />
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
  if (data.template === 'proximo') {
    return data.match.status === 'postergado'
      ? { text: 'Partido postergado', color: ACCENT }
      : { text: 'Próximo partido', color: ACCENT }
  }
  if (data.match.status === 'en_vivo') return { text: 'En vivo', color: LIVE }
  if (data.match.status === 'suspendido') return { text: matchStatusLabels.suspendido, color: ACCENT }
  return { text: 'Resultado final', color: ACCENT }
}

const capitalize = (text: string) => text.replace(/^./, (letter) => letter.toUpperCase())

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
  const showScore = data.template !== 'proximo'
  const penalties = showScore ? penaltiesLine(match) : null
  const date = capitalize(formatLongDate(match.kickoffAt).replace(/ de \d{4}$/, ''))

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
              fontSize: (showScore ? size.score : size.score * 0.5) * s,
              lineHeight: 1,
              color: showScore ? PAPER : MUTED,
            }}
          >
            {showScore ? `${match.homeScore}–${match.awayScore}` : 'VS'}
          </div>
          {penalties && <div style={{ display: 'flex', fontSize: 30 * s, color: MUTED }}>{penalties}</div>}
        </div>
        <TeamColumn team={match.away} crestSize={size.crest * s} nameSize={size.name * s} />
      </div>
      {data.template === 'proximo' &&
        (wide ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 20 * s, fontSize: 34 * s }}>
            <div style={{ display: 'flex' }}>{date}</div>
            <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 52 * s, color: ACCENT }}>
              {`${formatTime(match.kickoffAt)} h`}
            </div>
            {match.venueName && (
              <div style={{ display: 'flex', color: MUTED }}>{clampText(match.venueName, 28)}</div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 * s, fontSize: 44 * s }}>
            <div style={{ display: 'flex' }}>{date}</div>
            <div
              style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 96 * s, lineHeight: 1, color: ACCENT }}
            >
              {`${formatTime(match.kickoffAt)} h`}
            </div>
            {match.venueName && (
              <div style={{ display: 'flex', color: MUTED }}>{clampText(match.venueName, 40)}</div>
            )}
          </div>
        ))}
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
