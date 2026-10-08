'use client' // Cliente: usa la Web Share API y el portapapeles del navegador.

import { Check, Link2, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { FacebookIcon, WhatsAppIcon, XIcon } from '@/components/icons/brand'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/cn'

type ShareBarProps = {
  /** URL absoluta de lo que se comparte. */
  url: string
  title: string
  className?: string
}

/**
 * Compartir (especificación 6.1): Web Share API en el celular y, como respaldo, WhatsApp, Facebook, X y
 * «Copiar enlace». Los enlaces de respaldo funcionan sin JavaScript; los botones que lo necesitan
 * aparecen solo después de montar.
 */
export function ShareBar({ url, title, className }: ShareBarProps) {
  const [enhanced, setEnhanced] = useState(false)
  const [canShare, setCanShare] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setEnhanced(true)
    setCanShare(typeof navigator.share === 'function')
  }, [])

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2500)
    return () => clearTimeout(timer)
  }, [copied])

  const text = encodeURIComponent(title)
  const target = encodeURIComponent(url)
  const links = [
    ['WhatsApp', `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`, WhatsAppIcon],
    ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${target}`, FacebookIcon],
    ['X', `https://x.com/intent/tweet?text=${text}&url=${target}`, XIcon],
  ] as const
  const itemClass = buttonVariants({ variant: 'outline', size: 'icon' })

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="text-meta font-semibold">Compartir</span>
      {canShare && (
        <button
          type="button"
          className={itemClass}
          aria-label="Compartir"
          onClick={() => navigator.share({ title, url }).catch(() => {})}
        >
          <Share2 aria-hidden="true" />
        </button>
      )}
      {links.map(([name, href, Icon]) => (
        <a
          key={name}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Compartir en ${name} (se abre en una pestaña nueva)`}
          className={itemClass}
        >
          <Icon />
        </a>
      ))}
      {enhanced && (
        <button
          type="button"
          className={itemClass}
          aria-label="Copiar enlace"
          onClick={() =>
            navigator.clipboard
              .writeText(url)
              .then(() => setCopied(true))
              .catch(() => {})
          }
        >
          {copied ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}
        </button>
      )}
      <span role="status" className="text-meta">
        {copied ? 'Enlace copiado.' : ''}
      </span>
    </div>
  )
}
