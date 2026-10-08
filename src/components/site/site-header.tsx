import { ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import type { SiteDTO } from '@/features/settings/dto'
import { cn } from '@/lib/cn'
import { ClubImage } from './club-image'
import { CLUB_NAV, MAIN_NAV, MEMBERSHIP_NAV, STORE_NAV } from './nav'
import { NavLink } from './nav-link'

type Brand = Pick<SiteDTO, 'clubName' | 'shortName' | 'foundedYear' | 'crest'>

/** Escudo del club. Decorativo: el nombre siempre va escrito al lado. */
export function ClubCrest({ site, className }: { site: Pick<SiteDTO, 'crest'>; className?: string }) {
  return (
    <span className={cn('crest block shrink-0', className)}>
      {site.crest ? (
        <ClubImage
          image={site.crest}
          alt=""
          sizes="96px"
          className="size-full object-contain"
          style={{ backgroundImage: 'none' }}
        />
      ) : (
        // biome-ignore lint/performance/noImgElement: archivo estático pequeño, sin optimizador (2.7)
        <img
          src="/placeholder/escudo-generico.svg"
          alt=""
          width={96}
          height={96}
          className="size-full object-contain"
        />
      )}
    </span>
  )
}

const linkClass =
  'flex min-h-11 items-center border-b-2 border-transparent px-3 font-semibold hover:border-(--fg)/40'
const activeClass = 'border-accent hover:border-accent'

export const HEADER_HEIGHT = 'h-16'

/** Encabezado: escudo y nombre; en escritorio, menú horizontal con el desplegable «Club» y «Hazte socio». */
export function SiteHeader({ site }: { site: Brand }) {
  return (
    <header className={cn('theme-dark sticky top-0 z-40 border-b border-(--border)', HEADER_HEIGHT)}>
      <div className="container-site flex h-full items-center justify-between gap-4">
        <Link href="/" className="flex min-h-11 items-center gap-3">
          <ClubCrest site={site} className="size-11" />
          <span className="grid leading-none">
            <span className="font-display text-xl font-extrabold uppercase [font-stretch:75%]">
              {site.shortName}
            </span>
            <span className="text-[0.6875rem] font-semibold tracking-[0.14em] text-(--muted) uppercase">
              Desde {site.foundedYear}
            </span>
            <span className="sr-only">, ir al inicio</span>
          </span>
        </Link>

        <nav aria-label="Principal" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {MAIN_NAV.map((item) => (
              <li key={item.href}>
                <NavLink href={item.href} className={linkClass} activeClassName={activeClass}>
                  {item.label}
                </NavLink>
              </li>
            ))}
            <li className="relative">
              {/* <details> nativo: el desplegable funciona con teclado y sin JavaScript. */}
              <details className="group">
                <summary
                  className={cn(
                    linkClass,
                    'cursor-pointer list-none gap-1 [&::-webkit-details-marker]:hidden',
                  )}
                >
                  Club
                  <ChevronDown
                    aria-hidden="true"
                    className="size-4 transition-transform duration-150 group-open:rotate-180"
                  />
                </summary>
                <ul className="absolute top-full right-0 z-50 mt-2 grid w-56 gap-0.5 rounded-lg border border-(--border) bg-(--bg) p-2 shadow-xl">
                  {CLUB_NAV.map((item) => (
                    <li key={item.href}>
                      <NavLink
                        href={item.href}
                        className="flex min-h-11 items-center rounded-md px-3 font-medium hover:bg-(--fg)/10"
                        activeClassName="text-accent"
                      >
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
            <li>
              <NavLink href={STORE_NAV.href} className={linkClass} activeClassName={activeClass}>
                {STORE_NAV.label}
              </NavLink>
            </li>
          </ul>
        </nav>

        <Link href={MEMBERSHIP_NAV.href} className={buttonVariants({ variant: 'primary', size: 'sm' })}>
          {MEMBERSHIP_NAV.label}
        </Link>
      </div>
    </header>
  )
}

/** Mismo alto que el encabezado real: no hay salto de layout mientras llegan los datos del club. */
export function SiteHeaderSkeleton() {
  return <div className={cn('theme-dark sticky top-0 z-40 border-b border-(--border)', HEADER_HEIGHT)} />
}
