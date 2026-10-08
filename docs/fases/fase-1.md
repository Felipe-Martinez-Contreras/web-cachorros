# Fase 1 — Modelo de datos, seed, sistema de diseño y portada · reporte de cierre

- **Rama:** `fase-1-diseno-y-portada`
- **Fecha:** 8 de octubre de 2026
- **Objetivo:** esquema completo, datos de ejemplo, sistema de diseño y la portada real funcionando con el seed.

## Qué quedó hecho

| Entregable | Estado | Dónde |
|---|---|---|
| Esquema completo, migraciones, vista de estadísticas y restricciones | Hecho | `src/db/schema/`, `drizzle/0001_modelo_completo.sql`, `drizzle/0002_vista_estadisticas.sql`, `docs/modelo-de-datos.md` |
| Reglas de dominio de 8.6 como lógica pura y probada | Hecho | `src/features/matches/lib/`, `src/features/players/lib/is-minor.ts` |
| Formatos chilenos, slugs, RUT, reloj inyectable, etiquetas y tags de caché | Hecho | `src/lib/` |
| Núcleo del pipeline de imágenes (adelantado de la Fase 2) | Hecho | `src/lib/images/`, `src/components/site/club-image.tsx`, `src/app/media/` |
| Seed completo (sección 13) | Hecho | `scripts/seed.ts`, `scripts/seed/` |
| `pnpm content:pending` | Hecho | `scripts/content-pending.ts`, `docs/pendientes-contenido.md` |
| Tokens, tipografía, componentes base, de partidos y de contenido | Hecho (alcance acordado) | `src/styles/`, `src/components/ui/`, `src/features/*/components/` |
| Layout público: encabezado, barra inferior, hoja «Más», pie | Hecho | `src/components/site/`, `src/app/(public)/layout.tsx` |
| `/admin/sistema-de-diseno` | Hecho | `src/app/admin/(panel)/sistema-de-diseno/` |
| Portada completa con datos del seed | Hecho | `src/app/(public)/page.tsx`, `src/components/site/home-sections.tsx` |
| `not-found`, `error` y placeholders | Hecho | `src/app/not-found.tsx`, `src/app/(public)/`, `public/placeholder/` |
| `loading` del sitio público | **No se hizo, a propósito** | Ver ADR 0007 |

## Criterios de aceptación

| Criterio | Resultado | Evidencia |
|---|---|---|
| `pnpm db:reset` y `pnpm db:seed` cargan todo; correr el seed dos veces no duplica | Cumple | `tests/integration/seed.test.ts` compara los conteos de 39 tablas tras la segunda corrida. También se corrió dentro de la imagen Docker contra una base vacía |
| Integración de las unicidades y restricciones de 8.6 | Cumple | `tests/integration/constraints.test.ts` (15 casos) y `stats-view.test.ts` (5) |
| Unitarias del marcador derivado, la tabla calculada e `isMinor` | Cumple | `tests/unit/matches-lib.test.ts`, `tests/unit/domain-lib.test.ts`; cobertura de `src/features/*/lib` ≈ 98 % |
| Test de contraste de tokens en verde | Cumple | `tests/unit/tokens-contrast.test.ts` (22 casos) |
| Portada correcta en 360, 768 y 1280 px, sin scroll horizontal ni CLS visible | Cumple | e2e: sin desborde y CLS ≤ 0,1 en los tres anchos (medido: 0 a 0,03) |
| Lighthouse móvil local ≥ 90 / 95 / 95 / 95 | **Parcial: rendimiento no llega** | Accesibilidad 100, Buenas prácticas 100, SEO 100. **Rendimiento bajo 90** en todas las mediciones locales (entre 42 y 84 según la carga de la máquina). Diagnóstico abajo; el CI lo mide ahora sin carga |
| Cuenta regresiva correcta en `America/Santiago`, incluido el cambio de horario, sin errores de hidratación | Cumple | Unitarias con las transiciones de abril y septiembre de 2026; la e2e de la portada falla ante cualquier error de consola |
| Navegación completa con teclado y foco visible; axe sin *serious/critical* | Cumple | e2e: enlace «Saltar al contenido», foco visible en cada parada, desplegable «Club», hoja «Más»; axe sin violaciones |
| Ningún dato del club inventado | Cumple | `docs/pendientes-contenido.md`: 197 marcadores (122 en la base, 75 en el código y el seed) y 6 campos de Configuración sin completar |

