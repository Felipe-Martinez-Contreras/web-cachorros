# Pendientes de contenido

> Archivo generado por `pnpm content:pending`. No lo edites a mano: corrige el dato en el panel o en el
> código y vuelve a generarlo.

Marcadores que todavía están en el sitio (especificación, sección 0.3):

| Marcador | Significado | Cantidad |
|---|---|---|
| `[COMPLETAR: …]` | Dato del club que aún no tenemos | 219 |
| `[DECIDIR: …]` | Decisión de producto pendiente (rige el default) | 5 |
| `[VERIFICAR: …]` | Supuesto técnico o normativo por confirmar | 11 |

## En la base de datos

Es lo que ve el público hoy. Se corrige desde el panel.

| Marcador | Dónde |
|---|---|
| [COMPLETAR: año, serie y relato del título] | `honours.description` (×3) |
| [COMPLETAR: año] | `history_milestones.title` (×2) |
| [COMPLETAR: auspiciadores reales, niveles y enlaces] | `sponsors.description` (×4) |
| [COMPLETAR: banco] | `site_settings.bank_details` |
| [COMPLETAR: beneficios de cada tipo de socio] | `page_blocks.body` |
| [COMPLETAR: beneficios y valor del auspicio oficial] | `page_blocks.body` |
| [COMPLETAR: beneficios y valor del auspicio principal] | `page_blocks.body` |
| [COMPLETAR: beneficios y valor del colaborador] | `page_blocks.body` |
| [COMPLETAR: camiseta histórica, años en que se usó y foto] | `historic_kits.description` (×3) |
| [COMPLETAR: cómo se cambia de plan y desde cuándo rige] | `page_blocks.body` |
| [COMPLETAR: competencia] | `honours.competition_name` (×3) |
| [COMPLETAR: correo para comprobantes] | `site_settings.bank_details` |
| [COMPLETAR: costo mensual o matrícula, si la hay] | `page_blocks.body` |
| [COMPLETAR: cuota y beneficios reales de este tipo de socio; el valor mostrado es de ejemplo] | `membership_plans.benefits` (×3) |
| [COMPLETAR: datos reales de la camiseta] | `news.body`, `news.body_text` |
| [COMPLETAR: datos reales de la completada] | `news.body`, `news.body_text` |
| [COMPLETAR: descripción y fotos reales del producto] | `products.description` (×3) |
| [COMPLETAR: descripción, tela y fotos reales del producto] | `products.description` (×2) |
| [COMPLETAR: destino de los aportes y donaciones] | `page_blocks.body` |
| [COMPLETAR: dirección de la cancha] | `site_settings.address`, `venues.address` |
| [COMPLETAR: documento real del club] | `documents.description` (×3) |
| [COMPLETAR: edad mínima y categorías por año de nacimiento] | `page_blocks.body` |
| [COMPLETAR: época] | `hall_of_fame.era_label` (×3) |
| [COMPLETAR: filosofía de la escuela, categorías, edades, horarios, requisitos y costos] | `page_blocks.body` |
| [COMPLETAR: fotos reales del club] | `album_items.caption` (×12) |
| [COMPLETAR: fuente oficial de la tabla] | `standings_tables.source_note` (×6) |
| [COMPLETAR: horario real de entrenamiento] | `training_schedules.notes` (×12) |
| [COMPLETAR: información real de la escuela de fútbol] | `news.body`, `news.body_text` |
| [COMPLETAR: lugar del bingo] | `events.location_text` |
| [COMPLETAR: medidas de cada talla de adulto e infantil (ancho y largo en centímetros)] | `page_blocks.body` |
| [COMPLETAR: medios de pago de la cuota (transferencia, efectivo en la sede…)] | `page_blocks.body` |
| [COMPLETAR: nombre de la asociación] | `competitions.name` (×2), `competitions.organizer` (×2) |
| [COMPLETAR: nombre del ídolo] | `hall_of_fame.full_name` (×3) |
| [COMPLETAR: nombre y coordenadas exactas de la cancha] | `venues.notes` |
| [COMPLETAR: nombres de los proveedores] | `page_blocks.body` |
| [COMPLETAR: número de cuenta] | `site_settings.bank_details` |
| [COMPLETAR: personalidad jurídica, RUT, domicilio y representante legal del club] | `page_blocks.body` |
| [COMPLETAR: plazo] | `page_blocks.body` |
| [COMPLETAR: precio y tallas reales; los valores mostrados son de ejemplo] | `products.description` (×5) |
| [COMPLETAR: premios, valor del cartón y puntos de venta] | `events.description` |
| [COMPLETAR: procedimiento de renuncia según los estatutos] | `page_blocks.body` |
| [COMPLETAR: programa real de la celebración] | `events.description` |
| [COMPLETAR: relato de la fundación y nombres de los fundadores] | `history_milestones.body` |
| [COMPLETAR: relato de la historia del club] | `page_blocks.body` |
| [COMPLETAR: relato real del aniversario] | `news.body`, `news.body_text` |
| [COMPLETAR: relato, fecha exacta y foto de este hito] | `history_milestones.body` (×6) |
| [COMPLETAR: RUT del club] | `site_settings.bank_details` |
| [COMPLETAR: tipo de cuenta] | `site_settings.bank_details` |
| [COMPLETAR: titular de la cuenta] | `site_settings.bank_details` |
| [COMPLETAR: título o campeonato obtenido] | `honours.name` (×3) |
| [COMPLETAR: trayectoria en el club] | `hall_of_fame.bio` (×3) |
| [COMPLETAR: URL de la publicación] | `social_posts.permalink` (×6) |
| [COMPLETAR: URL del video] | `videos.url` (×2) |
| [COMPLETAR: valor de la adhesión] | `events.price_text` |
| [COMPLETAR: valor del cartón] | `events.price_text` |
| [COMPLETAR: valor del completo y de la promoción] | `events.price_text` |
| [COMPLETAR: valores, promociones y forma de reservar] | `events.description` |
| [VERIFICAR: con asesoría legal, Ley 19.628 y Ley 21.719] | `page_blocks.body` |
| [VERIFICAR: plazos con la directiva] | `page_blocks.body` |
| [VERIFICAR: política de fotos de menores con la directiva] | `page_blocks.body` |

