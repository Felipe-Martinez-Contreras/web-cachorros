# ADR 0001 — Framework: Next.js 16

- **Estado:** aceptado (decisión vinculante de la especificación, sección 2.2)
- **Fecha:** 2026-10-07

## Contexto

El sitio necesita SSR con caché e invalidación por tags, Open Graph dinámico, sitemap y manifest, y un panel con
formularios, todo en una VM de 1–2 GB de RAM mantenida por muy pocas personas.

## Opciones

| Opción | A favor | En contra |
|---|---|---|
| **Next.js 16** (App Router, RSC, Server Actions, Cache Components) | Caché con tags, `next/og`, `sitemap.ts` y `manifest.ts` nativos; un solo proceso para sitio + panel + API; ecosistema más amplio | 120–250 MB de RAM en runtime; más JS base |
| SvelteKit (adapter-node) | 50–100 MB de RAM, menos JS | Caché y OG manuales; menos gente que lo mantenga |
| React Router v7 | 70–150 MB de RAM | Caché y OG manuales |

## Decisión

Next.js 16 con `output: 'standalone'` y `cacheComponents: true`. Su costo de memoria se neutraliza con
arquitectura: build fuera de la VM, cero optimización de imágenes en runtime, límites por contenedor, swap y caché
en el borde.

Versión fijada exacta: **16.3.8** (decisión del arranque: se evitó la 16.4.0, publicada el día anterior).

## Consecuencias

- `next build` no puede tocar la BD: las rutas con datos usan `connection()` o APIs dinámicas dentro de `<Suspense>`.
  El CI lo verifica compilando sin BD ni variables de entorno.
- `proxy.ts` (ex `middleware.ts`) solo hace redirecciones optimistas; la autorización vive en cada acción y layout.
- Prohibido `NEXT_PUBLIC_*`: la misma imagen debe servir en cualquier dominio.
- Parches de seguridad de Next.js y React en 48 h o menos.
- **Salida de emergencia:** si en la Fase 5 la app supera su presupuesto de memoria en e2-micro, primero se sube a
  e2-small; cambiar de framework requiere un ADR nuevo.
