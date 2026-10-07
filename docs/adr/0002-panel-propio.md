# ADR 0002 — Panel de administración propio

- **Estado:** aceptado (decisión vinculante de la especificación, sección 2.3)
- **Fecha:** 2026-10-07

## Contexto

El panel lo usarán 1–2 personas sin conocimientos técnicos, desde el celular y muchas veces en la cancha. Debe
permitir cargar un gol en 3 toques y convivir con la app en una VM de 1 GB.

## Opciones

| Opción | A favor | En contra |
|---|---|---|
| Payload CMS 3 | CRUD, medios y control de acceso listos | Más RAM y build más pesado; UX genérica; el esquema lo gobierna Payload |
| Directus | Panel maduro, API automática | Otro servicio Node de varios cientos de MB |
| PocketBase | Binario muy liviano | SQLite, panel para desarrolladores y en inglés, pre-1.0 |
| Strapi | Popular | Pesado para 1 GB |
| **Panel propio** (Next.js + Server Actions + shadcn/ui) | Cero procesos extra; UX a medida, en español y mobile-first; control total del modelo | Más código |

## Decisión

Panel propio dentro de la misma app Next.js, bajo `/admin`.

## Consecuencias

- El costo de escribir más código se mitiga con componentes CRUD genéricos (Fase 2).
- Toda mutación sigue el patrón obligatorio de Server Actions (especificación 3.5): autorización → validación →
  transacción → auditoría → invalidación → resultado tipado. La Fase 0 deja el patrón funcionando en
  `src/features/settings/actions.ts`.
- El panel es 100 % dinámico, sin caché y `noindex`.
