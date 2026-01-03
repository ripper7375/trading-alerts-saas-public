# Part 20 - Phase 08: E2E Testing Migration

**Purpose:** Migrate E2E tests from Part 6 to Part 20 architecture and add new critical path tests.

---

## Usage Instructions

1. Start a fresh Claude Code (web) chat
2. Attach these 3 documents:
   - `docs/build-orders/part-20-architecture-design.md`
   - `docs/build-orders/part-20-implementation-plan.md`
   - `docs/open-api-documents/part-20-sqlite-sync-postgresql-openapi.yaml`
3. Copy and paste the prompt below

---

## Phase 08 Prompt

```
# Part 20 - Phase 08: E2E Testing Migration

## Context
I'm implementing Part 20 of Trading Alerts SaaS. Phases 1-7 are complete.

This phase migrates E2E tests from Part 6 to Part 20 architecture and adds new critical path tests.

Please refer to the attached documents:
- `part-20-architecture-design.md` - Section 10.2 (Critical Path for E2E Testing)
- `part-20-implementation-plan.md` - Phase 8 details

## Prerequisites
- Phase 7 completed (unit and integration tests passing)
- Playwright installed in the project

## Your Task
Create E2E tests for Part 20 critical paths.

## Files to Create

### 1. `playwright.config.ts` (update if needed)
Configure Playwright:
- Base URL for local dev
- Test directory: e2e/
- Browser: chromium
- Retries for CI
- Screenshot on failure

### 2. `e2e/critical-path.spec.ts`
Create critical path E2E test:

```typescript
test.describe('Part 20 Critical Path', () => {
  test('Complete data flow from database to frontend', async ({ page }) => {
    // Step 1: Verify PostgreSQL has data
    // - Call /api/health/postgresql
    // - Assert tables = 135, connected = true

    // Step 2: Verify sync is recent
    // - Call /api/health/sync
    // - Assert last_sync within 60 seconds

    // Step 3: API returns correct data
    // - Call /api/indicators/EURUSD/H1
    // - Assert success = true
    // - Assert ohlc array not empty
    // - Assert all indicator fields present

    // Step 4: Chart renders correctly
    // - Navigate to /dashboard/chart/EURUSD/H1
    // - Wait for chart component to be visible
    // - Assert candlesticks rendered
    // - Assert indicators overlaid

    // Step 5: Indicators display on chart
    // - Assert fractal markers visible
    // - Assert trendlines visible
  });

  test('Tier access control works', async ({ page }) => {
    // Login as FREE user
    // Try to access PRO symbol - should see upgrade prompt
    // Try to access PRO timeframe - should see upgrade prompt
  });

  test('Confluence score for PRO users', async ({ page }) => {
    // Login as PRO user
    // Navigate to confluence view
    // Assert score displayed (0-10)
    // Assert all 9 timeframes shown
  });
});
```

### 3. `e2e/chart-rendering.spec.ts`
Create chart rendering tests:

```typescript
test.describe('Chart Rendering', () => {
  test('Chart loads with correct data', async ({ page }) => {
    // Navigate to chart page
    // Wait for loading to complete
    // Verify OHLC candles match API data
  });

  test('Timeframe switching works', async ({ page }) => {
    // Start on H1
    // Switch to H4
    // Verify data reloads
    // Verify chart updates
  });

  test('Symbol switching works', async ({ page }) => {
    // Start on EURUSD
    // Switch to XAUUSD
    // Verify data reloads
  });

  test('Indicators toggle on/off', async ({ page }) => {
    // Toggle fractals off
    // Assert markers hidden
    // Toggle back on
    // Assert markers visible
  });
});
```

## Part 6 Test Migration Mapping

| Part 6 Test | Part 20 Replacement |
|-------------|---------------------|
| Flask health check | PostgreSQL/Redis health check |
| Flask /api/indicators | Next.js /api/indicators |
| MT5 connection test | SQLite data freshness check |
| Python indicator calc | Verify PostgreSQL has correct values |
| Connection pool test | Database connection pool test |

## Important Notes
- E2E tests require running app and database
- Use test data fixtures for consistent results
- Add data-testid attributes to components if needed
- Tests should be independent (no order dependency)

## Success Criteria
- [ ] Critical path test passes
- [ ] Chart rendering tests pass
- [ ] Tier access tests pass
- [ ] Confluence tests pass
- [ ] Tests run in CI pipeline
- [ ] All Part 6 E2E behaviors covered

## Testing Commands
```bash
# Install Playwright browsers
npx playwright install

# Run E2E tests
npx playwright test

# Run with UI
npx playwright test --ui

# Run specific test
npx playwright test e2e/critical-path.spec.ts

# Generate report
npx playwright show-report
```

## Commit Instructions
After creating all files, commit with message:
```
test(e2e): migrate Part 6 E2E tests to Part 20 architecture

- Add critical path E2E test
- Add chart rendering E2E tests
- Add tier access E2E tests
- Configure Playwright
- Map all Part 6 test cases
```
```

---

## Next Step

After Phase 08, proceed to `part-20-phase09-prompts.md` (Migration, Integration & Cutover).
