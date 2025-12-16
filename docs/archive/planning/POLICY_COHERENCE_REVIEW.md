# Policy Coherence Review - Multi-MT5 Architecture Updates

**Date:** 2025-11-17
**Reviewer:** Claude
**Scope:** Impact of multi-MT5 terminal architecture on project policies and documentation

---

## Executive Summary

Following the implementation of multi-MT5 terminal architecture (15 terminals, 1 per symbol), all critical policy and architecture documents have been reviewed and updated to maintain coherence for Aider (builder) + Claude Code (validator) + Human (policy maker) workflow.

---

## Files Reviewed & Updated

### ✅ UPDATED FILES

| File                         | Status     | Changes Made                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **flask_mt5_openapi.yaml**   | ✅ Updated | • Added multi-terminal architecture description<br>• Enhanced /api/health endpoint (15 terminals)<br>• Added admin endpoints (5 total)<br>• Added AdminApiKeyAuth security scheme<br>• Added 6 admin response schemas                                                                                                                                     |
| **ARCHITECTURE.md**          | ✅ Updated | • Updated system diagram (15 MT5 terminals)<br>• Updated section 4.5 with multi-terminal architecture<br>• Added deployment options (1 VPS vs 3 VPS)<br>• Added admin health endpoint example<br>• Added reference documentation links                                                                                                                    |
| **03-architecture-rules.md** | ✅ Updated | • Section 8 renamed to "FLASK MT5 SERVICE - MULTI-TERMINAL ARCHITECTURE"<br>• Added 8.1: Multi-terminal overview + symbol mapping<br>• Added 8.1.1: Connection pool pattern (mandatory)<br>• Added 8.1.2: Admin endpoints for terminal management<br>• Updated 8.2: Route handler with connection pool<br>• Marked 8.3 as UNCHANGED (Next.js client-side) |

### ✅ NEW FILES CREATED (Previous Work)

| File                                      | Purpose                                          |
| ----------------------------------------- | ------------------------------------------------ |
| **mt5-terminal-mapping.md**               | Deployment strategy, VPS options, symbol mapping |
| **flask-multi-mt5-implementation.md**     | Complete Python implementation code              |
| **admin-mt5-dashboard-implementation.md** | Admin dashboard (Flask + Next.js)                |

### ✅ FILES REQUIRING NO CHANGES

| File                                        | Reason                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------ |
| **.aider.conf.yml**                         | Already references flask_mt5_openapi.yaml and all policies - no changes needed |
| **00-tier-specifications.md**               | Tier limits unchanged (FREE: 5 symbols, PRO: 15 symbols)                       |
| **01-approval-policies.md**                 | Approval criteria remain valid for multi-MT5 code                              |
| **02-quality-standards.md**                 | Quality standards apply regardless of MT5 count                                |
| **04-escalation-triggers.md**               | Escalation criteria unchanged                                                  |
| **05-coding-patterns.md**                   | Coding patterns remain valid                                                   |
| **06-aider-instructions.md**                | Aider workflow unchanged                                                       |
| **07-dlocal-integration-rules.md**          | Payment integration unaffected                                                 |
| **08-google-oauth-implementation-rules.md** | OAuth unaffected                                                               |
| **v5-structure-division.md**                | File structure unchanged                                                       |
| **diagram-06-db-schema.mermaid**            | Database schema unchanged                                                      |

---

## Key Architectural Changes Documented

### 1. **Multi-Terminal Architecture** (15 MT5 Terminals)

**Reason:** PRO tier = 135 chart combinations (15 symbols × 9 timeframes)

- Single MT5 cannot handle 135 chart windows efficiently
- Solution: 15 terminals × 9 charts each = distributed load

**Symbol-to-Terminal Mapping:**

```
MT5_01 → AUDJPY     MT5_09 → NZDUSD
MT5_02 → AUDUSD     MT5_10 → US30
MT5_03 → BTCUSD     MT5_11 → USDCAD
MT5_04 → ETHUSD     MT5_12 → USDCHF
MT5_05 → EURUSD     MT5_13 → USDJPY
MT5_06 → GBPJPY     MT5_14 → XAGUSD
MT5_07 → GBPUSD     MT5_15 → XAUUSD
MT5_08 → NDX100
```

### 2. **Connection Pool Pattern** (MANDATORY)

**Rule:** All MT5 connections MUST go through the connection pool.

**New File:** `app/services/mt5_connection_pool.py`

- Manages 15 MT5 connections
- Routes requests to correct terminal based on symbol
- Auto-reconnects failed terminals
- Provides health monitoring

### 3. **Admin Dashboard** (NEW)

**New Admin Endpoints:**

```
GET  /api/admin/terminals/health           # View all 15 terminals
POST /api/admin/terminals/{id}/restart     # Restart specific terminal
POST /api/admin/terminals/restart-all      # Restart all (critical)
GET  /api/admin/terminals/{id}/logs        # View logs
GET  /api/admin/terminals/stats            # Aggregate stats
```

**Authentication:** Separate admin API key (`X-Admin-API-Key`)

**Next.js Dashboard:** `app/admin/mt5-terminals/page.tsx`

- Real-time health monitoring (auto-refresh 30s)
- Per-terminal status cards
- One-click restart
- Visual indicators (green/yellow/red)

### 4. **Deployment Options**

**Option 1 - Development:**

