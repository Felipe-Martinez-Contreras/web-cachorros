# Fase 3 — Club y comunidad (cierre)

- **Ramas:** `fase-3a-comunidad-y-datos` (PR #8, mergeado) y `fase-3b-club-y-vitrina` (PR #9)
- **Fecha de cierre:** 20 de octubre de 2026
- **Reportes por parte:** [`fase-3a.md`](fase-3a.md) (formularios, socios, auspiciadores, datos personales) y este
  documento, que agrega el PR 3b y cierra la fase con todos sus criterios.

## Qué quedó hecho

### PR 3a (resumen; detalle en `fase-3a.md`)

Formularios públicos con Turnstile, campo trampa, tiempo mínimo firmado y rate limit con 429 real; socios (planes,
solicitudes, padrón con número correlativo, CSV auditado); contacto y privacidad con consentimiento versionado;
auspiciadores (vitrina, formulario, conteo de clics y reporte mensual); exportar y eliminar los datos de una
persona; retención de 12 meses en `GET /api/cron/daily`.

### PR 3b

| Hito | Entregable | Dónde |
|---|---|---|
| 6 | **Tienda.** `/tienda` por categoría y `/tienda/[slug]` con galería deslizable (sin JavaScript), tallas (las agotadas, tachadas y deshabilitadas), stock opcional, precio anterior y guía de tallas editable. «Pedir por WhatsApp» es un formulario GET a `/tienda/[slug]/pedido`, que valida y redirige a `wa.me` con el mensaje exacto de 6.8. Panel: productos, tallas, fotos y categorías | `src/features/store/`, `/admin/tienda/**` |
| 7 | **Eventos.** `/eventos` con los próximos (ascendente; los que están en curso siguen ahí) y los pasados paginados; `/eventos/[slug]` con afiche ampliable (`popover` nativo), lugar con mapa, valor, botón de WhatsApp o enlace propio, JSON-LD `Event` y `.ics` (`/api/ics/evento/[id]`). Panel con hora de pared de Santiago | `src/features/events/`, `/admin/eventos/**` |
| 8 | **Directiva y transparencia.** `/club/directiva` con los vigentes; `/club/transparencia` filtrable por categoría y año (formulario GET), con fecha y tamaño. Subida de PDF por `POST /api/admin/media` (`kind=document`): solo PDF por su firma real, servidos con `sandbox`. Panel Club: directiva y documentos | `src/features/club/`, `/admin/club/**` |
| 9 | **Formativas, La cancha y Apoya al club.** `/formativas` (textos, categorías con horarios y cuerpo técnico, preguntas frecuentes y contacto, sin formulario con datos de niños); `/club/la-cancha` (dirección, mapa de OpenStreetMap detrás de una fachada, Google Maps, Waze y Apple Maps, horarios); `/apoya-al-club` (uso de los aportes, «Copiar datos», link de pago y rendiciones). Panel Club → Horarios | `src/features/club/`, `src/components/site/map-facade.tsx`, `copy-block.tsx` |
| 10 | **Galería y videos.** `/galeria` y `/galeria/[slug]` con visor propio en `<dialog>` (teclado, deslizamiento, foco de vuelta a la miniatura; sin JavaScript, enlaces a cada foto); `/videos` con YouTube detrás de `youtube-nocookie` y Facebook como enlace. Panel: álbumes (subida de varias fotos, orden, pie) y videos | `src/features/gallery/`, `/admin/galeria/**` |

- **Proxy:** `/tienda/[slug]`, `/eventos/[slug]` y `/galeria/[slug]` responden 404 y 301 reales (ADR 0008).
  Renombrar un producto, un evento o un álbum deja una redirección 301.
- **Sitemap:** todas las secciones nuevas, con la misma regla de visibilidad que sus páginas.
- **Permisos nuevos:** `store:write`, `events:write`, `club:write` y `gallery:write`. **Tags nuevos:** `club` y
  `gallery`.
- **Ya no queda ninguna sección en «Próximamente».**
- **Seed:** una talla agotada, un producto con control de stock, guía de tallas, preguntas de formativas y un
  link de pago de ejemplo (`example.com`). Lo demás de la fase ya estaba sembrado: productos, eventos, directiva,
  tres PDF, álbumes, videos (con la dirección `[COMPLETAR]`) y horarios.
- Sin migraciones nuevas: las tablas de la fase ya existían desde la Fase 1.

## Criterios de aceptación de la Fase 3 (sección 14)

| Criterio | Resultado | Evidencia |
|---|---|---|
| Envío válido: se guarda y se notifica a los destinatarios configurados (Mailpit). Honeypot o Turnstile inválido: se rechaza. 6.º envío en 10 min: 429 con mensaje amable | ✅ | PR 3a: e2e `contacto`, `socios`, `auspiciadores`; integración `public-forms` |
| Si el SMTP falla, la solicitud queda guardada y se reintenta desde `tick` | ✅ | PR 3a: integración `public-forms` |
| Mensaje de WhatsApp de la tienda con formato exacto y codificación correcta (ñ, tildes y símbolos) | ✅ | unitaria `store.test.ts` (ñ, tildes, `&`, `#`, `+`, emojis, «») ; integración `store.test.ts`; e2e `tienda.spec.ts` (con y sin JavaScript) |
| PDF validados por firma y servidos con `sandbox`; tipos no permitidos, rechazados | ✅ | unitaria `club.test.ts`; integración `club.test.ts` (PNG y HTML llamados `.pdf` → 415; cabeceras `sandbox` y `nosniff`); e2e `club.spec.ts` |
| Exportar y eliminar los datos de una persona desde el panel | ✅ | PR 3a: integración `privacy`; e2e `datos-personales` |
| Mapa y videos no cargan nada de terceros antes de la interacción | ✅ | e2e `club.spec.ts` (La cancha) y `galeria.spec.ts` (Videos): registran toda petición fuera del sitio y verifican que no hay ninguna antes del clic, y que después sí se pide el iframe |
| Todo el contenido de ejemplo de la fase está en el seed | ✅ | integración `seed.test.ts`; e2e de cada sección contra el seed |

### Verificación

| Paso | Dónde | Resultado |
|---|---|---|
| `pnpm check` | local y CI | en verde |
| `pnpm test` (unitarias) | local | 257 de 257 |
| `pnpm test:integration` | local | 215 de 215 |
| `pnpm build` (sin BD) | local y CI | en verde |
| e2e de cada hito (workers=1) | local | tienda 10/10 · eventos 8/8 · club (hitos 8 y 9) 14/14 · galería 10/10 |
| `pnpm test:e2e` completa | CI del PR #9 | _ver «CI del cierre»_ |
| Lighthouse móvil de la portada | CI (job informativo) | en verde |
| Imagen Docker y memoria con `--memory=512m` | CI | _ver «CI del cierre»_ |

**CI del cierre:** _se completa al final._

## Desviaciones y ADRs

Ninguna desviación del stack ni ADR nuevo. Decisiones de diseño que conviene conocer:

- **Pedido por WhatsApp como formulario GET a una ruta del servidor**, no como enlace armado en el navegador:
  funciona sin JavaScript, el servidor valida la talla y la cantidad contra el producto vigente (una talla agotada
  no se puede pedir aunque se edite la página) y el mensaje se arma en un solo lugar.
- **Afiche ampliable con `popover`** y no con `<dialog>`: `popover` es HTML nativo y funciona sin JavaScript
  (lo verifica la e2e sin JavaScript).
- **Videos de Facebook como enlace**, no incrustados: su reproductor carga scripts y cookies de Facebook. La
  especificación pide «fachada»; un enlace con miniatura propia es la fachada que no carga nada de ellos.
- **Un PDF sin uso se borra.** La biblioteca del panel lista solo imágenes, así que un PDF reemplazado o de un
  documento eliminado quedaría huérfano. Se borra su fila y sus archivos al confirmar la transacción.
- **Horarios en el módulo Club** (`club:write`), no en Series: los edita la misma persona que mantiene La cancha y
  Formativas.

## Decisiones que tomé (defaults)

- Formativas incluye las series de tipo `formativa` y `juvenil`. Muestra también las series sin horario cargado
  («Horario por confirmar»). La cancha solo muestra las series que tienen horario.
- Cuerpo técnico de formativas: solo nombre y cargo de la temporada actual (son adultos; sin foto).
- Galería sin fotos de menores (default de 9.6): una foto marcada «contiene menores» no se puede agregar y, si se
  marca después, deja de mostrarse. Un álbum marcado «con menores» exige confirmar las autorizaciones para
  publicarse; queda quién y cuándo.
- Eventos: «próximo» mientras no termina y no se marcó realizado; uno cancelado sigue en el listado con su aviso.
  Sin hora de término, el `.ics` dura 2 horas.
- Tienda: máximo 20 unidades por pedido; un producto sin tallas cargadas se pide como «Única».
- Transparencia: el año de un documento es el de su fecha o, si no tiene, el de su publicación.

## Hallazgos corregidos en el camino

- **sharp en el build de Windows:** el *standalone* no incluye las DLL de libvips, así que `sharp` no carga en
  `pnpm start` local, y cualquier página que lo importara (aunque no lo usara) fallaba. Ahora `sharp` se carga con
  `import()` recién al procesar una imagen, y el borrado de archivos vive en `src/features/media/files.ts`, sin
  `sharp`. En Linux (CI e imagen Docker) nunca falló. Consecuencia en local: **subir fotos con `pnpm start` en
  Windows sigue fallando**; con `pnpm dev` funciona. Las e2e que suben fotos corren en el CI.
- **E2E que fallaban en el CI** (primera corrida del 3b): la negrita del editor perdía teclas, el formulario de
  contacto se enviaba antes de los 3 s mínimos, y tienda y eventos daban por hecho el WhatsApp del seed, que otra
  prueba cambia. Además, la foto del seed puede quedar en la segunda página de la biblioteca. Se corrigieron las
  esperas y los supuestos; `AGENTS.md` lo deja como convención.
- **`openModule()`** estaba copiada en tres pruebas: ahora vive en `tests/e2e/support.ts`.

## Qué falta (para fases siguientes)

- **CSP en Caddy (Fase 5):** al definir la política, permitir `frame-src` de `https://www.openstreetmap.org` y
  `https://www.youtube-nocookie.com` (solo se cargan después del clic) y servir `/media/**/*.pdf` con
  `Content-Security-Policy: sandbox` y `nosniff`, como ya hace la ruta de desarrollo.
- **Un PDF subido en un formulario que no se guarda** queda en la biblioteca sin uso. Lo recogerá la tarea de
  limpieza de la Fase 5 (`ops_runs` tipo `limpieza`).
- **Fotos de La cancha:** la especificación las menciona y la tabla `venues` no tiene fotos. Si el club las quiere,
  van con una migración *expand* (`venues.photo_media_id`) o como bloque de texto con imágenes.
- **Contenido real** (`pnpm content:pending`): productos, precios y tallas; guía de tallas; datos de transferencia
  y link de pago; directiva y documentos; información de formativas; videos.

## Resumen de los PR de Renovate (sin mergear)

No hay PR de Renovate abiertos. El único que hubo (#5, `next` 16.4.0) lo mergeaste tú el 20 de octubre. El
*Dependency Dashboard* (issue #6) tiene 7 actualizaciones **esperando su horario** (lunes antes de las 8):

| PR que abrirá | Tipo | Comentario |
|---|---|---|
| `next`, `react`, `react-dom` (16.4.2 y 19.3.1) | parche | **Revisar primero:** la regla es aplicar los parches de seguridad de Next y React en ≤ 48 h. Conviene ver si 16.4.2 trae alguno |
| Menores y parches agrupados (Tiptap, Playwright, Vitest, drizzle-orm, zod, pino, nodemailer, lucide-react, pnpm 12.13, node 24.21…) | menor/parche | Bajo riesgo; necesita la suite completa del CI |
| `@hookform/resolvers` 6 | mayor | Lo usa todo `EntityForm`: revisar las notas de la versión |
| `typescript` 7 | mayor | TypeScript va fijado en versión exacta: subir solo con una revisión aparte |
| `ubuntu` 26.04 (runners del CI) | mayor | Decidiste fijar `ubuntu-24.04`: este PR conviene cerrarlo o ignorarlo |
| `actions/setup-node` 7 y `actions/upload-artifact` 7 | mayor | Solo el CI; bajo riesgo |

Renovate no abrió nada fuera de horario porque `minimumReleaseAge` (7 días) y el `schedule` semanal lo frenan,
como se pidió. Ninguno se mergea solo (`automerge: false`).

## Cómo probarlo

```powershell
docker compose -f compose.dev.yaml up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

1. `http://localhost:3000/tienda` → «Camiseta oficial (local)»: la XXL está agotada. Elige M y 2, y «Pedir por
   WhatsApp»: se abre WhatsApp con el pedido listo.
2. `/eventos` → la completada: toca el afiche, «Agregar al calendario» descarga el `.ics`.
3. `/club/transparencia`: filtra por «Balance» y abre el PDF.
4. `/club/la-cancha`: no se carga el mapa hasta tocar «Ver el mapa». `/apoya-al-club`: «Copiar datos».
5. `/galeria` → un álbum → toca una foto: ← y → cambian de foto, Escape cierra.
6. Panel → Tienda, Eventos, Club (Directiva, Documentos, Horarios) y Galería y videos. En Club → Documentos →
   «Nuevo documento», sube un PDF; un archivo que no es PDF se rechaza.

## Capturas

En `docs/fases/capturas/fase-3b/`, a 360 y 1280 px:

- Sitio: `tienda`, `tienda-producto`, `eventos`, `evento`, `directiva`, `transparencia`, `formativas`,
  `la-cancha`, `apoya-al-club`, `galeria`, `galeria-album`, `galeria-visor` y `videos`.
- Panel: `panel-tienda`, `panel-tienda-producto`, `panel-eventos`, `panel-club-directiva`, `panel-club-documentos`,
  `panel-club-horarios`, `panel-galeria` y `panel-videos`.

Se regeneran con:

```powershell
$env:CAPTURAS = 'fase-3b'
pnpm test:e2e capturas
Remove-Item Env:CAPTURAS
```
