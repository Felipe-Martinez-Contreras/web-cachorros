# AGENTS.md — Club Deportivo Los Cachorros

Reglas de trabajo para cualquier agente de código o desarrollador. Es un **resumen** de las secciones 0 y 3 de
[`docs/ESPECIFICACION.md`](docs/ESPECIFICACION.md), que es la **fuente de verdad**: ante cualquier diferencia, manda la
especificación. Si cambias un comando o una convención, actualiza este archivo en el mismo PR.

## 1. Qué es

Sitio web (propuesta de web oficial) del Club Deportivo Los Cachorros, club de fútbol amateur ANFA fundado el
1 de abril de 1934 en Sagrada Familia, Región del Maule, Chile. Producto 100 % en español de Chile, pensado para el
celular, con un panel propio para 1–2 administradores no técnicos.

**Stack vinculante (sección 2.1):** Node.js 24 LTS · Next.js 16 (App Router, RSC, Server Actions, Cache Components,
`output: 'standalone'`) · TypeScript estricto · Tailwind CSS v4 + shadcn/ui · PostgreSQL 18 + Drizzle ORM (driver
`postgres`) · Better Auth · Zod 4 · sharp · `next/og` · Biome · Vitest · Playwright · pnpm · Docker Compose + Caddy
detrás de Cloudflare.

## 2. Reglas de trabajo

1. **Las decisiones de arquitectura y stack no se reabren por preferencia.** Ante un impedimento real (API deprecada,
   incompatibilidad, bug bloqueante, presupuesto de memoria inalcanzable): escribe un ADR en
   `docs/adr/NNNN-titulo.md` (contexto → opciones → propuesta → consecuencias) y **espera aprobación** antes de
   desviarte.
2. **Por fases** (sección 14). No se avanza de fase sin aprobación explícita. Una rama por fase
   (`fase-0-cimientos`, `fase-1-diseno-y-portada`, …) y un PR con el checklist de criterios de aceptación.
3. **Cierre de fase:** `pnpm check`, `pnpm test`, `pnpm test:e2e` y `pnpm build` en verde; todo funcionando en local
   con el seed; reporte en `docs/fases/fase-N.md` (qué quedó hecho, qué falta, desviaciones/ADRs, cómo probarlo,
   capturas a 360 px y 1280 px).
4. **Commits** pequeños y atómicos, Conventional Commits en español:
   `feat(partidos): agrega tabla de posiciones manual`, `fix(en-vivo): evita goles duplicados sin conexión`.
5. **Dependencias:** solo las del stack. Cualquier otra se justifica en el PR (peso, mantenimiento, licencia,
   alternativa nativa de la plataforma).
6. **Dudas:** si bloquea, pregunta (una ronda agrupada por fase); si no bloquea, aplica el default razonable,
   regístralo en el reporte de fase y continúa.
7. **Entornos:** staging en `cachorros.fmartinez.xyz` (datos de ejemplo, nunca indexado); producción en el dominio
   definitivo. Pasar de uno a otro es solo cambiar variables de entorno: **la misma imagen** sirve para ambos.
8. **Nunca inventes datos reales del club.** Usa los marcadores:

   | Marcador | Uso |
   |---|---|
   | `[COMPLETAR: …]` | Dato del club que no tenemos (dirección, cuota, teléfonos, títulos). |
   | `[DECIDIR: … Default: …]` | Decisión de producto pendiente, con el default aplicado mientras tanto. |
   | `[VERIFICAR: …]` | Supuesto técnico o normativo por confirmar. |

   `pnpm content:pending` lista todos los marcadores (código, seed y BD) y regenera `docs/pendientes-contenido.md`.

### Definición de terminado (toda tarea)

- Tipos, lint y pruebas en verde; e2e de los flujos afectados.
- Responsive en 360 / 768 / 1280 px; accesible (teclado, contraste AA, axe sin *serious/critical*).
- Textos en español de Chile; ningún dato del club inventado ni fijo en el código (viene de la BD o de Configuración).
- Presupuestos de rendimiento respetados (sección 10); sin secretos en el código.
- Documentación y este archivo actualizados si cambió un comando o una convención.

