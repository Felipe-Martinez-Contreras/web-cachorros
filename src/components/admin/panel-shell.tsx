import { Ellipsis, X } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { NavLink } from '@/components/site/nav-link'
import { buttonVariants } from '@/components/ui/button'
import { LogoutButton } from '@/features/auth/components/logout-button'
import type { SessionUser } from '@/lib/auth/session'
import { can } from '@/lib/permissions'
import { ADMIN_NAV, type AdminNavItem } from './nav'
import { ToastProvider } from './toast'

const SHEET_ID = 'panel-mas'
const sideLinkClass =
  'flex min-h-12 items-center gap-3 rounded-md px-3 font-medium text-neutral-700 hover:bg-neutral-100'
const sideActiveClass = 'bg-ink text-paper hover:bg-ink'
const barItemClass =
  'flex min-h-14 w-full flex-col items-center justify-center gap-0.5 border-t-2 border-transparent text-[0.6875rem] font-semibold text-neutral-600'

function isExact(item: AdminNavItem) {
  return item.href === '/admin'
}

/**
 * Marco del panel (especificación 7.1): barra inferior y hoja «Más» en el celular, menú lateral en
 * escritorio. Áreas táctiles de 48 px y texto negro sobre blanco para leerlo a pleno sol.
 */
export function PanelShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const groups = ADMIN_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => can(user, item.permission)),
  })).filter((group) => group.items.length > 0)
  const primary = groups.flatMap((group) => group.items.filter((item) => item.primary)).slice(0, 4)

  const groupList = (onSheet: boolean) =>
    groups.map((group) => (
      <div key={group.label} className="grid gap-1">
        <p className="px-3 pt-3 text-eyebrow text-neutral-600">{group.label}</p>
        <ul className={onSheet ? 'grid grid-cols-2 gap-1' : 'grid gap-1'}>
          {group.items.map((item) => (
            <li key={item.href}>
              <NavLink
                href={item.href}
                exact={isExact(item)}
                className={sideLinkClass}
                activeClassName={sideActiveClass}
              >
                <item.icon aria-hidden="true" className="size-5 shrink-0" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    ))

  return (
    <ToastProvider>
      <div className="min-h-svh bg-neutral-50 lg:grid lg:grid-cols-[17rem_1fr]">
        <aside className="sticky top-0 hidden h-svh overflow-y-auto border-r border-neutral-200 bg-paper p-3 lg:block">
          <Link
            href="/admin"
            className="flex min-h-12 items-center px-3 font-display text-lg font-extrabold uppercase [font-stretch:75%]"
          >
            Panel Los Cachorros
          </Link>
          <nav aria-label="Módulos del panel">{groupList(false)}</nav>
        </aside>

        <div className="min-w-0">
          <header className="border-b border-neutral-200 bg-paper">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
              <Link
                href="/admin"
                className="font-display text-lg font-extrabold uppercase [font-stretch:75%] lg:hidden"
              >
                Panel Los Cachorros
              </Link>
              <span className="hidden lg:block" />
              <LogoutButton />
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-4 pt-6 pb-28 lg:pb-12">
            <p className="mb-4 text-sm text-neutral-600">
              Sesión de <span className="font-medium text-ink">{user.name || user.email}</span>
            </p>
            {children}
          </main>
        </div>

        <nav
          aria-label="Accesos del panel"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-300 bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          <ul className="grid auto-cols-fr grid-flow-col">
            {primary.map((item) => (
              <li key={item.href}>
                <NavLink
                  href={item.href}
                  exact={isExact(item)}
                  className={barItemClass}
                  activeClassName="border-ink text-ink"
                >
                  <item.icon aria-hidden="true" className="size-6" />
                  {item.label}
                </NavLink>
              </li>
            ))}
            <li>
              <button type="button" popoverTarget={SHEET_ID} className={barItemClass}>
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
          className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85svh] w-full max-w-none overflow-y-auto rounded-t-2xl border-t border-neutral-300 bg-paper p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-ink shadow-2xl backdrop:bg-ink/60 lg:hidden"
        >
          <div className="flex items-center justify-between">
            <h2 id={`${SHEET_ID}-titulo`} className="text-h3">
              Todos los módulos
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
          <nav aria-label="Todos los módulos">{groupList(true)}</nav>
        </dialog>
      </div>
    </ToastProvider>
  )
}
