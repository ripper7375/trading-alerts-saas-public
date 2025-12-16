# Build Order Files - Complete Reference

## Purpose

This directory contains **file-by-file build instructions** for each of the 18 parts defined in `v5-structure-division.md`.

These files provide Aider with:

- **Exact file sequence** within each part
- **Dependency information** (what must exist before building this file)
- **Pattern references** (which coding pattern to use)
- **OpenAPI references** (which schemas to comply with)
- **Seed code references** (which examples to reference)
- **Step-by-step build instructions**

## Alignment with Project Structure

```
(E) PHASE: docs/v7/v7_phase_3_building.md
    ↓ "Build Parts 1-18"

(B) PART ORDERS: docs/v5-structure-division.md
    ↓ Defines Parts 1-18 (which files in each)

(C) FILE-BY-FILE ORDERS: docs/build-orders/part-XX-[name].md ← YOU ARE HERE
    ↓ Detailed build sequence for each part

(D) SPECIAL RULES: docs/policies/06-aider-instructions.md
    ↓ Overrides for complex parts (17, 18)

(A) API COMPLIANCE: OpenAPI specs
    ↓ All files comply with these contracts
```

## File Structure

```
build-orders/
├── README.md                        ← This file
├── TEMPLATE.md                      ← Template for creating new build orders
├── part-01-foundation.md            ← Part 1: Foundation & Root Config
├── part-02-database.md              ← Part 2: Database Schema & Migrations
├── part-03-types.md                 ← Part 3: Type Definitions
├── part-04-tier-system.md           ← Part 4: Tier System & Constants
├── part-05-authentication.md        ← Part 5: Authentication System
├── part-06-flask-mt5.md             ← Part 6: Flask MT5 Service
├── part-07-indicators-api.md        ← Part 7: Indicators API & Tier Routes
├── part-08-dashboard.md             ← Part 8: Dashboard & Layout Components
├── part-09-charts.md                ← Part 9: Charts & Visualization
├── part-10-watchlist.md             ← Part 10: Watchlist System
├── part-11-alerts.md                ← Part 11: Alerts System
├── part-12-ecommerce.md             ← Part 12: E-commerce & Billing
├── part-13-settings.md              ← Part 13: Settings System
├── part-14-admin.md                 ← Part 14: Admin Dashboard
├── part-15-notifications.md         ← Part 15: Notifications & Real-time
├── part-16-utilities.md             ← Part 16: Utilities & Infrastructure
├── part-17-affiliate.md             ← Part 17: Affiliate Marketing Platform
└── part-18-dlocal.md                ← Part 18: dLocal Payment Integration
```

## How Aider Uses These Files

### Step 1: Determine Current Part

```
User says: "Build Part 5"
Aider reads: docs/build-orders/part-05-authentication.md
```

### Step 2: Follow File Sequence

```
Part 5 says:
  File 1: prisma/schema.prisma (update User model)
  File 2: lib/auth/auth-options.ts
  File 3: app/api/auth/[...nextauth]/route.ts
  ...
```

### Step 3: For Each File

```
Read:
  - File description (purpose, dependencies)
  - Pattern reference (05-coding-patterns.md)
  - OpenAPI reference (trading_alerts_openapi.yaml)
  - Seed code reference (seed-code/...)

Generate:
  - Code using specified pattern
  - Ensure dependencies met
  - Comply with OpenAPI schema

Validate:
  - Against all 9 constitutions (00-08 policies)
  - Approve / Auto-fix / Escalate

Commit:
  - If approved, commit and move to next file
```

## Reference Material Mapping

Each build-order file extracts and organizes information from:

