# ADR 0004 — Autenticación y autorización: Better Auth

- **Estado:** aceptado (decisión vinculante de la especificación, sección 2.5)
- **Fecha:** 2026-10-07

## Contexto

Solo entran al panel los administradores de la directiva. No hay registro público ni login de socios en v1.

## Decisión

Better Auth con email + contraseña (hash scrypt), sesiones en la base de datos, plugin `admin` (columnas `role` y
`banned`) y rate limit con almacenamiento persistente.

- **Sin registro público** (`disableSignUp`). Los administradores se crean por consola: `pnpm admin:create`.
- `baseURL` y `trustedOrigins` se leen de `SITE_URL` en runtime.
- Contraseñas de 12 caracteres o más; enlace de recuperación válido 1 hora; sesiones de 7 días con renovación
  deslizante; al restablecer la contraseña se cierran las sesiones abiertas.
- **Autorización:** matriz de permisos en código (`src/lib/permissions.ts`, `can(user, 'matches:live')`). v1
  habilita solo `admin`; quedan declarados `editor`, `delegado` y `prensa` sin permisos.
- La autorización se verifica en cada Server Action y Route Handler (`requirePermission`) y en el layout del panel
  (`requirePanelUser`). `proxy.ts` solo redirige de forma optimista (precedente: CVE-2025-29927).

## Detalles de implementación (Fase 0)

- Los formularios de login, recuperación y cierre de sesión llaman a `/api/auth/*` con el cliente de Better Auth,
  no a Server Actions: así pasan por su rate limit, que solo actúa sobre peticiones HTTP.
- El rate limit se desactiva con `SITE_ENV=development` para no entorpecer las pruebas locales y e2e.
- Los errores de Better Auth se mapean a español en `src/lib/auth/errors.ts`; nunca se muestra su texto en inglés.
- El CLI ya no es `@better-auth/cli` (deprecado) sino el paquete `auth`: `pnpm dlx auth@<versión> generate`.

## Consecuencias

- 2FA TOTP queda para la Fase 2, junto con la gestión de usuarios (agrega una tabla y una columna vía migración).
- Turnstile en el login y la verificación de contraseñas filtradas se evalúan en la Fase 3, junto con el resto del
  anti-spam.
- `createAdmin` usa la API interna de Better Auth (`$context.internalAdapter`): al actualizar la librería hay que
  correr las pruebas de integración, que cubren ese camino.
