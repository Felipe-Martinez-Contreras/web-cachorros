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
| `pnpm test:e2e` | Playwright (360×800 y 1280×800) + axe, contra el build de producción (`pnpm build` antes), en el puerto 3100 |
| `pnpm db:generate` | Genera migraciones SQL con `drizzle-kit generate` (se revisan y se commitean) |
| `pnpm db:migrate` | Aplica migraciones con el migrador de `drizzle-orm` |
| `pnpm db:seed` / `pnpm db:reset` | Carga datos de ejemplo (idempotente; `--en-vivo`, `--hoy=AAAA-MM-DD`) / recrea la BD (solo desarrollo) |
| `pnpm lighthouse` | Lighthouse móvil de la portada (`pnpm build` y seed antes), en el puerto 3210; meta 90 / 95 / 95 / 95 |
| `pnpm admin:create` | Crea un administrador (no hay registro público); `--restablecer` cambia su contraseña |
| `pnpm content:pending` | Regenera `docs/pendientes-contenido.md` |
| `pnpm build:scripts` | Empaqueta `scripts/` con esbuild a `.mjs` autocontenidos |

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
  en el layout raíz (envuelve `<html>`), así el HTML llega completo. El panel sí puede usar `<Suspense>`.
- Una ruta que no existe debe responder 404 real: no uses rutas comodín con `notFound()` (el estado ya se envió
  como 200). Las secciones aún no construidas tienen su `page.tsx` con `<ComingSoon>`.
- Tipografía sin saltos: `src/styles/fonts.css` define las fuentes de respaldo con el mismo ancho que Archivo
  (normal, 75 % y 62,5 %). Usa `font-display` para títulos al 75 % y `font-tight` para display y marcadores al
  62,5 %; no uses anchos en `ch` (cambian al cargar la fuente): usa `rem` o las clases `max-w-*`.
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
redirecciones optimistas: no es una barrera de seguridad; su *matcher* excluye `/api`, `/_next` y `/media`.

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

### Fechas, dinero y formatos chilenos (3.8)

- Persistir `timestamptz` en UTC; mostrar y razonar en `America/Santiago` con `timeZone` explícito.
- Un único módulo `src/lib/format.ts` (`Intl` `es-CL`); cálculos con date-fns v4 + `@date-fns/tz`; reloj inyectable
  en `src/lib/clock.ts`.
- Dinero en CLP como `integer` → «$15.000». Teléfonos en E.164. RUT con módulo 11 y formato `12.345.678-5`.

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
| Docker, Caddy, Cloudflare, respaldos | 12 |
| Criterios de aceptación de la fase | 14 |
| **Trampas conocidas** (léelas siempre) | 16 |
