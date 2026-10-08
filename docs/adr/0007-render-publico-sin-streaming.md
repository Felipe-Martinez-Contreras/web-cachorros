# ADR 0007 — El sitio público entrega el HTML completo, sin *streaming* de `<Suspense>`

- **Estado:** aprobado el 8 de octubre de 2026 (pendiente de confirmación de la directiva)
- **Fecha:** 8 de octubre de 2026

## Contexto

Dos requisitos de la especificación chocan al implementarse con Cache Components:

1. **3.4 y trampa 2:** `next build` no toca la base de datos. Las rutas con datos se resuelven en runtime con
   `await connection()` «dentro de límites `<Suspense>`», y **3.6** pide `loading.tsx` y `<Suspense>` con
   *skeletons*.
2. **3.3 y criterios de la Fase 2:** las páginas públicas muestran su contenido **con JavaScript deshabilitado**.

Cuando el contenido queda detrás de un `<Suspense>` con respaldo, React envía primero el *skeleton* y después el
contenido real en un bloque oculto que un script en línea mueve a su lugar. Sin JavaScript ese script no corre:
la portada se queda en los *skeletons*. Lo detectó la prueba e2e sin JavaScript de la Fase 1.

Además, con el documento ya enviado, un `notFound()` posterior no puede cambiar el estado HTTP: la ruta
inexistente respondía 200.

## Opciones

| Opción | Sin JS | Build sin BD | Costo |
|---|---|---|---|
| A. `<Suspense>` por capa con *skeletons* (lo literal de 3.6) | **No funciona** | Sí | — |
| B. Un único `<Suspense fallback={null}>` en el layout raíz, envolviendo `<html>` | Sí | Sí | Sin *skeletons* ni pintado progresivo en el sitio público: el HTML llega cuando están todos los datos |
| C. Prerender estático con datos en el build | Sí | **No** (el build necesitaría la BD) | Rompe «construir una vez, desplegar en cualquier parte» |
| D. Quitar Cache Components y usar render dinámico clásico | Sí | Sí | Reabre una decisión de stack (2.1) |

## Propuesta

**Opción B.** El layout raíz envuelve el documento en un único `<Suspense fallback={null}>`. Como no hay nada que
mostrar antes, el servidor entrega el HTML terminado en una sola respuesta, sin bloques ocultos ni scripts de
reemplazo. Reglas que se derivan:

- En el sitio público no se usan `<Suspense>` ni `loading.tsx` alrededor de datos. Cada capa llama a
  `connection()` y a sus consultas con `"use cache"`; todas se resuelven en paralelo.
- Una dirección inexistente no pasa por una ruta comodín: no coincide con ninguna ruta y la atiende el
  `not-found` estático, con estado 404 real.
- El layout público declara `export const instant = false`: es la forma que documenta Next para indicar que
  una ruta bloquea en el servidor a propósito (sin eso, el modo desarrollo lo reporta como error).
- El panel (`/admin`) sí puede usar `<Suspense>` y *skeletons*: exige JavaScript de todos modos.

## Consecuencias

- **A favor:** contenido completo sin JavaScript; CLS = 0 en la portada (no hay reemplazo de *skeletons*); 404
  reales; el build sigue sin tocar la BD.
- **En contra:** el primer byte espera a la consulta más lenta. Con las consultas cacheadas por tags, la
  portada se sirve en ≈ 10–20 ms de servidor (≈ 160 ms en frío) en local; si una página futura tiene una
  consulta lenta, se nota completa.
- **Pendiente para la Fase 2:** en una página de detalle (`/noticias/[slug]`), un `notFound()` lanzado después
  de `connection()` sigue respondiendo 200. `[VERIFICAR: resolver la existencia del slug antes de enviar el
  documento, por ejemplo con una redirección desde el proxy o con la API que ofrezca Next para fijar el estado]`
- **Reversible:** volver a la opción A es mover el `<Suspense>` del layout raíz a cada capa (los *skeletons* de
  la portada se pueden recuperar del historial de la rama).
