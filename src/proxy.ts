import { getSessionCookie } from 'better-auth/cookies'
import { type NextRequest, NextResponse } from 'next/server'
import { matchSlugStatus } from '@/features/matches/slug'
import { newsSlugStatus } from '@/features/news/slug'
import { playerSlugStatus, seriesSlugStatus } from '@/features/players/slug'
import { logger } from '@/lib/logger'
import type { SlugStatus } from '@/lib/slug-status'

// Rutas del panel que se ven sin sesión.
const PUBLIC_ADMIN_PATHS = new Set(['/admin/login', '/admin/recuperar', '/admin/restablecer'])

/**
 * Redirección optimista del panel: si no hay cookie de sesión, manda al login sin tocar la BD.
 * NO es una barrera de seguridad (especificación 2.5 y trampa 6): la autorización real se verifica en
 * cada layout, Server Action y Route Handler.
 */
function adminProxy(request: NextRequest) {
  if (!PUBLIC_ADMIN_PATHS.has(request.nextUrl.pathname) && !getSessionCookie(request)) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }
  const response = NextResponse.next()
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  response.headers.set('Cache-Control', 'no-store')
  return response
}

type DetailRoute = {
  status: (slug: string) => Promise<SlugStatus>
  /** Rutas fijas que comparten el prefijo: pasan sin consulta. */
  fixed?: ReadonlySet<string>
}

// Páginas de detalle públicas cuyo estado HTTP decide el proxy (ADR 0008). Una sección nueva se agrega
// aquí y en el `matcher`.
const DETAIL_ROUTES: Record<string, DetailRoute> = {
  noticias: { status: newsSlugStatus, fixed: new Set(['rss.xml']) },
  partidos: { status: matchSlugStatus, fixed: new Set(['posiciones', 'goleadores']) },
  jugadores: { status: playerSlugStatus },
  plantel: { status: seriesSlugStatus },
}

// Ninguna ruta coincide con esta dirección: Next responde con el `not-found` del club y estado 404 real.
const NOT_FOUND_PATH = '/_no-existe'
const LOOKUP_TIMEOUT_MS = 2000

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), LOOKUP_TIMEOUT_MS)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

function safeDecode(segment: string): string | null {
  try {
    return decodeURIComponent(segment)
  } catch {
    return null
  }
}

/**
 * Estado HTTP de las páginas de detalle (ADR 0008): con el documento detrás de un único `<Suspense>`
 * (ADR 0007), la página ya no puede responder 404 ni 301, así que el slug se resuelve aquí, antes del
 * render, con una consulta indexada. Si la base no responde, la petición pasa y la página responde como
 * antes (su `notFound()` sigue siendo la segunda barrera). Tampoco es una barrera de seguridad.
 */
async function detailProxy(request: NextRequest) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return NextResponse.next()
  const [, section, segment, ...rest] = request.nextUrl.pathname.split('/')
  const route = section ? DETAIL_ROUTES[section] : undefined
  if (!route || !segment || rest.length > 0 || route.fixed?.has(segment)) return NextResponse.next()

  try {
    const slug = safeDecode(segment)
    // Una dirección mal codificada no es el slug de nada.
    const status: SlugStatus = slug === null ? { kind: 'missing' } : await withTimeout(route.status(slug))
    if (status.kind === 'found') return NextResponse.next()
    const url = request.nextUrl.clone()
    if (status.kind === 'moved') {
      url.pathname = `/${section}/${status.slug}`
      return NextResponse.redirect(url, 301)
    }
    url.pathname = NOT_FOUND_PATH
    return NextResponse.rewrite(url)
  } catch (error) {
    logger.warn({ err: error, section }, 'proxy: no se pudo resolver el slug; la petición sigue a la página')
    return NextResponse.next()
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  return pathname === '/admin' || pathname.startsWith('/admin/') ? adminProxy(request) : detailProxy(request)
}

// Solo el panel y las páginas de detalle públicas: /api (subidas), /_next y /media nunca pasan por el proxy.
export const config = {
  matcher: [
    '/admin',
    '/admin/:path*',
    '/noticias/:slug',
    '/partidos/:slug',
    '/jugadores/:slug',
    '/plantel/:serie',
  ],
}
