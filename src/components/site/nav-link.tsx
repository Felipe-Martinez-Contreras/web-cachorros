'use client' // Cliente: marca el enlace activo según la ruta actual (`usePathname`).

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type NavLinkProps = {
  href: string
  children: ReactNode
  className?: string
  /** Clases extra cuando el enlace corresponde a la sección actual. */
  activeClassName?: string
}

/** Enlace de navegación con `aria-current="page"` en la sección actual. */
export function NavLink({ href, children, className, activeClassName }: NavLinkProps) {
  const pathname = usePathname()
  const active = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(className, active && activeClassName)}
    >
      {children}
    </Link>
  )
}
