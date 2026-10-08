import { Mail, MapPin, Phone } from 'lucide-react'
import Link from 'next/link'
import type { SiteDTO } from '@/features/settings/dto'
import { SocialFollowLinks, WhatsAppButton } from '@/features/social/components/social-post-card'
import { formatPhone } from '@/lib/format'
import { CLUB_NAV, FOOTER_NAV, MAIN_NAV, STORE_NAV } from './nav'
import { ClubCrest } from './site-header'

const linkClass = 'inline-flex min-h-11 items-center hover:underline hover:underline-offset-4'

/** Pie del sitio: escudo, redes, dirección de la cancha, contacto, WhatsApp, transparencia y privacidad. */
export function SiteFooter({ site }: { site: SiteDTO }) {
  const place = [site.address, site.commune, site.region].filter(Boolean).join(', ')
  return (
    // En celular deja espacio para la barra inferior fija.
    <footer className="theme-dark border-t border-(--border) pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0">
      <div className="container-site grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div className="grid content-start gap-4">
          <div className="flex items-center gap-3">
            <ClubCrest site={site} className="size-16" />
            <p className="grid leading-tight">
              <span className="font-display text-2xl font-extrabold uppercase [font-stretch:75%]">
                {site.clubName}
              </span>
              <span className="text-eyebrow text-accent">Desde {site.foundedYear}</span>
            </p>
          </div>
          <SocialFollowLinks links={site.socialLinks} />
        </div>

        <nav aria-label="Secciones del sitio">
          <h2 className="mb-2 text-eyebrow text-(--muted)">El sitio</h2>
          <ul>
            {[...MAIN_NAV, STORE_NAV].map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="El club">
          <h2 className="mb-2 text-eyebrow text-(--muted)">El club</h2>
          <ul>
            {CLUB_NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="grid content-start gap-3">
          <h2 className="text-eyebrow text-(--muted)">Contacto</h2>
          <ul className="grid gap-3">
            {place && (
              <li className="flex items-start gap-2">
                <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-(--muted)" />
                <span>{place}</span>
              </li>
            )}
            {site.phone && (
              <li className="flex items-center gap-2">
                <Phone aria-hidden="true" className="size-5 shrink-0 text-(--muted)" />
                <a href={`tel:${site.phone}`} className={linkClass}>
                  {formatPhone(site.phone)}
                </a>
              </li>
            )}
            {site.email && (
              <li className="flex items-center gap-2">
                <Mail aria-hidden="true" className="size-5 shrink-0 text-(--muted)" />
                <a href={`mailto:${site.email}`} className={linkClass}>
                  {site.email}
                </a>
              </li>
            )}
          </ul>
          {site.whatsapp && (
            <div>
              <WhatsAppButton phone={site.whatsapp} />
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-(--border)">
        <div className="container-site flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-4 text-sm text-(--muted)">
          <p>
            {site.clubName} · {[site.commune, site.region].filter(Boolean).join(', ')}
          </p>
          <ul className="flex flex-wrap gap-x-5">
            {FOOTER_NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
}