## 3. Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` / `pnpm start` | Build de producción (standalone, **sin acceso a la BD**) / arranque |
| `pnpm check` / `pnpm check:fix` | Biome (lint + formato) + `tsc --noEmit` / corrige formato y lint |
| `pnpm test` | Pruebas unitarias (Vitest) |
| `pnpm test:integration` | Integración contra PostgreSQL 18 real (base aparte `cachorros_test`, con el rol restringido) |
| `pnpm test:e2e` | Playwright (360×800 y 1280×800) + axe, contra el build de producción (`pnpm build` antes), en el puerto 3100; `seo.spec.ts` usa además una segunda instancia de la misma build en el 3101 (otro `SITE_URL`, `SITE_ENV=production`) |
| `pnpm db:generate` | Genera migraciones SQL con `drizzle-kit generate` (se revisan y se commitean) |
| `pnpm db:migrate` | Aplica migraciones con el migrador de `drizzle-orm` |
| `pnpm db:seed` / `pnpm db:reset` | Carga datos de ejemplo (idempotente; `--en-vivo`, `--hoy=AAAA-MM-DD`) / recrea la BD (solo desarrollo) |
| `pnpm lighthouse` | Lighthouse móvil de la portada (`pnpm build` y seed antes), en el puerto 3210; meta 90 / 95 / 95 / 95 |
| `pnpm admin:create` | Crea un administrador (no hay registro público); `--restablecer` cambia su contraseña |
| `pnpm content:pending` | Regenera `docs/pendientes-contenido.md` |
| `pnpm build:scripts` | Empaqueta `scripts/` con esbuild a `.mjs` autocontenidos |
| `node scripts/run.mjs share-preview` | Dibuja «Próximo partido» y «Programación» con datos de ejemplo en `tmp/tarjetas/` (revisar un diseño sin la BD) |
| `pnpm pwa:icons [archivo]` | Regenera los íconos de la PWA en `public/icons/` desde el escudo (por defecto `public/placeholder/escudo.svg`) |

Arranque local desde un clon limpio:

```powershell
pnpm i
docker compose -f compose.dev.yaml up -d   # PostgreSQL 18 (puerto 5439) + Mailpit (http://localhost:8025)
pnpm db:migrate
pnpm db:seed
pnpm admin:create
pnpm dev
```

### Entorno de desarrollo: Windows + PowerShell

El autor trabaja en Windows 11 con PowerShell; CI y producción corren en Linux. Por eso:

- Los scripts de `package.json` DEBEN ser multiplataforma: nada de `rm -rf`, `cp`, `VAR=valor comando` ni `&&` que
  dependa de un shell POSIX. La lógica no trivial va en `scripts/*.ts` y las variables se cargan desde `.env`.
- Los scripts de consola (`scripts/<nombre>.ts`) se ejecutan con `node scripts/run.mjs <nombre>`, que los empaqueta
  con esbuild (sin `tsx` ni otra dependencia). Para la imagen se empaquetan con `pnpm build:scripts`. Un script
  nuevo se registra en `scripts/lib/bundle.mjs`.
- PowerShell 5.1 no tiene `&&` / `||`: en documentación y ejemplos, un comando por línea.
- Finales de línea **LF** en todo el repo (`.gitattributes`); imprescindible para los `.sh`, el Caddyfile y los
  Dockerfile que se ejecutan en Linux.
- Los scripts de la VM (`deploy/*.sh`, `docker/ops/*`) son Bash y solo corren en Linux; no se ejecutan en local.
- Donde la especificación usa `openssl rand …`, el README DEBE dar el equivalente en PowerShell.
- Docker Desktop (backend WSL 2) para `compose.dev.yaml` y para probar la imagen.

## 4. Estructura del repositorio (sección 3.1)

```text
.
├── AGENTS.md · CLAUDE.md · README.md · CHANGELOG.md
├── compose.yaml · compose.dev.yaml · Dockerfile
├── docker/ops/        # imagen ops (respaldos, tareas programadas)
├── deploy/            # Caddyfile, scripts de VM
├── drizzle/           # migraciones SQL generadas y revisadas
├── docs/              # ESPECIFICACION.md, adr/, fases/, manuales, integraciones/
├── public/            # placeholder/, icons/
├── scripts/           # migrate, seed, create-admin, content-pending
├── src/
│   ├── app/           # (public)/ · admin/ · api/ · manifest.ts · robots.ts · sitemap.ts
│   ├── features/      # un módulo por dominio: queries.ts · actions.ts · schemas.ts · dto.ts · lib/ · components/
│   ├── components/    # ui/ (shadcn adaptado) · site/ · admin/
│   ├── db/            # schema/*.ts, relaciones, vistas, cliente
│   ├── lib/           # env, auth, permissions, cache-tags, clock, format, labels, rut, slug, logger, …
│   ├── styles/        # globals.css, tokens.css
│   ├── instrumentation.ts
│   └── proxy.ts
└── tests/             # unit/ · integration/ · e2e/ · load/
```

## 5. Convenciones de código

### TypeScript (3.2)

- `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`,
  `forceConsistentCasingInFileNames`.
- `any` prohibido (Biome `noExplicitAny` como error). `@ts-expect-error` solo con comentario que lo justifique; nunca
  `@ts-ignore`.
