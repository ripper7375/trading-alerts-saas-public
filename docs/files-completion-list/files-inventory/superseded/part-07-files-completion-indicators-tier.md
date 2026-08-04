# [SUPERSEDED] Part 07: Indicators API & Tier Routes - Files Completion List

> **STATUS: ⚠️ SUPERSEDED AND DECOMMISSIONED**
>
> **Superseded Date:** 2026-08-04
> **Reason:** Part 07's original scope ("Indicators API") was decommissioned in v2.0 when custom MT5 indicator routes (`/api/indicators/*`) and `lib/api/mt5-client.ts` were removed. Its tier routes (`/api/tier/symbols`, `/api/tier/check/[symbol]`, `/api/tier/combinations`) have been consolidated into **Part 04 (Tier System & Constants)**. Market data and indicator streaming are served via **Part 06 (Flask MT5 / WebSocket)**, **Part 09 (MTF Visualization / Channel API)**, and **Part 23 (Railway Gateway Pipeline)**.

---

## 📜 Historical Summary & Superseded Scope

### 1. Indicators API (Decommissioned in v2.0.0)

- **`app/api/indicators/route.ts`** — ❌ **REMOVED** (MT5 `iCustom()` API was unreliable; indicator calculations moved out of Flask microservice).
- **`app/api/indicators/[symbol]/[timeframe]/route.ts`** — ❌ **REMOVED** (replaced by Socket.IO WebSocket stream in Part 06 and `MarketDataV6` pipeline in Part 23).
- **`lib/api/mt5-client.ts`** — ❌ **DELETED** (dead code removed in Session 2-3).

### 2. Tier Access Control Routes (Merged into Part 04)

- **`app/api/tier/symbols/route.ts`** — Moved to **Part 04** (File 6/12). Returns `['XAUUSD']` (V8 single-symbol architecture).
- **`app/api/tier/check/[symbol]/route.ts`** — Moved to **Part 04** (File 4/12). Validates `XAUUSD` access for all tiers.
- **`app/api/tier/combinations/route.ts`** — Moved to **Part 04** (File 5/12). Returns `XAUUSD × {M5, M15}` combinations.
- **`docs/open-api-documents/part-07-indicators-tier-openapi.yaml`** — Merged/superseded by `docs/open-api-documents/part-04-tier-system-openapi.yaml`.

---

## 🔀 Ownership Transfer & Current References

| Former Part 07 Resource     | New Owning Module / Document                                                                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tier Routes (`/api/tier/*`) | [Part 04 Completion List](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/files-completion-list/files-inventory/part-04-files-completion-tier-system.md)                         |
| Tier API OpenAPI Spec       | [`docs/open-api-documents/part-04-tier-system-openapi.yaml`](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/open-api-documents/part-04-tier-system-openapi.yaml)                |
| OHLCV & Price Streaming     | [Part 06 Completion List](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/files-completion-list/files-inventory/part-06-files-completion-flask_mt5.md)                           |
| Market Data V6 Pipeline     | [Part 23 Completion List](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/files-completion-list/files-inventory/part-23-files-completion-v2_29_data_pipeline_architecture.md)    |
| Multi-Timeframe Channel API | [Part 24 Completion List](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/files-completion-list/files-inventory/part-24-files-completion-v2_29_multi-timeframe-visualisation.md) |

---

**Archived Location:** `docs/files-completion-list/files-inventory/superseded/part-07-files-completion-indicators-tier.md`
