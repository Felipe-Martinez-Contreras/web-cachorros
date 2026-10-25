// Colores de las tarjetas para redes. Satori no lee variables CSS: son copia de `src/styles/tokens.css` y
// `tests/unit/share-brand.test.ts` falla si se desfasan.

export const BRAND = {
  ink: '#0b0b0c',
  paper: '#ffffff',
  accent: '#f27405',
  accentSoft: '#fdeedd',
  live: '#d7263d',
  neutral200: '#dcdcdc',
  neutral400: '#9e9e9e',
  neutral700: '#424242',
  neutral800: '#2b2b2b',
  neutral900: '#1a1a1a',
} as const

/** Token de `tokens.css` del que sale cada color. */
export const BRAND_TOKENS: Record<keyof typeof BRAND, string> = {
  ink: 'ink',
  paper: 'paper',
  accent: 'accent',
  accentSoft: 'accent-soft',
  live: 'live',
  neutral200: 'neutral-200',
  neutral400: 'neutral-400',
  neutral700: 'neutral-700',
  neutral800: 'neutral-800',
  neutral900: 'neutral-900',
}