- Tipos inferidos desde Drizzle (`$inferSelect`, `$inferInsert`) y Zod (`z.infer`).
- DTOs públicos explícitos: **nunca** se envían filas de la BD al cliente.

### Server y Client Components (3.3)

- Server Components por defecto. `"use client"` solo en hojas interactivas, nunca en layouts ni páginas completas;
  cada uno con un comentario de una línea que explique por qué es cliente.
- Preferir HTML nativo (`<details>`, `popover`, `<dialog>`, filtros como `<form method="get">` o enlaces): las
  páginas públicas funcionan sin JavaScript.
- Al cliente solo DTOs serializables mínimos. Módulos de datos con `import 'server-only'`.
- Valores dependientes de la hora (cuenta regresiva, «hace 5 min») se calculan en el cliente después del montaje; el
  servidor renderiza un texto estático equivalente.
- **Sin `<Suspense>` ni `loading.tsx` alrededor de datos en el sitio público:** el contenido que llega por
  *streaming* necesita JavaScript para colocarse y la página quedaría en el *skeleton* sin JS. El único límite está
  en el layout raíz (envuelve `<html>`), así el HTML llega completo. El panel tampoco pone un `<Suspense>` con
  esqueleto por encima de su primera lectura dinámica: un esqueleto prerenderado sale con scripts sin el nonce de
  la CSP (9.3). Más abajo, dentro de una página ya dinámica, sí puede usarlo.
- Una ruta que no existe debe responder 404 real: no uses rutas comodín con `notFound()` (el estado ya se envió
  como 200). Una sección pública todavía no construida tiene su `page.tsx` con `<ComingSoon>` (`noindex`). La página 404
  (`src/app/not-found.tsx`) lleva el marco del sitio (`SiteFrame`) y lee los datos del club con
  `loadSiteOrFallback()`: si la base falla usa el respaldo, nunca responde 500.
- Las páginas de detalle (`/noticias/[slug]`, `/partidos/[slug]`, `/jugadores/[slug]`, `/plantel/[serie]`,
  `/tienda/[slug]`, `/eventos/[slug]`, `/galeria/[slug]`) reciben
  su 404 y su 301 desde `proxy.ts` (ADR 0008), que llama a `src/features/<dominio>/slug.ts`: **una sola consulta
  indexada**, con la misma regla de visibilidad que el DTO público; si la base falla, deja pasar. La página
  conserva su `notFound()` como segunda barrera. Una página de detalle nueva se agrega a `DETAIL_ROUTES` y al
  *matcher* (nunca `/api`, `/_next` ni `/media`), con su e2e sin JavaScript de 404 y 301.
- Tipografía sin saltos: `src/styles/fonts.css` define las fuentes de respaldo con el mismo ancho que Archivo
  (normal, 75 % y 62,5 %). Usa `font-display` para títulos al 75 % y `font-tight` para display y marcadores al
  62,5 %; no uses anchos en `ch` (cambian al cargar la fuente): usa `rem` o las clases `max-w-*`.
- Un contenedor `grid` con tablas o contenido ancho lleva `grid-cols-1` (`minmax(0, 1fr)`): así la tabla se
  desplaza dentro de su región (`role="region"` + `tabIndex={0}`) y no ensancha la página en el celular.
- Los escudos van dentro de `.crest` (`TeamCrest`, `ClubCrest`): en secciones `.theme-dark` reciben un disco blanco.
- Sobre fondo claro, el naranja `accent` no alcanza contraste: para texto, enlaces e indicadores usa
  `accent-strong` (o los tokens `--link` / `--focus`). Lo verifica `tests/unit/tokens-contrast.test.ts`.

### Datos y caché (3.4)

- Cada dominio vive en `src/features/<dominio>/`. Los componentes nunca consultan la BD directamente.
- Lecturas públicas con Cache Components: `"use cache"` + `cacheTag()` + `cacheLife()`.
- Tags centralizados y tipados en `src/lib/cache-tags.ts`. Toda mutación invalida el conjunto mínimo:
  `updateTag()` en Server Actions; `revalidateTag(tag, 'max')` en Route Handlers y tareas programadas.
- **`next build` no toca la BD:** las rutas con datos se resuelven en runtime (`await connection()` o APIs dinámicas
  dentro de `<Suspense>`). El CI compila sin BD.
- **En vivo (2.6, ADR 0005):** `/api/live/current` y `/api/live/[matchId]` sin `use cache` (la caché es la del
  borde: `s-maxage=10`), con ETag desde `share_version` y eventos compactos (`toLiveEvent`) para quedar en 2 KB.
  Toda acción que cambie un partido sube `share_version`. En el sitio, las islas usan `useLivePolling`
  (sin peticiones si no hay nada en vivo ni por comenzar); `LIVE_POLL_MS` lo acorta solo en desarrollo (e2e).
