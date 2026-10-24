import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'
import type { ReactNode } from 'react'
import { formatDayMonth, formatLongDate, formatTime } from '@/lib/format'
import { matchStatusLabels } from '@/lib/labels'
import type { CardMatch, CardTeam, MatchCardData, NewsCardData, ShareCardData, WeekendCardData } from './dto'
import { BRAND } from './lib/brand'
import { clampText, fitDisplaySize, SHARE_FORMATS, type ShareFormat, weekendTitle } from './lib/cards'

// Plantillas de las tarjetas (especificación 2.8) con Satori (`next/og`): solo flexbox, fuentes TTF
// estáticas y escudos como *data URI* PNG (trampa 8). Fondo negro, marcador en display condensada,
// escudos enfrentados y franja de acento.

const INK = BRAND.ink
const PAPER = BRAND.paper
const ACCENT = BRAND.accent
const MUTED = BRAND.neutral400
const LIVE = BRAND.live
const SURFACE = BRAND.neutral900
const LINE = BRAND.neutral800
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
          <NextMatchCard data={data} layout={layout} />
        ) : (
          <MatchCard data={data} layout={layout} />
        ))}
      {data.kind === 'weekend' &&
        (data.template === 'programacion' ? (
          <ScheduleCard data={data} layout={layout} />
        ) : (
          <WeekendCard data={data} layout={layout} />
        ))}
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

// ─── Próximo partido («cara a cara») ────────────────────────────────────────────────────────────────

const SIDE_LABEL = { local: 'Local', visita: 'Visita' } as const
/** Ancho de un dígito de la fuente display, en em (la hora «15:30» mide unos 5 de estos). */
const DISPLAY_EM = 0.56

/** «Sábado 31 de octubre» (sin año). */
function dayLong(iso: string): string {
  return capitalize(formatLongDate(iso).replace(/ de \d{4}$/, ''))
}

function NextTeam({
  team,
  crest,
  width,
  nameSize,
}: {
  team: CardTeam
  crest: number
  width: number
  nameSize: number
}) {
  // El nombre nunca se corta con «…»: si no cabe en dos líneas, se achica la letra.
  const name = clampText(team.name, 80)
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: nameSize * 0.35, width }}
    >
      <Crest team={team} size={crest} />
      <div
        style={{
          display: 'flex',
          fontFamily: DISPLAY,
          fontSize: fitDisplaySize(name, width, nameSize, 3),
          lineHeight: 1.02,
          textAlign: 'center',
          textTransform: 'uppercase',
          justifyContent: 'center',
        }}
      >
        {name}
      </div>
    </div>
  )
}

/** Escudos grandes enfrentados y una banda de acento con fecha, hora, local o visita y cancha. */
function NextMatchCard({ data, layout }: { data: MatchCardData; layout: Layout }) {
  const { match } = data
  const { s, wide, tall } = layout
  const pad = (wide ? 44 : 64) * s
  // En 9:16 los equipos van uno sobre otro: así llenan el alto en vez de dejarlo vacío.
  const crest = (wide ? 190 : tall ? 360 : layout.height > 1200 ? 330 : 270) * s
  const nameSize = (wide ? 44 : tall ? 76 : 62) * s
  const teamWidth = tall ? layout.width - pad * 2 : (layout.width - pad * 2 - 150 * s) / 2
  const timeSize = (wide ? 100 : 140) * s
  const date = dayLong(match.kickoffAt)
  // La fecha va en una línea junto a la hora: si no cabe, se achica.
  const dateWidth = layout.width - pad * 2 - 32 * s - timeSize * DISPLAY_EM * 5
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
      <div style={{ display: 'flex', flexDirection: 'column', padding: pad, paddingBottom: 0, gap: 10 * s }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 * s }}>
          <Eyebrow layout={layout}>
            {match.status === 'postergado' ? 'Partido postergado' : 'Próximo partido'}
          </Eyebrow>
          <div
            style={{
              display: 'flex',
              fontFamily: DISPLAY,
              fontSize: (wide ? 30 : 40) * s,
              textTransform: 'uppercase',
              border: `${3 * s}px solid ${PAPER}`,
              padding: `${6 * s}px ${18 * s}px`,
              flexShrink: 0,
            }}
          >
            {clampText(match.seriesName, 24)}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: (wide ? 26 : 32) * s,
            color: MUTED,
            textTransform: 'uppercase',
          }}
        >
          {clampText([match.competitionName, match.roundLabel].filter(Boolean).join(' · '), 56)}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexGrow: 1,
          flexDirection: tall ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: (tall ? 28 : 0) * s,
          padding: `${(wide ? 8 : 24) * s}px ${pad}px`,
        }}
      >
        <NextTeam team={match.home} crest={crest} width={teamWidth} nameSize={nameSize} />
        <div
          style={{
            display: 'flex',
            fontFamily: DISPLAY,
            fontSize: (wide ? 80 : 120) * s,
            color: ACCENT,
            lineHeight: 1,
          }}
        >
          VS
        </div>
        <NextTeam team={match.away} crest={crest} width={teamWidth} nameSize={nameSize} />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 32 * s,
          backgroundColor: ACCENT,
          color: INK,
          padding: `${(wide ? 18 : 32) * s}px ${pad}px ${(wide ? 30 : 48) * s}px`,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 * s, flexShrink: 1 }}>
          <div
            style={{
              display: 'flex',
              fontFamily: DISPLAY,
              fontSize: fitDisplaySize(date, dateWidth, (wide ? 48 : 64) * s, 1),
              lineHeight: 1,
              textTransform: 'uppercase',
            }}
          >
            {date}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 * s, fontSize: (wide ? 26 : 34) * s }}>
            <div
              style={{
                display: 'flex',
                fontFamily: DISPLAY,
                textTransform: 'uppercase',
                backgroundColor: INK,
                color: PAPER,
                padding: `${2 * s}px ${12 * s}px`,
                flexShrink: 0,
              }}
            >
              {SIDE_LABEL[match.clubSide]}
            </div>
            {match.venueName && (
              <div style={{ display: 'flex' }}>{clampText(match.venueName, wide ? 34 : 30)}</div>
            )}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            fontFamily: DISPLAY,
            fontSize: timeSize,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          {formatTime(match.kickoffAt)}
        </div>
      </div>
    </div>
  )
}

