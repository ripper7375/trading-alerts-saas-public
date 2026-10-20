CREATE TABLE "currency_gold_indices" (
    "id" TEXT NOT NULL,
    "terminal_id" TEXT NOT NULL,
    "index_name" TEXT NOT NULL,
    "bar_time" INTEGER NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "change_pct" DOUBLE PRECISION NOT NULL,
    "session_open_bar_time" INTEGER NOT NULL,
    "open" DOUBLE PRECISION,
    "high" DOUBLE PRECISION,
    "low" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "currency_gold_indices_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "currency_gold_indices_index_name_bar_time_idx" ON "currency_gold_indices"("index_name", "bar_time" DESC);
CREATE UNIQUE INDEX "currency_gold_indices_index_name_bar_time_key" ON "currency_gold_indices"("index_name", "bar_time");
