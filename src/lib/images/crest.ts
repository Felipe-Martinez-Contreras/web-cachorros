// Tamaño óptico de los escudos (y logos) dentro de su caja cuadrada. El escudo se dibuja con
// `object-fit: contain` en la caja y después se escala: así todos se perciben del mismo tamaño, sean
// cuadrados, altos y angostos, anchos o redondos, y en un disco blanco nunca tocan el borde.
// Es la misma regla en el sitio (`.crest`) y en las tarjetas para redes (Satori).

/** Medidas de lo visible de un logo, calculadas al procesarlo (`measureLogo`). */
export type LogoMetrics = {
  /** Revisión del proceso de logos con que se generaron los archivos (recorte y medidas). */
  v: number
  /**
   * Fracción del rectángulo del logo que ocupa su silueta: en cada fila, de lo primero visible a lo último
   * (lo blanco de adentro también cuenta para el tamaño que se percibe).
   */
  coverage: number
  /**
   * Distancia desde el centro hasta el píxel visible más lejano, en unidades del lado mayor del logo:
   * 0,707 en un cuadrado opaco, 0,5 en un escudo redondo.
   */
  radius: number
}

/** Revisión actual del proceso de logos: si un logo trae una menor, `reprocess-logos` lo vuelve a generar. */
export const LOGO_PIPELINE_VERSION = 1

/** Escala del escudo sobre su caja: `disc` dentro del disco blanco, `bare` sin disco (fondo claro). */
export type CrestScale = { disc: number; bare: number }

/** Un cuadrado opaco en el disco: su diagonal queda en el 96 % del diámetro (lado de 68 %). */
const DISC_EDGE = 0.48
const DISC_BASE = 0.68
/** Sin disco, el mismo cuadrado ocupa el 76 % de la caja: deja espacio para agrandar a los altos o redondos. */
const BARE_BASE = 0.76
/**
 * Cuánto se compensa el área visible: 0,5 igualaría el área exacta, que agranda de más a los angostos
 * (el ojo no percibe el área de forma lineal).
 */
const AREA_EXPONENT = 0.4
/** Nunca se compensa más de esto (un logo de trazos finos con muy poca área visible). */
const MIN_AREA = 0.25

/**
 * Escala del escudo dentro de su caja, con y sin disco. Sin medidas (archivo antiguo, aún sin reprocesar),
 * supone un rectángulo opaco: nunca se sale del disco.
 */
export function crestScale(
  width: number | null | undefined,
  height: number | null | undefined,
  metrics: LogoMetrics | null | undefined,
): CrestScale {
  const aspect = width && height ? width / height : 1
  // El logo «contenido» en la caja de lado 1.
  const boxWidth = aspect >= 1 ? 1 : aspect
  const boxHeight = aspect >= 1 ? 1 / aspect : 1
  const coverage = clamp(metrics?.coverage ?? 1, 0, 1)
  const radius = metrics?.radius ?? Math.hypot(boxWidth, boxHeight) / 2
  const area = Math.max(MIN_AREA, boxWidth * boxHeight * coverage)
  const optical = area ** -AREA_EXPONENT
  return {
    disc: round(Math.min(DISC_BASE * optical, DISC_EDGE / Math.max(radius, DISC_EDGE), 1)),
    bare: round(Math.min(BARE_BASE * optical, 1)),
  }
}

/** Píxeles crudos RGBA (4 canales), como los entrega sharp con `.ensureAlpha().raw()`. */
export type RgbaPixels = { data: Uint8Array; width: number; height: number }

const OPAQUE = 128
/** Sobre el disco blanco, un píxel casi blanco no se ve. */
const NEAR_WHITE = 240

function isTransparentAt(pixels: RgbaPixels, x: number, y: number): boolean {
  return (pixels.data[(y * pixels.width + x) * 4 + 3] ?? 0) < 16
}

function isWhiteAt(pixels: RgbaPixels, x: number, y: number): boolean {
  const i = (y * pixels.width + x) * 4
  const { data } = pixels
  return (
    (data[i + 3] ?? 0) >= 240 &&
    (data[i] ?? 0) >= NEAR_WHITE &&
    (data[i + 1] ?? 0) >= NEAR_WHITE &&
    (data[i + 2] ?? 0) >= NEAR_WHITE
  )
}

/**
 * Fondo que se recorta de un logo: transparente o blanco si las cuatro esquinas lo son. Un fondo de color
 * (un escudo cuadrado azul) es parte del diseño y no se toca.
 */
export function trimBackground(pixels: RgbaPixels): 'transparent' | 'white' | null {
  const corners: [number, number][] = [
    [0, 0],
    [pixels.width - 1, 0],
    [0, pixels.height - 1],
    [pixels.width - 1, pixels.height - 1],
  ]
  if (corners.every(([x, y]) => isTransparentAt(pixels, x, y))) return 'transparent'
  if (corners.every(([x, y]) => isWhiteAt(pixels, x, y))) return 'white'
  return null
}

/**
 * Mide lo visible de un logo ya recortado: cuánto cubre su silueta y qué tan lejos del centro llega.
 * Visible es lo opaco que no es blanco (sobre el disco blanco el blanco no se ve); si casi nada cumple eso
 * (un logo blanco), basta con lo opaco.
 */
export function measureLogo(pixels: RgbaPixels): Omit<LogoMetrics, 'v'> {
  const measure = (visible: (i: number) => boolean) => {
    const { width, height } = pixels
    const cx = width / 2
    const cy = height / 2
    let count = 0
    let farthest = 0
    for (let y = 0; y < height; y++) {
      let left = -1
      let right = -1
      for (let x = 0; x < width; x++) {
        if (!visible((y * width + x) * 4)) continue
        if (left < 0) left = x
        right = x
      }
      if (left < 0) continue
      count += right - left + 1
      // El borde exterior del píxel más lejano de la fila (arriba o abajo, según el lado del centro).
      const dy = Math.max(Math.abs(y - cy), Math.abs(y + 1 - cy))
      const dx = Math.max(Math.abs(left - cx), Math.abs(right + 1 - cx))
      farthest = Math.max(farthest, Math.hypot(dx, dy))
    }
    return { count, farthest }
  }
  const { data } = pixels
  const opaque = (i: number) => (data[i + 3] ?? 0) >= OPAQUE
  const total = pixels.width * pixels.height
  let result = measure(
    (i) =>
      opaque(i) &&
      !((data[i] ?? 0) >= NEAR_WHITE && (data[i + 1] ?? 0) >= NEAR_WHITE && (data[i + 2] ?? 0) >= NEAR_WHITE),
  )
  if (result.count < total * 0.02) result = measure(opaque)
  if (result.count === 0) return { coverage: 1, radius: Math.SQRT1_2 }
  const side = Math.max(pixels.width, pixels.height)
  return { coverage: round(result.count / total), radius: round(result.farthest / side) }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}