- **Consola en vivo (7.3):** toda acción pasa por la cola de `lib/offline-queue.ts` (se guarda antes de enviarse,
  sobrevive a una recarga y lo rechazado queda visible) y lleva su `clientEventId`. Las acciones del servidor
  deben ser idempotentes ante un reintento. La consola relee su estado con `leerConsola`, nunca con
  `router.refresh()` (un corte de señal durante un refresh recarga la página).
- **Tarjetas para redes (2.8):** `GET /api/share/[plantilla]/[id]/[formato]?v=<versión>` (`src/features/share/`).
  Se dibujan con `next/og` dentro de `runHeavy()` (`src/lib/heavy-queue.ts`, la cola de 1 que comparten Satori y
  sharp), se guardan en `SHARE_CACHE_DIR` por versión (`share_version` del partido; hash para el fin de semana y la
  noticia) y se sirven inmutables; sin versión o con una vieja, redirige a la vigente. Los datos pasan por los
  mismos DTO públicos (menores con nombre e inicial). `og:image` de partidos y noticias usa `matchOgImage` /
  `newsOgImage`. Las fuentes TTF llegan al standalone por `outputFileTracingIncludes`. Al rediseñar una
  plantilla, sube su revisión en `DESIGN_REVISION` (`lib/cards.ts`): cambia la URL y la caché se regenera. Los
  colores salen de `lib/brand.ts` (copia de `tokens.css`, verificada por `tests/unit/share-brand.test.ts`).
- **Publicación en Facebook (ADR 0009):** `src/features/social-publishing/`. Toda publicación es una fila de
  `social_publications` (único `(channel, kind, subject_key)`): se encola con `ON CONFLICT DO NOTHING` y se
  publica con `processPublication()`, que la toma con `FOR UPDATE SKIP LOCKED`; nunca se llama a la Graph API
  dentro de una transacción. `tick` encola y reintenta (`runSocialPublishing`). El texto sale de los mismos DTO
  de las tarjetas. Secretos solo en `.env` (`FACEBOOK_PAGE_ID`, `FACEBOOK_PAGE_TOKEN`); fuera de producción no se
  publica salvo `FACEBOOK_ALLOW_NON_PRODUCTION=true`. Las pruebas nunca llaman a Facebook: `fetch` simulado en
  integración y `tests/e2e/graph-mock.mjs` (puerto 3190) en las e2e.
- **Feed de redes (2.9):** curado en el panel → Redes sociales; la portada lee `socialFeed().latest()`
  (`src/features/social/provider.ts`). «Ver aquí» crea el iframe del embed oficial solo al tocarlo.
- **PWA (6.16):** `app/manifest.ts` en runtime, íconos en `public/icons/` y `public/sw.js`, que se registra como
  `/sw.js?v=<APP_VERSION>` solo fuera de desarrollo. Su regla (`swStrategy`) la prueba `tests/unit/sw.test.ts`
  desde el mismo archivo: una ruta nueva que no deba guardarse va en `SW_RULES.bypass`.
- **CSP (9.3), obligatoria:** la del sitio público es fija (`src/lib/csp.ts`, aplicada en `next.config.ts`); la
  del panel lleva un nonce por petición desde `proxy.ts`. Un dominio de terceros nuevo se agrega a la directiva que
  corresponda en `src/lib/csp.ts`; `tests/e2e/csp.spec.ts` falla con cualquier violación. Los reportes llegan a
  `POST /api/csp-report` y se registran resumidos. En `next dev` se agrega `'unsafe-eval'` (recarga en caliente);
  `upgrade-insecure-requests` lo suma Caddy en la VM.
- **Infraestructura (12):** `compose.yaml` y `deploy/` (Caddyfile, `deploy.sh`, `restore.sh`, `bootstrap-vm.sh`,
  `generar-env.sh`, `cloudflare-ips.sh`) son lo que corre en la VM; la guía es `docs/despliegue.md`. La imagen
  `ops` (`docker/ops/`, contexto propio) hace los respaldos cifrados con `age`, la prueba de restauración y las
  tareas programadas, y deja cada ejecución en `ops_runs` (lo lee «Estado del sistema»). El CI prueba las dos
  cosas: `probar-ops.sh` (remoto rclone local) y `probar-compose.sh` (la VM simulada con certificados de
  prueba). **Mínimo privilegio:** nada que corra en la VM toca Google Cloud (su cuenta de servicio solo ve el
  bucket); el firewall se actualiza desde el PC o con `cloudflare-ips.yml` (WIF). Las imágenes las publica
  `release.yml` en GHCR (`sha-<corto>`) después de Trivy.