Totales: **99** pruebas unitarias, **51** de integración y **36** e2e (18 por viewport), todas en verde.
Las e2e corren contra el build en el puerto 3100 y nunca reutilizan un servidor que ya esté corriendo.
`pnpm check` y `pnpm build` en verde; el build se verificó además apuntando a una base inexistente.

### Lighthouse: diagnóstico del rendimiento

**No se alcanzó la meta de 90 en local.** La meta no se bajó: `pnpm lighthouse` sigue exigiendo 90 / 95 / 95 / 95.

| Medición (5 corridas, 4G lento y CPU ×4 aplicados) | Rendimiento | LCP | Índice de CPU de la máquina |
|---|---|---|---|
| Antes de optimizar, máquina con poca carga | 73 · 80 · 84 · 80 · 81 | 2,7–3,3 s | 1.700–2.180 |
| Después de optimizar, máquina cargada | 42 · 60 · 54 · 53 · 57 | 3,4–5,2 s | 610–910 |

Las dos filas **no son comparables**: en la segunda la máquina rendía menos de la mitad (el índice de CPU que
reporta Lighthouse bajó de ≈ 1.900 a ≈ 750; OneDrive estaba sincronizando y la CPU marcaba 76 % sin hacer nada).
Por eso las optimizaciones se compararon con una traza propia, alternando ambas variantes en el mismo momento.

**Elemento LCP en móvil:** la imagen del hero (`main#contenido > section > img`). Desglose de la mejor corrida
inicial:

| Fase | Tiempo | Qué significa |
|---|---|---|
| TTFB | ≈ 25 ms | El servidor responde de inmediato (consultas cacheadas) |
| Retraso de carga | ≈ 660 ms | Latencia de la red 4G lenta hasta que llega el `<head>` con la precarga |
| Tiempo de carga | ≈ 630 ms | Una petición más en 4G lento; la imagen pesa 2,5 KB |
| Retraso de render | ≈ 1.400 ms | **El problema:** la imagen ya llegó, pero el navegador aún no puede pintar |

Lo que se verificó, punto por punto:

- **Imagen del hero:** se precarga desde el `<head>` con prioridad alta y con `imagesrcset` / `sizes="100vw"`; en
  un celular de 412 px (densidad 1,75) elige la variante de 768 px. La de ejemplo pesa 2,2 KB (la mayor, de
  1.920 px, 8 KB): muy bajo los 180 KB. **Con una foto real hay que volver a medir**; el pipeline la limita a
  2.560 px y WebP calidad 78.
- **Error corregido:** la precarga de prioridad alta estaba puesta en el escudo del encabezado, no en el hero, y
  el `<picture>` impedía que React precargara la imagen. Ahora la lleva el hero.
- **JavaScript antes del LCP:** no lo bloquea. La hidratación (React y las islas `Countdown` y `NavLink`) corre
  después del primer pintado. Sí pesa en el TBT: ≈ 0,6–0,7 s de evaluación con CPU ×4.
- **Fuentes:** una sola (Archivo variable, 88 KB), precargada y con `display: swap`: no bloquea el pintado. Al
  llegar provoca un segundo layout (≈ 0,5 s con CPU ×4) después del LCP, que suma al TBT y explica el CLS de 0,03.
- **Causa del retraso de render:** (1) el CSS era una petición aparte que bloqueaba el primer pintado hasta
  ≈ 1,5 s; (2) el primer layout de la página completa tarda ≈ 0,9 s con CPU ×4 (≈ 900 cajas, con la fuente de
  respaldo porque la definitiva aún no llega).

Cambios aplicados y su efecto (traza propia, mismas condiciones, 4 corridas por variante):

| Cambio | Efecto en el LCP |
|---|---|
| CSS incrustado en el HTML (`experimental.inlineCss`) | De ≈ 3,1 s a ≈ 2,1 s (mediana). El HTML comprimido pasa de 30 KB a 55 KB |
| Quitar `content-visibility: auto` de las capas (lo había agregado yo) | El layout antes del primer pintado bajó a un tercio |
| Precarga en la imagen del hero y no en el escudo | La imagen se pide con el `<head>`, sin esperar al resto del HTML |

