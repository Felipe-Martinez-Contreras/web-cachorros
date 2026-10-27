import { CHAR_EM, displayLines, fitDisplaySize } from './cards'

// Tamaños de los tiles de «Programación»: uno solo para todos los de una imagen (el que cabe en el más
// exigente), para que horas, nombres y escudos se vean parejos. Lógica pura: la usa `render.tsx` y la prueban
// las unitarias (nada se sale del tile).

/** Ancho medio de una mayúscula de Barlow Condensed (fecha y cancha), en em, con su espaciado. */
export const DETAIL_CHAR_EM = 0.5

export type ScheduleTile = {
  /** Hora o estado («10:00», «Postergado»). */
  time: string
  /** «vs Rival» (sin él cuando todos juegan contra el mismo rival). */
  versus: string | null
  /** «SÁB 31 OCT · LOCAL». */
  detail: string
  venue: string | null
}

export type ScheduleLayoutInput = {
  tiles: readonly ScheduleTile[]
  tileWidth: number
  rowHeight: number
  /** Escala de la tarjeta (ancho / 1080) y si es la OG. */
  s: number
  wide: boolean
  /** Tiles a lo ancho (una sola columna): la hora a la izquierda y los datos a la derecha. */
  horizontal: boolean
  /** Tamaños de partida (ya escalados), que solo se achican. */
  base: { label: number; detail: number; time: number; crest: number }
}

export type ScheduleLayout = {
  horizontal: boolean
  padX: number
  padY: number
  border: number
  gap: number
  label: number
  time: number
  detail: number
  /** La cancha: nunca más grande que el rival (si quedara muy chica, no va). */
  venue: number
  versus: number
  versusLines: number
  crest: number
  showVenue: boolean
  /** Horizontal: ancho del bloque de la hora (el resto va para los datos y el escudo). */
  leftWidth: number
}

/** Alto de línea de cada texto del tile (el render usa los mismos). */
export const TILE_LINE = { label: 1.05, time: 0.95, detail: 1.2, versus: 1 } as const

const MIN_SCALE_WITH_VENUE = 0.82
const MIN_SCALE = 0.5

/** El ancho de una línea de detalle a ese tamaño. */
const detailWidth = (text: string, size: number) => text.length * size * DETAIL_CHAR_EM

/**
 * Un solo juego de tamaños para todos los tiles: primero achica todo de forma pareja; si con la cancha no
 * alcanza sin bajar de ~82 %, la omite y vuelve a probar.
 */
export function scheduleTileLayout(input: ScheduleLayoutInput): ScheduleLayout {
  const { s, wide, tiles } = input
  const padX = (wide ? 14 : 22) * s
  const padY = (wide ? 10 : 18) * s
  const border = 6 * s
  const gap = 4 * s
  const inner = input.tileWidth - padX * 2
  const height = input.rowHeight - border - padY * 2
  const hasVenue = tiles.some((tile) => tile.venue)
  const timeChars = Math.max(...tiles.map((tile) => tile.time.length), 1)
  const attempts = hasVenue ? [true, false] : [false]

  let last: ScheduleLayout | null = null
  for (const showVenue of attempts) {
    const floor = showVenue && hasVenue ? MIN_SCALE_WITH_VENUE : MIN_SCALE
    for (let scale = 1; scale >= floor - 1e-9; scale -= 0.04) {
      const attempt = { scale, showVenue, inner, height, padX, padY, border, gap, timeChars }
      const { layout, fits } = input.horizontal
        ? horizontalLayout(input, attempt)
        : verticalLayout(input, attempt)
      if (fits) return layout
      last = layout
    }
  }
  // Con el mínimo siempre cabe; por si acaso, lo más chico que se probó.
  return last as ScheduleLayout
}

type Attempt = {
  scale: number
  showVenue: boolean
  inner: number
  height: number
  padX: number
  padY: number
  border: number
  gap: number
  timeChars: number
}

/** Un intento y si cabe en el alto del tile (la hora no queda más chica que su mínimo). */
type Checked = { layout: ScheduleLayout; fits: boolean }

/** Detalle (fecha y cancha) al tamaño pedido, achicado si alguna línea no cabe a lo ancho. */
function detailSize(tiles: readonly ScheduleTile[], width: number, size: number, showVenue: boolean) {
  const lines = tiles.flatMap((tile) => [tile.detail, ...(showVenue && tile.venue ? [tile.venue] : [])])
  const widest = Math.max(...lines.map((line) => detailWidth(line, 1)), 1)
  return Math.min(size, width / widest)
}

/**
 * «vs Rival» con la misma letra en todos: en una línea si cabe sin bajar del 75 %; si no, la que cabe en 2
 * líneas en el más largo.
 */
function versusSize(tiles: readonly ScheduleTile[], width: number, size: number) {
  const names = tiles.map((tile) => tile.versus).filter((name): name is string => Boolean(name))
  if (names.length === 0) return { size: 0, lines: 0 }
  const lines = (common: number) =>
    Math.max(...names.map((name) => displayLines(name, width, common, CHAR_EM.bebas)))
  const single = Math.min(
    ...names.map((name) => fitDisplaySize(name, width, size, 1, size * 0.75, CHAR_EM.bebas)),
  )
  if (lines(single) === 1) return { size: single, lines: 1 }
  const common = Math.min(
    ...names.map((name) => fitDisplaySize(name, width, size, 2, size * 0.5, CHAR_EM.bebas)),
  )
  return { size: common, lines: lines(common) }
}