- Single VPS, 15 MT5 instances
- Cost: ~$80/month
- Simpler management

**Option 2 - Production (Recommended):**

- 3 VPS, 5 MT5 instances each
- Cost: ~$150/month
- Fault tolerance

---

## Impact on Aider + Claude Code Workflow

### ✅ NO DISRUPTION TO WORKFLOW

| Component                   | Impact                                                                           |
| --------------------------- | -------------------------------------------------------------------------------- |
| **Aider (Builder)**         | Reads updated policies from .aider.conf.yml - will follow new multi-MT5 patterns |
| **Claude Code (Validator)** | Uses same policy files - will validate against updated architecture rules        |
| **Human (Decision Maker)**  | Informed of architectural decision via updated docs                              |

### ✅ POLICIES REMAIN COHERENT

1. **Approval Policies (01):** Still apply - code must follow patterns
2. **Quality Standards (02):** Still apply - TypeScript, error handling, etc.
3. **Architecture Rules (03):** **UPDATED** - now includes multi-MT5 rules
4. **Escalation Triggers (04):** Still apply - when to ask human
5. **Coding Patterns (05):** Still apply - Flask patterns remain valid
6. **Aider Instructions (06):** Still apply - workflow unchanged

### ✅ AIDER CAN NOW BUILD

When building Flask MT5 service, Aider will:

1. Read `flask_mt5_openapi.yaml` (updated with multi-terminal endpoints)
2. Read `03-architecture-rules.md` (updated with connection pool pattern)
3. Read `flask-multi-mt5-implementation.md` (implementation guide)
4. Follow connection pool pattern (mandatory rule in 03)
5. Implement admin endpoints per OpenAPI spec
6. Claude Code validates against updated policies

---

## Verification Checklist

### Coherence Verification

- ✅ **flask_mt5_openapi.yaml** describes multi-terminal API
- ✅ **ARCHITECTURE.md** explains multi-terminal system design
- ✅ **03-architecture-rules.md** mandates connection pool pattern
- ✅ **Implementation guides** provide complete code examples
- ✅ **All files cross-reference** each other correctly
- ✅ **.aider.conf.yml** loads all updated files

### Aider Readiness

- ✅ Policies are specific and actionable
- ✅ Code patterns include complete examples
- ✅ Architecture rules are unambiguous
- ✅ OpenAPI spec is complete (15 endpoints + schemas)
- ✅ No conflicting requirements

### Claude Code Readiness

- ✅ Validation criteria remain clear
- ✅ Quality standards apply to new architecture
- ✅ Approval policies cover multi-MT5 code
- ✅ Escalation triggers still relevant

---

## Remaining Phase 3 Work

### What Aider Will Build (Using Updated Policies)

**Part 1: Flask MT5 Service**

- `mt5-service/app/services/mt5_connection_pool.py` ← NEW
- `mt5-service/app/services/health_monitor.py` ← NEW
- `mt5-service/app/routes/admin_terminals.py` ← NEW
- `mt5-service/app/middleware/auth.py` ← UPDATED (admin key)
- `mt5-service/app/routes/indicators.py` ← UPDATED (uses pool)
- `mt5-service/config/mt5_terminals.json` ← NEW
- `mt5-service/app/__init__.py` ← UPDATED (init pool)

**Part 2: Next.js Admin Dashboard**

- `app/admin/mt5-terminals/page.tsx` ← NEW
- `app/api/admin/mt5-terminals/health/route.ts` ← NEW
- `app/api/admin/mt5-terminals/[id]/restart/route.ts` ← NEW
- `app/api/admin/mt5-terminals/restart-all/route.ts` ← NEW

**Part 3: Next.js Client Updates**

- `lib/mt5-client/` ← AUTO-GENERATED from updated flask_mt5_openapi.yaml

---

## Recommendations

### For Human (You)

1. ✅ **Review this summary** to ensure alignment with your vision
2. ✅ **Approve architectural decision** (15 terminals vs 1)
3. ✅ **Choose deployment option** (Option 1 or 2) before Phase 3 building
4. ✅ **Verify VPS requirements** match your budget

### For Aider

1. ✅ **Policies are ready** - start Phase 3 building when instructed
2. ✅ **Connection pool pattern is mandatory** - no direct MT5 connections
3. ✅ **Admin endpoints required** - must implement all 5 admin routes
4. ✅ **Follow seed code patterns** - loguru logging, Flask structure

### For Claude Code

1. ✅ **Validate connection pool usage** - reject direct MT5 connections
2. ✅ **Check admin authentication** - separate admin API key required
3. ✅ **Verify terminal routing** - must route by symbol
4. ✅ **Approve multi-terminal code** - if follows updated policies

---

## Summary

**Coherence Status:** ✅ **FULLY COHERENT**

All policy files, architecture documentation, and implementation guides are now consistent with the multi-MT5 terminal architecture. Aider can proceed with Phase 3 building using the updated policies without conflicts or ambiguities.

**Key Achievement:**

- 3 major files updated (OpenAPI spec, ARCHITECTURE.md, 03-architecture-rules.md)
- 3 new implementation guides created
- 11 policy files verified (no changes needed)
- 1 config file verified (.aider.conf.yml - no changes needed)
- 0 conflicts or ambiguities

**Aider + Claude Code + Human workflow:** ✅ **READY FOR PHASE 3**

---

**Last Updated:** 2025-11-17
**Version:** 1.0.0
