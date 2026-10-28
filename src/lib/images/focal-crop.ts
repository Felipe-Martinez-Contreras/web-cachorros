// Recorte de una foto a una proporción alrededor de su punto focal, con acercamiento opcional. Lógica pura:
// la usan las tarjetas (sharp) y la vista previa del panel (CSS), así lo que se ve al editar es lo que sale.

/** Límites del acercamiento que se guarda con cada foto (`media_assets.focal_zoom`). */
export const FOCAL_ZOOM_MIN = 1
export const FOCAL_ZOOM_MAX = 2.5

export type FocalPoint = { focalX: number; focalY: number; focalZoom?: number }
export type CropRect = { left: number; top: number; width: number; height: number }

/**
 * Rectángulo de proporción `ratio` (ancho / alto) dentro de una foto de `width × height`: el más grande que
 * cabe, achicado por el zoom, con el punto focal al centro a lo ancho y a `anchorY` del alto (0,5 = al medio;
 * menos deja más aire arriba), sin salirse de la foto.
 */
export function focalCrop(
  width: number,
  height: number,
  ratio: number,
  focal: FocalPoint,
  anchorY = 0.5,
): CropRect {
  const zoom = clamp(focal.focalZoom ?? 1, FOCAL_ZOOM_MIN, FOCAL_ZOOM_MAX)
  const fullWidth = Math.min(width, height * ratio)
  const cropWidth = Math.max(1, Math.round(fullWidth / zoom))
  const cropHeight = Math.max(1, Math.min(height, Math.round(cropWidth / ratio)))
  const left = Math.round(clamp(focal.focalX * width - cropWidth / 2, 0, width - cropWidth))
  const top = Math.round(clamp(focal.focalY * height - cropHeight * anchorY, 0, height - cropHeight))
  return { left, top, width: cropWidth, height: cropHeight }
}

/**
 * Lo que queda visible de un recorte al cubrir una caja de otra proporción, centrado (`object-fit: cover`,
 * como lo hace Satori con la foto del panel).
 */
export function coverCrop(rect: CropRect, ratio: number): CropRect {
  if (rect.width / rect.height > ratio) {
    const width = rect.height * ratio
    return { ...rect, left: rect.left + (rect.width - width) / 2, width }
  }
  const height = rect.width / ratio
  return { ...rect, top: rect.top + (rect.height - height) / 2, height }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
