import { describe, expect, it } from 'vitest'
import {
  buildOrderMessage,
  isVariantOrderable,
  type OrderLine,
  orderWhatsappUrl,
  parseQuantity,
} from '@/features/store/lib/order'
import { productSchema, productVariantSchema } from '@/features/store/schemas'

const line: OrderLine = {
  clubName: 'Club Deportivo Los Cachorros',
  productName: 'Camiseta Oficial 2026 (Local)',
  size: 'M',
  quantity: 2,
  unitPriceClp: 18000,
  productUrl: 'https://cachorros.example/tienda/camiseta-oficial-2026-local',
}

/** Decodifica el texto de un enlace `wa.me` tal como lo hace WhatsApp. */
function decodedText(url: string): string {
  const text = new URL(url).searchParams.get('text')
  if (text === null) throw new Error('el enlace no tiene ?text=')
  return text
}

describe('mensaje del pedido por WhatsApp (especificación 6.8)', () => {
  it('tiene el formato exacto de la especificación', () => {
    expect(buildOrderMessage(line)).toBe(
      [
        '¡Hola! Quiero hacer un pedido en la tienda del Club Deportivo Los Cachorros:',
        '• Producto: Camiseta Oficial 2026 (Local)',
        '• Talla: M',
        '• Cantidad: 2',
        '• Precio unitario: $18.000 · Total referencial: $36.000',
        'Enlace: https://cachorros.example/tienda/camiseta-oficial-2026-local',
      ].join('\n'),
    )
  })

  it('arma el enlace con el número sin + ni espacios', () => {
    const url = orderWhatsappUrl('+56 9 1234 5678', line)
    expect(url.startsWith('https://wa.me/56912345678?text=')).toBe(true)
    expect(decodedText(url)).toBe(buildOrderMessage(line))
  })

  it('codifica ñ, tildes, símbolos y emojis sin perder nada', () => {
    const tricky: OrderLine = {
      ...line,
      productName: 'Polerón Niño & Niña #10 + bufanda 🧡⚽ «edición 90 años»',
      size: '10 años',
      quantity: 1,
      unitPriceClp: 1234567,
    }
    const url = orderWhatsappUrl('+56912345678', tricky)
    const encoded = url.split('?text=')[1] ?? ''
    // Nada que rompa la dirección queda sin codificar: ni &, #, + ni espacios.
    expect(encoded).not.toMatch(/[&#+ \n]/)
    expect(encoded).toContain('%26') // &
    expect(encoded).toContain('%23') // #
    expect(encoded).toContain('%2B') // +
    expect(encoded).toContain('%C3%B1') // ñ
    expect(encoded).toContain('%C3%B3') // ó
    expect(encoded).toContain('%F0%9F%A7%A1') // 🧡
    expect(encoded).toContain('%0A') // salto de línea
    const text = decodedText(url)
    expect(text).toBe(buildOrderMessage(tricky))
    expect(text).toContain('• Producto: Polerón Niño & Niña #10 + bufanda 🧡⚽ «edición 90 años»')
    expect(text).toContain('• Talla: 10 años')
    expect(text).toContain('• Precio unitario: $1.234.567 · Total referencial: $1.234.567')
  })
})

describe('tallas que se pueden pedir', () => {
  it('sin control de stock, solo cuenta si está disponible', () => {
    expect(isVariantOrderable({ isAvailable: true, stock: 0 }, false)).toBe(true)
    expect(isVariantOrderable({ isAvailable: false, stock: 10 }, false)).toBe(false)
  })

  it('con control de stock, una talla sin unidades está agotada; sin número, no se controla', () => {
    expect(isVariantOrderable({ isAvailable: true, stock: 0 }, true)).toBe(false)
    expect(isVariantOrderable({ isAvailable: true, stock: 3 }, true)).toBe(true)
    expect(isVariantOrderable({ isAvailable: true, stock: null }, true)).toBe(true)
    expect(isVariantOrderable({ isAvailable: false, stock: 3 }, true)).toBe(false)
  })
})

describe('cantidad del pedido', () => {
  it('acepta enteros entre 1 y 20', () => {
    expect(parseQuantity('1')).toBe(1)
    expect(parseQuantity(' 20 ')).toBe(20)
  })

  it('rechaza lo demás', () => {
    for (const value of [null, undefined, '', '0', '21', '-1', '1.5', '2e1', 'dos', '0x10']) {
      expect(parseQuantity(value)).toBeNull()
    }
  })
})

describe('esquemas de la tienda', () => {
  const product = {
    name: 'Camiseta',
    categoryId: '',
    description: '',
    priceClp: '18000',
    compareAtPriceClp: '',
    trackStock: false,
    isActive: true,
    sortOrder: '0',
  }

  it('convierte los campos vacíos en null', () => {
    const parsed = productSchema.parse(product)
    expect(parsed).toMatchObject({ priceClp: 18000, compareAtPriceClp: null, categoryId: null })
  })

  it('el precio anterior tiene que ser mayor que el actual', () => {
    const result = productSchema.safeParse({ ...product, compareAtPriceClp: '15000' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['compareAtPriceClp'])
    expect(productSchema.safeParse({ ...product, compareAtPriceClp: '22000' }).success).toBe(true)
  })

  it('una talla sin unidades indicadas no controla stock', () => {
    expect(
      productVariantSchema.parse({ sizeLabel: ' M ', stock: '', isAvailable: true, sortOrder: '1' }),
    ).toEqual({ sizeLabel: 'M', stock: null, isAvailable: true, sortOrder: 1 })
  })
})
