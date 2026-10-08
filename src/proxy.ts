import { getSessionCookie } from 'better-auth/cookies'
import { type NextRequest, NextResponse } from 'next/server'

// Rutas del panel que se ven sin sesión.
const PUBLIC_ADMIN_PATHS = new Set(['/admin/login', '/admin/recuperar', '/admin/restablecer'])

/**
 * Redirección optimista del panel: si no hay cookie de sesión, manda al login sin tocar la BD.
 * NO es una barrera de seguridad (especificación 2.5 y trampa 6): la autorización real se verifica en
 * cada layout, Server Action y Route Handler.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (!PUBLIC_ADMIN_PATHS.has(pathname) && !getSessionCookie(request)) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }
  const response = NextResponse.next()
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  response.headers.set('Cache-Control', 'no-store')
  return response
}

// Solo el panel: /api (subidas), /_next y /media nunca pasan por el proxy.
export const config = {
  matcher: ['/admin', '/admin/:path*'],
}
