# Phase 4 Part 1.0: Pre-Flight Check

**Project**: Trading Alerts SaaS V7  
**Phase**: 4 of 6 - Business Logic & APIs  
**Part**: 1.0 of 5 - Pre-Flight Verification  
**Priority**: 🔴 CRITICAL - Safety Checkpoint  
**Estimated Time**: 5-10 minutes  
**Dependencies**: ✅ Part 0 Complete (business-rules.ts exists)

---

## 🎯 Objective

**Verify the codebase is in a healthy state BEFORE implementing caching.**

This is a **safety checkpoint** to ensure:

- All existing tests pass
- No hidden failures exist
- We have a clean baseline to compare against
- We can confidently proceed with caching implementation

**Critical Rule**: This part makes **ZERO code changes**. It only verifies and documents.

---

## 🚨 Why This Step is Critical

### Lessons Learned:

In previous attempts (PR99, PR101):

- We made changes and THEN discovered tests were failing
- Hard to tell if OUR changes broke tests or tests were already broken
- Spent hours debugging when the baseline was unclear

### This Prevents:

- ❌ Building on a broken foundation
- ❌ Assuming tests pass when they don't
- ❌ Blaming our caching code for pre-existing failures
- ❌ Wasting time debugging issues we didn't create

### This Ensures:

- ✅ Clear baseline: "All X tests passed before we started"
- ✅ Accountability: If tests fail after Part 1.1, we know WE broke them
- ✅ Easy rollback: Documented clean state to return to
- ✅ Confidence: Safe to proceed with actual implementation

---

## ✅ Verification Tasks

### Task 1: Verify Current Branch State

**Check which branch you're on:**

```bash
git branch --show-current

# Expected: Should be on the Part 0 success branch
# Example: claude/implement-phase4-constants-gYEfH
# OR: A clean branch based on Part 0
```

**Verify Part 0 file exists:**

```bash
ls -la lib/constants/business-rules.ts

# Expected output:
# -rw-r--r--  1 user  staff  ~15000-18000  lib/constants/business-rules.ts

# If file doesn't exist, STOP - Part 0 was not completed
```

**Check working tree is clean:**

```bash
git status

# Expected output:
# On branch claude/implement-phase4-constants-gYEfH
# nothing to commit, working tree clean

# If there are uncommitted changes, STOP and commit or stash them first
```

---

### Task 2: Run Full Test Suite

**Run all tests with coverage:**

```bash
npm test

# This should run ALL tests across the entire codebase
# Let it complete fully - don't interrupt
```

**Expected Output Pattern:**

```
Test Suites: X passed, X total
Tests:       Y passed, Y total
Snapshots:   Z total
Time:        ~XXs
```

**Document the Results:**

Create a file called `BASELINE_STATE.md` in your project root:

```markdown
# Pre-Flight Check Results

**Date**: [Current date]
**Branch**: [Branch name]
**Commit**: [git rev-parse HEAD]

## Test Results

- **Test Suites**: X passed, 0 failed, X total
- **Tests**: Y passed, 0 failed, Y total
- **Duration**: ~XXs

## Files Modified Since Part 0

[Output of: git diff --name-only origin/main...HEAD]

## Current State

- ✅ All tests passing
- ✅ No uncommitted changes
- ✅ business-rules.ts exists and exports correctly
- ✅ TypeScript compiles without errors
- ✅ No console errors during test run

## Ready for Part 1.1

This baseline is confirmed clean and safe to proceed with caching implementation.
```

---

### Task 3: Verify TypeScript Compilation

**Check for type errors:**

```bash
npx tsc --noEmit

# Expected: Should complete with no errors
# If you see errors, document them in BASELINE_STATE.md
```

---

### Task 4: Verify Part 0 Constants Are Importable

**Create a temporary verification script:**

Create file: `verify-part0.ts` (temporary, will delete after)

