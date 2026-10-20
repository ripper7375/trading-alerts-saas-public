-- Synthetic load for the B1 benchmark. Run with: psql -v ndays=260 -f gen.sql
--
-- Shape (mirrors what the engine pushes, see schema comments of CurrencyGoldIndex):
--   9 listed indices, one M5 bar per index every 300 s, :ndays consecutive days of 288 bars.
--   XAUX's session opens 60 s after the others (independent daily inception).
--   CHFX is STALE: its newest bar is 40 days older than the others'.
--   ZZ1X is an UNLISTED index name (not in ALL_INDEX_NAMES) with exactly ONE row.
--   Rows are inserted in time order across indices (like the engine's arrival order), so the
--   heap is NOT in index order: an ordered index scan has to jump around the heap.
\set ON_ERROR_STOP on

INSERT INTO "currency_gold_indices"
  ("id", "terminal_id", "index_name", "bar_time", "value", "change_pct", "session_open_bar_time", "open", "high", "low")
SELECT
  md5(i.name || ':' || (1700000000 + g.n * 300)::text),
  'SCRATCH',
  i.name,
  1700000000 + g.n * 300,
  100.0 + ((g.n * 7 + i.ord * 13) % 97) * 0.01 - 0.5,
  ((g.n * 7 + i.ord * 13) % 97) * 0.01 - 0.5,
  1700000000 + (g.n / 288) * 86400 + CASE WHEN i.name = 'XAUX' THEN 60 ELSE 0 END,
  100.0, 100.1, 99.9
FROM generate_series(0, :ndays * 288 - 1) AS g(n)
CROSS JOIN (VALUES
  ('XAUX', 1), ('USDX', 2), ('EURX', 3), ('JPYX', 4), ('GBPX', 5),
  ('AUDX', 6), ('NZDX', 7), ('CADX', 8), ('CHFX', 9)
) AS i(name, ord)
WHERE NOT (i.name = 'CHFX' AND g.n >= GREATEST(:ndays - 40, 1) * 288)
ORDER BY g.n, i.ord;

INSERT INTO "currency_gold_indices"
  ("id", "terminal_id", "index_name", "bar_time", "value", "change_pct", "session_open_bar_time")
VALUES
  (md5('ZZ1X:only'), 'SCRATCH', 'ZZ1X', 1700000000 + 144 * 300, 99.5, -0.5, 1700000000);

VACUUM (ANALYZE) "currency_gold_indices";
