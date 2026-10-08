# ADR 0003 — Datos: PostgreSQL 18 + Drizzle ORM

- **Estado:** aceptado (decisión vinculante de la especificación, sección 2.4)
- **Fecha:** 2026-10-07

## Contexto

El dominio (partidos, eventos, nóminas, tablas, estadísticas derivadas) pide integridad referencial, vistas y
respaldos estándar, dentro de un presupuesto de 256 MB para la base de datos.

## Opciones

- **PostgreSQL 18** frente a SQLite: integridad referencial, vistas, `uuidv7()` nativo y `pg_dump`.
- **Drizzle ORM** frente a Prisma: SQL explícito y tipado, sin motor adicional en runtime, migraciones SQL
  versionadas y revisables.

## Decisión

PostgreSQL 18 + Drizzle ORM con el driver `postgres` (postgres.js), pool `max: 5`.

Al arrancar (octubre de 2026) Drizzle 1.0 seguía en *release candidate* (rc.4), así que se usa el canal estable:
**drizzle-orm 0.45.x y drizzle-kit 0.31.x**. Las consultas críticas se escriben con el *query builder*.

## Consecuencias

- Migraciones con `drizzle-kit generate`: SQL revisado y commiteado en `drizzle/`. **Prohibido `drizzle-kit push`**
  fuera de desarrollo. Siempre *expand/contract* para permitir rollback.
- En producción las aplica `scripts/migrate.mjs` (servicio `migrate`), que además crea o actualiza el rol
  restringido de la app (`cachorros_app`, solo DML) a partir de `DATABASE_URL`.
- La app nunca se conecta como dueña del esquema: hay pruebas de integración que lo verifican.
- Las tablas de Better Auth las genera su CLI y son la excepción a las convenciones de la sección 8.1 (ids de
  texto); se ajustaron solo las fechas a `timestamptz`.
- PostgreSQL 18 en Docker guarda los datos en `/var/lib/postgresql/<versión>/docker`: el volumen se monta en
  `/var/lib/postgresql` (verificado con la imagen `postgres:18-alpine`).
- Adoptar Drizzle 1.0 cuando sea estable es una mejora futura (vía Renovate), no un requisito.
