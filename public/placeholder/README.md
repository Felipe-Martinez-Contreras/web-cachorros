# Imágenes de ejemplo

Esta carpeta guarda las imágenes que el sitio usa mientras no existan las reales.

## Archivos que entrega el club

Si están aquí, `pnpm db:seed` los usa; si no, usa los genéricos.

| Archivo | Uso | Recomendación |
|---|---|---|
| `escudo.svg` (o `escudo.png`) | Escudo del club en todo el sitio | Vectorial o PNG con fondo transparente, de 1000 px o más |
| `hero.jpg` (o `.png`, `.webp`) | Foto principal de la portada | Horizontal, 2400 px de ancho o más |
| `hero-movil.jpg` | Foto de la portada en celulares (opcional) | Vertical, 1200 px de ancho o más |

Para reemplazarlos: copia el archivo nuevo con el mismo nombre y vuelve a correr `pnpm db:seed`
(no duplica datos; solo vuelve a procesar las imágenes). No uses fotos donde aparezcan menores de edad
mientras el club no defina su política de autorizaciones.

## Genéricos incluidos

| Archivo | Uso |
|---|---|
| `escudo-generico.svg` | Escudo de respaldo si no hay `escudo.*` y para equipos sin escudo |
| `jugador.svg` | Silueta para jugadores sin foto |

El resto de las imágenes de ejemplo (escudos de rivales ficticios, logos de auspiciadores, fotos de
noticias, afiches, productos y documentos PDF) las genera el seed en `scripts/seed/artwork.ts`, siempre
marcadas como «de ejemplo», y pasan por el mismo procesamiento que una foto subida desde el panel.
Desde la Fase 2 se reemplazan una a una en el panel → Biblioteca de medios.
