# Pendientes de contenido

> Archivo generado por `pnpm content:pending`. No lo edites a mano: corrige el dato en el panel o en el
> código y vuelve a generarlo.

Marcadores que todavía están en el sitio (especificación, sección 0.3):

| Marcador | Significado | Cantidad |
|---|---|---|
| `[COMPLETAR: …]` | Dato del club que aún no tenemos | 187 |
| `[DECIDIR: …]` | Decisión de producto pendiente (rige el default) | 4 |
| `[VERIFICAR: …]` | Supuesto técnico o normativo por confirmar | 6 |

## En la base de datos

Es lo que ve el público hoy. Se corrige desde el panel.

| Marcador | Dónde |
|---|---|
| [COMPLETAR: año, serie y relato del título] | `honours.description` (×3) |
| [COMPLETAR: año] | `history_milestones.title` (×2) |
| [COMPLETAR: auspiciadores reales, niveles y enlaces] | `sponsors.description` (×4) |
| [COMPLETAR: banco] | `site_settings.bank_details` |
| [COMPLETAR: beneficios de cada tipo de socio] | `page_blocks.body` |
| [COMPLETAR: camiseta histórica, años en que se usó y foto] | `historic_kits.description` (×3) |
| [COMPLETAR: competencia] | `honours.competition_name` (×3) |
| [COMPLETAR: correo para comprobantes] | `site_settings.bank_details` |
| [COMPLETAR: cuota y beneficios reales de este tipo de socio; el valor mostrado es de ejemplo] | `membership_plans.benefits` (×3) |
| [COMPLETAR: datos legales del club (personalidad jurídica, RUT, representante) y texto revisado de la política] | `page_blocks.body` |
| [COMPLETAR: datos reales de la camiseta] | `news.body`, `news.body_text` |
| [COMPLETAR: datos reales de la completada] | `news.body`, `news.body_text` |
| [COMPLETAR: descripción y fotos reales del producto] | `products.description` (×3) |
| [COMPLETAR: descripción, tela y fotos reales del producto] | `products.description` (×2) |
| [COMPLETAR: destino de los aportes y donaciones] | `page_blocks.body` |
| [COMPLETAR: dirección de la cancha] | `site_settings.address`, `venues.address` |
| [COMPLETAR: documento real del club] | `documents.description` (×3) |
| [COMPLETAR: época] | `hall_of_fame.era_label` (×3) |
| [COMPLETAR: filosofía de la escuela, categorías, edades, horarios, requisitos y costos] | `page_blocks.body` |
| [COMPLETAR: fotos reales del club] | `album_items.caption` (×12) |
| [COMPLETAR: fuente oficial de la tabla] | `standings_tables.source_note` (×6) |
| [COMPLETAR: horario real de entrenamiento] | `training_schedules.notes` (×12) |
| [COMPLETAR: información real de la escuela de fútbol] | `news.body`, `news.body_text` |
| [COMPLETAR: lugar del bingo] | `events.location_text` |
| [COMPLETAR: nombre de la asociación] | `competitions.name` (×2), `competitions.organizer` (×2) |
| [COMPLETAR: nombre del ídolo] | `hall_of_fame.full_name` (×3) |
| [COMPLETAR: nombre y coordenadas exactas de la cancha] | `venues.notes` |
| [COMPLETAR: número de cuenta] | `site_settings.bank_details` |
| [COMPLETAR: precio y tallas reales; los valores mostrados son de ejemplo] | `products.description` (×5) |
| [COMPLETAR: premios, valor del cartón y puntos de venta] | `events.description` |
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

### Configuración del club

- WhatsApp del club: tiene el número de ejemplo +56900000000.
- Teléfono del club: sin completar.
- Correo público: sin completar.
- Destinatarios de las notificaciones de formularios: sin completar.
- Redes sociales: sin completar.
- Link de pago (opcional): sin completar.

## En el código y en el seed

Los del seed (`scripts/seed/`) son el origen de los datos de ejemplo de la base. El resto son supuestos
y decisiones anotados junto al código que los aplica.

