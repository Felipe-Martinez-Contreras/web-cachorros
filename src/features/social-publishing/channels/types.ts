import type { GraphFailure } from '../lib/rules'

// Un canal de publicación en redes (ADR 0009). Hoy solo Facebook; Instagram se suma con la misma forma
// (con la salvedad de que su API pide la imagen por URL pública, no como archivo).

export type PublishInput = {
  /** La tarjeta ya dibujada (PNG). */
  image: Buffer
  filename: string
  caption: string
}

export type PublishResult =
  | { ok: true; externalId: string; url: string }
  | { ok: false; failure: GraphFailure }

export type ConnectionResult = { ok: true; name: string } | { ok: false; message: string }

export type PublishChannel = {
  id: 'facebook' | 'instagram'
  publishPhoto: (input: PublishInput) => Promise<PublishResult>
  testConnection: () => Promise<ConnectionResult>
}