/** La cancha baja hasta el tamaño del rival; por debajo de esto (respecto de la fecha) se omite. */
const MIN_VENUE = 0.6
const VENUE_TO_VERSUS = 0.9

/** Tamaño de la cancha y si va: no más grande que «vs Rival», que es lo más importante de los dos. */
function venueSize(detail: number, versus: { size: number; lines: number }, showVenue: boolean) {
  // Al 90 %: a igual tamaño, la Barlow de la cancha se ve algo más grande que la Bebas del rival.
  const venue = versus.lines > 0 ? Math.min(detail, versus.size * VENUE_TO_VERSUS) : detail
  return { venue, showVenue: showVenue && venue >= detail * MIN_VENUE }
}

/** La hora es lo que manda en el tile: si no llega a este múltiplo de la serie, no cabe. */
const MIN_TIME = 1.8

/** Serie arriba, la hora (con el escudo del rival al lado), fecha, cancha y rival. */
function verticalLayout(input: ScheduleLayoutInput, a: Attempt): Checked {
  const { base, tiles, s } = input
  const label = base.label * a.scale
  const detail = detailSize(tiles, a.inner, base.detail * a.scale, a.showVenue)
  const versus = versusSize(tiles, a.inner, label * 0.95)
  const { venue, showVenue } = venueSize(detail, versus, a.showVenue && tiles.some((tile) => tile.venue))
  const texts =
    label * TILE_LINE.label +
    detail * TILE_LINE.detail +
    (showVenue ? venue * TILE_LINE.detail : 0) +
    versus.size * versus.lines * TILE_LINE.versus
  const gaps = a.gap * (2 + (showVenue ? 1 : 0) + (versus.lines > 0 ? 1 : 0))
  const crestRoom = tiles.some((tile) => tile.versus) ? base.crest * a.scale + 12 * s : 0
  const byWidth = (a.inner - crestRoom) / (a.timeChars * CHAR_EM.bebas)
  const time = Math.min(base.time * a.scale, byWidth, (a.height - texts - gaps) / TILE_LINE.time)
  const crest = Math.min(base.crest * a.scale, time * TILE_LINE.time)
  const layout: ScheduleLayout = {
    horizontal: false,
    padX: a.padX,
    padY: a.padY,
    border: a.border,
    gap: a.gap,
    label,
    time,
    detail,
    venue,
    versus: versus.size,
    versusLines: versus.lines,
    crest,
    showVenue,
    leftWidth: a.inner,
  }
  return { layout, fits: time >= label * MIN_TIME }
}

/** A lo ancho: serie y hora a la izquierda; fecha, cancha y rival al centro; el escudo del rival a la derecha. */
function horizontalLayout(input: ScheduleLayoutInput, a: Attempt): Checked {
  const { base, tiles, s } = input
  const label = base.label * a.scale
  const hasRival = tiles.some((tile) => tile.versus)
  const crest = hasRival ? Math.min(base.crest * a.scale, a.height * 0.8) : 0
  const leftWidth = Math.min(a.inner * 0.46, base.time * a.scale * a.timeChars * CHAR_EM.bebas + 8 * s)
  const sideGap = 28 * s
  const rightWidth = a.inner - leftWidth - sideGap - (hasRival ? crest + sideGap : 0)
  // Con espacio de sobra, la fecha y la cancha crecen para equilibrar el tile.
  const detail = detailSize(tiles, rightWidth, base.detail * 1.3 * a.scale, a.showVenue)
  const versus = versusSize(tiles, rightWidth, label * 1.1)
  const { venue, showVenue } = venueSize(detail, versus, a.showVenue && tiles.some((tile) => tile.venue))
  const right =
    detail * TILE_LINE.detail +
    (showVenue ? venue * TILE_LINE.detail : 0) +
    versus.size * versus.lines * TILE_LINE.versus +
    a.gap * ((showVenue ? 1 : 0) + (versus.lines > 0 ? 1 : 0))
  const byWidth = leftWidth / (a.timeChars * CHAR_EM.bebas)
  const time = Math.min(
    base.time * a.scale,
    byWidth,
    (a.height - label * TILE_LINE.label - a.gap) / TILE_LINE.time,
  )
  const layout: ScheduleLayout = {
    horizontal: true,
    padX: a.padX,
    padY: a.padY,
    border: a.border,
    gap: a.gap,
    label,
    time,
    detail,
    venue,
    versus: versus.size,
    versusLines: versus.lines,
    crest,
    showVenue,
    leftWidth,
  }
  return { layout, fits: time >= label * MIN_TIME && right <= a.height }
}

/** Alto que ocupa el contenido de un tile con estos tamaños (para verificar que nada toca el borde). */
export function tileContentHeight(layout: ScheduleLayout): number {
  const venue = layout.showVenue ? 1 : 0
  const versus = layout.versus * layout.versusLines * TILE_LINE.versus
  if (layout.horizontal) {
    const left = layout.label * TILE_LINE.label + layout.time * TILE_LINE.time + layout.gap
    const right =
      layout.detail * TILE_LINE.detail +
      layout.venue * TILE_LINE.detail * venue +
      versus +
      layout.gap * (venue + (layout.versusLines > 0 ? 1 : 0))
    return Math.max(left, right, layout.crest)
  }
  return (
    layout.label * TILE_LINE.label +
    layout.time * TILE_LINE.time +
    layout.detail * TILE_LINE.detail +
    layout.venue * TILE_LINE.detail * venue +
    versus +
    layout.gap * (2 + venue + (layout.versusLines > 0 ? 1 : 0))
  )
}
