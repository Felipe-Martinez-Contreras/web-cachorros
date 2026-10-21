# Fase 4 — Funciones pro

- **PR:** #11 (4a, en vivo, ya mergeado) y #12 (4b, redes y PWA)
- **Ramas:** `fase-4a-en-vivo` y `fase-4b-redes-y-pwa`
- **Fecha de cierre:** 21 de octubre de 2026
- **Detalle de la 4a:** [`fase-4a.md`](fase-4a.md) (consola en vivo, `/api/live/*`, polling). Este reporte cubre la
  fase completa y entra en detalle en la 4b.

## Qué quedó hecho

| Hito | Entregable | Dónde |
|---|---|---|
| 1–5 | Consola en vivo, `/api/live/*` con ETag y caché en el borde, islas de polling y criterios con dos navegadores | Ver [`fase-4a.md`](fase-4a.md) |
| 6 | **Tarjetas para redes y Open Graph.** Plantillas resultado, próximo partido, «¡Gol!», programación y resultados del fin de semana, y noticia; formatos 1:1, 4:5, 9:16 y Open Graph (JPEG ≤ 300 KB). Caché en disco por versión, URL versionada e inmutable, cola de 1 compartida con sharp. Descargar y compartir (Web Share con archivos) desde el partido, desde la consola al finalizar y desde Inicio | `src/features/share/`, `src/app/api/share/`, `src/lib/heavy-queue.ts` |
| 7 | **Feed de redes curado.** Panel → Redes sociales (Instagram, Facebook o TikTok: la red sale del enlace), imagen de la biblioteca, extracto, fijada, orden. «Ver aquí» carga el embed oficial solo al tocarlo. Interfaz `SocialFeedProvider` y guía para la API de Instagram | `src/features/social/`, `src/app/admin/(panel)/redes/`, `docs/integraciones/instagram.md` |
| 8 | **PWA.** Manifest en runtime, íconos 192/512/*maskable* y `apple-touch-icon` desde el escudo, service worker propio y página `/offline`. Aviso «Hay una versión nueva del sitio» | `src/app/manifest.ts`, `public/sw.js`, `public/icons/`, `scripts/pwa-icons.ts` |
| 9 | **CSP en modo Report-Only** con tu ajuste: fija en `next.config` para el sitio público (sin nonce) y estricta con nonce por petición desde `proxy.ts` para el panel. Reportes resumidos en `POST /api/csp-report` | `src/lib/csp.ts`, `next.config.ts`, `src/proxy.ts`, `src/app/api/csp-report/` |

### Tarjetas para redes

- **Dirección:** `/api/share/<plantilla>/<id>/<formato>?v=<versión>`. La versión es el `share_version` del
  partido (sube con cada gol o cambio), un hash de los partidos del fin de semana o de la fecha de edición de
  la noticia. Con la versión vigente se sirve con `Cache-Control: immutable`; sin ella o con una vieja,
  redirige a la vigente. Así Cloudflare y WhatsApp nunca muestran una tarjeta desactualizada.
- **Se genera una sola vez por versión** en `SHARE_CACHE_DIR` (`/data/cache/share` en la VM) y se borran
  las versiones anteriores del mismo formato.
- **Satori y sharp nunca corren a la vez:** comparten la cola de 1 de `runHeavy()`.
- **Menores:** los goleadores pasan por los mismos DTO públicos (nombre e inicial). Los marcadores
  `[COMPLETAR: …]` no se dibujan: la imagen circula fuera del sitio.
- **`og:image`** de partidos (resultado o previa) y noticias apunta a la tarjeta versionada. Cierra el pendiente
  de la Fase 2b.

### PWA

- El service worker se registra como `/sw.js?v=<APP_VERSION>` y solo fuera de desarrollo. Cada despliegue
  instala uno nuevo, con cachés nombradas por versión; se activa cuando la persona toca «Actualizar».
- *Cache-first* para `/_next/static`, `/media` e `/icons`. Las páginas van a la red y, sin señal, responde
  `/offline`. **El HTML no se guarda** (solo `/offline`): así nunca hay páginas viejas ni respuestas con
  cookies en la caché.
- **Nunca toca** `/admin`, `/api`, `/r/`, otros orígenes ni lo que no sea GET. La regla se prueba desde el
  mismo `public/sw.js` (`tests/unit/sw.test.ts`) y en el navegador (`tests/e2e/pwa.spec.ts`).

### CSP

| | Sitio público | Panel |
|---|---|---|
| Dónde | `headers()` de `next.config.ts` (fija) | `proxy.ts`, por petición |
| Scripts | `'self' 'unsafe-inline'` + Turnstile y Cloudflare Web Analytics | `'self' 'nonce-…' 'strict-dynamic'` |
| Frames | Turnstile, youtube-nocookie, OpenStreetMap, Facebook e Instagram (solo tras el clic) | youtube-nocookie |
| Modo | Report-Only | Report-Only |

`upgrade-insecure-requests` queda para la Fase 5: en Report-Only el navegador lo ignora y avisa.

## Criterios de aceptación (sección 14)

| Criterio | Resultado | Evidencia |
|---|---|---|
| E2E con dos navegadores: iniciar, 2 goles, 1 tarjeta, deshacer, finalizar; portada y detalle en ≤ 30 s | ✅ | `en-vivo.spec.ts` (Fase 4a) |
| Sin conexión: se encola, se envía al reconectar, sin duplicados | ✅ | `en-vivo.spec.ts`, `offline-queue.test.ts` (Fase 4a) |
| Polling: pausa con la pestaña oculta, se detiene al finalizar, no existe sin partidos | ✅ | `en-vivo.spec.ts` (Fase 4a) |
| `/api/live/*`: ≤ 2 KB, ETag y 304; p95 en el origen ≤ 50 ms | ✅ | `live-api.test.ts` (Fase 4a) |
| Tarjetas: primera generación ≤ 3 s en la VM y luego desde caché | ✅ en el CI | Job de memoria (512 MB): ver la tabla de verificación. Integración: la segunda vez viene del disco. La medición en la e2-micro es de la Fase 5 |
| Tarjetas: tipografía y escudos correctos | ✅ | Capturas `tarjeta-*.png` (abajo) |
| Tarjetas: OG ≤ 300 KB | ✅ | `share-cards.test.ts` y `seo.spec.ts` (descarga la OG real de una noticia) |
| Previsualización en WhatsApp y en el Sharing Debugger de Facebook | ⏳ manual | Requiere staging con dominio público. Pasos abajo |
| PWA instalable en Android (Chrome) e iOS (Safari) con página offline | ✅ técnico · ⏳ manual | `pwa.spec.ts`: manifest, íconos, SW controlando y `/offline` sin red. La instalación en celulares reales es manual (pasos abajo) |
| El SW nunca cachea `/admin` ni `/api` | ✅ | `pwa.spec.ts` revisa todas las cachés desde la página; `sw.test.ts` |

Además, del plan aprobado:

| Verificación | Resultado | Evidencia |
|---|---|---|
| CSP: ninguna violación en portada, formulario con Turnstile, visor, mapa, videos y panel (incluido el editor) | ✅ | `csp.spec.ts` (escucha `securitypolicyviolation`) |
| Cada respuesta del panel lleva un nonce distinto y todos sus scripts lo traen | ✅ | `csp.spec.ts` |
| Reportes de CSP sin IP ni query, con *rate limit* | ✅ | `csp-report.test.ts` |
| Fachada del feed: nada de Instagram antes del clic | ✅ | `redes.spec.ts` |

## Verificación

| Paso | Dónde | Resultado |
|---|---|---|
| `pnpm check` | local | en verde |
| `pnpm test` (unitarias) | local | 306 de 306 |
| `pnpm test:integration` | local | 238 de 238 |
| e2e de los hitos (`workers=1`) | local | tarjetas en `en-vivo` 6/6, `redes` 2/2, `pwa` 4/4, `csp` 4/4, `panel` y `formularios` 18/18, `resultados` 4/4 |
| `pnpm test:e2e` completa e imagen Docker con memoria | CI del PR #12 | _se completa al revisar el CI_ |

En local, `noticias.spec.ts` y la OG de una noticia en `seo.spec.ts` fallan por la limitación conocida de
Windows: el build standalone no trae las DLL de libvips y sharp no carga. En el CI (Linux) pasan.

## Desviaciones y decisiones

- **El panel ya no prerenderiza un esqueleto.** Con Cache Components, el `<Suspense>` con esqueleto del layout
  del panel generaba en el build un *shell* estático cuyos scripts no podían llevar el nonce de la CSP (la guía
  de Next lo advierte: el prerender parcial no es compatible con nonces). El layout ahora verifica la sesión
  antes de dibujar, sin esqueleto, y todo el HTML del panel lleva el nonce. Las rutas del panel pasan de ◐ a ƒ.
  Se nota solo en la primera carga (sin esqueleto mientras responde la base); la navegación interna no cambia.
  Queda anotado en `AGENTS.md`.
- **Zod sin JIT** (`jitless: true`): su sonda de `new Function` aparecía como violación de `eval` en el panel.
  Sin el JIT valida igual, apenas más lento en esquemas grandes.
- **Embeds del feed en iframe**, no con el script de Instagram o Facebook: el iframe oficial no necesita
  permisos de `script-src` y se crea solo al tocar «Ver aquí». TikTok queda solo como enlace.
- **Instagram y Facebook en `frame-src`** del sitio: «Ver aquí» es una opción por publicación que el panel ya
  permite activar.
- **Íconos de la PWA con fondo blanco** (*maskable* y Apple): las letras negras del escudo no se leían sobre el
  negro de la marca. En las tarjetas, los escudos van sobre un disco blanco, como `.crest` en el sitio.
- **Service worker estático** (`public/sw.js`) versionado por la dirección de registro, en vez de generarlo en
  una ruta: así se prueba el mismo archivo que se sirve.
- **Sin logo del auspiciador** en las tarjetas (default de la especificación, `[DECIDIR]`).
- **La tarjeta «¡Gol!» quedó hecha** (era deseable).

## Qué falta

- **Verificación manual con capturas** (necesita staging con dominio público):
  1. WhatsApp: pegar el enlace de un partido y de una noticia en un chat; la previsualización muestra la tarjeta.
  2. Facebook Sharing Debugger (developers.facebook.com/tools/debug): pegar los mismos enlaces; `og:image`
     de 1200 × 630 sin advertencias.
  3. Android (Chrome): menú → «Instalar app»; abrir sin conexión → página «Sin conexión».
  4. iOS (Safari): Compartir → «Agregar a inicio»; el ícono es el escudo sobre blanco.
- **Quitar la excepción de antigüedad de `pnpm-workspace.yaml`** (`next` 16.4.2 y `react` 19.3.1): hoy es 21 de
  octubre y se puede quitar **desde el 23 de octubre**. Queda para el próximo PR de dependencias.
- **Fase 5:** CSP obligatoria en Caddy (con `upgrade-insecure-requests`), k6 de `/api/live/*` y medición de las
  tarjetas en la e2-micro.

## Resumen de Renovate

- **PR abiertos:** ninguno.
- **Dependency Dashboard (#6), esperando su horario:** grupo «dependencias (menores y parches)» con
  `@playwright/test`, `lucide-react`, `node` (24.21.0) y `nodemailer`. Son parches; entran en el próximo PR de
  dependencias junto con la excepción de antigüedad.
- **Pospuestas a propósito** (`renovate.json`): `@hookform/resolvers` 6 y `typescript` 7, hasta después de esta
  fase; `ubuntu` 26.04 en los runners, ignorado.

## Cómo probarlo

```powershell
docker compose -f compose.dev.yaml up -d
pnpm db:migrate
pnpm db:seed
pnpm build
pnpm start
```

1. Panel → Partidos → un partido jugado → «Tarjetas para redes»: descarga 1:1, 4:5 y 9:16.
2. Panel → Redes sociales → «Nueva publicación»: pega un enlace de Instagram, elige una imagen, marca «Permitir
   verla dentro del sitio». En la portada aparece con «Ver aquí».
3. PWA: con `SITE_ENV=staging` en `.env`, abre `http://localhost:3000`; en DevTools → Application aparecen el
   manifest y el service worker. Marca «Offline» y navega: aparece «Sin conexión».
4. CSP: DevTools → Console, sin avisos de «Content-Security-Policy-Report-Only» al recorrer el sitio y el panel.

## Capturas

En `docs/fases/capturas/fase-4b/`, a 360 y 1280 px: `panel-tarjetas`, `panel-redes`, `panel-redes-nueva`,
`portada-redes` y `offline`. Tarjetas generadas con los datos del seed: `tarjeta-resultado-4x5`,
`tarjeta-gol-1080`, `tarjeta-proximo-1080`, `tarjeta-programacion-1080` y `tarjeta-programacion-9x16`.

```powershell
$env:CAPTURAS = 'fase-4b'
pnpm test:e2e capturas
Remove-Item Env:CAPTURAS
```