Lo que queda por hacer si el CI confirma que sigue bajo 90:

1. Reducir el costo del primer layout (menos nodos en la portada o diferir capas bajo el pliegue de otra forma).
2. Reducir el JavaScript de hidratación (TBT), por ejemplo quitando `NavLink` como componente de cliente.
3. Revisar el peso de la fuente (88 KB): compite por el ancho de banda con los scripts.

`inlineCss` es una opción experimental de Next: si da problemas se apaga en `next.config.ts` sin otro cambio.

**Medición sin carga:** el CI tiene ahora un job «Lighthouse móvil de la portada (informativo)» que carga el
seed, corre 5 veces, publica la tabla de puntajes y el desglose del LCP en el resumen del workflow y sube los
informes como artefacto `lighthouse`. No bloquea el PR. Se revisa de nuevo en la Fase 5 sobre el servidor real.

## Qué falta

1. **Rendimiento de Lighthouse** (arriba): la meta sigue en 90; se revisa con el job del CI y, en la Fase 5, sobre el servidor real.
2. **Foto del hero:** el escudo que dejaste en `public/placeholder/escudo.svg` ya está en uso; no había foto, así
   que el hero usa una imagen de ejemplo. Para cambiarla: deja `public/placeholder/hero.jpg` (y, opcional,
   `hero-movil.jpg`) y corre `pnpm db:seed`.
3. Confirmar con la directiva el color de acento y el ADR 0007 (ambos aprobados por ti el 8 de octubre de 2026).
4. La imagen Docker pesa **323 MB** (311 MB en la Fase 0; objetivo ≤ 250 MB en la Fase 5).

## Desviaciones y ADRs

- **[ADR 0007](../adr/0007-render-publico-sin-streaming.md) — aprobado.** La especificación pide
  `<Suspense>` con *skeletons* (3.6) y, a la vez, páginas públicas que funcionen sin JavaScript (3.3). Con
  *streaming*, sin JavaScript la portada se queda en los *skeletons*. Apliqué un único `<Suspense>` en el layout
  raíz: el HTML llega completo. Por eso no hay `loading.tsx` público. Es reversible.
- **Rutas provisionales explícitas, no una ruta comodín.** Con una ruta comodín, una dirección inexistente
  respondía 200. Cada sección por construir tiene su `page.tsx` «Próximamente» (29 archivos mínimos) y lo demás
  es un 404 real.
- **Una migración para el modelo completo**, no una por dominio como decía el plan: las claves foráneas cruzadas
  entre dominios (`matches` ↔ `albums`, `site_settings` → `series` y `sponsors`) obligaban a generarla junta.
- **Alcance de componentes** (acordado): quedan para su fase `PlayerCard`, `StaffCard`, `ProductCard`,
  `HistoryTimeline`, `GalleryGrid`, `Lightbox`, `VideoFacade`, `MapFacade`, `DocumentList`, `BoardMemberCard`,
  `CopyBlock` y `Breadcrumbs` (ninguna página de esta fase los usa).
- **`Toast`:** está el componente visual; la cola y el temporizador llegan con el panel (Fase 2).

## Decisiones que tomé (defaults)

Además de los 10 defaults del plan, ya aceptados:

1. **Color de acento `#f27604`**, tomado del león del escudo entregado. Sobre blanco no alcanza contraste ni
   para texto grande (2,9:1), así que la regla de 4.2 cambia: sobre fondo claro se usa `accent-strong`
   (`#b05500`, 5,1:1) para texto, enlaces e indicadores; `accent` queda para botones (texto negro encima) y
   secciones oscuras. `[VERIFICAR: color oficial con la directiva]`
2. **El texto secundario claro usa `neutral-600`**, no `neutral-500`: también va sobre fondos grises, donde 500
   no alcanza AA (lo detectó axe).
3. **Escudos sobre un disco blanco en las secciones oscuras:** el escudo tiene letras y trazos negros que
   desaparecerían sobre negro. No modifiqué el escudo.
4. **WhatsApp de ejemplo `+56900000000`** en Configuración, para que los botones se vean en la demo.
   `content:pending` lo reporta como pendiente.
