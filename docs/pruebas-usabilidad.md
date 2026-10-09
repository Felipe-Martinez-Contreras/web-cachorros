# Prueba guiada con una persona no técnica

Criterio de aceptación de la Fase 2 (especificación, sección 14): una persona que no programa **crea una noticia
con foto desde el celular en 5 minutos o menos** y **carga un resultado completo en 3 minutos o menos**.

Este es el guion para tomar la prueba. No es una prueba automática: la hace una persona real, con un celular real,
mientras alguien la observa y toma el tiempo.

## Antes de empezar

| Qué | Detalle |
|---|---|
| Quién | Alguien de la directiva o un delegado que **no haya visto el panel antes**. Idealmente dos personas, por separado |
| Con qué | Su propio celular (Android o iPhone), con su navegador de siempre |
| Dónde | El sitio de pruebas (staging) o el computador de desarrollo por la red local |
| Datos | Los de ejemplo (`pnpm db:seed`). Antes de cada persona: `pnpm db:seed` de nuevo |
| Cuenta | Una cuenta propia, creada desde **Usuarios → Invitar a un administrador** |
| Material | Una foto cualquiera en la galería del celular y este guion impreso para quien observa |

Quien observa **no ayuda ni explica**. Si la persona se queda detenida más de 30 segundos, se anota dónde y se le
da solo la pista mínima para seguir. Se le pide que piense en voz alta.

Antes de tomar el tiempo, se le deja entrar al panel y mirar la pantalla de Inicio durante un minuto, sin tocar
nada más.

## Tarea 1 — Publicar una noticia con foto (meta: 5 minutos)

Se le lee textual:

> «El sábado el club hizo una completada y salió muy bien. Publica una noticia en el sitio contando eso, con una
> foto de tu celular. Avísame cuando creas que ya está publicada.»

El tiempo corre desde que termina la lectura hasta que dice «listo».

Camino esperado (no se le muestra):

1. Inicio → **Nueva noticia**.
2. Escribe el título.
3. **Foto principal → Elegir imagen → Subir una imagen nueva**, elige la foto, escribe su descripción y la sube.
4. Escribe dos o tres frases en el texto.
5. **Guardar borrador**.
6. **Publicar ahora → Sí, publicar**.

Se da por cumplida si, al abrir el sitio en otra pestaña, la noticia aparece en la portada con su foto.

## Tarea 2 — Cargar un resultado completo (meta: 3 minutos)

Antes, quien observa deja listo un partido de Honor ya jugado y sin resultado (**Partidos → Un partido**, con
fecha de ayer). Se le lee textual:

> «Ayer jugó la serie de Honor y ganó 2 a 1. Los goles del club los hicieron el número 9 y el número 10; al
> número 5 le sacaron tarjeta amarilla. Deja cargado ese resultado en el sitio.»

Camino esperado:

1. Inicio → en **Falta cargar el resultado**, **Cargar resultado**.
2. **Usar nómina del partido anterior**.
3. **Gol nuestro** → jugador 9 → confirmar. Lo mismo con el 10.
4. **Gol rival**.
5. **Tarjeta** → jugador 5 → amarilla.
6. **Finalizar partido** → confirmar el marcador 2–1.

Se da por cumplida si la portada del sitio muestra el partido con el marcador 2–1.

## Qué se anota

Una fila por persona y por tarea:

| Persona | Celular | Tarea | Tiempo | ¿La terminó sin ayuda? | Dónde dudó o se equivocó | Qué dijo |
|---|---|---|---|---|---|---|
| | | Noticia | | | | |
| | | Resultado | | | | |

Además, al terminar se le pregunta:

1. ¿Qué fue lo más difícil?
2. ¿Hubo alguna palabra que no entendiste?
3. ¿Te atreverías a hacerlo sola o solo el próximo fin de semana?

## Cómo se decide

- **Cumple:** las dos personas terminan ambas tareas dentro de la meta y sin ayuda.
- **Cumple con observaciones:** terminan dentro de la meta, pero dudan en el mismo paso. Ese paso se corrige
  (texto de un botón, orden de los campos) y no hace falta repetir la prueba completa.
- **No cumple:** alguna no termina, necesita ayuda o se pasa del tiempo. Se corrige lo observado y se repite con
  otra persona.

Los resultados se anotan en el reporte de la fase (`docs/fases/fase-2b.md`, sección «Prueba guiada»).

## Referencia

Las pruebas automáticas hacen estos mismos recorridos a 360 px de ancho: la noticia con foto, de punta a punta,
en unos 22 segundos, y el resultado completo en unos 25 segundos. Esos tiempos son los de un robot que ya conoce
el camino: sirven para saber que el recorrido es corto, no para reemplazar esta prueba.