```typescript
/**
 * Temporary verification script for Part 0 constants
 * This file will be deleted after pre-flight check
 */

import {
  VALID_SYMBOLS,
  VALID_TIMEFRAMES,
  ALL_INDICATORS,
  BASIC_INDICATORS,
  PRO_INDICATORS,
  FREE_SYMBOLS,
  PRO_SYMBOLS,
  RATE_LIMITS,
  CACHE_TTL,
  TIER_CONFIG,
  isValidSymbol,
  isValidTimeframe,
  isValidIndicator,
  canAccessSymbol,
  canAccessIndicator,
} from './lib/constants/business-rules';

console.log('=== Part 0 Constants Verification ===\n');

// Verify counts
console.log('✓ Symbols:', VALID_SYMBOLS.length, '(should be 15)');
console.log('  - FREE:', FREE_SYMBOLS.length, '(should be 5)');
console.log('  - PRO additional:', PRO_SYMBOLS.length, '(should be 10)');

console.log('\n✓ Timeframes:', VALID_TIMEFRAMES.length, '(should be 9)');
console.log('  - M5, M15, M30, H1, H2, H4, H8, H12, D1');
console.log('  - NO M1 or W1!');

console.log('\n✓ Indicators:', ALL_INDICATORS.length, '(should be 8)');
console.log('  - Basic:', BASIC_INDICATORS.length, '(should be 2)');
console.log('  - PRO:', PRO_INDICATORS.length, '(should be 6)');

console.log('\n✓ Rate Limits:');
console.log('  - FREE:', RATE_LIMITS.FREE.requests, '/hour (should be 60)');
console.log('  - PRO:', RATE_LIMITS.PRO.requests, '/hour (should be 300)');

console.log('\n✓ Cache TTL:');
console.log('  - M5:', CACHE_TTL.M5, 's (should be 300 = 5min)');
console.log('  - H4:', CACHE_TTL.H4, 's (should be 14400 = 4hr)');
console.log('  - D1:', CACHE_TTL.D1, 's (should be 86400 = 24hr)');

// Verify helper functions
console.log('\n✓ Helper Functions:');
console.log(
  '  - isValidSymbol("XAUUSD"):',
  isValidSymbol('XAUUSD'),
  '(should be true)'
);
console.log(
  '  - isValidSymbol("INVALID"):',
  isValidSymbol('INVALID'),
  '(should be false)'
);
console.log(
  '  - isValidTimeframe("H1"):',
  isValidTimeframe('H1'),
  '(should be true)'
);
console.log(
  '  - isValidTimeframe("M1"):',
  isValidTimeframe('M1'),
  '(should be false - not supported!)'
);
console.log(
  '  - canAccessSymbol("XAUUSD", "FREE"):',
  canAccessSymbol('XAUUSD', 'FREE'),
  '(should be true)'
);
console.log(
  '  - canAccessSymbol("GBPUSD", "FREE"):',
  canAccessSymbol('GBPUSD', 'FREE'),
  '(should be false)'
);
console.log(
  '  - canAccessSymbol("GBPUSD", "PRO"):',
  canAccessSymbol('GBPUSD', 'PRO'),
  '(should be true)'
);
console.log(
  '  - canAccessIndicator("fractals", "FREE"):',
  canAccessIndicator('fractals', 'FREE'),
  '(should be true)'
);
console.log(
  '  - canAccessIndicator("zigzag", "FREE"):',
  canAccessIndicator('zigzag', 'FREE'),
  '(should be false)'
);
console.log(
  '  - canAccessIndicator("zigzag", "PRO"):',
  canAccessIndicator('zigzag', 'PRO'),
  '(should be true)'
);

console.log('\n=== All Part 0 Constants Verified ===');
console.log('✅ Ready to proceed with Part 1.1\n');

process.exit(0);
```

**Run the verification:**

```bash
npx tsx verify-part0.ts

# Expected: All checks should show correct values
# If anything is wrong, Part 0 needs to be fixed first
```

**Clean up after verification:**

```bash
rm verify-part0.ts
```

---

### Task 5: Document Any Pre-Existing Issues

**Check for known issues:**

Look for any warnings, errors, or failures that exist BEFORE we start:

