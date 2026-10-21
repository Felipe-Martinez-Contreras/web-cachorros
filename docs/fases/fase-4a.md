# Fase 4a — En vivo

- **Rama:** `fase-4a-en-vivo` · PR #11
- **Fecha:** 21 de octubre de 2026
- **Alcance:** hitos 1 a 5 del plan de la Fase 4: consola en vivo, `/api/live/*`, polling en el sitio y los
  criterios de tiempo real. La Fase 4 se cierra con el PR 4b (tarjetas para redes, feed curado, PWA y CSP).

## Qué quedó hecho

| Hito | Entregable | Dónde |
|---|---|---|
| 1 | **Dominio en vivo.** Pasos del partido (iniciar y terminar cada tiempo, alargue, penales) **idempotentes**: repetir un paso ya aplicado no avanza dos veces. Deshacer el último evento (solo si sigue siendo el último que veía la consola), editar un evento y suspender con motivo. Un evento registrado en vivo toma el período del partido | `src/features/matches/lib/live.ts`, `actions.ts` (`cambiarPeriodo`, `deshacerUltimoEvento`, `editarEvento`, `suspenderPartido`) |
| 2 | **`/api/live/current` y `/api/live/[matchId]`.** Estado mínimo, `serverNow`, ETag desde `share_version` (304 sin cambios) y `Cache-Control: public, max-age=0, s-maxage=10`. Eventos compactos: 20 eventos caben en 2 KB. Nombres de menores con inicial | `src/app/api/live/`, `src/features/matches/live-queries.ts`, `lib/live-poll.ts` |
| 3 | **Polling en el sitio.** `useLivePolling`: 20 s en vivo, 60 s si empieza en ≤ 30 min, **sin peticiones** en otro caso; pausa con la pestaña oculta, `If-None-Match`, *backoff* y reactivación al entrar en la ventana de 30 min. Franja de la portada y detalle del partido sin recargar; minuto en el cliente con `serverNow`; avisos `aria-live` de goles y eventos | `components/use-live-polling.ts`, `live-matchday.tsx`, `live-match.tsx`, `live-minute.tsx` |
| 4 | **Consola móvil** (`/admin/partidos/[id]/en-vivo`): nómina en la previa, botones grandes (gol del club con la grilla de la nómina, gol y autogol rival, tarjetas, cambios, comentarios, penal errado), deshacer, editar, eliminar, finalizar con confirmación del marcador y suspender. Minuto sugerido, Wake Lock y vibración. **Cola sin conexión** | `components/live-console.tsx`, `use-console-queue.ts`, `lib/offline-queue.ts` |
| 5 | **Criterios con dos navegadores**, sin conexión y del polling | `tests/e2e/en-vivo.spec.ts` |

**La cola sin conexión** (con el ajuste que pediste):
- Cada toque se guarda en el celular **antes** de enviarse (`localStorage`, por partido). Sobrevive a una
  recarga y se reintenta después.
- Se envía en orden al reconectar (evento `online` y cada 10 s). El id de cada acción es su `clientEventId`, así
  que el servidor ignora los duplicados.
- Si el servidor **rechaza** una acción, esta queda visible con su mensaje y las opciones «Reintentar» y
  «Descartar». Nunca se descarta en silencio.
- Si el celular no deja guardar (modo privado, almacenamiento lleno), la consola lo avisa.
- El marcador y el período se muestran de forma optimista mientras hay acciones pendientes.

## Criterios de aceptación de la Fase 4 que cubre este PR

| Criterio | Resultado | Evidencia |
|---|---|---|
| E2E con dos navegadores: el admin inicia, registra 2 goles y 1 tarjeta, deshace un evento y finaliza; la portada y el detalle reflejan cada cambio en ≤ 30 s sin recargar | ✅ | e2e `en-vivo.spec.ts` (1.ª prueba) |
| Sin conexión, las acciones se encolan, se envían al reconectar y no se duplican | ✅ | e2e `en-vivo.spec.ts` (2.ª prueba, también tras una recarga); unitarias `offline-queue.test.ts`; integración: el mismo `clientEventId` crea un solo evento y los pasos repetidos no avanzan |
| El polling se pausa con la pestaña oculta, se detiene al finalizar y no existe si no hay partidos en vivo ni por comenzar | ✅ | e2e `en-vivo.spec.ts` (cuenta las peticiones a `/api/live`); unitarias `live-poll.test.ts` |
| `/api/live/*`: ≤ 2 KB, con `ETag` y 304 sin cambios; p95 en el origen ≤ 50 ms | ✅ | integración `live-api.test.ts` (20 eventos ≤ 2 KB; 304; p95 de 100 peticiones con la BD real). La medición con k6 contra staging es de la Fase 5 |
| Tarjetas, feed curado, PWA y CSP | ⏳ PR 4b | — |

