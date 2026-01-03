# Part 20: Phase 0 - Pre-Implementation Migration Analysis

**Purpose:** Run this BEFORE starting Part 20 Phase 1 to identify all Part 6 dependencies.

**Note:** Phase 9 (Migration & Cutover) has been merged into `part-20-phase-prompts.md`. This file only contains Phase 0.

---

## Complete Implementation Sequence

```
┌─────────────────────────────────────────────────────────────────┐
│                    IMPLEMENTATION ORDER                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ① Phase 0: Migration Analysis      ← THIS FILE (run first)    │
│     └─ Identify all Part 6 dependencies                        │
│     └─ Creates: docs/migration/part6-to-part20-analysis.md     │
│                                                                 │
│  ② Phases 1-8: Build Part 20        ← part-20-phase-prompts.md │
│     └─ Part 6 continues running during development             │
│                                                                 │
│  ③ Phase 9: Migration & Cutover     ← part-20-phase-prompts.md │
│     └─ Update all Part 6 references to Part 20                 │
│     └─ Deploy and verify                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 0 Prompt: Pre-Implementation Migration Analysis

**When to Run:** BEFORE starting Part 20 Phase 1

```
# Part 20 - Phase 0: Migration Analysis (Part 6 → Part 20)

## Context
Before implementing Part 20 (SQLite + Sync to PostgreSQL), I need to analyze the current Part 6 (Flask MT5 Service) dependencies to understand what will need to change during migration.

Part 6 currently provides:
- Flask service running on port 5001
- API endpoints: /api/indicators, /api/health, /api/symbols, /api/timeframes, /api/admin/*
- Python MT5 API for indicator data retrieval
- Connection pooling for 15 MT5 terminals

Part 20 will replace Part 6 with:
- MQL5 Service → SQLite → Sync → PostgreSQL → Next.js API
- No Flask service needed
- Indicator data from database instead of live MT5 connection

Please refer to the attached documents for Part 20 architecture.

## Your Task
Analyze the codebase to identify ALL Part 6 dependencies and create a migration plan.

## Analysis Required

### 1. Find All Part 6 File References
Search for files that:
- Import from `mt5-service/` directory
- Reference Flask service URL (localhost:5001 or mt5-service:5001)
- Use MT5_API_URL or similar environment variables
- Call Flask endpoints (/api/indicators, /api/health, etc.)

Output a table:
| File Path | Reference Type | What It Does | Migration Action |
|-----------|---------------|--------------|------------------|

### 2. Find All Environment Variables
Search for Part 6 related env vars:
- MT5_API_URL
- MT5_API_KEY
- MT5_ADMIN_API_KEY
- FLASK_PORT
- Any MT5_* variables

Output a table:
| Variable | Used In | Current Value | Part 20 Replacement |
|----------|---------|---------------|---------------------|

### 3. Analyze Next.js API Routes (Part 7)
Examine how Next.js calls Flask:
- Which routes proxy to Flask?
- What data transformations happen?
- What error handling exists?

Files to check:
- app/api/indicators/**
- app/api/mt5/**
- lib/services/mt5*.ts
- lib/api/indicators*.ts

### 4. Analyze Frontend Dependencies (Part 9)
Examine chart components:
- How does frontend fetch indicator data?
- What response format is expected?
- Any direct Flask calls from client?

Files to check:
- components/charts/**
- hooks/useIndicators*.ts
- lib/api/client*.ts

### 5. Analyze Test Dependencies
Find tests that:
- Mock Flask endpoints
- Use Flask test fixtures
- Reference MT5 service

Files to check:
- __tests__/**
- e2e/**
- *.test.ts, *.spec.ts

### 6. Analyze Docker/Deployment
Check deployment configurations:
- docker-compose.yml
- Dockerfile references
- Kubernetes/Railway configs
- CI/CD pipelines

### 7. Analyze Documentation
Find docs referencing Part 6:
- README files
- API documentation
- Architecture docs
- Build orders

## Output Required

Create a file `docs/migration/part6-to-part20-analysis.md` with:

```markdown
# Part 6 → Part 20 Migration Analysis

## Executive Summary
- Total files affected: X
- Critical dependencies: X
- Estimated migration effort: X hours

## File Reference Map

### Direct Imports (from mt5-service/)
| File | Import | Migration Action |
|------|--------|------------------|
| ... | ... | ... |

### Flask URL References
| File | URL Pattern | Migration Action |
|------|-------------|------------------|
| ... | ... | ... |

### Environment Variables
| Variable | Files Using | Replacement |
|----------|-------------|-------------|
| ... | ... | ... |

## Integration Points

### Next.js → Flask Calls
[List each API route that calls Flask]

### Frontend → API Calls
[List frontend fetch patterns]

### Test Mocks
[List test files with Flask mocks]

## Migration Risk Assessment

### High Risk (Must change carefully)
- [List critical files]

### Medium Risk (Standard updates)
- [List affected files]

### Low Risk (Simple replacements)
- [List trivial changes]

## Pre-Migration Checklist
- [ ] All Part 6 dependencies identified
- [ ] All environment variables mapped
- [ ] All API response formats documented
- [ ] All test mocks identified
- [ ] Rollback plan documented

## Recommended Migration Order
1. [First thing to migrate]
2. [Second thing to migrate]
...
```

## Success Criteria
- [ ] All Part 6 references found and documented
- [ ] Migration analysis file created
- [ ] No hidden dependencies missed
- [ ] Clear migration path identified

## Commit Instructions
```
docs: add Part 6 to Part 20 migration analysis

- Identify all files referencing Part 6 Flask service
- Map environment variables for migration
- Document integration points and risks
- Create migration checklist
```
```

---

## What Happens After Phase 0

After completing Phase 0, you will have `docs/migration/part6-to-part20-analysis.md` which:
1. Lists ALL files that reference Part 6
2. Maps ALL environment variables
3. Documents ALL integration points
4. Provides migration risk assessment

This document is used during **Phase 9 (Migration & Cutover)** to ensure nothing is missed.

---

## Next Steps

After Phase 0:
1. Go to `docs/build-orders/part-20-phase-prompts.md`
2. Run Phases 1-8 in order
3. Run Phase 9 (Migration & Cutover)

---

## Risk Mitigation

### Why Phase 0 First?
- Identifies hidden dependencies before you start building
- Prevents surprises during migration
- Allows accurate effort estimation
- Creates documentation for Phase 9

### What If Phase 0 Finds Problems?
- Document blockers in the analysis file
- Discuss with team before proceeding
- May need to adjust Part 20 architecture
- Better to know now than during cutover