- **Dos pasos obligatorios:** con `AUTH_REQUIRE_2FA=true`, `requirePanelUser` lleva a «Mi cuenta» y
  `requirePermission` rechaza todo lo que no sea `panel:access`. Una pantalla nueva que deba verse sin los dos
  pasos (solo «Mi cuenta») pasa `allowWithoutTwoFactor`.
- Tareas programadas: `GET /api/cron/tick` y `GET /api/cron/daily` con `Authorization: Bearer $CRON_SECRET`
  (`cronRejection()` en `src/lib/cron-auth.ts`). `tick` publica las noticias programadas y reintenta avisos;
  `daily` aplica la retención de datos personales. La lógica vive en el dominio (`src/features/news/publish-due.ts`) y es idempotente.
- Cero N+1; seleccionar solo las columnas necesarias. Pool `max: 5`.
- Migraciones con `drizzle-kit generate`, compatibles hacia atrás (*expand/contract*).
  **Prohibido `drizzle-kit push` fuera de desarrollo.**

### Patrón obligatorio de Server Actions (3.5)

1. Autorización: `requirePermission('…')` (siempre dentro de la acción).
2. Validación con Zod (`safeParse`, mensajes en español).
3. Escritura atómica en transacción, idempotente cuando corresponda.
4. Auditoría (`audit(tx, user, 'accion', meta)`) dentro de la misma transacción.
5. Invalidación mínima de tags.
6. Resultado tipado:
   `ActionResult<T> = { ok: true; data: T } | { ok: false; message: string; fieldErrors?: Record<string, string[]> }`.

Nunca se lanzan errores crudos al cliente: se registran con pino y se devuelve un mensaje claro en español.

La autorización se verifica **en cada Server Action, Route Handler y layout del panel**. `proxy.ts` solo hace
redirecciones optimistas del panel y decide el estado HTTP (404 / 301) de las páginas de detalle públicas
(ADR 0008): no es una barrera de seguridad; su *matcher* excluye `/api`, `/_next` y `/media`.

Las mutaciones del panel usan `mutate()` (`src/lib/entity-action.ts`), que aplica los seis pasos en un solo lugar:
cada acción aporta su permiso, su esquema, la escritura dentro de la transacción (`write`) y sus tags. Un rechazo
de negocio se lanza como `Rejection(mensaje, campo?)`; las restricciones de la BD que el usuario puede provocar
se traducen con `constraints`. Los ids que llegan enlazados desde el cliente se validan con `assertId()`.

### Panel (7)

- Cada pantalla verifica su permiso con `requirePanelUser('permiso')`. Un módulo nuevo se agrega a
  `src/components/admin/nav.ts` cuando su página existe.
- Formularios: `EntityForm` (`src/components/admin/entity-form.tsx`, react-hook-form + Zod) con el **mismo
  esquema** que valida la acción; el formulario envía los valores tal como están y el servidor los vuelve a validar.
  Las piezas de esquema están en `src/lib/form-schemas.ts` (un campo vacío llega como `''` y se guarda `null`).
- **Todo formulario del panel envuelve sus campos y botones en `<FormBody>`**
  (`src/components/admin/form-body.tsx`; `EntityForm` ya lo trae): nacen deshabilitados, con el aviso
  «Preparando el formulario…», y se habilitan cuando React toma el control. Así nada de lo que se escribe puede
  perderse ni enviarse como formulario nativo antes de la hidratación. Vale también para controles con estado
  fuera de un `<form>`. Lo cubre `tests/e2e/formularios.spec.ts`, que retiene los scripts de la página.
  `EntityForm` también trae los campos `richtext` (editor Tiptap, cargado con `import()` dinámico), `checkboxes`
  y el autoguardado (`autosave`, solo para borradores).
- Texto enriquecido: el documento del editor se valida y se reduce a la lista blanca con `richTextField()`
  (`src/lib/rich-text/`); se dibuja con `<RichText>` (`src/components/site/rich-text.tsx`), nodo por nodo, sin
  `dangerouslySetInnerHTML`. Un nodo nuevo se agrega en los tres lugares: `document.ts`, el editor y el render.
  Los videos van detrás de una fachada: nada de terceros se carga antes del clic. Lo mismo en todo el sitio:
  `YoutubeFacade` (`youtube-nocookie`, con miniatura propia), `MapFacade` (OpenStreetMap) y los videos de Facebook
  como enlace. Cada fachada tiene su e2e que intercepta la red y verifica que no sale nada antes del clic.