### Verificación

| Paso | Dónde | Resultado |
|---|---|---|
| `pnpm check` | local | en verde |
| `pnpm test` (unitarias) | local | 282 de 282 |
| `pnpm test:integration` | local | 225 de 225 |
| `pnpm build` (sin BD) | local | en verde |
| e2e de los hitos (workers=1) | local | en-vivo 6/6 · resultados y panel 18/18 · portada y deportes 40/40 |
| `pnpm test:e2e` completa e imagen Docker con memoria | CI del PR #11 | _se completa al revisar el CI_ |

## Desviaciones y decisiones

- **Polling con un *hook* propio, sin SWR.** La especificación menciona SWR, pero sería una dependencia nueva para
  un `fetch` con temporizadores. El *hook* cumple todo lo de 2.6 y está probado.
- **La consola relee su estado con una Server Action de lectura (`leerConsola`), no con `router.refresh()`.** En
  las pruebas sin conexión apareció un riesgo real: si la señal se corta durante un `router.refresh()`, Next hace
  una recarga completa y el celular queda en la página de error del navegador. Con la lectura por Server Action,
  un corte solo hace fallar la lectura.
- **Eventos compactos en `/api/live/[matchId]`** (claves cortas, sin campos vacíos). Con los eventos completos, 20
  eventos pesaban 4,5 KB, más del doble del límite de 2 KB. El cliente los expande para la cronología.
- **Intervalo corto en las e2e:** `LIVE_POLL_MS` (2 s) solo vale con `SITE_ENV=development`. En staging y
  producción siempre es el de la especificación.
- **Deshacer** borra el último evento **registrado** (no el de minuto mayor), y solo si es el que la consola tenía
  como último: si llegó otro desde otro celular, avisa y no borra nada. Un toque repetido no hace nada.
- **Permisos:** iniciar o terminar tiempos y suspender piden `matches:live`; los eventos siguen con
  `matches:write` (el mismo admin tiene los dos).
- **Editar y eliminar un evento** requieren conexión (la consola los deshabilita sin señal). Los goles, tarjetas,
  pasos, deshacer y finalizar sí se encolan.

## Qué falta

- **PR 4b:** tarjetas para redes, feed curado, PWA y CSP *Report-Only* (con tu ajuste: fija en `next.config` para
  el sitio público y con *nonce* en el proxy para el panel).
- **Quitar la excepción de antigüedad de `pnpm-workspace.yaml`** (`next` 16.4.2 y `react` 19.3.1) a partir del
  **23 de octubre**, en el PR 4b o en el próximo de dependencias.
- La prueba en un celular real en la cancha (señal intermitente, Wake Lock en Android e iOS).

## Cómo probarlo

```powershell
docker compose -f compose.dev.yaml up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

1. Panel → Partidos → un partido programado → «Iniciar en vivo».
2. Copia la nómina e «Iniciar 1.er tiempo». Registra un gol desde la grilla.
3. En otra ventana (o en el celular), abre `http://localhost:3000`: la franja muestra el partido en vivo y el gol
   llega solo, en unos 20 segundos.
4. En DevTools → Network → «Offline», registra dos goles: la consola dice «Sin conexión · 2 acciones
   pendientes». Recarga ya con conexión: se envían una sola vez.

## Capturas

En `docs/fases/capturas/fase-4a/`, a 360 y 1280 px: `panel-consola-previa`, `panel-consola-gol`,
`panel-consola-en-vivo`, `portada-en-vivo` y `partido-en-vivo`.

```powershell
$env:CAPTURAS = 'fase-4a'
pnpm test:e2e capturas
Remove-Item Env:CAPTURAS
```
