-- Derived prices and provenance only. Do not persist raw CurrencyBeacon exchange rates.
CREATE TABLE "world_gold_closes" (
    "market_id" TEXT NOT NULL,
    "session_date" TEXT NOT NULL,
    "formula_version" TEXT NOT NULL,
    "closed_at" INTEGER NOT NULL,
    "gold_bar_closed_at" INTEGER NOT NULL,
    "fx_published_at" INTEGER NOT NULL,
    "fx_observed_at" INTEGER NOT NULL,
    "prices" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "world_gold_closes_pkey" PRIMARY KEY ("market_id", "session_date", "formula_version"),
    CONSTRAINT "world_gold_market_known" CHECK ("market_id" IN ('gb', 'th', 'hk', 'jp', 'in', 'ae', 'tr', 'de', 'ch', 'au')),
    CONSTRAINT "world_gold_date_format" CHECK ("session_date" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND
      "session_date" = to_char("session_date"::date, 'YYYY-MM-DD')),
    CONSTRAINT "world_gold_formula_nonempty" CHECK (length("formula_version") BETWEEN 1 AND 64),
    CONSTRAINT "world_gold_sources_before_close" CHECK (
      "closed_at" >= 0 AND "gold_bar_closed_at" >= 0 AND "fx_published_at" >= 0 AND
      "gold_bar_closed_at" <= "closed_at" AND "closed_at" - "gold_bar_closed_at" <= 900 AND
      "fx_published_at" <= "fx_observed_at" AND "fx_observed_at" <= "closed_at" AND
      "closed_at" - "fx_published_at" <= 3900
    )
);
CREATE INDEX "world_gold_closes_session_date_idx" ON "world_gold_closes"("session_date");

CREATE FUNCTION world_gold_prices_valid(input JSONB) RETURNS BOOLEAN
LANGUAGE SQL IMMUTABLE STRICT AS $$
  SELECT CASE WHEN jsonb_typeof(input) <> 'object' OR input = '{}'::jsonb THEN FALSE
    ELSE NOT EXISTS (
      SELECT 1 FROM jsonb_each(input) AS entry(key, value)
      WHERE CASE WHEN jsonb_typeof(value) = 'number' THEN (value::text)::numeric <= 0 ELSE TRUE END
    ) END;
$$;
ALTER TABLE "world_gold_closes" ADD CONSTRAINT "world_gold_prices_positive" CHECK (world_gold_prices_valid("prices"));

CREATE FUNCTION world_gold_close_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'world_gold_closes is immutable' USING ERRCODE = '55000';
END;
$$;
CREATE TRIGGER world_gold_close_immutable
BEFORE UPDATE OR DELETE ON "world_gold_closes"
FOR EACH ROW EXECUTE FUNCTION world_gold_close_immutable();
