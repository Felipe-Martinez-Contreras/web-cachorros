-- Estadísticas por jugador, temporada y serie (especificación 8.6). Vista normal: se cachea con el tag `stats`.
-- Solo cuentan los partidos `finalizado`; se suman los ajustes históricos de `player_stat_adjustments`.
-- Segunda amarilla = 1 amarilla + 1 roja [VERIFICAR: criterio con la directiva].
CREATE VIEW "v_player_season_stats" AS
WITH apps AS (
  SELECT l.player_id, m.season_id, m.series_id, count(*) AS appearances
  FROM match_lineups l
  JOIN matches m ON m.id = l.match_id
  WHERE m.status = 'finalizado' AND l.played
  GROUP BY l.player_id, m.season_id, m.series_id
),
ev AS (
  SELECT e.player_id, m.season_id, m.series_id,
    count(*) FILTER (WHERE e.type IN ('gol', 'gol_penal')) AS goals,
    count(*) FILTER (WHERE e.type IN ('tarjeta_amarilla', 'segunda_amarilla')) AS yellow_cards,
    count(*) FILTER (WHERE e.type IN ('tarjeta_roja', 'segunda_amarilla')) AS red_cards
  FROM match_events e
  JOIN matches m ON m.id = e.match_id
  WHERE m.status = 'finalizado' AND e.player_id IS NOT NULL
  GROUP BY e.player_id, m.season_id, m.series_id
),
adj AS (
  SELECT player_id, season_id, series_id,
    sum(appearances) AS appearances,
    sum(goals) AS goals,
    sum(yellow_cards) AS yellow_cards,
    sum(red_cards) AS red_cards
  FROM player_stat_adjustments
  GROUP BY player_id, season_id, series_id
),
keys AS (
  SELECT player_id, season_id, series_id FROM apps
  UNION
  SELECT player_id, season_id, series_id FROM ev
  UNION
  SELECT player_id, season_id, series_id FROM adj
)
SELECT
  k.player_id,
  k.season_id,
  k.series_id,
  (coalesce(apps.appearances, 0) + coalesce(adj.appearances, 0))::integer AS appearances,
  (coalesce(ev.goals, 0) + coalesce(adj.goals, 0))::integer AS goals,
  (coalesce(ev.yellow_cards, 0) + coalesce(adj.yellow_cards, 0))::integer AS yellow_cards,
  (coalesce(ev.red_cards, 0) + coalesce(adj.red_cards, 0))::integer AS red_cards
FROM keys k
LEFT JOIN apps USING (player_id, season_id, series_id)
LEFT JOIN ev USING (player_id, season_id, series_id)
LEFT JOIN adj USING (player_id, season_id, series_id);