### Configuración del club

- WhatsApp del club: tiene el número de ejemplo +56900000000.
- Teléfono del club: sin completar.
- Correo público: sin completar.
- Redes sociales: sin completar.

## En el código y en el seed

Los del seed (`scripts/seed/`) son el origen de los datos de ejemplo de la base. El resto son supuestos
y decisiones anotados junto al código que los aplica.

| Marcador | Dónde |
|---|---|
| [COMPLETAR: …] | `scripts/content-pending.ts:156`, `scripts/seed/data.ts:2`, `src/app/admin/(panel)/configuracion/page.tsx:38`, `src/features/pages/queries.ts:59`, `src/features/seo/lib/json-ld.ts:35`, `src/lib/form-schemas.ts:89`, `src/lib/markers.ts:4` |
| [COMPLETAR: año, serie y relato del título] | `scripts/seed/content.ts:317` |
| [COMPLETAR: año] | `scripts/seed/content.ts:283`, `scripts/seed/content.ts:289` |
| [COMPLETAR: auspiciadores reales, niveles y enlaces] | `scripts/seed/club.ts:158` |
| [COMPLETAR: banco] | `scripts/seed/club.ts:52` |
| [COMPLETAR: beneficios de cada tipo de socio] | `scripts/seed/content.ts:376` |
| [COMPLETAR: beneficios y valor del auspicio oficial] | `scripts/seed/content.ts:397` |
| [COMPLETAR: beneficios y valor del auspicio principal] | `scripts/seed/content.ts:396` |
| [COMPLETAR: beneficios y valor del colaborador] | `scripts/seed/content.ts:398` |
| [COMPLETAR: camiseta histórica, años en que se usó y foto] | `scripts/seed/content.ts:336` |
| [COMPLETAR: cómo se cambia de plan y desde cuándo rige] | `scripts/seed/content.ts:387` |
| [COMPLETAR: competencia] | `scripts/seed/content.ts:316` |
| [COMPLETAR: correo para comprobantes] | `scripts/seed/club.ts:55` |
| [COMPLETAR: correos de la directiva que reciben los avisos de cada formulario] | `scripts/seed/club.ts:69` |
| [COMPLETAR: costo mensual o matrícula, si la hay] | `scripts/seed/content.ts:361` |
| [COMPLETAR: cuota y beneficios reales de este tipo de socio; el valor mostrado es de ejemplo] | `scripts/seed/club.ts:232` |
| [COMPLETAR: datos reales de la camiseta] | `scripts/seed/content.ts:178` |
| [COMPLETAR: datos reales de la completada] | `scripts/seed/content.ts:150` |
| [COMPLETAR: descripción y fotos reales del producto] | `scripts/seed/data.ts:350`, `scripts/seed/data.ts:360`, `scripts/seed/data.ts:370` |
| [COMPLETAR: descripción, tela y fotos reales del producto] | `scripts/seed/data.ts:330`, `scripts/seed/data.ts:340` |
| [COMPLETAR: destino de los aportes y donaciones] | `scripts/seed/content.ts:404` |
| [COMPLETAR: dirección de la cancha] | `scripts/seed/club.ts:42`, `scripts/seed/sport.ts:191` |
| [COMPLETAR: documento real del club] | `scripts/seed/club.ts:339` |
| [COMPLETAR: duración de los tiempos por serie] | `scripts/seed/sport.ts:141` |
| [COMPLETAR: edad mínima y categorías por año de nacimiento] | `scripts/seed/content.ts:360` |
| [COMPLETAR: época] | `scripts/seed/content.ts:326` |
| [COMPLETAR: filosofía de la escuela, categorías, edades, horarios, requisitos y costos] | `scripts/seed/content.ts:353` |
| [COMPLETAR: fotos reales del club] | `scripts/seed/content.ts:99` |
| [COMPLETAR: fuente oficial de la tabla] | `scripts/seed/sport.ts:570` |
| [COMPLETAR: horario real de entrenamiento] | `scripts/seed/sport.ts:312` |
| [COMPLETAR: información real de la escuela de fútbol] | `scripts/seed/content.ts:164` |
| [COMPLETAR: link de pago real o vacío] | `scripts/seed/club.ts:47` |
| [COMPLETAR: lugar del bingo] | `scripts/seed/club.ts:136` |
| [COMPLETAR: medidas de cada talla de adulto e infantil (ancho y largo en centímetros)] | `scripts/seed/content.ts:371` |
| [COMPLETAR: medios de pago de la cuota (transferencia, efectivo en la sede…)] | `scripts/seed/content.ts:385` |
| [COMPLETAR: nombre de la asociación] | `scripts/seed/sport.ts:147`, `scripts/seed/sport.ts:153`, `scripts/seed/sport.ts:155` |
| [COMPLETAR: nombre del ídolo] | `scripts/seed/content.ts:325` |
| [COMPLETAR: nombre y coordenadas exactas de la cancha] | `scripts/seed/sport.ts:197` |
| [COMPLETAR: nombres de los proveedores] | `scripts/seed/content.ts:426` |
| [COMPLETAR: número de cuenta] | `scripts/seed/club.ts:54` |
| [COMPLETAR: personalidad jurídica, RUT, domicilio y representante legal del club] | `scripts/seed/content.ts:414` |
| [COMPLETAR: plazo] | `scripts/seed/content.ts:434` |
| [COMPLETAR: precio y tallas reales; los valores mostrados son de ejemplo] | `scripts/seed/club.ts:182` |
| [COMPLETAR: premios, valor del cartón y puntos de venta] | `scripts/seed/club.ts:140` |
| [COMPLETAR: procedimiento de renuncia según los estatutos] | `scripts/seed/content.ts:388` |
| [COMPLETAR: programa real de la celebración] | `scripts/seed/club.ts:105` |
| [COMPLETAR: reemplazar por el balance real del club] | `scripts/seed/media.ts:204` |
| [COMPLETAR: reemplazar por los estatutos vigentes del club] | `scripts/seed/media.ts:196` |
| [COMPLETAR: reemplazar por un acta real aprobada por la directiva] | `scripts/seed/media.ts:200` |
| [COMPLETAR: relato de la fundación y nombres de los fundadores] | `scripts/seed/content.ts:276` |
| [COMPLETAR: relato de la historia del club] | `scripts/seed/content.ts:347` |
| [COMPLETAR: relato real del aniversario] | `scripts/seed/content.ts:192` |
| [COMPLETAR: relato, fecha exacta y foto de este hito] | `scripts/seed/content.ts:269` |
| [COMPLETAR: RUT del club] | `scripts/seed/club.ts:51` |
| [COMPLETAR: tipo de cuenta] | `scripts/seed/club.ts:53` |
| [COMPLETAR: titular de la cuenta] | `scripts/seed/club.ts:50` |
| [COMPLETAR: título o campeonato obtenido] | `scripts/seed/content.ts:315` |
| [COMPLETAR: trayectoria en el club] | `scripts/seed/content.ts:327` |
| [COMPLETAR: URL de la publicación] | `scripts/seed/content.ts:259` |
| [COMPLETAR: URL del video] | `scripts/seed/content.ts:230`, `scripts/seed/content.ts:239` |
| [COMPLETAR: valor de la adhesión] | `scripts/seed/club.ts:107` |
| [COMPLETAR: valor del cartón] | `scripts/seed/club.ts:142` |
| [COMPLETAR: valor del completo y de la promoción] | `scripts/seed/club.ts:125` |
| [COMPLETAR: valores, promociones y forma de reservar] | `scripts/seed/club.ts:123` |
| [COMPLETAR: WhatsApp del club] | `scripts/seed/club.ts:40` |
| [COMPLETAR] | `.env.example:22`, `.env.example:70`, `.env.example:71`, `scripts/content-pending.ts:1`, `src/app/admin/(panel)/galeria/videos/[id]/page.tsx:30`, `src/features/gallery/queries.ts:174`, `src/features/sponsors/lib/links.ts:19`, `src/lib/links.ts:18` |
| [DECIDIR: …] | `scripts/content-pending.ts:157` |
| [DECIDIR: desempate en la tabla calculada. Default: PTS, DIF, GF y luego manual] | `src/features/matches/lib/standings.ts:33` |
| [DECIDIR: mini-tabla en la portada. Default: sí] | `src/features/matches/queries.ts:235` |
| [DECIDIR] | `scripts/content-pending.ts:1`, `src/features/inbox/retention.ts:7` |
| [VERIFICAR: …] | `scripts/content-pending.ts:158` |
| [VERIFICAR: cabecera X-Robots-Tag noindex en staging desde el Caddyfile, Fase 5] | `src/app/robots.ts:13` |
| [VERIFICAR: color oficial del club con la directiva] | `src/styles/tokens.css:6` |
| [VERIFICAR: con asesoría legal, Ley 19.628 y Ley 21.719] | `scripts/seed/content.ts:422` |
| [VERIFICAR: plazos con la directiva] | `scripts/seed/content.ts:430` |
| [VERIFICAR: política de fotos de menores con la directiva] | `scripts/seed/content.ts:364` |
| [VERIFICAR: puntos por triunfo y empate según el reglamento de la asociación] | `src/features/matches/lib/standings.ts:67` |
| [VERIFICAR] | `scripts/content-pending.ts:1` |
