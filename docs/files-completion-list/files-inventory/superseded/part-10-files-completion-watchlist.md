# [SUPERSEDED] Part 10: Watchlist System - Files Completion List

> **STATUS: ⚠️ SUPERSEDED AND DECOMMISSIONED**
>
> **Superseded Date:** 2026-07-07 (V8 Architecture Update)
> **Reason:** The Watchlist feature was deleted from the product for all tiers in commit `f213bd12` (`change-to-new-design.md`). Under the V8 single-symbol architecture (`XAUUSD` only, `M5`/`M15` timeframes only), watchlist tracking is obsolete as there are no multi-symbol lists to maintain.
> **Database Changes:** `Watchlist` and `WatchlistItem` Prisma models were dropped via migration `prisma/migrations/20260706000000_drop_watchlists/migration.sql`.

---

## 📜 Historical Summary & Deleted Files (0/0 Active Files)

All 9 original production files, components, API routes, and hooks were permanently deleted:

1. ❌ ~~`app/(dashboard)/watchlist/page.tsx`~~ — **DELETED**
2. ❌ ~~`app/(dashboard)/watchlist/watchlist-client.tsx`~~ — **DELETED**
3. ❌ ~~`app/api/watchlist/route.ts`~~ — **DELETED**
4. ❌ ~~`app/api/watchlist/[id]/route.ts`~~ — **DELETED**
5. ❌ ~~`app/api/watchlist/reorder/route.ts`~~ — **DELETED**
6. ❌ ~~`components/watchlist/symbol-selector.tsx`~~ — **DELETED**
7. ❌ ~~`components/watchlist/timeframe-grid.tsx`~~ — **DELETED**
8. ❌ ~~`components/watchlist/watchlist-item.tsx`~~ — **DELETED**
9. ❌ ~~`hooks/use-watchlist.ts`~~ — **DELETED**
10. ❌ ~~`types/watchlist.ts`~~ — **DELETED**
11. ❌ ~~`components/dashboard/watchlist-widget.tsx`~~ — **DELETED**

---

## 🔀 Replacement Architecture

- **Trading Experience:** Users trade and view real-time data directly on the single `XAUUSD` chart (`app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx`).
- **Feature Differentiation:** Tier differentiation is now based on **Alerts Limit** (FREE: 0, PRO: 100), **Multi-Timeframe Visualization** (PRO-only channel overlay), and **Drawing Engine Line Alerts** (PRO-only).

---

**Archived Location:** `docs/files-completion-list/files-inventory/superseded/part-10-files-completion-watchlist.md`
