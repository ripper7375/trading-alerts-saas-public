-- V8 migration: Watchlists removed from the product for all tiers.
-- Drops WatchlistItem first (FK -> Watchlist), then Watchlist.
-- Both tables cascade-delete from User, so no orphan cleanup is needed.

-- DropTable
DROP TABLE IF EXISTS "WatchlistItem";

-- DropTable
DROP TABLE IF EXISTS "Watchlist";