5. **Coordenadas de ejemplo** de la cancha: el centro de la comuna, marcado `[COMPLETAR]`.
6. **Cuotas y precios de ejemplo** (3.000 / 5.000 / 1.500; productos entre 8.000 y 25.000), marcados
   `[COMPLETAR]` en su descripción.
7. **Ids deterministas en el seed** (además del slug): es lo que permite repetirlo sin duplicar en tablas sin slug.
8. **Partidos entre rivales con `score_locked = true`:** no tienen eventos, así que su marcador no se recalcula.
9. **Dos fuentes Archivo estáticas (OFL) en `src/assets/fonts/og/`:** las usa el seed para dibujar las imágenes
   de ejemplo (la imagen Docker no trae fuentes) y servirán para las tarjetas de la Fase 4.
10. **`/media/*` en desarrollo** lo sirve la app; con `SITE_ENV` distinto de `development` responde 404.
11. **`pnpm start` usa `scripts/start.mjs`:** el servidor standalone cambia de carpeta y las rutas relativas de
    `.env` dejaban de apuntar a `data/uploads`.
12. **Ícono del sitio** (`src/app/icon.png`) generado desde el escudo; los íconos de la PWA son de la Fase 4.
13. **Biome no revisa `public/`** (son archivos del club).
14. **Lighthouse en el puerto 3210 y e2e en el 3100:** con `pnpm dev` abierto en el 3000, ambas herramientas
    medían el servidor de desarrollo sin avisar.
15. **Lighthouse con red y CPU aplicadas** (`throttlingMethod: 'devtools'`), no simuladas: en localhost la
    simulación daba un LCP irreal. Con la simulada el rendimiento fue 0,64–0,83.

## Cómo probarlo

```powershell
docker compose -f compose.dev.yaml up -d
pnpm db:reset
pnpm db:seed
pnpm admin:create
pnpm dev
```

1. <http://localhost:3000> → portada completa. Prueba el celular (360 px): barra inferior y «Más».
2. `pnpm db:seed --en-vivo` y recarga (hasta 30 s de caché) → franja EN VIVO. `pnpm db:seed` la quita.
3. <http://localhost:3000/noticias> → «Próximamente». <http://localhost:3000/no-existe> → 404.
4. <http://localhost:3000/admin/sistema-de-diseno> → tokens y componentes con sus estados.
5. Desactiva JavaScript en el navegador y recarga la portada: el contenido sigue ahí.
6. `pnpm content:pending` → `docs/pendientes-contenido.md`.

Verificación completa:

```powershell
pnpm check
pnpm test
pnpm test:integration
pnpm build
pnpm test:e2e
pnpm lighthouse
```

## Capturas

| | 360 px | 1280 px |
|---|---|---|
| Portada | ![Portada a 360 px](capturas/fase-1/portada-360.png) | ![Portada a 1280 px](capturas/fase-1/portada-1280.png) |
| Portada completa | ![Portada completa a 360 px](capturas/fase-1/portada-completa-360.png) | ![Portada completa a 1280 px](capturas/fase-1/portada-completa-1280.png) |
| Sección provisional | ![Próximamente a 360 px](capturas/fase-1/proximamente-360.png) | ![Próximamente a 1280 px](capturas/fase-1/proximamente-1280.png) |
| Sistema de diseño | ![Sistema de diseño a 360 px](capturas/fase-1/sistema-de-diseno-360.png) | ![Sistema de diseño a 1280 px](capturas/fase-1/sistema-de-diseno-1280.png) |

En la captura completa a 360 px la barra inferior aparece a media página: es un efecto de la captura de página
entera con elementos fijos, no del sitio.

Se regeneran con `$env:CAPTURAS = 'fase-1'; pnpm test:e2e capturas`.

## Notas para la Fase 2

- `notFound()` en páginas de detalle responderá 200 con el esquema actual (ver ADR 0007): hay que resolverlo al
  construir `/noticias/[slug]` y `/partidos/[slug]`.
- La franja *matchday* se cachea 30 s; el polling llega en la Fase 4.
- En la imagen Docker, Pango no distingue la variante condensada de Archivo: los rótulos de las imágenes de
  ejemplo salen en la variante normal. Es solo estético y afecta únicamente a los placeholders.
- Las pruebas e2e cargan el seed al empezar: tardan unos 40 s más.
