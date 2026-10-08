import { CalendarDays, Ellipsis, House, Newspaper, Users, X } from 'lucide-react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import type { SiteDTO } from '@/features/settings/dto'
import { SocialFollowLinks, WhatsAppButton } from '@/features/social/components/social-post-card'
import { CLUB_NAV, MEMBERSHIP_NAV, STORE_NAV } from './nav'
import { NavLink } from './nav-link'

const ITEMS = [
  { href: '/', label: 'Inicio', icon: House },
  { href: '/partidos', label: 'Partidos', icon: CalendarDays },
  { href: '/noticias', label: 'Noticias', icon: Newspaper },
  { href: '/plantel', label: 'Plantel', icon: Users },
] as const

const itemClass =
  'flex min-h-14 w-full flex-col items-center justify-center gap-0.5 border-t-2 border-transparent text-[0.6875rem] font-semibold text-(--muted)'
const SHEET_ID = 'menu-mas'

type Contact = Pick<SiteDTO, 'whatsapp' | 'socialLinks'>

/**
 * Barra inferior del celular (especificación 5.2). «Más» abre una hoja con el resto de las secciones:
 * es un `<dialog popover>`, así que se abre y se cierra (toque afuera o Escape) sin JavaScript.
 */
export function BottomNav({ site }: { site: Contact }) {
  return (
    <>
      <nav
        aria-label="Principal"
        className="theme-dark fixed inset-x-0 bottom-0 z-40 border-t border-(--border) pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="grid grid-cols-5">
          {ITEMS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <NavLink href={href} className={itemClass} activeClassName="border-accent text-(--fg)">
                <Icon aria-hidden="true" className="size-6" />
                {label}
              </NavLink>
            </li>
          ))}
          <li>
            <button type="button" popoverTarget={SHEET_ID} className={itemClass}>
              <Ellipsis aria-hidden="true" className="size-6" />
              Más
            </button>
          </li>
        </ul>
      </nav>

      <dialog
        id={SHEET_ID}
        popover="auto"
        aria-labelledby={`${SHEET_ID}-titulo`}
        className="theme-light fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85svh] w-full max-w-none overflow-y-auto rounded-t-2xl border-t border-(--border) p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl backdrop:bg-ink/60 lg:hidden"
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 id={`${SHEET_ID}-titulo`} className="text-h3">
            Más secciones
          </h2>
          <button
            type="button"
            popoverTarget={SHEET_ID}
            popoverTargetAction="hide"
            aria-label="Cerrar el menú"
            className={buttonVariants({ variant: 'ghost', size: 'icon' })}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <ul className="grid grid-cols-2 gap-x-4">
          {[{ href: '/historia', label: 'Historia' }, ...CLUB_NAV, STORE_NAV].map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex min-h-12 items-center border-b border-(--border) font-medium"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-4 grid gap-3">
          <Link href={MEMBERSHIP_NAV.href} className={buttonVariants({ variant: 'primary', size: 'lg' })}>
            {MEMBERSHIP_NAV.label}
          </Link>
          {site.whatsapp && <WhatsAppButton phone={site.whatsapp} />}
          <SocialFollowLinks links={site.socialLinks} className="justify-center" />
        </div>
      </dialog>
    </>
  )
}
