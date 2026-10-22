# Fase 5a — Infraestructura

- **Rama:** `fase-5a-infraestructura` · PR #13
- **Fecha:** 21 de octubre de 2026
- **Alcance:** hitos 1 a 4 del plan de la Fase 5. Todo se prueba en el CI, sin la VM. La Fase 5 se cierra con el
  PR 5b, ya con staging arriba: rendimiento, seguridad, simulacros, documentación y traspaso.

## Qué quedó hecho

| Hito | Entregable | Dónde |
|---|---|---|
| 1 | **Imagen `ops`** (12.2 y 12.8): `postgres:18-alpine` con rclone, age y supercronic. Respaldo diario (`pg_dump` verificado → cifrado con la clave pública → Cloud Storage con hash comprobado, y las imágenes con 30 días de historial), prueba de restauración semanal, chequeo de disco, tareas `tick`/`daily` y restauración real. Cada ejecución queda en `ops_runs` y avisa a healthchecks.io | `docker/ops/` |
| 2 | **`compose.yaml`, Caddyfile y scripts de la VM** (12.3 a 12.6): Origin CA y Authenticated Origin Pulls, cabeceras, `/media` desde el volumen, `/api/cron` cerrado y `noindex` fuera de producción. Scripts: despliegue con respaldo previo y vuelta automática, restauración, preparación de la VM y generación de `.env` | `compose.yaml`, `deploy/` |
| 3 | **`release.yml`** (GHCR + Trivy), **`deploy.yml`** (WIF + IAP) y **`cloudflare-ips.yml`** (firewall mensual con una cuenta de servicio propia) | `.github/workflows/` |
| 4 | **Producción en la app:** CSP obligatoria, `AUTH_REQUIRE_2FA`, beacon de Cloudflare Web Analytics, «Estado del sistema» en lenguaje simple y Lighthouse bloqueante en cuatro páginas | `src/lib/csp.ts`, `src/lib/auth/session.ts`, `src/features/system/`, `lighthouserc.cjs` |

**Tu ajuste de seguridad (mínimo privilegio):**
- La cuenta de servicio de la VM solo tiene `storage.objectAdmin` sobre el bucket de respaldos.
- `deploy/cloudflare-ips.sh` solo regenera el *snippet* de Caddy.
- La regla de firewall se actualiza desde tu PC (comando en `docs/despliegue.md`) o con el workflow mensual
  `cloudflare-ips.yml`, que usa WIF y una cuenta de servicio con un rol propio (solo leer y actualizar reglas de
  firewall).

## Cómo se prueba sin la VM

| Prueba en el CI | Qué verifica |
|---|---|
| `probar-ops.sh` (job de la imagen) | `tick` por la red interna. Respaldo cifrado que se descifra con la clave privada de prueba y es un volcado válido. Copia de imágenes. Prueba de restauración. Chequeo de disco. Un respaldo fallido queda como error en `ops_runs`. Restauración real (base más una imagen borrada) con la app detenida |
| `probar-compose.sh` (job «VM simulada») | `compose.yaml` y el Caddyfile reales con una CA de prueba que hace de Origin CA y de CA de AOP. Verifica, en orden: `caddy validate`; las cabeceras (incluidas la CSP de la app y `upgrade-insecure-requests` de Caddy); que sin el certificado de cliente no se entra; `/media` inmutable y `/api/cron` → 404; `deploy.sh` (ida, respaldo previo, *rollback* y vuelta automática ante una versión rota); que los datos de PostgreSQL 18 sobreviven a `down`/`up`; y `restore.sh local` |
| `shellcheck` | Todos los scripts de shell |
| Trivy | `cachorros-web` y `cachorros-ops`: falla con CRITICAL que tenga arreglo |
| Lighthouse | Portada, noticia, partido y plantel: la mediana de 5 corridas de cada una bloquea con 90 / 95 / 95 / 95 |

## Verificación

