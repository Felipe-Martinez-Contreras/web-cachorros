import { Download } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import type { ShareCardLink } from '../admin-queries'
import { SHARE_FORMATS, type ShareFormat, SOCIAL_FORMATS, shareFilename, shareUrl } from '../lib/cards'
import { ShareFileButton } from './share-file-button'

const FORMAT_HINTS: Record<(typeof SOCIAL_FORMATS)[number], string> = {
  cuadrado: 'publicación',
  vertical: 'Instagram',
  historia: 'historias y estados de WhatsApp',
}

/**
 * Tarjetas para redes en el panel: vista previa y, por formato, «Descargar» (un enlace: funciona sin
 * JavaScript) y «Compartir» (Web Share con el archivo, donde el navegador lo permita).
 */
export function ShareCards({ cards }: { cards: ShareCardLink[] }) {
  if (cards.length === 0) return null
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => {
        const urlOf = (format: ShareFormat) => shareUrl(card.template, card.id, format, card.version)
        const request = { template: card.template, id: card.id }
        return (
          <li
            key={`${card.template}-${card.id}`}
            className="grid content-start gap-3 rounded-lg border border-neutral-200 p-3"
          >
            {/* biome-ignore lint/performance/noImgElement: la tarjeta ya viene en su tamaño final desde /api/share. */}
            <img
              src={urlOf('cuadrado')}
              alt={`Vista previa: ${card.label}, ${card.title}`}
              width={SHARE_FORMATS.cuadrado.width}
              height={SHARE_FORMATS.cuadrado.height}
              loading="lazy"
              decoding="async"
              className="aspect-square h-auto w-full rounded-md bg-ink"
            />
            <div>
              <h3 className="font-bold">{card.label}</h3>
              <p className="text-sm text-neutral-600">{card.title}</p>
            </div>
            <ul className="grid gap-2">
              {SOCIAL_FORMATS.map((format) => {
                const { label } = SHARE_FORMATS[format]
                const name = `${card.label} ${label}`
                return (
                  <li key={format} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm">
                      <span className="font-semibold">{label}</span>{' '}
                      <span className="text-neutral-600">· {FORMAT_HINTS[format]}</span>
                    </span>
                    <span className="flex gap-2">
                      <a
                        href={`${urlOf(format)}&descargar=1`}
                        download={shareFilename({ ...request, format }, card.slug)}
                        className={buttonVariants({ variant: 'outline', size: 'sm' })}
                        aria-label={`Descargar ${name}`}
                      >
                        <Download aria-hidden="true" />
                        Descargar
                      </a>
                      <ShareFileButton
                        url={urlOf(format)}
                        filename={shareFilename({ ...request, format }, card.slug)}
                        title={card.title}
                        label={`Compartir ${name}`}
                      />
                    </span>
                  </li>
                )
              })}
            </ul>
          </li>
        )
      })}
    </ul>
  )
}
