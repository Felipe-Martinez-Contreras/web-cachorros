# ADR 0008 — 404 y 301 reales en las páginas de detalle: el slug se resuelve en `proxy.ts`

- **Estado:** propuesto (pendiente de aprobación)
- **Fecha:** 8 de octubre de 2026

## Contexto

El ADR 0007 dejó un pendiente: con el único `<Suspense>` en el layout raíz, el servidor compromete el estado
`200` antes de que la página sepa si el slug existe. Lo medí en el hito 0 de la Fase 2, sobre el build de
producción, con una página de prueba en `/partidos/[slug]` que consulta el slug y llama a `notFound()`:

| Petición | Estado |
|---|---|
| `/partidos/<slug que existe>` | 200 |
| `/partidos/no-existe-xyz` | **200**, con `<meta name="robots" content="noindex">` |
| La misma, con agente de usuario de Googlebot | **200** |
| `/no-existe` (ninguna ruta coincide) | 404 |

La documentación de Next 16 lo confirma (`guides/streaming.md`, «The HTTP contract»): una vez que un
`<Suspense>` suspende, el estado ya se envió; un `notFound()` posterior solo agrega `noindex` y un `redirect()`
se convierte en una redirección del lado del cliente. Con Cache Components no existe una forma de bloquear la
ruta sin `<Suspense>` (`dynamicParams` no está permitido y leer `params` fuera de un límite hace fallar el build).

Afecta a `/noticias/[slug]`, `/partidos/[slug]`, `/jugadores/[slug]`, `/plantel/[serie]` y, en la Fase 3, a
`/eventos/[slug]`, `/galeria/[slug]` y `/tienda/[slug]`. Dos requisitos dependen de esto:

- **3.9 y 11:** al cambiar un slug, la dirección anterior responde con una **redirección 301**.
- **5.1:** la ficha de un menor de edad «no existe»; lo correcto es un 404, no una página 200 vacía.

La misma documentación indica la salida: resolver la existencia **antes del render**, en `proxy.ts`.

## Opciones

| Opción | 404 real | 301 real | Costo |
|---|---|---|---|
| A. Dejarlo como está: `notFound()` y `redirect()` en la página | No (200 + `noindex`) | No (redirección por `<meta refresh>`) | Ninguno. Los buscadores no indexan el 404, pero el slug antiguo no traspasa su posicionamiento y las herramientas de monitoreo ven 200 |
| B. Resolver el slug en `proxy.ts` para las rutas de detalle | Sí | Sí | Una consulta indexada por petición de detalle; el proxy deja de ser «solo el panel» |
| C. Volver a `<Suspense>` por sección en las páginas de detalle | Sí, si la comprobación va antes del límite | Sí | No se puede: leer `params` o la BD fuera de un `<Suspense>` hace fallar el build con Cache Components, y con el límite dentro la página deja de funcionar sin JavaScript (ADR 0007) |
| D. Quitar Cache Components | Sí | Sí | Reabre una decisión de stack (2.1) |

## Propuesta

**Opción B**, acotada:

- El *matcher* de `proxy.ts` agrega solo las rutas de detalle públicas (`/noticias/:slug`, `/partidos/:slug`,
  `/jugadores/:slug`, `/plantel/:serie`). Sigue excluyendo `/api`, `/_next` y `/media`. Las rutas fijas que
  comparten prefijo (`/partidos/posiciones`, `/partidos/goleadores`, `/noticias/rss.xml`) pasan sin consulta.
- Por cada una, el proxy llama a una función del dominio (`src/features/<dominio>/slug.ts`) que responde una de
  tres cosas con **una consulta indexada**: existe y es visible · cambió de slug (→ 301 al actual, desde
  `slug_redirects`) · no existe (→ 404 con la página `not-found` del club). Las reglas de visibilidad son las
  mismas del DTO público: noticia `publicada` con `published_at ≤ ahora`; jugador que no es menor (`isMinor`).
- La página conserva su `notFound()` como segunda barrera (si el proxy fallara, el resultado es el de hoy:
  200 con `noindex`, nunca datos indebidos).
- Si la BD no responde, el proxy deja pasar la petición: la página mostrará su error como hoy.
- Sin caché en memoria en el proxy: una noticia recién publicada debe verse en la carga siguiente.

Medido en el spike (build de producción, local): slug inexistente → **404** con la página del club; slug
antiguo → **301**; el panel sigue redirigiendo al login. El proxy tiene su propio *bundle* y por lo tanto su
propio pool de conexiones: se limita a `max: 2` para no pasar del presupuesto de PostgreSQL (5 + 2).

## Consecuencias

- **A favor:** estados HTTP correctos sin JavaScript; se cumple la redirección 301 de 3.9; la ficha de un menor
  responde 404 antes de renderizar nada.
- **En contra:** una consulta más (≈ 1 ms, por índice único) en cada página de detalle; el proxy ya no es «solo
  redirecciones optimistas del panel». **Sigue sin ser una barrera de seguridad**: no autoriza nada, solo decide
  el estado de páginas públicas. Hay que actualizar la frase correspondiente de `AGENTS.md`.
- **Cambia la especificación** en 2.1 («`proxy.ts` solo para redirecciones optimistas y cabeceras del panel»):
  por eso este ADR necesita aprobación.
- **Mientras no se apruebe:** las páginas de detalle del hito 5 se construyen con la opción A y la prueba e2e
  de estados queda marcada como pendiente en el reporte.
- **Reversible:** quitar las rutas del *matcher* devuelve el comportamiento de la opción A.
