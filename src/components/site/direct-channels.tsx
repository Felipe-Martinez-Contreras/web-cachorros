import { Mail, MessageCircle } from 'lucide-react'
import type { SiteDTO } from '@/features/settings/dto'
import { whatsappUrl } from '@/lib/links'
import { isContentMarker } from '@/lib/markers'

/** WhatsApp y correo del club: la salida cuando un formulario no se puede enviar. */
export function DirectChannels({ site }: { site: SiteDTO }) {
  const email = site.email && !isContentMarker(site.email) ? site.email : null
  if (!site.whatsapp && !email) return null
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
      {site.whatsapp && (
        <li>
          <a href={whatsappUrl(site.whatsapp)} className="inline-flex min-h-11 items-center gap-1 underline">
            <MessageCircle aria-hidden="true" className="size-4" /> WhatsApp del club
          </a>
        </li>
      )}
      {email && (
        <li>
          <a href={`mailto:${email}`} className="inline-flex min-h-11 items-center gap-1 underline">
            <Mail aria-hidden="true" className="size-4" /> {email}
          </a>
        </li>
      )}
    </ul>
  )
}
