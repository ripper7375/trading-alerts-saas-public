# Step 1: Fix MT5ServiceError Test Blocker

**Project**: Trading Alerts SaaS V7  
**Phase**: Pre-Phase 4 Blocker Resolution  
**Priority**: 🔴 CRITICAL - Blocks Phase 4 Implementation  
**Estimated Time**: 30 minutes - 1 hour  
**Target**: Fix ONE failing test with minimal code changes (3-10 lines)

---

## 🎯 Problem Statement

### Current Situation

One test has been failing across 5+ compilation cycles:

**Test**: `GET /api/indicators/[symbol]/[timeframe] › should handle MT5ServiceError`  
**File**: `__tests__/api/indicators.test.ts` (around lines 435-462, 485-489)

**Expected**: API returns `{ error: "MT5 service error" }`  
**Actual**: API returns `{ error: "Internal server error" }`

### Root Cause Analysis

The API route handler has correct error handling logic:

```typescript
if (error instanceof MT5ServiceError || isMT5ServiceError(error)) {
  return NextResponse.json({
    success: false,
    error: ERROR_MESSAGES.MT5_SERVICE, // "MT5 service error"
  });
}
// Falls through to generic handler:
return NextResponse.json({ error: 'Internal server error' });
```

**Problem**: The condition `error instanceof MT5ServiceError` is **NOT triggering** in the test environment, causing the error to fall through to the generic handler.

**Hypothesis**: The test is mocking the error as a plain object instead of creating an actual `MT5ServiceError` instance, so `instanceof` checks fail.

---

## 🔍 Investigation Task

### Step 1: Locate the Failing Test

**File**: `__tests__/api/indicators.test.ts`

**Search for**:

- `"should handle MT5ServiceError"`
- `"MT5 service error"` (expected error message)
- Lines around 435-462 and 485-489

**Show me the EXACT test code**, including:

1. How `fetchIndicatorData` is being mocked
2. What error object is being thrown
3. Whether `MT5ServiceError` class is imported

### Step 2: Identify the Mock Problem

Look for patterns like this:

#### ❌ WRONG Pattern (likely current code):

```typescript
// This creates a plain object, NOT an MT5ServiceError instance
jest.spyOn(indicatorService, 'fetchIndicatorData').mockRejectedValue({
  name: 'MT5ServiceError',
  message: 'Service unavailable',
  statusCode: 500,
});

// Or similar variations:
mockRejectedValue(new Error('MT5ServiceError'));
mockRejectedValue({ ...someObject });
```

**Why this fails**: Plain objects and generic Error instances don't pass `instanceof MT5ServiceError` checks.

#### ✅ CORRECT Pattern (target fix):

```typescript
import { MT5ServiceError } from '@/lib/errors/mt5-service-error';

jest
  .spyOn(indicatorService, 'fetchIndicatorData')
  .mockRejectedValue(new MT5ServiceError('Service unavailable', 500));
```

**Why this works**: Creates actual `MT5ServiceError` instance that passes `instanceof` checks.

---

## 🛠️ Fix Instructions

### Required Changes (3-10 lines total)

#### Change 1: Add Import (if missing)

At the top of `__tests__/api/indicators.test.ts`:

```typescript
import { MT5ServiceError } from '@/lib/errors/mt5-service-error';
```

#### Change 2: Fix the Mock

Find the test section (around line 435-462):

**BEFORE** (plain object mock):

```typescript
it('should handle MT5ServiceError', async () => {
  jest.spyOn(indicatorService, 'fetchIndicatorData').mockRejectedValue({
    name: 'MT5ServiceError',
    message: 'Service unavailable',
    statusCode: 500,
  });

  // ... rest of test
});
```

**AFTER** (proper instance mock):

```typescript
it('should handle MT5ServiceError', async () => {
  jest
    .spyOn(indicatorService, 'fetchIndicatorData')
    .mockRejectedValue(new MT5ServiceError('Service unavailable', 500));

  // ... rest of test (no changes needed)
});
```

### Verification: Check MT5ServiceError Class Location

The import path might vary. Check these locations:

- `@/lib/errors/mt5-service-error`
- `@/lib/errors/MT5ServiceError`
- `@/types/errors`
- `@/lib/services/errors`

**If MT5ServiceError class doesn't exist**, you may need to create it:

```typescript
// lib/errors/mt5-service-error.ts
export class MT5ServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody?: any
  ) {
    super(message);
    this.name = 'MT5ServiceError';

    // Ensures proper prototype chain for instanceof
    Object.setPrototypeOf(this, MT5ServiceError.prototype);
  }
}
```

---

## ✅ Validation Steps

After making changes, run:

```bash
# Run the specific failing test
npm test -- __tests__/api/indicators.test.ts -t "should handle MT5ServiceError"

# If that passes, run all tests in the file
npm test -- __tests__/api/indicators.test.ts

# Finally, run full test suite
npm test
```

### Expected Output:

```
✓ GET /api/indicators/[symbol]/[timeframe] › should handle MT5ServiceError (XX ms)

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
```

