import { MATCHDAY_CROP_RATIO, MATCHDAY_PANEL_RATIO } from '@/features/share/lib/cards'
import { type CropRect, coverCrop, focalCrop } from '@/lib/images/focal-crop'

// Vista previa en vivo del encuadre (panel → Medios): cómo queda la foto en una barra del matchday (con el
// mismo recorte de `focalCrop` que las tarjetas, el zoom y el blanco y negro) y, en el sitio, en cuadrado y
// horizontal (`object-position` desde el punto focal; el sitio no usa el zoom). Se dibuja con CSS: no pide
// nada al servidor.

type Props = {
  src: string
  width: number
  height: number
  focalX: number
  focalY: number
  focalZoom: number
}

/** La foto posicionada para que solo se vea `crop` dentro de una caja de su misma proporción. */
function Cropped({
  src,
  width,
  height,
  crop,
}: {
  src: string
  width: number
  height: number
  crop: CropRect
}) {
  return (
    // biome-ignore lint/performance/noImgElement: sin optimizador de imágenes en runtime (2.7)
    <img
      src={src}
      alt=""
      className="absolute max-w-none"
      style={{
        width: `${(width / crop.width) * 100}%`,
        height: `${(height / crop.height) * 100}%`,
        left: `${(-crop.left / crop.width) * 100}%`,
        top: `${(-crop.top / crop.height) * 100}%`,
        // El mismo tratamiento de las tarjetas (sharp): blanco y negro con más contraste.
        filter: 'grayscale(1) contrast(1.25)',
      }}
    />
  )
}

/** Lo que queda de la foto en una barra del matchday (el mismo recorte de las tarjetas). */
export function matchdayPanelCrop(
  width: number,
  height: number,
  focal: { focalX: number; focalY: number; focalZoom: number },
): CropRect {
  return coverCrop(focalCrop(width, height, MATCHDAY_CROP_RATIO, focal), MATCHDAY_PANEL_RATIO)
}

export function FocalPreview({ src, width, height, focalX, focalY, focalZoom }: Props) {
  const panel = matchdayPanelCrop(width, height, { focalX, focalY, focalZoom })
  const position = `${Math.round(focalX * 100)}% ${Math.round(focalY * 100)}%`
  return (
    <div className="grid grid-cols-[auto_1fr] items-start gap-3" aria-hidden="true">
      <figure className="grid w-28 gap-1 sm:w-36">
        <div
          className="relative w-full overflow-hidden rounded-sm bg-ink"
          style={{ aspectRatio: MATCHDAY_PANEL_RATIO }}
        >
          <Cropped src={src} width={width} height={height} crop={panel} />
          {/* El acento naranjo de la esquina y el desvanecido a negro del pie, como en la tarjeta. */}
          <span
            className="absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(circle at 100% 0%, rgba(242, 116, 5, 0.35) 0%, rgba(242, 116, 5, 0.12) 28%, transparent 52%), linear-gradient(180deg, transparent 62%, rgba(7, 7, 7, 0.55) 77%, rgb(7, 7, 7) 100%)',
            }}
          />
        </div>
        <figcaption className="text-sm text-neutral-600">Barra del matchday</figcaption>
      </figure>
      <div className="grid gap-3">
        <figure className="grid w-28 gap-1 sm:w-36">
          <div className="relative aspect-square w-full overflow-hidden rounded-sm bg-neutral-100">
            {/* biome-ignore lint/performance/noImgElement: sin optimizador de imágenes en runtime (2.7) */}
            <img src={src} alt="" className="size-full object-cover" style={{ objectPosition: position }} />
          </div>
          <figcaption className="text-sm text-neutral-600">Cuadrado (sitio)</figcaption>
        </figure>
        <figure className="grid w-full max-w-60 gap-1">
          <div className="relative aspect-video w-full overflow-hidden rounded-sm bg-neutral-100">
            {/* biome-ignore lint/performance/noImgElement: sin optimizador de imágenes en runtime (2.7) */}
            <img src={src} alt="" className="size-full object-cover" style={{ objectPosition: position }} />
          </div>
          <figcaption className="text-sm text-neutral-600">Horizontal (sitio)</figcaption>
        </figure>
      </div>
    </div>
  )
}
