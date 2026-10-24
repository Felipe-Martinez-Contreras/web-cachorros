import 'server-only'
import { classifyGraphResponse, classifyNetworkError, redactSecret } from '../lib/rules'
import type { ConnectionResult, PublishChannel, PublishInput, PublishResult } from './types'

// Página de Facebook vía Graph API, con `fetch` nativo (sin SDK). La imagen se sube como archivo
// (multipart): no depende de que el sitio sea público. Guía: docs/integraciones/facebook.md.

/** Versión de la Graph API. Meta mantiene cada versión unos dos años: revisarla al menos una vez al año. */
export const GRAPH_API_VERSION = 'v26.0'
const TIMEOUT_MS = 30_000

export type FacebookConfig = {
  pageId: string
  token: string
  /** `https://graph.facebook.com`, o la API simulada en desarrollo. */
  baseUrl: string
  fetch?: typeof fetch
}

export function facebookChannel(config: FacebookConfig): PublishChannel {
  const doFetch = config.fetch ?? fetch
  const endpoint = (path: string) => `${config.baseUrl.replace(/\/$/, '')}/${GRAPH_API_VERSION}/${path}`

  async function readJson(response: Response): Promise<unknown> {
    try {
      return await response.json()
    } catch {
      return null
    }
  }

  return {
    id: 'facebook',

    async publishPhoto({ image, filename, caption }: PublishInput): Promise<PublishResult> {
      const form = new FormData()
      form.set('source', new Blob([new Uint8Array(image)], { type: 'image/png' }), filename)
      form.set('caption', caption)
      form.set('published', 'true')
      // El token va en el cuerpo, no en la URL: así no queda en ningún registro de direcciones.
      form.set('access_token', config.token)
      let response: Response
      try {
        response = await doFetch(endpoint(`${config.pageId}/photos`), {
          method: 'POST',
          body: form,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })
      } catch (error) {
        return { ok: false, failure: classifyNetworkError(error) }
      }
      const body = await readJson(response)
      if (!response.ok) {
        const failure = classifyGraphResponse(response.status, body)
        return { ok: false, failure: { ...failure, message: redactSecret(failure.message, config.token) } }
      }
      const { id, post_id: postId } = (body ?? {}) as { id?: unknown; post_id?: unknown }
      const externalId = typeof postId === 'string' ? postId : typeof id === 'string' ? id : null
      if (!externalId) {
        // Respondió 200 pero sin id: la foto pudo quedar arriba.
        return {
          ok: false,
          failure: { kind: 'incierto', message: 'Facebook no devolvió el id de la publicación.' },
        }
      }
      return { ok: true, externalId, url: `https://www.facebook.com/${encodeURIComponent(externalId)}` }
    },

    async testConnection(): Promise<ConnectionResult> {
      const url = new URL(endpoint(config.pageId))
      url.searchParams.set('fields', 'id,name')
      url.searchParams.set('access_token', config.token)
      try {
        const response = await doFetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
        const body = (await readJson(response)) as { name?: unknown } | null
        if (response.ok && typeof body?.name === 'string') return { ok: true, name: body.name }
        return {
          ok: false,
          message: redactSecret(classifyGraphResponse(response.status, body).message, config.token),
        }
      } catch {
        return { ok: false, message: 'No hubo respuesta de Facebook. Intenta de nuevo en un rato.' }
      }
    },
  }
}
