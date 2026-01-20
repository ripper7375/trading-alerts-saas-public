# Sync Workflow Review Report

**Date**: 2026-01-20
**Reviewer**: Claude Code
**Document Reviewed**: `frontend/SYNC-WORKFLOW.md`
**Status**: ⚠️ **CRITICAL ISSUES FOUND**

---

## Executive Summary

The sync workflow documentation (`frontend/SYNC-WORKFLOW.md`) contains **critical inaccuracies** that prevent the documented workflow from functioning correctly. Multiple npm scripts are referenced but don't exist, file paths are incorrect, and several files are out of sync between root and frontend directories.

**Impact**: Medium to High
- Developers following this guide will encounter errors
- Sync operations cannot be executed as documented
- Files are already out of sync

---

## Issues Found

### 🔴 CRITICAL: Missing npm Scripts

**Issue**: The workflow documentation references npm scripts that **do not exist** in `package.json`.

**Referenced Scripts** (from SYNC-WORKFLOW.md):
```bash
npm run sync:frontend    # Line 48
npm run sync:check       # Line 12, 399
npm run sync:all         # Line 102
```

**Actual State**: None of these scripts exist in `/package.json`

**Evidence**:
```bash
$ grep -E '"sync:|"check:sync' package.json
# No output - scripts don't exist
```

**Impact**:
- All documented sync commands will fail with "script not found" error
- CI/CD workflows referencing these scripts will fail
- Pre-commit hooks will fail

**Location in Doc**: Lines 12, 48, 89, 102, 399, 419, 421

---

### 🔴 CRITICAL: Incorrect File Path in Sync Script

**Issue**: The sync script references a file that **doesn't exist**.

**In `scripts/sync-frontend.sh` (line 42)**:
```bash
SHARED_FILES=(
    "lib/tier-config.ts"
    "lib/tier-helpers.ts"
    "lib/utils.ts"
    "lib/constants/business-rules.ts"
    "lib/tier/constants.ts"
    "lib/tier/validation.ts"    # ❌ WRONG - File doesn't exist
)
```

**Actual File**: `lib/tier/validator.ts` (NOT `validation.ts`)

**Evidence**:
```bash
$ ls -la lib/tier/
total 25
drwxr-xr-x  3 root root    88 Jan 20 19:39 .
drwxr-xr-x 27 root root   570 Jan 20 19:39 ..
drwxr-xr-x  2 root root    65 Jan 20 19:39 __tests__
-rw-r--r--  1 root root 12131 Jan 20 19:39 constants.ts
-rw-r--r--  1 root root   187 Jan 20 19:39 index.ts
-rw-r--r--  1 root root 10670 Jan 20 19:39 validator.ts  # ✅ Actual file
```

**Impact**:
- Sync script shows warning: "⚠ File not found: lib/tier/validation.ts"
- `lib/tier/validator.ts` is never synced to frontend
- Frontend may use outdated tier validation logic

**Location in Doc**: Lines 24, 42, 468 (references `lib/tier/validation.ts`)

---

### 🔴 CRITICAL: Files Already Out of Sync

**Issue 1: types/api.ts is out of sync**

**Missing Content in Frontend**: Lines 85-145 from root `types/api.ts` are **missing** in `frontend/types/api.ts`

**Missing Interfaces**:
- `MarketDataResponse` - Tier-aware market data responses
- `IndicatorAccessInfo` - Tier upgrade prompt data
- Related imports and types for 57-column schema

**Evidence**:
```bash
$ diff types/api.ts frontend/types/api.ts
85,145d84
< // TIER-AWARE MARKET DATA RESPONSES (57-COLUMN SCHEMA)
< import type { Tier, Symbol, Timeframe } from './tier';
< import type { CompleteMarketData, FreeMarketData } from './indicator';
< export interface MarketDataResponse { ... }
< export interface IndicatorAccessInfo { ... }
```

**Impact**: Frontend cannot properly handle tier-aware market data responses

---

**Issue 2: lib/tier-validation.ts has different content**

**Differences Found**:
- Root: Uses `fractal_diagonal`, `fractal_horizontal`, `moving_averages`, `body_momentum`, `heiken_ashi`
- Frontend: Uses `fractals`, `trendlines` (outdated names)
- Comments differ in describing indicator column counts

**Evidence**:
```bash
$ diff lib/tier-validation.ts frontend/lib/tier-validation.ts
22,24c22,24
<  * FREE: 5 alerts, 1 watchlist/5 items, 60 req/hour, 2 FREE indicators (16 columns)
<  * PRO: 20 alerts, 5 watchlists/50 items, 300 req/hour, all 8 indicators (49 columns)
---
>  * FREE: 5 alerts, 1 watchlist/5 items, 60 req/hour, basic indicators
>  * PRO: 20 alerts, 5 watchlists/50 items, 300 req/hour, all indicators

35c35
<     indicators: ['fractal_diagonal', 'fractal_horizontal'] as const,
---
>     indicators: ['fractals', 'trendlines'] as const,
```