- Listas con `ResourceList` / `ResourceRow` (tarjetas en el celular), filtros como formulario GET (`ListToolbar`),
  acciones con `ActionButton` (confirmación en `<dialog>` para lo destructivo) y avisos con `useToast()`.
  Un módulo con varias pantallas usa `SectionTabs` (enlaces). Una mutación sin tags públicos (bandejas, padrón)
  igual refresca el panel: `mutate()` llama a `refresh()` cuando no invalida ningún tag.
- Slugs: `resolveSlug()` + `recordSlugChange()` (`src/lib/slug-redirects.ts`) dentro de la transacción.
- Imágenes: toda imagen que se asigna a algo visible pasa por `assertPublishableMedia()`
  (`src/features/media/guards.ts`); las subidas van por `POST /api/admin/media`, nunca por una Server Action.
  Los PDF de transparencia también (`kind=document`): se aceptan solo por su firma real (`isPdf()`, `file-type`),
  no se re-codifican y se sirven con `Content-Security-Policy: sandbox` y `nosniff`. En un formulario se suben con
  el campo `document` de `EntityForm`; el archivo de un documento debe ser `kind = 'documento'` y, si queda sin
  uso al reemplazarlo o eliminarlo, se borra con sus archivos.
- sharp se carga solo al procesar una imagen (`import()` dentro de `storeUploadedImage`). Para borrar archivos
  usa `src/features/media/files.ts` (`uploadsDir()`, `removeMediaFiles()`), que no arrastra sharp: así una acción
  que solo borra no lo carga.
- Una ruta de archivos que se decide en runtime (`UPLOADS_DIR`) lleva `/* turbopackIgnore: true */`; sin eso el
  build rastrea todo el proyecto y lo mete en la imagen.

### Formularios públicos (9.4)

- Socios, auspicios y contacto se envían a `POST /api/forms/[form]` (Route Handler, no Server Action: responde
  un 429 real y funciona sin JavaScript con PRG, `?enviado=1` / `?error=<código>`). Cada formulario se registra
  en `src/features/inbox/forms.ts` (bandeja, página, `action` de Turnstile, esquema y guardado).
- Orden de los controles: `Origin` igual a `SITE_URL` (CSRF) → rate limit (5 cada 10 min por formulario e IP)
  → campo trampa y tiempo mínimo firmado (3 s) → Turnstile (`success`, `hostname`, `action`) → Zod. Las piezas
  están en `src/lib/forms/`; los textos de error, en `messages.ts` (los mismos con y sin JavaScript).
- En la página: `<PublicForm {...publicFormProps('nombre')} …>` después de `connection()` (la clave pública de
  Turnstile llega desde el servidor y el formulario se firma por petición).
- Se guarda `ip_hash` (nunca la IP), `privacy_consent_at` y `privacy_policy_version`. El aviso por correo va en
  `after()` (`src/features/inbox/notify.ts`); si falla, la tarea `tick` lo reintenta hasta 5 veces.
- En las e2e, cada prueba envía su propia IP simulada en `x-e2e-client-ip` (solo se acepta con
  `SITE_ENV=development`): el rate limit es por IP y todas las pruebas salen de la misma máquina.
- La versión de la política de privacidad es la fecha de la última edición del bloque `privacidad.politica`
  (se muestra en `/privacidad` y se guarda con cada consentimiento).
- Bandejas del panel: piezas en `src/components/admin/inbox.tsx` (estado, responder por correo o WhatsApp,
  ficha con el consentimiento) e `InboxUpdateForm`. Las exportaciones CSV se registran en
  `src/features/inbox/exports.ts` y se descargan por `GET /api/admin/exportar/[lista]`: se generan con
  `toCsv()` (`src/lib/csv.ts`: `;`, BOM y fórmulas neutralizadas) y cada descarga se audita con el número de
  filas. La auditoría de datos personales anota números y estados, nunca nombres, RUT ni contacto.
- Padrón: el número de socio es correlativo (`nextMemberNumber()`, con `pg_advisory_xact_lock`) y no se edita.
  Aprobar una solicitud bloquea su fila (`FOR UPDATE`): dos aprobaciones simultáneas crean un solo socio.
- Auspiciadores: todo enlace público pasa por `/r/auspiciador/[slug]?a=web|instagram|whatsapp`, que suma el
  clic del día con un *upsert* (`sponsor_clicks_daily`, sin datos personales; no cuenta precargas ni HEAD) y
  redirige con 302. La vitrina y el contador usan la misma regla de vigencia (`isSponsorVisible()`). El slug
  se fija al crear el auspiciador y no cambia al renombrarlo: es el enlace que ya pudo compartirse.
