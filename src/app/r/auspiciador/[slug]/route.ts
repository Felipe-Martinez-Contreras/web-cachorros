import { findSponsorTarget, recordSponsorClick } from '@/features/sponsors/clicks'
import { requestLogger } from '@/lib/logger'

const HEADERS = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }

/** Una precarga del navegador (o un HEAD) no es un clic de una persona. */
function isPrefetch(request: Request): boolean {
  const purpose = `${request.headers.get('sec-purpose') ?? ''} ${request.headers.get('purpose') ?? ''}`
  return request.method === 'HEAD' || /prefetch|prerender/i.test(purpose)
}

/**
 * Enlace de un auspiciador (especificación 6.10): `?a=web|instagram|whatsapp`. Cuenta el clic del día y
 * redirige con 302. Si el auspiciador no existe, venció o no tiene ese enlace, vuelve a la vitrina.
 */
async function handle(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const url = new URL(request.url)
  const found = await findSponsorTarget(slug, url.searchParams.get('a'))
  if (!found) {
    return new Response(null, { status: 302, headers: { ...HEADERS, Location: '/auspiciadores' } })
  }
  if (!isPrefetch(request)) {
    try {
      await recordSponsorClick(found.id)
    } catch (error) {
      // Un conteo perdido no debe impedir que la persona llegue al auspiciador.
      requestLogger(request.headers).warn({ err: error, slug }, 'clic de auspiciador: no se pudo contar')
    }
  }
  return new Response(null, { status: 302, headers: { ...HEADERS, Location: found.target } })
}

export { handle as GET, handle as HEAD }
