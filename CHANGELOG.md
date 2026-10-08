# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Sin publicar]

### Fase 1 — Modelo de datos, seed, sistema de diseño y portada

- Modelo de datos completo (52 tablas): deporte, contenido, club y comunidad y biblioteca de medios, con sus
  restricciones y unicidades, y la vista de estadísticas `v_player_season_stats`.
- Reglas de dominio como lógica pura y probada: marcador derivado, tabla calculada, reloj del partido, cuenta
  regresiva en `America/Santiago` e `isMinor`. Formatos chilenos (fechas, CLP, teléfonos, RUT) y slugs.
- Núcleo del pipeline de imágenes con sharp (master, variantes WebP, LQIP, rasterizado de SVG) y `<ClubImage>`.
- `pnpm db:seed` (idempotente, determinista, con fechas relativas a hoy y opción `--en-vivo`) y
  `pnpm content:pending`, que regenera `docs/pendientes-contenido.md`.
- Sistema de diseño: tokens con el naranja del escudo y test de contraste, componentes base, de partidos y de
  contenido, íconos propios de fútbol y la página `/admin/sistema-de-diseno`.
- Layout público (encabezado, barra inferior con la hoja «Más», pie) y portada completa con los datos del seed,
  legible sin JavaScript; páginas «Próximamente» para las secciones que vienen.
- `pnpm lighthouse` para medir la portada en móvil.

### Fase 0 — Cimientos

- Proyecto Next.js 16 (App Router, Cache Components, `output: 'standalone'`) con TypeScript estricto y Tailwind v4.
- Calidad: Biome, lefthook, commitlint y Renovate (con antigüedad mínima de 7 días para nuevas versiones).
- Variables de entorno validadas al arrancar, con mensajes en español; logs en JSON con pino; `GET /api/health`.
- PostgreSQL 18 + Drizzle: primera migración (tablas de Better Auth, `audit_log`, `site_settings`, `ops_runs`) y
  rol restringido para la app.
- Panel: login, cierre de sesión y recuperación de contraseña por correo; layout `/admin` protegido; permisos en
  código; `pnpm admin:create`.
- Pruebas unitarias, de integración (PostgreSQL real) y e2e (Playwright + axe) a 360 px y 1280 px.
- `Dockerfile` multi-stage y CI en GitHub Actions (lint, tipos, pruebas, build sin base de datos, imagen).
- `AGENTS.md`, `CLAUDE.md`, ADRs 0001–0006 y README inicial.