- Tienda (6.8): sin pago en línea. «Pedir por WhatsApp» es un formulario GET a `/tienda/[slug]/pedido` (funciona
  sin JavaScript), que valida la talla y la cantidad contra el producto vigente y redirige a `wa.me` con
  `buildOrderMessage()` (`src/features/store/lib/order.ts`, el formato exacto de la especificación). Una talla se
  puede pedir según `isVariantOrderable()`: disponible y, si el producto controla stock, con unidades.
- Eventos (6.11): fecha y hora se escriben como hora de pared en Santiago (`santiagoWallTime`). Un evento es
  «próximo» mientras no termina y no se marcó realizado (la misma regla en la portada, el listado y el sitemap).
- Galería (6.5): un álbum con menores se publica solo con la confirmación de autorizaciones, que guarda quién y
  cuándo (`albums_minors_consent_check`); las fotos marcadas «contiene menores» no llegan al sitio. Lo interactivo
  (visor, «Copiar datos», afiche ampliado) funciona sin JavaScript: enlaces, texto seleccionable o `popover`.
- Datos personales (9.6): una tabla nueva con datos de personas se agrega a `PERSONAL_DATA_SOURCES`
  (`src/features/privacy/queries.ts`, para exportar y eliminar) y a la retención (`runRetention()`, tarea
  `GET /api/cron/daily`). El dato buscado viaja en el cuerpo (Server Action o POST), nunca en la URL.
  Procedimiento en `docs/seguridad-privacidad.md`.

### Menores de edad (6.3)

Los jugadores llegan al sitio público **solo** a través de `src/features/players/public.ts`
(`loadMinorIds` + `toPublicPlayerRef`): nombre e inicial, sin apodo, sin foto, sin ficha y sin fecha de nacimiento.
Ningún DTO público se arma leyendo `players` directamente.

### Errores y estados de carga (3.6)

- `global-error.tsx`, `error.tsx` por grupo, `not-found.tsx` con la identidad del club.
- `loading.tsx` y `<Suspense>` con *skeletons* que replican el layout final (CLS = 0).
- `instrumentation.ts` valida las variables de entorno al arrancar y registra errores con `onRequestError`.

### Configuración (3.7)

- **Prohibido `NEXT_PUBLIC_*`.** La configuración pública que necesita el navegador se entrega desde el servidor en
  runtime.
- Nada que dependa del entorno o de la BD se resuelve en build (`metadataBase`, canonical, sitemap, robots, manifest).
- `src/lib/env.ts` con `@t3-oss/env-nextjs` + Zod: solo variables de servidor, `emptyStringAsUndefined`;
  `SKIP_ENV_VALIDATION=1` únicamente en la etapa de build de Docker. Si falta una variable, la app no arranca y lo
  explica en español.
- Los datos del club viven en la BD (panel → Configuración), **no** en `.env`.

### SEO (11)

- Los metadatos se generan en runtime: el layout raíz usa `rootMetadata()` (`metadataBase` desde `SITE_URL`,
  `noindex` si `SITE_ENV ≠ production`) y cada página pública exporta `generateMetadata` con
  `pageMetadata({ title, description, path })` (`src/features/seo/metadata.ts`): canonical, Open Graph y Twitter
  con direcciones relativas que `metadataBase` vuelve absolutas. Nunca `export const metadata` con URLs.
- JSON-LD con los constructores puros de `src/features/seo/lib/json-ld.ts` y el componente `<JsonLd>` (el JSON
  va escapado como texto, sin `dangerouslySetInnerHTML`). Reciben DTOs públicos: un dato privado o un marcador
  `[COMPLETAR]` nunca llega a los datos estructurados.
- Una sección pública nueva se agrega a `getSitemapEntries()` (`src/features/seo/sitemap.ts`) con la misma regla
  de visibilidad que su página. Los jugadores pasan por `loadMinorIds`: ningún menor en el sitemap.

### Usuarios y seguridad (7.6)

- Las cuentas se invitan desde el panel (`invitarAdministrador`); no hay registro público.
- Lo que reemplaza la cookie de sesión (activar o desactivar los dos pasos, verificar el código al entrar) lo hace
  el navegador contra `/api/auth` y se audita en los *hooks* de `src/lib/auth/index.ts`. Todo lo demás (invitar,
  desactivar, cambiar la contraseña, cerrar sesiones) son Server Actions con `mutate()`.
- La auditoría guarda quién hizo qué, nunca valores sensibles: ni correos, ni datos bancarios, ni contraseñas.
- En un formulario, un marcador `[COMPLETAR: …]` se acepta tal cual (`isContentMarker`): el dato sigue en los
  pendientes hasta que el club lo complete.

### Fechas, dinero y formatos chilenos (3.8)