| Marcador | Dónde |
|---|---|
| [COMPLETAR: …] | `scripts/content-pending.ts:156`, `scripts/seed/data.ts:2` |
| [COMPLETAR: año, serie y relato del título] | `scripts/seed/content.ts:317` |
| [COMPLETAR: año] | `scripts/seed/content.ts:283`, `scripts/seed/content.ts:289` |
| [COMPLETAR: auspiciadores reales, niveles y enlaces] | `scripts/seed/club.ts:145` |
| [COMPLETAR: banco] | `scripts/seed/club.ts:46` |
| [COMPLETAR: beneficios de cada tipo de socio] | `scripts/seed/content.ts:353` |
| [COMPLETAR: camiseta histórica, años en que se usó y foto] | `scripts/seed/content.ts:336` |
| [COMPLETAR: competencia] | `scripts/seed/content.ts:316` |
| [COMPLETAR: correo para comprobantes] | `scripts/seed/club.ts:49` |
| [COMPLETAR: cuota y beneficios reales de este tipo de socio; el valor mostrado es de ejemplo] | `scripts/seed/club.ts:210` |
| [COMPLETAR: datos legales del club (personalidad jurídica, RUT, representante) y texto revisado de la política] | `scripts/seed/content.ts:358` |
| [COMPLETAR: datos reales de la camiseta] | `scripts/seed/content.ts:178` |
| [COMPLETAR: datos reales de la completada] | `scripts/seed/content.ts:150` |
| [COMPLETAR: descripción y fotos reales del producto] | `scripts/seed/data.ts:350`, `scripts/seed/data.ts:360`, `scripts/seed/data.ts:370` |
| [COMPLETAR: descripción, tela y fotos reales del producto] | `scripts/seed/data.ts:330`, `scripts/seed/data.ts:340` |
| [COMPLETAR: destino de los aportes y donaciones] | `scripts/seed/content.ts:354` |
| [COMPLETAR: dirección de la cancha] | `scripts/seed/club.ts:38`, `scripts/seed/sport.ts:191` |
| [COMPLETAR: documento real del club] | `scripts/seed/club.ts:251` |
| [COMPLETAR: duración de los tiempos por serie] | `scripts/seed/sport.ts:141` |
| [COMPLETAR: época] | `scripts/seed/content.ts:326` |
| [COMPLETAR: filosofía de la escuela, categorías, edades, horarios, requisitos y costos] | `scripts/seed/content.ts:351` |
| [COMPLETAR: fotos reales del club] | `scripts/seed/content.ts:99` |
| [COMPLETAR: fuente oficial de la tabla] | `scripts/seed/sport.ts:570` |
| [COMPLETAR: horario real de entrenamiento] | `scripts/seed/sport.ts:312` |
| [COMPLETAR: información real de la escuela de fútbol] | `scripts/seed/content.ts:164` |
| [COMPLETAR: lugar del bingo] | `scripts/seed/club.ts:123` |
| [COMPLETAR: nombre de la asociación] | `scripts/seed/sport.ts:147`, `scripts/seed/sport.ts:153`, `scripts/seed/sport.ts:155` |
| [COMPLETAR: nombre del ídolo] | `scripts/seed/content.ts:325` |
| [COMPLETAR: nombre y coordenadas exactas de la cancha] | `scripts/seed/sport.ts:197` |
| [COMPLETAR: número de cuenta] | `scripts/seed/club.ts:48` |
| [COMPLETAR: precio y tallas reales; los valores mostrados son de ejemplo] | `scripts/seed/club.ts:165` |
| [COMPLETAR: premios, valor del cartón y puntos de venta] | `scripts/seed/club.ts:127` |
| [COMPLETAR: programa real de la celebración] | `scripts/seed/club.ts:92` |
| [COMPLETAR: reemplazar por el balance real del club] | `scripts/seed/media.ts:204` |
| [COMPLETAR: reemplazar por los estatutos vigentes del club] | `scripts/seed/media.ts:196` |
| [COMPLETAR: reemplazar por un acta real aprobada por la directiva] | `scripts/seed/media.ts:200` |
| [COMPLETAR: relato de la fundación y nombres de los fundadores] | `scripts/seed/content.ts:276` |
| [COMPLETAR: relato de la historia del club] | `scripts/seed/content.ts:346` |
| [COMPLETAR: relato real del aniversario] | `scripts/seed/content.ts:192` |
| [COMPLETAR: relato, fecha exacta y foto de este hito] | `scripts/seed/content.ts:269` |
| [COMPLETAR: RUT del club] | `scripts/seed/club.ts:45` |
| [COMPLETAR: tipo de cuenta] | `scripts/seed/club.ts:47` |
| [COMPLETAR: titular de la cuenta] | `scripts/seed/club.ts:44` |
| [COMPLETAR: título o campeonato obtenido] | `scripts/seed/content.ts:315` |
| [COMPLETAR: trayectoria en el club] | `scripts/seed/content.ts:327` |
| [COMPLETAR: URL de la publicación] | `scripts/seed/content.ts:259` |
| [COMPLETAR: URL del video] | `scripts/seed/content.ts:230`, `scripts/seed/content.ts:239` |
| [COMPLETAR: valor de la adhesión] | `scripts/seed/club.ts:94` |
| [COMPLETAR: valor del cartón] | `scripts/seed/club.ts:129` |
| [COMPLETAR: valor del completo y de la promoción] | `scripts/seed/club.ts:112` |
| [COMPLETAR: valores, promociones y forma de reservar] | `scripts/seed/club.ts:110` |
| [COMPLETAR: WhatsApp del club] | `scripts/seed/club.ts:36` |
| [COMPLETAR] | `.env.example:22`, `.env.example:70`, `.env.example:71`, `scripts/content-pending.ts:1`, `src/lib/links.ts:18` |
| [DECIDIR: …] | `scripts/content-pending.ts:157` |
| [DECIDIR: desempate en la tabla calculada. Default: PTS, DIF, GF y luego manual] | `src/features/matches/lib/standings.ts:33` |
| [DECIDIR: mini-tabla en la portada. Default: sí] | `src/features/matches/queries.ts:235` |
| [DECIDIR] | `scripts/content-pending.ts:1` |
| [VERIFICAR: …] | `scripts/content-pending.ts:158` |
| [VERIFICAR: color oficial del club con la directiva] | `src/styles/tokens.css:6` |
| [VERIFICAR: con asesoría legal, Ley 19.628 y Ley 21.719] | `scripts/seed/content.ts:358` |
| [VERIFICAR: puntos por triunfo y empate según el reglamento de la asociación] | `src/features/matches/lib/standings.ts:67` |
| [VERIFICAR] | `scripts/content-pending.ts:1` |
