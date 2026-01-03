# Part 20 - Phase 07: Testing Framework

**Purpose:** Implement comprehensive testing with unit tests, integration tests, and API tests.

---

## Usage Instructions

1. Start a fresh Claude Code (web) chat
2. Attach these 3 documents:
   - `docs/build-orders/part-20-architecture-design.md`
   - `docs/build-orders/part-20-implementation-plan.md`
   - `docs/open-api-documents/part-20-sqlite-sync-postgresql-openapi.yaml`
3. Copy and paste the prompt below

---

## Phase 07 Prompt

```
# Part 20 - Phase 07: Testing Framework

## Context
I'm implementing Part 20 of Trading Alerts SaaS. Phases 1-6 are complete.

This phase implements comprehensive testing with unit tests, integration tests, and API tests.

Please refer to the attached documents:
- `part-20-architecture-design.md` - Section 10 (Testing Framework)
- `part-20-implementation-plan.md` - Phase 7 details

## Prerequisites
- Phases 1-6 completed (all functionality working)
- Jest already configured in the project

## Your Task
Create comprehensive test suite for Part 20.

## Files to Create

### 1. `__tests__/setup.ts`
Create test setup:
- Mock environment variables
- Mock database connections for unit tests
- Setup/teardown helpers
- Test utilities

### 2. `jest.config.js` (update if needed)
Ensure Jest is configured for:
- TypeScript support
- Path aliases (@/)
- Coverage reporting
- Test file patterns

### 3. `__tests__/unit/timeframe-filter.test.ts`
Unit tests for timeframe filtering:
- Test M5 filtering (5-minute boundaries)
- Test M15 filtering (15-minute boundaries)
- Test M30 filtering (30-minute boundaries)
- Test H1 filtering (hourly boundaries)
- Test H2, H4, H8, H12 filtering
- Test D1 filtering (midnight only)
- Test edge cases (empty data, invalid timestamps)

### 4. `__tests__/unit/confluence-calculator.test.ts`
Unit tests for confluence calculation:
- Test signal detection for each indicator type
- Test trend direction calculation
- Test strength calculation
- Test overall confluence score
- Test with missing/null data
- Test score bounds (0-10)

### 5. `__tests__/unit/symbol-utils.test.ts`
Unit tests for symbol utilities:
- Test suffix stripping (EURUSD.i → EURUSD)
- Test multiple suffix patterns
- Test already-normalized symbols
- Test supported symbol validation

### 6. `__tests__/unit/tier-validation.test.ts`
Unit tests for tier validation:
- Test FREE tier symbol access
- Test FREE tier timeframe access
- Test PRO tier full access
- Test denied access messages

### 7. `__tests__/integration/db-queries.test.ts`
Integration tests for database queries:
- Test getIndicatorData returns correct format
- Test multi-timeframe query
- Test with real PostgreSQL (use test database)
- Test connection pooling

### 8. `__tests__/integration/cache-integration.test.ts`
Integration tests for caching:
- Test cache miss → DB fetch → cache set
- Test cache hit returns cached data
- Test cache invalidation
- Test TTL expiration
- Test Redis fallback

### 9. `__tests__/api/indicators.test.ts`
API tests for indicators endpoint:
- Test GET /api/indicators/EURUSD/H1 returns 200
- Test invalid symbol returns 400
- Test invalid timeframe returns 400
- Test FREE tier denied PRO symbol returns 403
- Test response matches OpenAPI schema
- Test limit parameter works

### 10. `__tests__/api/confluence.test.ts`
API tests for confluence endpoint:
- Test GET /api/confluence/EURUSD returns 200 for PRO
- Test FREE tier returns 403
- Test timestamp parameter works
- Test all 117 indicators present
- Test score is 0-10

## Important Notes
- Use mocks for unit tests
- Use test database for integration tests
- API tests can use mocked session
- Aim for >80% code coverage

## Success Criteria
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All API tests pass
- [ ] Code coverage > 80%
- [ ] Tests run in CI pipeline

## Testing Commands
```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- __tests__/unit/timeframe-filter.test.ts

# Run in watch mode
npm test -- --watch
```

## Commit Instructions
After creating all files, commit with message:
```
test(part20): add comprehensive testing framework

- Add unit tests for timeframe filtering
- Add unit tests for confluence calculation
- Add unit tests for symbol utilities
- Add integration tests for database and cache
- Add API tests for all endpoints
- Configure Jest with TypeScript
```
```

---

## Next Step

After Phase 07, proceed to `part-20-phase08-prompts.md` (E2E Testing Migration).
