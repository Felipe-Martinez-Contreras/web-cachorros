import { describe, expect, it } from 'vitest'
import {
  type ScheduleTile,
  scheduleTileLayout,
  tileContentHeight,
} from '@/features/share/lib/schedule-layout'

const tile = (overrides: Partial<ScheduleTile> = {}): ScheduleTile => ({
  time: '10:00',
  versus: 'vs Deportivo Ejemplo',
  detail: 'SÁB 31 OCT · LOCAL',
  venue: 'Cancha de ejemplo',
  ...overrides,
})

const six = [
  tile(),
  tile({ versus: 'vs Rojo Blanco', time: '11:45' }),
  tile({ versus: 'vs Deportivo Cuadrado', detail: 'SÁB 31 OCT · VISITA', venue: 'Estadio de ejemplo' }),
  tile({ versus: 'vs Atlético Alto' }),
  tile({ versus: 'vs Deportivo Ejemplo', detail: 'DOM 1 NOV · VISITA' }),
  tile({ versus: 'vs Social y Deportivo Población Ejemplo del Sur', detail: 'DOM 1 NOV · VISITA' }),
]

/** Lo que queda dentro del tile, sin el borde ni el margen interno. */
const room = (layout: ReturnType<typeof scheduleTileLayout>, rowHeight: number) =>
  rowHeight - layout.border - layout.padY * 2

const base = (s: number, grow = 1) => ({
  label: 38 * s * grow,
  detail: 27 * s * grow,
  time: 230 * s,
  crest: 110 * s * grow,
})

describe('tamaños de la programación', () => {
  it('1:1 con 6 partidos: nada toca el borde del tile', () => {
    const rowHeight = 219
    const layout = scheduleTileLayout({
      tiles: six,
      tileWidth: 468,
      rowHeight,
      s: 1,
      wide: false,
      horizontal: false,
      base: base(1),
    })
    expect(tileContentHeight(layout)).toBeLessThanOrEqual(room(layout, rowHeight))
    // La hora sigue siendo lo más grande del tile.
    expect(layout.time).toBeGreaterThanOrEqual(layout.label * 1.8)
    expect(layout.versusLines).toBeLessThanOrEqual(2)
  })

  it('9:16 con 6 partidos: la cancha nunca es más grande que el rival', () => {
    const layout = scheduleTileLayout({
      tiles: six,
      tileWidth: 468,
      rowHeight: 480,
      s: 1,
      wide: false,
      horizontal: false,
      base: base(1, 1.6),
    })
    expect(layout.versus).toBeGreaterThan(0)
    if (layout.showVenue) expect(layout.venue).toBeLessThanOrEqual(layout.versus)
    expect(layout.venue).toBeLessThanOrEqual(layout.detail)
    expect(tileContentHeight(layout)).toBeLessThanOrEqual(room(layout, 480))
  })

  it('si achicando de forma pareja no alcanza, omite la cancha', () => {
    const layout = scheduleTileLayout({
      tiles: six,
      tileWidth: 468,
      rowHeight: 170,
      s: 1,
      wide: false,
      horizontal: false,
      base: base(1),
    })
    expect(layout.showVenue).toBe(false)
    expect(tileContentHeight(layout)).toBeLessThanOrEqual(room(layout, 170))
  })

  it('con alto de sobra conserva la cancha y no achica', () => {
    const layout = scheduleTileLayout({
      tiles: six.slice(0, 2),
      tileWidth: 468,
      rowHeight: 420,
      s: 1,
      wide: false,
      horizontal: false,
      base: base(1),
    })
    expect(layout.showVenue).toBe(true)
    expect(layout.label).toBe(38)
  })

  it('un solo tamaño para todos: lo decide el rival más largo y la hora más larga', () => {
    const short = scheduleTileLayout({
      tiles: [tile({ versus: 'vs Uno' })],
      tileWidth: 468,
      rowHeight: 300,
      s: 1,
      wide: false,
      horizontal: false,
      base: base(1),
    })
    const mixed = scheduleTileLayout({
      tiles: [
        tile({ versus: 'vs Uno' }),
        tile({ time: 'Postergado', versus: 'vs Social y Deportivo Población Ejemplo del Sur' }),
      ],
      tileWidth: 468,
      rowHeight: 300,
      s: 1,
      wide: false,
      horizontal: false,
      base: base(1),
    })
    expect(mixed.time).toBeLessThan(short.time)
    expect(mixed.versus).toBeLessThanOrEqual(short.versus)
  })

  it('9:16 contra un mismo rival: tiles a lo ancho, con la hora a la izquierda y los datos al lado', () => {
    const tiles = ['10:00', '11:45', '13:30', '15:30'].map((time) => tile({ time, versus: null }))
    const rowHeight = 330
    const layout = scheduleTileLayout({
      tiles,
      tileWidth: 952,
      rowHeight,
      s: 1,
      wide: false,
      horizontal: true,
      base: { ...base(1, 1.1), time: 320 },
    })
    expect(layout.horizontal).toBe(true)
    expect(layout.showVenue).toBe(true)
    expect(layout.leftWidth).toBeLessThan(952 * 0.5)
    expect(tileContentHeight(layout)).toBeLessThanOrEqual(room(layout, rowHeight))
  })
})