| Build Order File          | Primary Sources                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------- |
| part-01-foundation.md     | v5-structure-division.md Part 1 + v5_part_a.md sections 7.4, 7.5                      |
| part-02-database.md       | v5-structure-division.md Part 2 + v5_part_c.md section 6                              |
| part-03-types.md          | v5-structure-division.md Part 3 + OpenAPI specs                                       |
| part-04-tier-system.md    | v5-structure-division.md Part 4 + v5_part_d.md                                        |
| part-05-authentication.md | v5-structure-division.md Part 5 + v5_part_e.md section 5                              |
| part-06-flask-mt5.md      | v5-structure-division.md Part 6 + v5_part_e.md section 8                              |
| part-07-indicators-api.md | v5-structure-division.md Part 7 + v5_part_g.md                                        |
| part-08-dashboard.md      | v5-structure-division.md Part 8 + v5_part_h.md                                        |
| part-09-charts.md         | v5-structure-division.md Part 9 + v5_part_i.md                                        |
| part-10-watchlist.md      | v5-structure-division.md Part 10 + v5_part_j.md                                       |
| part-11-alerts.md         | v5-structure-division.md Part 11 + v5*part*\*.md                                      |
| part-12-ecommerce.md      | v5-structure-division.md Part 12 + v5*part*\*.md                                      |
| part-13-settings.md       | v5-structure-division.md Part 13 + v5*part*\*.md                                      |
| part-14-admin.md          | v5-structure-division.md Part 14 + v5*part*\*.md                                      |
| part-15-notifications.md  | v5-structure-division.md Part 15 + v5*part*\*.md                                      |
| part-16-utilities.md      | v5-structure-division.md Part 16 + v5*part*\*.md                                      |
| part-17-affiliate.md      | v5-structure-division.md Part 17 + 06-aider-instructions.md Section 12                |
| part-18-dlocal.md         | v5-structure-division.md Part 18 + v5_part_r.md + 06-aider-instructions.md Section 13 |

## Alignment Verification

Before starting autonomous building, verify:

1. **Phase → Part alignment**

   ```
   v7_phase_3_building.md mentions Parts 1-18
   v5-structure-division.md defines Parts 1-18
   build-orders/ has 18 files (part-01 through part-18)
   ✅ ALIGNED
   ```

2. **Part → File alignment**

   ```
   For each part:
     v5-structure-division.md says: "Part X has N files"
     build-orders/part-XX-*.md lists: N files in sequence
   ✅ ALIGNED
   ```

3. **File → Pattern alignment**

   ```
   For each file:
     build-orders/part-XX-*.md says: "Use Pattern Y"
     05-coding-patterns.md defines: Pattern Y
   ✅ ALIGNED
   ```

4. **Pattern → OpenAPI alignment**
   ```
   For each API file:
     Pattern generates code with schemas
     OpenAPI spec defines those schemas
   ✅ ALIGNED
   ```

## Usage in .aider.conf.yml

```yaml
read:
  # Constitutions
  - docs/policies/00-tier-specifications.md
  - docs/policies/01-approval-policies.md
  - docs/policies/02-quality-standards.md
  - docs/policies/03-architecture-rules.md
  - docs/policies/04-escalation-triggers.md
  - docs/policies/05-coding-patterns.md
  - docs/policies/06-aider-instructions.md
  - docs/policies/07-dlocal-integration-rules.md
  - docs/policies/08-google-oauth-implementation-rules.md

  # Macro-to-Micro Ordering
  - docs/v5-structure-division.md

  # File-by-file build orders (loaded on-demand)
  # Aider loads the specific part file when building that part
  - docs/build-orders/part-*.md

  # API Compliance
  - docs/trading_alerts_openapi.yaml
  - docs/flask_mt5_openapi.yaml
  - docs/dlocal-openapi-endpoints.yaml

  # Progress
  - PROGRESS.md
```

## Creating New Build Order Files

Use `TEMPLATE.md` as the starting point for any new build-order file.

## Maintenance

When you update:

- **v5-structure-division.md** (add/remove files) → Update corresponding build-order file
- **OpenAPI specs** (change schemas) → Update references in build-order files
- **Coding patterns** (new patterns) → Update pattern references in build-order files

This ensures **(E) → (B) → (C) → (D)** remain perfectly aligned with **(A)** compliance.

---

**Last Updated:** 2025-11-18
**Maintained By:** Project documentation system
**Purpose:** Maximum Aider autonomy success
