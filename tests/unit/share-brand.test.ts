import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BRAND, BRAND_TOKENS } from '@/features/share/lib/brand'

const css = readFileSync('src/styles/tokens.css', 'utf8')

/**
 * Colores que las tarjetas conservan a propósito aunque el sitio cambió. El rediseño del sitio público
 * (rama rediseno-portada) pasó el negro a #000000; las tarjetas siguen con su negro hasta que se rediseñen
 * (cambiarlo exige subir `DESIGN_REVISION` y regenerar la caché).
 */
const CARD_OWN: Partial<Record<keyof typeof BRAND, string>> = { ink: '#0b0b0c' }

describe('colores de las tarjetas para redes', () => {
  it.each(Object.entries(BRAND_TOKENS))('%s es igual a --color-%s', (key, token) => {
    const brandKey = key as keyof typeof BRAND
    if (CARD_OWN[brandKey]) {
      expect(BRAND[brandKey]).toBe(CARD_OWN[brandKey])
      return
    }
    const match = new RegExp(`--color-${token}:\\s*(#[0-9a-fA-F]{6})`).exec(css)
    expect(match?.[1]?.toLowerCase()).toBe(BRAND[brandKey])
  })
})
