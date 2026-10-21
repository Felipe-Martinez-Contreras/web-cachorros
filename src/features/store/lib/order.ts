import { formatClp } from '@/lib/format'
import { whatsappUrl } from '@/lib/links'

/** Cantidades que se pueden pedir de una vez por WhatsApp. */
export const MAX_ORDER_QUANTITY = 20

export type OrderLine = {
  clubName: string
  productName: string
  size: string
  quantity: number
  unitPriceClp: number
  /** Dirección absoluta del producto (`https://<dominio>/tienda/<slug>`). */
  productUrl: string
}

/**
 * Mensaje del pedido por WhatsApp con el formato exacto de la especificación 6.8. Lógica pura: el texto
 * se codifica una sola vez, en `orderWhatsappUrl`.
 */
export function buildOrderMessage(line: OrderLine): string {
  const total = line.unitPriceClp * line.quantity
  return [
    `¡Hola! Quiero hacer un pedido en la tienda del ${line.clubName}:`,
    `• Producto: ${line.productName}`,
    `• Talla: ${line.size}`,
    `• Cantidad: ${line.quantity}`,
    `• Precio unitario: ${formatClp(line.unitPriceClp)} · Total referencial: ${formatClp(total)}`,
    `Enlace: ${line.productUrl}`,
  ].join('\n')
}

/** `https://wa.me/<número sin + ni espacios>?text=<mensaje codificado>` */
export function orderWhatsappUrl(whatsappE164: string, line: OrderLine): string {
  return whatsappUrl(whatsappE164, buildOrderMessage(line))
}

export type VariantStock = { isAvailable: boolean; stock: number | null }

/**
 * Una talla se puede pedir si está disponible y, cuando el producto controla stock, le quedan unidades.
 * `stock = null` es «sin control para esta talla» (8.4).
 */
export function isVariantOrderable(variant: VariantStock, trackStock: boolean): boolean {
  if (!variant.isAvailable) return false
  return !trackStock || variant.stock === null || variant.stock > 0
}

/** Cantidad pedida: un entero entre 1 y el máximo; cualquier otra cosa es `null`. */
export function parseQuantity(value: string | null | undefined): number | null {
  if (!value || !/^\d{1,3}$/.test(value.trim())) return null
  const quantity = Number(value.trim())
  return quantity >= 1 && quantity <= MAX_ORDER_QUANTITY ? quantity : null
}
