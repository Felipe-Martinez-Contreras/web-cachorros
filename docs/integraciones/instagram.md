# Feed de Instagram automático (pendiente)

En v1 el feed de redes de la portada es **curado** (especificación 2.9): desde el panel → Redes sociales se
pega el enlace de una publicación, se elige su imagen y, opcionalmente, se permite «Ver aquí» (el embed oficial
detrás de una fachada). No depende de ninguna API de Meta.

Esta guía describe cómo activar más adelante el proveedor `instagram_api` sin cambiar las páginas.

## Dónde se conecta

- `src/features/social/provider.ts` define `SocialFeedProvider` (`manual` | `instagram_api`) y `socialFeed()`,
  que hoy devuelve `manualFeed`.
- La portada solo llama a `socialFeed().latest(6)`. Una implementación nueva devuelve los mismos
  `SocialPostDTO` (imagen propia, extracto, enlace) y la portada no cambia.

## Requisitos de Meta

`[VERIFICAR requisitos vigentes de Meta al implementarla]`. Al escribir esta guía (octubre de 2026):

- Instagram Basic Display fue discontinuada en diciembre de 2024.
- La alternativa es la **Instagram API con inicio de sesión de Instagram** (o la Graph API vía Facebook Login),
  que exige:
  - Cuenta de Instagram **profesional** (empresa o creador) del club.
  - Una **app de Meta** en developers.facebook.com, con el producto Instagram y el permiso de lectura de
    contenido (`instagram_business_basic` o el vigente).
  - Un **token de larga duración**: vence a los 60 días y se renueva antes de vencer.
  - Posible **revisión de la app** por Meta si se piden permisos avanzados.

## Propuesta de implementación

1. Variables de servidor nuevas en `src/lib/env.ts` (nunca `NEXT_PUBLIC_*`): `INSTAGRAM_TOKEN` y, si aplica,
   `INSTAGRAM_USER_ID`.
2. Tarea programada (`GET /api/cron/daily`) que:
   - Lee las últimas publicaciones del endpoint de medios.
   - Descarga cada imagen y la pasa por el mismo pipeline de medios (`storeUploadedImage`): el sitio nunca
     enlaza imágenes de `cdninstagram.com`, que además caducan.
   - Guarda o actualiza filas en `social_posts` (sin publicar o publicadas, según se decida) e invalida el tag
     `social`.
   - Renueva el token cuando le quedan menos de 10 días y avisa por correo si falla.
3. `instagramFeed: SocialFeedProvider` lee de `social_posts` igual que `manual` (la tarea ya dejó todo en la
   base); `socialFeed()` elige según una opción de Configuración.
4. Pruebas: unitarias del mapeo de la respuesta de Meta y de integración de la tarea con una respuesta
   simulada.

## Mientras tanto

- Las publicaciones del seed tienen el enlace como `[COMPLETAR: URL de la publicación]`: aparecen en
  `docs/pendientes-contenido.md` hasta que el club pegue los enlaces reales.
- TikTok se muestra solo como enlace (sin embed en v1).
- Si se activa «Ver aquí», la CSP debe permitir el iframe de `https://www.instagram.com` o
  `https://www.facebook.com` en `frame-src` (especificación 9.3).
