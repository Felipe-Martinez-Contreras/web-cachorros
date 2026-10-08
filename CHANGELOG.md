# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Sin publicar]

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
