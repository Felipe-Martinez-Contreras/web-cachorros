import { serializeJsonLd } from '../lib/json-ld'

/**
 * Datos estructurados de la página. El JSON va como texto (React lo escribe tal cual porque no trae
 * `<`, `>` ni `&`: `serializeJsonLd` los deja como escapes), sin `dangerouslySetInnerHTML`.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json">{serializeJsonLd(data)}</script>
}
