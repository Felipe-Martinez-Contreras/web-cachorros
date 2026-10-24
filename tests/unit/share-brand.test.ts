import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BRAND, BRAND_TOKENS } from '@/features/share/lib/brand'

const css = readFileSync('src/styles/tokens.css', 'utf8')

describe('colores de las tarjetas para redes', () => {
  it.each(Object.entries(BRAND_TOKENS))('%s es igual a --color-%s', (key, token) => {
    const match = new RegExp(`--color-${token}:\\s*(#[0-9a-fA-F]{6})`).exec(css)
    expect(match?.[1]?.toLowerCase()).toBe(BRAND[key as keyof typeof BRAND])
  })
})
