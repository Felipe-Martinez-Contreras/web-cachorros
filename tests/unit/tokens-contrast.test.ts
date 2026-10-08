import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Verifica los pares de color permitidos (especificación 4.2) leyendo los valores reales de tokens.css.
const css = readFileSync('src/styles/tokens.css', 'utf8')

function token(name: string): string {
  const match = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css)
  if (!match?.[1]) throw new Error(`No existe el token --color-${name} en tokens.css`)
  return match[1]
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255)
  const [r = 0, g = 0, b = 0] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Razón de contraste WCAG entre dos tokens. */
function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(token(foreground)), luminance(token(background))].sort((a, b) => b - a)
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05)
}

const AA_TEXT = 4.5
const AA_LARGE = 3

describe('contraste de tokens (WCAG AA)', () => {
  it.each([
    ['ink', 'paper', 'texto base'],
    ['paper', 'ink', 'texto en secciones oscuras'],
    ['accent-strong', 'paper', 'enlaces y texto de acento sobre blanco'],
    ['accent-strong', 'neutral-50', 'enlaces sobre fondo gris claro'],
    ['accent', 'ink', 'texto y enlaces en secciones oscuras'],
    ['ink', 'accent', 'botón primario: texto negro sobre naranja'],
    ['paper', 'accent-strong', 'botón primario alternativo'],
    ['ink', 'accent-soft', 'texto sobre fondo de acento sutil'],
    ['paper', 'live', 'etiqueta EN VIVO'],
    ['paper', 'danger', 'botones y avisos de error'],
    ['danger', 'paper', 'mensajes de error de formularios'],
    ['paper', 'success', 'etiquetas de éxito'],
    ['neutral-500', 'paper', 'texto secundario mínimo sobre blanco'],
    ['neutral-600', 'neutral-50', 'texto secundario sobre gris 50'],
    ['neutral-600', 'neutral-100', 'texto secundario sobre gris 100'],
    ['neutral-700', 'neutral-100', 'etiqueta neutra'],
    ['neutral-400', 'ink', 'texto secundario en secciones oscuras'],
  ])('%s sobre %s alcanza 4,5:1 (%s)', (foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(AA_TEXT)
  })

  it.each([
    ['accent-strong', 'paper', 'foco e indicadores sobre blanco'],
    ['accent', 'ink', 'foco e indicadores en secciones oscuras'],
    ['neutral-500', 'paper', 'borde de los campos de formulario'],
  ])('%s sobre %s alcanza 3:1 para componentes de interfaz (%s)', (foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(AA_LARGE)
  })

  it('el naranja del escudo no sirve para texto sobre blanco: por eso existe accent-strong', () => {
    // Si este valor cambia, hay que revisar dónde se usa `accent` sobre fondos claros.
    expect(contrast('accent', 'paper')).toBeLessThan(AA_LARGE)
    expect(contrast('paper', 'accent')).toBeLessThan(AA_TEXT)
  })

  it('neutral-500 no alcanza AA sobre fondos grises: ahí se usa neutral-600', () => {
    expect(contrast('neutral-500', 'neutral-100')).toBeLessThan(AA_TEXT)
  })
})
