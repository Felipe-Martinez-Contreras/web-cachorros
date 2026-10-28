import { describe, expect, it } from 'vitest'
import { MATCHDAY_FOCAL_ANCHOR, panelFocalAnchor } from '@/features/share/lib/cards'
import { coverCrop, FOCAL_ZOOM_MAX, focalCrop } from '@/lib/images/focal-crop'

describe('recorte alrededor del punto focal', () => {
  it('sin zoom: el rectángulo más grande de la proporción, centrado en el punto focal', () => {
    // Foto 4000 × 3000 a 0,4: alto completo, 1200 de ancho.
    expect(focalCrop(4000, 3000, 0.4, { focalX: 0.5, focalY: 0.5 })).toEqual({
      left: 1400,
      top: 0,
      width: 1200,
      height: 3000,
    })
  })

  it('no se sale de la foto aunque el punto focal esté en un borde', () => {
    expect(focalCrop(4000, 3000, 0.4, { focalX: 0, focalY: 1 })).toMatchObject({ left: 0, top: 0 })
    expect(focalCrop(4000, 3000, 0.4, { focalX: 1, focalY: 0 })).toMatchObject({ left: 2800, top: 0 })
  })

  it('el zoom achica el recorte alrededor del punto focal', () => {
    const crop = focalCrop(4000, 3000, 0.4, { focalX: 0.25, focalY: 0.3, focalZoom: 2 })
    expect(crop).toEqual({ left: 700, top: 150, width: 600, height: 1500 })
    // El punto focal queda en el centro del recorte.
    expect(crop.left + crop.width / 2).toBe(1000)
    expect(crop.top + crop.height / 2).toBe(900)
  })

  it('con zoom y el punto focal descentrado, el punto queda al centro del recorte salvo contra un borde', () => {
    // Foto 4000 × 3000 a la proporción del matchday (0,34) con zoom 2.
    const near = focalCrop(4000, 3000, 0.34, { focalX: 0.7, focalY: 0.35, focalZoom: 2 })
    expect(near).toEqual({ left: 2545, top: 300, width: 510, height: 1500 })
    expect(near.left + near.width / 2).toBe(2800)
    expect(near.top + near.height / 2).toBe(1050)
    // Arriba a la derecha: se corre lo justo para no salirse; en el otro eje sigue centrado.
    const edge = focalCrop(4000, 3000, 0.34, { focalX: 0.95, focalY: 0.1, focalZoom: 2 })
    expect(edge).toEqual({ left: 3490, top: 0, width: 510, height: 1500 })
    const middle = focalCrop(4000, 3000, 0.34, { focalX: 0.5, focalY: 0.1, focalZoom: 2 })
    expect(middle.left + middle.width / 2).toBe(2000)
  })

  it('el zoom se limita a 100 % – 250 %', () => {
    const max = focalCrop(1000, 1000, 1, { focalX: 0.5, focalY: 0.5, focalZoom: 9 })
    expect(max.width).toBe(Math.round(1000 / FOCAL_ZOOM_MAX))
    expect(focalCrop(1000, 1000, 1, { focalX: 0.5, focalY: 0.5, focalZoom: 0.2 }).width).toBe(1000)
  })

  it('una foto más angosta que la proporción usa su ancho completo', () => {
    expect(focalCrop(300, 2000, 0.4, { focalX: 0.5, focalY: 0.5 })).toEqual({
      left: 0,
      top: 625,
      width: 300,
      height: 750,
    })
  })

  it('cubrir una caja más ancha recorta arriba y abajo, centrado', () => {
    expect(coverCrop({ left: 100, top: 0, width: 400, height: 1000 }, 0.5)).toEqual({
      left: 100,
      top: 100,
      width: 400,
      height: 800,
    })
    expect(coverCrop({ left: 0, top: 0, width: 1000, height: 1000 }, 0.5)).toEqual({
      left: 250,
      top: 0,
      width: 500,
      height: 1000,
    })
  })
})

describe('punto focal en la parte visible de una barra', () => {
  it('con anchorY, el punto queda a esa altura del recorte (aire por encima)', () => {
    // Foto 3000 × 2000 con la cara al 20 % de alto; barra 0,4 que el título tapa un 8 % arriba.
    const panel = { ratio: 0.4, hiddenTop: 0.08 }
    const anchor = panelFocalAnchor(panel)
    expect(anchor).toBeCloseTo(0.08 + 0.92 * MATCHDAY_FOCAL_ANCHOR, 5)
    const crop = focalCrop(3000, 2000, panel.ratio, { focalX: 0.5, focalY: 0.6, focalZoom: 1.5 }, anchor)
    // La cara (60 % de alto = 1200 px) cae a `anchor` del recorte: bajo la parte tapada, no al centro.
    expect((1200 - crop.top) / crop.height).toBeCloseTo(anchor, 2)
    expect((1200 - crop.top) / crop.height).toBeGreaterThan(panel.hiddenTop)
    expect((1200 - crop.top) / crop.height).toBeLessThan(0.5)
  })

  it('si la cabeza está muy arriba, el recorte no se sale de la foto', () => {
    const crop = focalCrop(3000, 2000, 0.4, { focalX: 0.5, focalY: 0.05 }, 0.42)
    expect(crop.top).toBe(0)
  })
})