**Impact**: Frontend uses outdated indicator names, may cause API mismatches

---

### 🟡 MEDIUM: Documentation References Wrong File in Triggers Table

**Issue**: Table at line 24 references `lib/tier/validation.ts` which doesn't exist.

**Location**: Lines 24, 42

**Should Be**: `lib/tier/validator.ts`

---

### 🟡 MEDIUM: Missing lib/tier-validation.ts from Sync List

**Issue**: The file `lib/tier-validation.ts` exists in both root and frontend, is already out of sync, but is **NOT** listed in the sync triggers.

**Files Listed in Workflow**:
```
lib/tier-config.ts       ✅ Listed
lib/tier-helpers.ts      ✅ Listed
lib/utils.ts             ✅ Listed
lib/constants/business-rules.ts  ✅ Listed
lib/tier/constants.ts    ✅ Listed
lib/tier/validation.ts   ❌ Wrong filename
lib/tier-validation.ts   ❌ NOT LISTED (but should be!)
```

**Impact**: Changes to tier validation logic in root won't be synced to frontend

---

## Files Actually Requiring Sync (Current State)

Based on the actual codebase, these files should be synced:

| Root File | Frontend File | Currently Synced? | In Sync? |
|-----------|--------------|-------------------|----------|
| `types/*` | `frontend/types/*` | ✅ Yes | ❌ **No** (api.ts out of sync) |
| `lib/tier-config.ts` | `frontend/lib/tier-config.ts` | ✅ Yes | ✅ Yes |
| `lib/tier-helpers.ts` | `frontend/lib/tier-helpers.ts` | ✅ Yes | ✅ Yes |
| `lib/tier-validation.ts` | `frontend/lib/tier-validation.ts` | ❌ **No** | ❌ **No** |
| `lib/utils.ts` | `frontend/lib/utils.ts` | ✅ Yes | ✅ Yes |
| `lib/constants/business-rules.ts` | `frontend/lib/constants/business-rules.ts` | ✅ Yes | ✅ Yes |
| `lib/tier/constants.ts` | `frontend/lib/tier/constants.ts` | ✅ Yes | ✅ Yes |
| `lib/tier/validator.ts` | `frontend/lib/tier/validator.ts` | ❌ **No** | ❓ Unknown |

---

## Recommended Fixes

### Priority 1: Critical Fixes (Immediate)

#### 1. Add Missing npm Scripts to package.json

**Add to root `package.json` scripts section**:
```json
"sync:frontend": "bash scripts/sync-frontend.sh",
"sync:check": "node scripts/check-sync-needed.js",
"sync:all": "npm run sync:frontend && npm run validate"
```

#### 2. Fix File Path in sync-frontend.sh

**Change line 42 in `scripts/sync-frontend.sh`**:
```bash
# FROM:
"lib/tier/validation.ts"

# TO:
"lib/tier/validator.ts"
```

#### 3. Add lib/tier-validation.ts to Sync List

**Add to `scripts/sync-frontend.sh` SHARED_FILES array**:
```bash
SHARED_FILES=(
    "lib/tier-config.ts"
    "lib/tier-helpers.ts"
    "lib/tier-validation.ts"    # ADD THIS
    "lib/utils.ts"
    "lib/constants/business-rules.ts"
    "lib/tier/constants.ts"
    "lib/tier/validator.ts"     # FIX THIS (was validation.ts)
)
```

**Add to `scripts/check-sync-needed.js` SYNC_TRIGGERS array**:
```javascript
const SYNC_TRIGGERS = [
  'types/',
  'lib/tier-config.ts',
  'lib/tier-helpers.ts',
  'lib/tier-validation.ts',    // ADD THIS
  'lib/utils.ts',
  'lib/constants/business-rules.ts',
  'lib/tier/constants.ts',
  'lib/tier/validator.ts',     // FIX THIS
];
```

#### 4. Sync Out-of-Sync Files

**Sync types/api.ts**:
```bash
cp types/api.ts frontend/types/api.ts
```

**Sync lib/tier-validation.ts**:
```bash
cp lib/tier-validation.ts frontend/lib/tier-validation.ts
```

#### 5. Update Documentation

**Update `frontend/SYNC-WORKFLOW.md`**:

Line 24 - Change:
```markdown
| `lib/tier/validation.ts`       | Run `npm run sync:frontend` | Tier validation functions    |
```

To:
```markdown
| `lib/tier/validator.ts`        | Run `npm run sync:frontend` | Tier validation utilities    |
| `lib/tier-validation.ts`       | Run `npm run sync:frontend` | Tier validation logic        |
```

---

### Priority 2: Verification Steps

After applying fixes, verify:

```bash
# 1. Check npm scripts exist
npm run | grep sync
# Expected output:
#   sync:frontend
#   sync:check
#   sync:all

# 2. Test sync script doesn't show warnings
bash scripts/sync-frontend.sh
# Should NOT show: "⚠ File not found: lib/tier/validation.ts"

# 3. Verify files are in sync
diff types/api.ts frontend/types/api.ts
# Expected: No differences

diff lib/tier-validation.ts frontend/lib/tier-validation.ts
# Expected: No differences

# 4. Test sync check
npm run sync:check
# Expected: "✅ No sync required"
```

---

## Testing the Workflow

After fixes, test the complete workflow:

### Test 1: Modify a synced file
```bash
# 1. Modify a tier config value
echo "// Test comment" >> lib/tier-config.ts

# 2. Check if sync is detected
npm run sync:check
# Expected: Exit code 1, message "⚠️ SYNC REQUIRED"

# 3. Run sync
npm run sync:frontend
# Expected: Success, no warnings

# 4. Verify sync worked
diff lib/tier-config.ts frontend/lib/tier-config.ts
# Expected: No differences

# 5. Clean up test
git restore lib/tier-config.ts frontend/lib/tier-config.ts
```

### Test 2: Verify non-synced file ignored
```bash
# 1. Modify a backend-only file
echo "// Test" >> lib/db/client.ts

# 2. Check sync
npm run sync:check
# Expected: Exit code 0, "✅ No sync required"

# 3. Clean up
git restore lib/db/client.ts
```

---

## Summary of Required Actions

### For Scripts Team:
- [ ] Add 3 missing npm scripts to `package.json`
- [ ] Fix `lib/tier/validation.ts` → `lib/tier/validator.ts` in `scripts/sync-frontend.sh`
- [ ] Add `lib/tier-validation.ts` to both sync scripts
- [ ] Test sync scripts work without errors

### For Documentation Team:
- [ ] Update `frontend/SYNC-WORKFLOW.md` table at line 24
- [ ] Add entry for `lib/tier-validation.ts`
- [ ] Verify all file paths in examples are correct

### For Sync Team:
- [ ] Run `cp types/api.ts frontend/types/api.ts` to sync types
- [ ] Run `cp lib/tier-validation.ts frontend/lib/tier-validation.ts` to sync validation
- [ ] Verify no other files are out of sync
- [ ] Run full sync: `npm run sync:frontend` (after scripts are fixed)

### For QA Team:
- [ ] Test modified sync workflow per "Testing the Workflow" section
- [ ] Verify CI/CD doesn't fail on sync checks
- [ ] Confirm pre-commit hooks work correctly

---

## Risk Assessment

**Current State Risk**: 🔴 **HIGH**
- Documented workflow is non-functional
- Files are already out of sync
- Developers cannot follow documented process

**After Fixes Risk**: 🟢 **LOW**
- All scripts will work as documented
- Files will be in sync
- Automated checks will prevent future drift

---

## Additional Recommendations

### 1. Add Automated Sync Verification to CI

Add to `.github/workflows/ci.yml`:
```yaml
- name: Check frontend sync
  run: npm run sync:check
```

### 2. Consider Husky Pre-commit Hook

Add to `.husky/pre-commit`:
```bash
npm run sync:check || {
  echo "❌ Frontend sync required!"
  echo "Run: npm run sync:frontend"
  exit 1
}
```

### 3. Add Sync Status to README

Add a badge or section showing sync status.

---

## Appendix: File Verification Commands

```bash
# Check all mentioned files exist in root
for f in types/ lib/tier-config.ts lib/tier-helpers.ts lib/tier-validation.ts \
         lib/utils.ts lib/constants/business-rules.ts lib/tier/constants.ts \
         lib/tier/validator.ts; do
  test -e "$f" && echo "✅ $f" || echo "❌ $f MISSING"
done

# Check all sync targets exist in frontend
for f in frontend/types/ frontend/lib/tier-config.ts \
         frontend/lib/tier-helpers.ts frontend/lib/tier-validation.ts \
         frontend/lib/utils.ts frontend/lib/constants/business-rules.ts \
         frontend/lib/tier/constants.ts frontend/lib/tier/validator.ts; do
  test -e "$f" && echo "✅ $f" || echo "❌ $f MISSING"
done

# Compare all synced files
diff -r types/ frontend/types/
diff lib/tier-config.ts frontend/lib/tier-config.ts
diff lib/tier-helpers.ts frontend/lib/tier-helpers.ts
diff lib/tier-validation.ts frontend/lib/tier-validation.ts
diff lib/utils.ts frontend/lib/utils.ts
diff lib/constants/business-rules.ts frontend/lib/constants/business-rules.ts
diff lib/tier/constants.ts frontend/lib/tier/constants.ts
diff lib/tier/validator.ts frontend/lib/tier/validator.ts
```

---

**End of Review Report**

**Status**: ⚠️ Requires immediate attention
**Estimated Fix Time**: 30-45 minutes
**Testing Time**: 15-20 minutes
**Total Time**: ~1 hour