1. **Console warnings during tests:**
   - CRON_SECRET warnings? (Environment config, not our problem)
   - Database connection issues? (Infrastructure, not code)
   - Deprecated packages? (Document but don't fix now)

2. **Skipped or pending tests:**

   ```bash
   npm test | grep -i "skip\|pending\|todo"

   # Document any skipped tests
   ```

3. **Known failing tests:**
   - Are there any tests marked as `.skip` or `xit`?
   - Document them in BASELINE_STATE.md

**Add to BASELINE_STATE.md:**

```markdown
## Known Pre-Existing Issues (NOT introduced by Part 1)

- [ ] CRON_SECRET warning in tests (environment config)
- [ ] [Any other issues found]

These existed BEFORE Part 1 implementation and are not blockers.
```

---

## 🎯 Success Criteria

### Must Have (STOP if any fail):

- ✅ Working tree is clean (no uncommitted changes)
- ✅ Part 0 file exists: `lib/constants/business-rules.ts`
- ✅ All tests pass (or document which don't)
- ✅ TypeScript compiles with no errors
- ✅ Part 0 constants can be imported and used
- ✅ Helper functions work correctly

### Documentation Complete:

- ✅ BASELINE_STATE.md created
- ✅ Test count documented (X suites, Y tests)
- ✅ Any pre-existing issues documented
- ✅ Verification script run successfully

### Ready to Proceed:

- ✅ Clear understanding of current state
- ✅ Baseline to compare against
- ✅ Confidence that codebase is healthy

---

## 🚫 Critical Constraints

### DO NOT:

- ❌ Make ANY code changes
- ❌ Modify ANY existing files
- ❌ Create any permanent new files (except BASELINE_STATE.md)
- ❌ Fix any bugs or issues found
- ❌ Try to "improve" anything
- ❌ Install new packages
- ❌ Update dependencies

### DO:

- ✅ Run tests and document results
- ✅ Verify imports work
- ✅ Check TypeScript compilation
- ✅ Document current state accurately
- ✅ Note any warnings or issues
- ✅ Create BASELINE_STATE.md for reference

---

## 🔍 What to Look For

### Good Signs (Proceed to Part 1.1):

```
✅ Test Suites: 108 passed, 108 total
✅ Tests: 2307 passed, 2307 total
✅ TypeScript: No errors
✅ Part 0 imports: Working
✅ All counts correct: 15 symbols, 9 timeframes, 8 indicators
```

### Warning Signs (Investigate before proceeding):

```
⚠️ Test Suites: X passed, 1 failed, X+1 total
⚠️ Tests: Y passed, Z failed, Y+Z total
⚠️ TypeScript: X errors found
⚠️ Part 0 imports: Module not found
⚠️ Counts incorrect: Wrong number of symbols/timeframes/indicators
```

**If you see warning signs:**

1. Document them in BASELINE_STATE.md
2. Determine if they're blockers:
   - **Blocker**: Test failures in indicators API, auth, or core features
   - **Not blocker**: CRON_SECRET warnings, Codecov issues, environment config
3. If blocker: Fix BEFORE proceeding to Part 1.1
4. If not blocker: Document and proceed

---

## 📊 Expected Timeline

**If everything is healthy:**

- Task 1 (Branch check): 1 minute
- Task 2 (Run tests): 3-5 minutes
- Task 3 (TypeScript): 1 minute
- Task 4 (Verify imports): 2 minutes
- Task 5 (Document issues): 1 minute

**Total**: 5-10 minutes

**If issues found:**

- Add time to investigate and document
- May need to fix issues before proceeding

---

## 📝 Example BASELINE_STATE.md

````markdown
# Pre-Flight Check Results

**Date**: December 28, 2025
**Branch**: claude/implement-phase4-constants-gYEfH
**Commit**: abc123def456
**Time**: 14:30 UTC

## Test Results

```bash
Test Suites: 108 passed, 108 total
Tests:       2307 passed, 2307 total
Snapshots:   0 total
Time:        45.234s
```
````

## Part 0 Verification

✅ **Symbols**: 15 total (5 FREE + 10 PRO)

- FREE: XAUUSD, BTCUSD, EURUSD, USDJPY, US30
- PRO: AUDJPY, AUDUSD, ETHUSD, GBPJPY, GBPUSD, NDX100, NZDUSD, USDCAD, USDCHF, XAGUSD

✅ **Timeframes**: 9 total (M5, M15, M30, H1, H2, H4, H8, H12, D1)

- NO M1 or W1 ✅

✅ **Indicators**: 8 total (2 basic + 6 PRO)

- Basic: fractals, trendlines
- PRO: momentum_candles, keltner_channels, tema, hrma, smma, zigzag

✅ **Rate Limits**: 60/hr FREE, 300/hr PRO

✅ **Cache TTL**: 300s (M5) to 86400s (D1)

## TypeScript Compilation

```bash
$ npx tsc --noEmit
# No errors ✅
```

## Known Pre-Existing Issues

- ⚠️ CRON_SECRET not configured (environment variable - not blocker)
- ⚠️ Codecov upload warnings (CI config - not blocker)

## Files Modified Since Main

```
lib/constants/business-rules.ts (Part 0)
```

## Status

✅ **READY FOR PART 1.1**

All tests passing, TypeScript clean, Part 0 constants verified.
Safe to proceed with caching utility implementation.

---

**Baseline Established**: 2307 tests passing
**Next Step**: Part 1.1 - Create cache utility (no integration)

````

---

## 🎯 Completion Checklist

- [ ] Branch verified and clean
- [ ] Part 0 file exists at `lib/constants/business-rules.ts`
- [ ] All tests run: `npm test`
- [ ] Test results documented in BASELINE_STATE.md
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] Part 0 verification script run: `npx tsx verify-part0.ts`
- [ ] Verification script deleted: `rm verify-part0.ts`
- [ ] Pre-existing issues documented (if any)
- [ ] BASELINE_STATE.md committed to repository

---

## 🚀 Next Steps

### If Pre-Flight Check Passes:
1. ✅ Commit BASELINE_STATE.md
   ```bash
   git add BASELINE_STATE.md
   git commit -m "docs: Part 1.0 pre-flight check - baseline established

   - All 2307 tests passing
   - Part 0 constants verified
   - TypeScript compiles cleanly
   - Ready for Part 1.1 (cache utility)"
````

2. ✅ Return to user and request Part 1.1 prompt

### If Pre-Flight Check Fails:

1. ❌ DO NOT PROCEED to Part 1.1
2. 📝 Document all failures in BASELINE_STATE.md
3. 🔍 Investigate root causes
4. 🛠️ Fix issues or determine they're not blockers
5. 🔄 Re-run pre-flight check
6. ✅ Only proceed when all tests pass

---

## 💡 Tips for Claude Code

1. **Don't rush** - This is a verification step, not implementation
2. **Document everything** - The BASELINE_STATE.md is critical
3. **Be honest** - If tests fail, say so clearly
4. **Don't fix** - Resist the urge to fix issues during pre-flight
5. **Verify thoroughly** - Run all checks even if early ones pass

**Remember**: The goal is to know EXACTLY what state we're in before making ANY changes.

This 10-minute investment saves hours of debugging later! 🎯
