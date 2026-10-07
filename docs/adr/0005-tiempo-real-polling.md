# ADR 0005 — Tiempo real: polling con micro-caché en el borde

- **Estado:** aceptado (decisión vinculante de la especificación, sección 2.6). Se implementa en la Fase 4.
- **Fecha:** 2026-10-07

## Contexto

Los hinchas siguen el marcador en vivo desde el celular, con mala señal. El origen es una VM de 1 GB: su carga no
puede crecer con la audiencia.

## Opciones

| | Polling + caché en el borde | SSE | WebSockets |
|---|---|---|---|
| Conexiones al origen | ≈ 1 cada 10 s por URL y por PoP de Cloudflare | 1 persistente por espectador | 1 persistente por espectador |
| RAM / CPU en e2-micro | Constante | Crece con la audiencia | Crece con la audiencia |
| Latencia percibida | ≤ ~30 s | ~1 s | ~1 s |
| Tolerancia a mala señal | Alta | Media | Media |

## Decisión

Polling liviano: `GET /api/live/current` y `GET /api/live/[matchId]` (JSON ≤ 2 KB con `serverNow`), con
`Cache-Control: public, max-age=0, s-maxage=10` + `ETag`, cacheados por Cloudflare. El cliente (SWR) sondea cada
20 s con partido en vivo, cada 60 s si empieza en 30 min o menos, y nunca en otro caso.

## Consecuencias

- 30 s de latencia son aceptables en fútbol amateur; a cambio la carga del origen es constante.
- Requiere una regla de caché en Cloudflare para `/api/live/*` (Fase 5).
- SSE, WebSockets y Redis quedan descartados explícitamente (sección 2.11).