// ─── Programación del fin de semana («grilla de jornada») ───────────────────────────────────────────

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
  const { s, wide } = layout
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
  const tileWidth = (layout.width - pad * 2 - gap * (columns - 1)) / columns
  // Alto disponible por fila, para escalar la hora: las filas llenan el alto de la tarjeta.
  const headerHeight = (wide ? 110 : 190) * s + (shared ? (wide ? 70 : 120) * s : 0) + (rest > 0 ? 50 * s : 0)
  const rowHeight = (layout.height - pad * 2 - 18 * s - headerHeight - gap * rows.length) / rows.length
  // Con filas altas (pocos partidos) todo crece, para no dejar la tarjeta vacía.
  const grow = wide ? 1 : Math.min(Math.max(rowHeight / (300 * s), 1), 1.6)
  const timeCap = Math.min(rowHeight * (shared ? 0.42 : 0.32), (wide ? 70 : columns === 1 ? 280 : 200) * s)
  const crestCap = (wide ? 48 : 110) * s * grow
  const label = (wide ? 24 : 32) * s * grow
  const detail = (wide ? 18 : 24) * s * grow

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1,
        padding: pad,
        paddingBottom: pad + 18 * s,
        gap: gap * 1.5,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 * s }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontFamily: DISPLAY,
              fontSize: (wide ? 60 : 104) * s,
              lineHeight: 1,
              textTransform: 'uppercase',
            }}
          >
            Jornada
          </div>
          <div style={{ display: 'flex', fontSize: (wide ? 26 : 36) * s, color: ACCENT }}>
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
            borderTop: `${2 * s}px solid ${LINE}`,
            paddingTop: 16 * s,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: (wide ? 24 : 30) * s,
              color: MUTED,
              textTransform: 'uppercase',
            }}
          >
            Contra
          </div>
          <Crest team={shared} size={(wide ? 48 : 80) * s} />
          <div
            style={{
              display: 'flex',
              flex: 1,
              fontFamily: DISPLAY,
              fontSize: fitDisplaySize(sharedName, layout.width - pad * 2 - 260 * s, (wide ? 40 : 60) * s),
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
              const crestSize = Math.min(timeCap, crestCap)
              // La hora también debe caber a lo ancho, junto al escudo del rival.
              const free = tileWidth - (wide ? 28 : 44) * s - (shared ? 0 : crestSize + 12 * s)
              const timeSize = Math.min(timeCap, free / (time.length * DISPLAY_EM))
              return (
                <div
                  key={`${match.kickoffAt}-${match.seriesName}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    width: tileWidth,
                    backgroundColor: SURFACE,
                    borderTop: `${8 * s}px solid ${ACCENT}`,
                    padding: `${(wide ? 10 : 18) * s}px ${(wide ? 14 : 22) * s}px`,
                    gap: 4 * s,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      fontFamily: DISPLAY,
                      fontSize: label,
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
                    <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: timeSize, lineHeight: 1 }}>
                      {time}
                    </div>
                    {!shared && <Crest team={rival} size={crestSize} />}
                  </div>
                  <div style={{ display: 'flex', fontSize: detail, color: BRAND.neutral200 }}>
                    {[capitalize(formatDayMonth(match.kickoffAt)), SIDE_LABEL[match.clubSide]].join(' · ')}
                  </div>
                  {match.venueName && (
                    <div style={{ display: 'flex', fontSize: detail, color: MUTED }}>
                      {clampText(match.venueName, columns > 2 ? 22 : 34)}
                    </div>
                  )}
                  {!shared && (
                    <div
                      style={{
                        display: 'flex',
                        fontFamily: DISPLAY,
                        fontSize: fitDisplaySize(versus, tileWidth - (wide ? 28 : 44) * s, label * 0.95),
                        lineHeight: 1.05,
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
          style={{ display: 'flex', fontSize: 28 * s, color: MUTED }}
        >{`y ${rest} partidos más en el sitio`}</div>
      )}
    </div>
  )
}
