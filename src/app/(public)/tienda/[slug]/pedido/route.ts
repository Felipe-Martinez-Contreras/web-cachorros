import { siteBaseUrl } from '@/features/seo/metadata'
import { getSite } from '@/features/settings/queries'
import { orderWhatsappUrl, parseQuantity } from '@/features/store/lib/order'
import { getProductDetail } from '@/features/store/queries'

const HEADERS = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }

function redirect(location: string) {
  return new Response(null, { status: 302, headers: { ...HEADERS, Location: location } })
}

/**
 * «Pedir por WhatsApp» (especificación 6.8). El formulario de la ficha llega aquí por GET (funciona sin
 * JavaScript): se valida la talla y la cantidad contra el producto vigente y se redirige a WhatsApp con
 * el mensaje armado. Si algo no calza, vuelve a la ficha con el error. No guarda nada.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [product, site] = await Promise.all([getProductDetail(slug), getSite()])
  if (!product) return redirect('/tienda')

  const back = (error: string) => redirect(`/tienda/${product.slug}?error=${error}#pedido`)
  if (!site?.whatsapp) return back('whatsapp')
  const query = new URL(request.url).searchParams
  // Un producto sin tallas cargadas se pide como «Única».
  const size =
    product.sizes.length === 0
      ? { label: 'Única', orderable: true }
      : product.sizes.find((item) => item.label === query.get('talla'))
  if (!size?.orderable) return back('talla')
  const quantity = parseQuantity(query.get('cantidad'))
  if (quantity === null) return back('cantidad')

  return redirect(
    orderWhatsappUrl(site.whatsapp, {
      clubName: site.clubName,
      productName: product.name,
      size: size.label,
      quantity,
      unitPriceClp: product.priceClp,
      productUrl: `${siteBaseUrl()}/tienda/${product.slug}`,
    }),
  )
}