- Persistir `timestamptz` en UTC; mostrar y razonar en `America/Santiago` con `timeZone` explícito.
- Un único módulo `src/lib/format.ts` (`Intl` `es-CL`); cálculos con date-fns v4 + `@date-fns/tz`; reloj inyectable
  en `src/lib/clock.ts`.
- Dinero en CLP como `integer` → «$15.000». Teléfonos en E.164 (`toE164()` en `src/lib/phone.ts`, o
  `optionalPhone()` en un esquema). RUT con módulo 11 y formato `12.345.678-5`.

### Idioma y nombres (3.9)

- Código, tablas y columnas en inglés (`snake_case` en BD, `camelCase` en TS).
- Valores de enums del dominio en español `snake_case` sin tildes (`en_vivo`, `tarjeta_amarilla`).
- Etiquetas visibles centralizadas en `src/lib/labels.ts`.
- URLs y slugs en español: minúsculas, sin tildes, `ñ → n`, máximo 80 caracteres, únicos con sufijo `-2`, `-3`;
  cambiar un slug crea una redirección 301.
- Todo texto visible en español de Chile, con tuteo cercano y claro («celular», no «móvil»). Incluye shadcn/ui,
  mensajes de Zod (`z.config(z.locales.es())`), errores de Better Auth (mapeados) y `aria-label`.

### Calidad (3.10) y pruebas (3.11)

- Biome (lint + formato) con reglas estrictas; lefthook (`biome check` sobre *staged* + commitlint); Renovate semanal.
- **Antigüedad mínima de 7 días** para cualquier versión nueva: `minimumReleaseAge` en `pnpm-workspace.yaml` y en
  `renovate.json`. Next.js y TypeScript van fijados en versión exacta.
- `process.env` solo se lee en `src/lib/env.ts` (Biome `noProcessEnv`); el resto del código importa `env`.
- Parches de seguridad de Next.js y React: aplicar en ≤ 48 h.
- CI: `pnpm audit --prod` y Trivy (falla con CRITICAL).

| Nivel | Herramienta | Cubre |
|---|---|---|
| Unitario | Vitest | Lógica pura; cobertura ≥ 90 % en `src/features/*/lib` |
| Integración | Vitest + PostgreSQL 18 real | Queries y actions: transacciones, restricciones, vistas, idempotencia |
| E2E | Playwright (360×800 y 1280×800) | Flujos críticos de cada fase, incluida la navegación sin JavaScript |
| Accesibilidad | `@axe-core/playwright` | Sin violaciones *serious* ni *critical* |
| Rendimiento | Lighthouse CI | Presupuestos de la sección 10 |
| Carga | k6 | Escenario de la sección 10 (Fase 5) |

Convenciones de las pruebas:

- **Integración de acciones:** `tests/integration/next-mocks.ts` simula las cabeceras, la caché y la navegación de
  Next; `session.ts` da `actAs('admin' | 'prensa' | 'nadie')` e `invalidatedTags()`.
- **E2E:** todo lo que crean empieza con «E2E» (o usa fechas de partido desde la 40 y camisetas desde la 90);
  `scripts/e2e-clean.ts` lo borra antes de cada corrida. Las pruebas no escriben en la BD por fuera del panel: el
  panel es lo que invalida la caché. Se busca por rol (`getByRole`): Next conserva oculta la pantalla anterior y
  `getByLabel` / `getByText` también encuentran sus elementos. Para entrar a un módulo del panel usa
  `openModule()` (`tests/e2e/support.ts`; en el celular está dentro de «Más»). No fijes datos que otra prueba
  puede cambiar (por ejemplo, el WhatsApp de Configuración): revisa su forma. Un formulario público exige 3 s
  desde que se dibujó: espéralos antes de enviar.

### Logs (3.12)

- pino en JSON a stdout con `requestId`; nunca datos personales (emails y teléfonos enmascarados; IP solo como hash).
- `GET /api/health` → `{ status, db, version }` (503 si la BD no responde); sin secretos ni detalles internos.

## 6. Antes de tocar un área, lee

| Vas a trabajar en… | Sección de la especificación |
|---|---|
| Tiempo real, imágenes, tarjetas OG | 2.6, 2.7, 2.8 |
| Diseño, tokens, accesibilidad | 4 |
| Rutas y portada | 5 |
| Panel y modo en vivo | 7 |
| Esquema y reglas de dominio | 8 |
| Seguridad, privacidad, menores de edad | 9 (y 6.3) |
| Estado HTTP de las páginas de detalle (404 / 301) | ADR 0007 y ADR 0008 |
| Docker, Caddy, Cloudflare, respaldos | 12 |
| Criterios de aceptación de la fase | 14 |
| **Trampas conocidas** (léelas siempre) | 16 |
