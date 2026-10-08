# ADR 0006 — Despliegue: una VM con Docker Compose detrás de Cloudflare

- **Estado:** aceptado (decisión vinculante de la especificación, secciones 2.1 y 12). Se completa en la Fase 5.
- **Fecha:** 2026-10-07

## Contexto

Presupuesto de infraestructura de US$ 0–20 al mes, disponibilidad ≥ 99,5 % y operación por personas no técnicas.

## Decisión

- Una VM de Google Compute Engine (e2-micro del free tier o e2-small) con Docker Compose: Caddy + app + PostgreSQL
  + ops.
- Las imágenes se construyen en GitHub Actions y se publican en GHCR: **nunca se compila en la VM**.
- Cloudflare delante (DNS, proxy, SSL Full strict con Origin CA, Authenticated Origin Pulls, caché, WAF).
- **Construir una vez, desplegar en cualquier dominio:** la imagen no contiene configuración de entorno. Pasar de
  staging a producción es cambiar variables.
- Respaldos diarios con `pg_dump` + rclone a Google Cloud Storage, cifrados con `age`.

Descartados: Kubernetes, Cloud Run y Cloud SQL (costo y complejidad).

## Estado en la Fase 0

- `Dockerfile` multi-stage inicial: construye sin base de datos ni variables de entorno, corre sin root (uid 1001)
  e incluye los scripts `migrate.mjs` y `create-admin.mjs` empaquetados con esbuild.
- El CI construye la imagen, aplica las migraciones contra un PostgreSQL 18 y comprueba `/api/health`.
- `compose.dev.yaml` solo para desarrollo (PostgreSQL 18 + Mailpit).

## Consecuencias

- La validación de variables ocurre al arrancar (`instrumentation.ts`), no al compilar: si falta una, el contenedor
  termina con un mensaje en español.
- «Docker Compose v2» en la especificación significa el plugin moderno `docker compose`; las versiones actuales
  del plugin (v5 en la máquina de desarrollo) son válidas.
- `compose.yaml`, Caddyfile, imagen `ops`, scripts de despliegue y `release.yml` llegan en la Fase 5.
- Riesgo principal: la RAM en e2-micro. Se mide con k6 en la Fase 5; el plan B es e2-small.