| Paso | Dónde | Resultado |
|---|---|---|
| `pnpm check` | local | en verde |
| `pnpm test` (unitarias) | local | 310 de 310 |
| `pnpm test:integration` | local | 242 de 242 |
| e2e de los hitos (`workers=1`) | local | `csp`, `pwa`, `sistema`, `en-vivo` y `redes` en verde |
| e2e completa (360 y 1280 px) | CI del PR #13 (`acffb43`) | 210 de 210, sin *flaky* |
| Integración y unitarias | CI del PR #13 | 242 de 242 · 310 de 310 |
| Imagen `ops`: tick, respaldo cifrado (se descifra), imágenes, prueba de restauración, disco, fallo registrado y restauración real | CI del PR #13 | todas en verde |
| VM simulada: compose, Caddy, AOP, `deploy.sh` (ida, rollback, versión rota), PG 18 y `restore.sh` | CI del PR #13 | 13 de 13 |
| Trivy (`cachorros-web` y `cachorros-ops`) | CI del PR #13 | sin CRITICAL con arreglo |
| Memoria con `--memory=512m` (seed, panel, fotos de 12 MP y 4 tarjetas) | CI del PR #13 | pico de 226 MB de 512 MB |
| Lighthouse móvil, mediana de 5 corridas (rendimiento / accesibilidad / buenas prácticas / SEO) | CI del PR #13 (`acffb43`) | portada 97 / 100 / 96 / 100 · noticia 98 / 100 / 96 / 100 · partido 98 / 100 / 96 / 100 · plantel 93 / 100 / 96 / 100 (CLS 0,116: pendiente) |

## Desviaciones y decisiones

- **`upgrade-insecure-requests` lo agrega Caddy**, no la app: en la app rompería el desarrollo y las e2e (que
  corren en `http://localhost`). Caddy lo suma a la CSP de la respuesta (cabecera diferida).
- **En `next dev`, la CSP permite `eval`:** la recarga en caliente lo necesita. En el build de producción, no.
- **`AUTH_REQUIRE_2FA=true`:** sin los dos pasos activos, el panel solo deja entrar a «Mi cuenta», con un aviso,
  y cualquier acción que no sea de la propia cuenta responde «Activa la verificación en dos pasos…».
- **El aviso del disco usa el mismo monitor de respaldos** (healthchecks.io → «falla»). Así no hace falta un
  tercer servicio; el siguiente respaldo correcto lo vuelve a «ok».
- **Trivy en imagen Docker fijada (0.76.0)**, no la acción de GitHub: menos piezas de terceros con permisos en
  el CI. Cuenta solo las CRITICAL con arreglo publicado.
- **El repositorio es público,** así que la VM lo clona con `git` y se actualiza con `git pull`. Si las imágenes de
  GHCR quedan privadas, `docker login` con un token de solo lectura (en la guía).
- **Correcciones que dejó el CI:**
  - la CSP de `next.config` ya no se aplica a `/media` ni a `/api` (pisaba el `sandbox` de los PDF);
  - `form-action` permite `wa.me` y `api.whatsapp.com` (el pedido de la tienda redirige a WhatsApp);
  - la imagen `ops` ya no trae `gosu` (CRITICAL de Go en Trivy; no se usa);
  - en el plantel, la primera fila de retratos se carga sin espera (el LCP bajó de 3,1 s a 1,2 s).
- **Arreglo en el panel:** con el layout sin esqueleto (Fase 4), la hoja «Más» del celular se podía abrir antes de
  la hidratación y se cerraba sola al hidratar. Ahora solo se cierra al cambiar de ruta.

**Pendiente documentado: CLS de `/plantel/honor`.** En el CI (Linux) mide **0,116**, sobre el presupuesto de 0,1 de
la sección 10, aunque su puntaje de rendimiento es **93**, sobre la meta de 90. Lighthouse lo atribuye a la llegada
de la fuente web; en Windows mide 0. Ya se aplicaron dos arreglos que no lo resolvieron: la cara regular de la
fuente de respaldo para Linux y Android en `fonts.css` (no cambió el valor) y la reserva de dos líneas para el
nombre del jugador. Se dejó de investigar por decisión del usuario, para cuidar créditos. La prueba
`deportes.spec.ts` («el plantel no se mueve cuando la fuente llega tarde») mide el CLS con la fuente retrasada y,
si falla, dice qué elemento se movió y cuánto: es el punto de partida para retomarlo.

## Qué falta (PR 5b)

- Staging arriba con tus pasos B1–B7 (`docs/despliegue.md`).
- k6 contra staging con la memoria y la CPU de la VM, y Lighthouse en staging.
- Revisión de seguridad y MDN Observatory ≥ A.
- Simulacros cronometrados (despliegue desde cero y restauración desde GCS) y cambio de dominio.
- CLS de `/plantel/honor` (0,116 en el CI), si se decide retomarlo.
- Documentación final: README, operación, arquitectura, manual del administrador y traspaso.
- Pruebas manuales de la Fase 4: WhatsApp, Sharing Debugger y PWA.