---

## 🚫 Critical Constraints

### DO NOT:

- ❌ Modify the API route handler (`app/api/indicators/[symbol]/[timeframe]/route.ts`)
- ❌ Change error handling logic in the API
- ❌ Create new error constants or utilities
- ❌ Refactor error detection functions (`isMT5ServiceError`)
- ❌ Touch any files outside the test file
- ❌ Add complex error mapping logic
- ❌ Modify CI/CD workflows
- ❌ Change more than 10 lines of code

### DO:

- ✅ Fix ONLY the test mock in `__tests__/api/indicators.test.ts`
- ✅ Import the existing `MT5ServiceError` class
- ✅ Create actual error instances in mocks
- ✅ Keep changes minimal (3-10 lines)
- ✅ Verify the fix works immediately
- ✅ Commit only if tests pass

---

## 📋 Implementation Checklist

- [ ] Located the failing test in `__tests__/api/indicators.test.ts`
- [ ] Identified how error is currently being mocked (plain object? generic Error?)
- [ ] Found the `MT5ServiceError` class definition and import path
- [ ] Added import statement for `MT5ServiceError` (if missing)
- [ ] Changed mock to throw actual `MT5ServiceError` instance
- [ ] Ran the specific test - PASSES ✅
- [ ] Ran all tests in indicators.test.ts - PASSES ✅
- [ ] Ran full test suite - PASSES ✅
- [ ] Committed changes with message: "fix: MT5ServiceError test mock - use actual class instance"

---

## 🎯 Success Criteria

**BEFORE** (failing state):

```
❌ Expected: "MT5 service error"
❌ Received: "Internal server error"

Test Suites: 1 failed, 1 total
Tests:       1 failed, X passed, X+1 total
```

**AFTER** (fixed state):

```
✅ GET /api/indicators/[symbol]/[timeframe] › should handle MT5ServiceError

Test Suites: 1 passed, 1 total
Tests:       X passed, X total
```

---

## 📝 Context for Claude Code

### Why This Fix is Important

This blocker prevents Phase 4 implementation. The MT5ServiceError handling must work correctly before adding:

- Rate limiting (Task 4.1)
- Caching (Task 4.2)
- Indicator filtering (Task 4.3)
- Business logic tests (Task 4.6-4.8)

All Phase 4 features will use the same error handling pattern, so this must work first.

### What Happens After This Fix

Once this test passes:

1. We'll have a clean, stable baseline
2. All existing tests will be passing
3. We can proceed with Phase 4 Part 0 (creating business constants)
4. We can build Phase 4 features incrementally with confidence

### Previous Attempts (What Didn't Work)

- ❌ Attempted to refactor error constants → added complexity, didn't fix root cause
- ❌ Modified error detection logic → made code more complex, still failed
- ❌ Added elaborate error type checking → over-engineered, didn't solve the issue
- ❌ Changed error messages → broke other tests, created cascading failures

**Root issue**: Never fixed the test mock itself. Always tried to change production code.

---

## 🔧 Example: Complete Fix

Here's what the complete fix might look like:

### File: `__tests__/api/indicators.test.ts`

```typescript
// At the top (add if missing):
import { MT5ServiceError } from '@/lib/errors/mt5-service-error';

// In the test (around line 435-462):
describe('GET /api/indicators/[symbol]/[timeframe]', () => {
  // ... other tests ...

  it('should handle MT5ServiceError', async () => {
    // ✅ FIX: Create actual MT5ServiceError instance
    jest
      .spyOn(indicatorService, 'fetchIndicatorData')
      .mockRejectedValue(new MT5ServiceError('Service unavailable', 500));

    const response = await GET(
      new NextRequest('http://localhost:3000/api/indicators/XAUUSD/H1'),
      { params: { symbol: 'XAUUSD', timeframe: 'H1' } }
    );

    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('MT5 service error'); // ✅ Now passes!
  });

  // ... rest of tests unchanged ...
});
```

**Total changes**: 2 lines

1. Added import
2. Changed mock to use `new MT5ServiceError(...)`

---

## 🚀 Ready to Execute

**Current Branch**: Should be clean (PR99 deleted)  
**Starting Point**: Fresh state, all previous refactoring reverted  
**Target**: One green test, minimal changes  
**Next Step**: After this passes → Phase 4 Part 0 (business constants)

**Estimated Impact**:

- Files changed: 1 (`__tests__/api/indicators.test.ts`)
- Lines changed: 2-10 lines
- Tests fixed: 1 test
- Time saved: Unblocks 6-8 hours of Phase 4 work

---

## 💬 Final Notes

This is a **surgical fix** - we're changing the minimum code necessary to unblock development.

**Philosophy**:

- Don't fix what isn't broken (the API handler is correct)
- Fix what IS broken (the test mock)
- Keep it simple (actual instance vs plain object)
- Verify immediately (run test after fix)

Once this test passes, we have a solid foundation to build Phase 4 systematically.

**Let's get this one test green and move forward.** 🎯
