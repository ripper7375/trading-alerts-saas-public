# Frontend Sync Workflow Testing Design

**Document Version**: 1.0.0
**Last Updated**: 2026-01-20
**Maintainer**: DevOps Team
**Purpose**: Testing architecture for frontend-backend sync workflow

---

## Table of Contents

1. [Overview](#overview)
2. [Test File Inventory](#test-file-inventory)
3. [Testing Architecture](#testing-architecture)
4. [Test Categories](#test-categories)
5. [Adding New Tests](#adding-new-tests)
6. [Updating Tests After Architecture Changes](#updating-tests-after-architecture-changes)
7. [Test Maintenance Checklist](#test-maintenance-checklist)
8. [Troubleshooting Test Failures](#troubleshooting-test-failures)

---

## Overview

### Purpose

The sync workflow testing design ensures that:

1. Frontend and backend shared files remain synchronized
2. npm scripts function correctly
3. CI/CD integration works as expected
4. File paths are accurate
5. Type definitions are complete

### Testing Philosophy

- **Automated**: All tests run without manual intervention
- **Comprehensive**: Cover all critical sync points
- **Fast**: Complete test suite runs in < 30 seconds
- **Clear**: Test failures provide actionable feedback
- **Maintainable**: Easy to update when architecture changes

---

## Test File Inventory

### Primary Test Files

| File                        | Location             | Type           | Lines | Purpose                                |
| --------------------------- | -------------------- | -------------- | ----- | -------------------------------------- |
| `test-sync-workflow.sh`     | `/tmp/` (generated)  | Shell Script   | 350   | Comprehensive sync workflow test suite |
| `check-sync-needed.js`      | `scripts/`           | Node.js Script | 96    | Detect if sync is required             |
| `sync-frontend.sh`          | `scripts/`           | Shell Script   | 119   | Execute sync operations                |
| `ci-nextjs-progressive.yml` | `.github/workflows/` | GitHub Actions | 303   | CI/CD sync validation                  |

### Supporting Test Files

| File                          | Location | Type          | Purpose                    |
| ----------------------------- | -------- | ------------- | -------------------------- |
| `package.json`                | Root     | JSON          | Define npm test scripts    |
| `SYNC-WORKFLOW-REVIEW.md`     | Root     | Documentation | Review findings and issues |
| `PRIORITY-1-FIXES-SUMMARY.md` | Root     | Documentation | Fix implementation summary |
| `PRIORITY-2-TEST-RESULTS.md`  | Root     | Documentation | Test execution results     |
| `frontend/SYNC-WORKFLOW.md`   | Frontend | Documentation | Sync workflow guide        |

### Test Data Files (Referenced)

| File                              | Location        | Purpose in Testing |
| --------------------------------- | --------------- | ------------------ |
| `types/api.ts`                    | Root & Frontend | Verify type sync   |
| `types/indicator.ts`              | Root & Frontend | Verify type sync   |
| `lib/tier-config.ts`              | Root & Frontend | Verify lib sync    |
| `lib/tier-helpers.ts`             | Root & Frontend | Verify lib sync    |
| `lib/tier-validation.ts`          | Root & Frontend | Verify lib sync    |
| `lib/utils.ts`                    | Root & Frontend | Verify lib sync    |
| `lib/constants/business-rules.ts` | Root & Frontend | Verify lib sync    |
| `lib/tier/constants.ts`           | Root & Frontend | Verify lib sync    |
| `lib/tier/validator.ts`           | Root & Frontend | Verify lib sync    |

---

## Testing Architecture

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    TESTING LAYERS                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 1: Unit Tests (Individual Script Tests)             │
│  ├─ npm script existence                                   │
│  ├─ File path validation                                   │
│  └─ Configuration correctness                              │
│                                                             │
│  Layer 2: Integration Tests (End-to-End Workflows)         │
│  ├─ Sync detection logic                                   │
│  ├─ Sync execution process                                 │
│  └─ File synchronization verification                      │
│                                                             │
│  Layer 3: System Tests (CI/CD Integration)                 │
│  ├─ GitHub Actions workflow                                │
│  ├─ Automated sync checks                                  │
│  └─ Build pipeline integration                             │
│                                                             │
│  Layer 4: Validation Tests (Data Integrity)                │
│  ├─ Type definition completeness                           │
│  ├─ Import statement validity                              │
│  └─ File content synchronization                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Test Execution Flow

```
┌────────────────────────────────────────────────────────────┐
│ 1. Manual Test Execution                                   │
│    $ bash /tmp/test-sync-workflow.sh                       │
└────────────────┬───────────────────────────────────────────┘
                 ↓
┌────────────────────────────────────────────────────────────┐
│ 2. Test Suite Initialization                               │
│    - Set environment variables                             │
│    - Initialize counters                                   │
│    - Navigate to project root                              │
└────────────────┬───────────────────────────────────────────┘
                 ↓
┌────────────────────────────────────────────────────────────┐
│ 3. Execute Test Sections (Sequential)                      │
│    ├─ Section 1: NPM Scripts (3 tests)                    │
│    ├─ Section 2: File Paths (5 tests)                     │
│    ├─ Section 3: File Sync (6 tests)                      │
│    ├─ Section 4: Sync Detection (2 tests)                 │
│    ├─ Section 5: File Existence (2 tests)                 │
│    ├─ Section 6: Documentation (3 tests)                  │
│    └─ Section 7: Type Checks (3 tests)                    │
└────────────────┬───────────────────────────────────────────┘
                 ↓
┌────────────────────────────────────────────────────────────┐
│ 4. Results Aggregation                                     │
│    - Count passed/failed tests                             │
│    - Generate summary report                               │
│    - Exit with appropriate code                            │
└────────────────┬───────────────────────────────────────────┘
                 ↓
┌────────────────────────────────────────────────────────────┐
│ 5. CI/CD Integration (Automatic)                           │
│    - GitHub Actions triggers on push/PR                    │
│    - Runs npm run sync:check                               │
│    - Fails build if sync needed                            │
└────────────────────────────────────────────────────────────┘
```

---

## Test Categories

### Category 1: NPM Script Tests

**Purpose**: Verify all required npm scripts exist and are executable

**Test Files**: `test-sync-workflow.sh` (Tests 1-3)

**What is Tested**:

```bash
# Test 1: sync:frontend exists
npm run | grep -q "sync:frontend"

# Test 2: sync:check exists
npm run | grep -q "sync:check"

# Test 3: sync:all exists
npm run | grep -q "sync:all"
```

**Expected Behavior**:

- All three scripts found in `package.json`
- Scripts are executable via `npm run`

**Update Trigger**: When adding/removing/renaming npm scripts in `package.json`

**Maintenance**:

```javascript
// package.json - If you add a new sync-related script:
"scripts": {
  "sync:frontend": "bash scripts/sync-frontend.sh",
  "sync:check": "node scripts/check-sync-needed.js",
  "sync:all": "npm run sync:frontend && npm run validate",
  "sync:verify": "..." // NEW SCRIPT - Update test to check for it
}
```

**Update Test**:

```bash
# Add to test-sync-workflow.sh
print_test_header "Verify npm sync:verify script exists"
npm run | grep -q "sync:verify"
check_result
```

---

### Category 2: File Path Validation Tests

**Purpose**: Ensure sync scripts reference correct file paths

**Test Files**: `test-sync-workflow.sh` (Tests 4-8)

**What is Tested**:

```bash
# Correct paths present
grep -q "lib/tier/validator.ts" scripts/sync-frontend.sh
grep -q "lib/tier-validation.ts" scripts/sync-frontend.sh

# Wrong paths absent
! grep -q "lib/tier/validation.ts" scripts/sync-frontend.sh
```

**Expected Behavior**:

- All referenced files exist in filesystem
- No references to non-existent files
- Paths match actual file locations

**Update Trigger**: When:

- Moving files to different directories
- Renaming files
- Adding new files to sync list
- Removing files from sync list

**Maintenance Example**:

**Scenario**: You move `lib/tier/validator.ts` → `lib/validation/tier-validator.ts`

**Steps**:

1. Update `scripts/sync-frontend.sh`:

   ```bash
   SHARED_FILES=(
       # ... other files
       "lib/validation/tier-validator.ts"  # NEW PATH
   )
   ```

2. Update `scripts/check-sync-needed.js`:

   ```javascript
   const SYNC_TRIGGERS = [
     // ... other files
     'lib/validation/tier-validator.ts', // NEW PATH
   ];
   ```

3. Update test expectations:

   ```bash
   # In test-sync-workflow.sh
   print_test_header "Check sync-frontend.sh has correct file paths"
   grep -q "lib/validation/tier-validator.ts" scripts/sync-frontend.sh
   check_result
   ```

4. Update file existence tests:
   ```bash
   # Update SECTION 5
   for f in "lib/validation/tier-validator.ts" ...; do
       if [ ! -f "$f" ]; then
           echo "❌ Missing: $f"
       fi
   done
   ```

---

### Category 3: File Synchronization Tests

**Purpose**: Verify files are identical between root and frontend

**Test Files**: `test-sync-workflow.sh` (Tests 9-14)

**What is Tested**:

```bash
# Compare root and frontend files
diff -q types/api.ts frontend/types/api.ts
diff -q lib/tier-config.ts frontend/lib/tier-config.ts
```

**Expected Behavior**:

- All synced files are byte-for-byte identical
- No drift between root and frontend versions

**Update Trigger**: When:

- Adding new files to sync list
- Removing files from sync list
- Changing sync strategy (selective vs full sync)

**Maintenance Example**:

**Scenario**: Add new file `lib/tier/permissions.ts` to sync list

**Steps**:

1. Add to sync scripts:

   ```bash
   # scripts/sync-frontend.sh
   SHARED_FILES=(
       # ... existing files
       "lib/tier/permissions.ts"  # NEW FILE
   )
   ```

2. Add to sync check:

   ```javascript
   // scripts/check-sync-needed.js
   const SYNC_TRIGGERS = [
     // ... existing files
     'lib/tier/permissions.ts', // NEW FILE
   ];
   ```

3. Add test case:

   ```bash
   # In test-sync-workflow.sh, Section 3
   print_test_header "Verify lib/tier/permissions.ts is in sync"
   diff -q lib/tier/permissions.ts frontend/lib/tier/permissions.ts > /dev/null 2>&1
   check_result
   ```

4. Add to file existence tests:

   ```bash
   # Section 5 - Root files
   for f in "lib/tier/permissions.ts" ...; do
       test -e "$f" && echo "✅ $f" || echo "❌ $f MISSING"
   done

   # Section 5 - Frontend files
   for f in "frontend/lib/tier/permissions.ts" ...; do
       test -e "$f" && echo "✅ $f" || echo "❌ $f MISSING"
   done
   ```

---

### Category 4: Sync Detection Tests

**Purpose**: Verify sync need detection logic works correctly

**Test Files**: `test-sync-workflow.sh` (Tests 15-16)

**What is Tested**:

```bash
# Test 15: No sync needed when no changes
npm run sync:check
# Expected: Exit 0, "No changed files detected"

# Test 16: Sync needed when file modified
echo "// test" >> lib/tier-config.ts
npm run sync:check
# Expected: Exit 1, "SYNC REQUIRED"
```

**Expected Behavior**:

- Detects when sync-triggering files are modified
- Ignores modifications to non-synced files
- Provides clear output about what needs syncing

**Update Trigger**: When:

- Changing sync detection logic
- Adding new file patterns to detect
- Modifying git diff strategy

**Maintenance Example**:

**Scenario**: Add detection for specific subdirectories only

**Steps**:

1. Update detection logic:

   ```javascript
   // scripts/check-sync-needed.js
   const SYNC_TRIGGERS = [
     'types/', // All types
     'lib/tier/', // All tier files
     'lib/constants/business-*.ts', // Specific pattern
   ];
   ```

2. Update test expectations:
   ```bash
   # Test that pattern matching works
   print_test_header "Test sync detection with pattern"
   echo "// test" >> lib/constants/business-rules.ts
   npm run sync:check || true
   if grep -q "business-rules.ts" /tmp/sync-detect-output.txt; then
       echo "✅ Pattern detection working"
   fi
   git restore lib/constants/business-rules.ts
   ```

---

### Category 5: File Existence Tests

**Purpose**: Verify all required files exist in both root and frontend

**Test Files**: `test-sync-workflow.sh` (Tests 17-18)

**What is Tested**:

```bash
# Root files
for f in "types/api.ts" "lib/tier-config.ts" ...; do
    test -f "$f" || echo "❌ Missing: $f"
done

# Frontend files
for f in "frontend/types/api.ts" "frontend/lib/tier-config.ts" ...; do
    test -f "$f" || echo "❌ Missing: $f"
done
```

**Expected Behavior**:

- All files in sync list exist in root
- All files in sync list exist in frontend
- No broken references

**Update Trigger**: When:

- Adding files to project
- Removing files from project
- Restructuring directory layout

---

### Category 6: Documentation Tests

**Purpose**: Verify documentation is accurate and up-to-date

**Test Files**: `test-sync-workflow.sh` (Tests 19-21)

**What is Tested**:

```bash
# Correct paths documented
grep -q "lib/tier/validator.ts" frontend/SYNC-WORKFLOW.md

# Wrong paths not documented
! grep -q "lib/tier/validation.ts" frontend/SYNC-WORKFLOW.md
```

**Expected Behavior**:

- Documentation reflects actual file paths
- All synced files are documented
- No outdated references

**Update Trigger**: When:

- Adding/removing synced files
- Changing file paths
- Updating sync procedures

**Maintenance Example**:

**Scenario**: Update documentation after file reorganization

**Steps**:

1. Update table in `frontend/SYNC-WORKFLOW.md`:

   ```markdown
   | Modified File/Directory         | Action Required             | Why                       |
   | ------------------------------- | --------------------------- | ------------------------- |
   | `lib/tier/validator.ts`         | Run `npm run sync:frontend` | Tier validation utilities |
   | `lib/validation/permissions.ts` | Run `npm run sync:frontend` | Permission validation     |
   ```

2. Update test to check new documentation:
   ```bash
   print_test_header "Verify documentation mentions lib/validation/permissions.ts"
   grep -q "lib/validation/permissions.ts" frontend/SYNC-WORKFLOW.md
   check_result
   ```

---

### Category 7: Type Definition Tests

**Purpose**: Verify critical type definitions are present and importable

**Test Files**: `test-sync-workflow.sh` (Tests 22-24)

**What is Tested**:

```bash
# Type exists in file
grep -q "export interface CompleteMarketData" frontend/types/indicator.ts

# Import statement present
grep -q "import type { CompleteMarketData" frontend/types/api.ts
```

**Expected Behavior**:

- All exported types are present
- Import statements reference existing types
- No missing type definitions

**Update Trigger**: When:

- Adding new type definitions
- Removing type definitions
- Renaming types
- Changing type imports

**Maintenance Example**:

**Scenario**: Add new type `TierPermissions` to sync workflow

**Steps**:

1. Create type in root:

   ```typescript
   // types/tier.ts
   export interface TierPermissions {
     canAccessPro: boolean;
     // ...
   }
   ```

2. Sync to frontend (run sync script)

3. Add test to verify:

   ```bash
   print_test_header "Verify TierPermissions exists in frontend/types/tier.ts"
   grep -q "export interface TierPermissions" frontend/types/tier.ts
   check_result
   ```

4. If type is imported elsewhere, test the import:
   ```bash
   print_test_header "Verify types/api.ts imports TierPermissions"
   grep -q "import type { TierPermissions } from './tier'" frontend/types/api.ts
   check_result
   ```

---

## Adding New Tests

### Step-by-Step Guide

#### Step 1: Identify What to Test

Ask yourself:

- What could break if this changes?
- How do I verify it's working correctly?
- What's the failure scenario?

#### Step 2: Choose Test Category

Determine which category your test falls into:

- NPM scripts → Category 1
- File paths → Category 2
- File sync → Category 3
- Sync detection → Category 4
- File existence → Category 5
- Documentation → Category 6
- Type definitions → Category 7

#### Step 3: Write the Test

Add to appropriate section in `test-sync-workflow.sh`:

```bash
print_test_header "Your test description here"
echo "  Additional context if needed"

# Your test command
your_test_command && expected_condition

# Check result
check_result
```

#### Step 4: Update Test Count

The test suite automatically counts tests, but update documentation:

```bash
# In test summary section
echo "  Total Tests: $((PASSED_TESTS + FAILED_TESTS))"  # Auto-updates
```

#### Step 5: Run Test Suite

```bash
bash /tmp/test-sync-workflow.sh
```

#### Step 6: Update Documentation

Update this document with:

- New test description
- Maintenance instructions
- Update triggers

### Example: Adding New Test for Prisma Schema Sync

```bash
# Add to Category 3 (File Synchronization Tests)

print_test_header "Verify prisma/schema.prisma is in sync"
if [ -f "prisma/schema.prisma" ] && [ -f "frontend/prisma/schema.prisma" ]; then
    diff -q prisma/schema.prisma frontend/prisma/schema.prisma > /dev/null 2>&1
    check_result
else
    echo -e "${YELLOW}⚠️  SKIP - Prisma schema not present in both locations${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi
```

---

## Updating Tests After Architecture Changes

### Common Architecture Changes

#### Change 1: Move File to New Directory

**Example**: Move `lib/tier/validator.ts` → `lib/validation/tier.ts`

**Files to Update**:

1. **scripts/sync-frontend.sh** (Line 36-44):

   ```bash
   SHARED_FILES=(
       # ... other files
       "lib/validation/tier.ts"  # UPDATED PATH
   )
   ```

2. **scripts/check-sync-needed.js** (Line 12-22):

   ```javascript
   const SYNC_TRIGGERS = [
     // ... other files
     'lib/validation/tier.ts', // UPDATED PATH
   ];
   ```

3. **test-sync-workflow.sh** (Multiple locations):

   ```bash
   # Section 2: File path tests
   grep -q "lib/validation/tier.ts" scripts/sync-frontend.sh

   # Section 3: Sync tests
   diff -q lib/validation/tier.ts frontend/lib/validation/tier.ts

   # Section 5: Existence tests
   for f in "lib/validation/tier.ts" ...; do
   ```

4. **frontend/SYNC-WORKFLOW.md** (Line 19-28):

   ```markdown
   | `lib/validation/tier.ts` | Run `npm run sync:frontend` | Tier validation utilities |
   ```

5. **CI/CD** (No changes needed - uses npm scripts)

#### Change 2: Add New File to Sync List

**Example**: Add `lib/tier/rate-limits.ts`

**Files to Update**:

1. **scripts/sync-frontend.sh**:

   ```bash
   SHARED_FILES=(
       # ... existing files
       "lib/tier/rate-limits.ts"  # NEW
   )
   ```

2. **scripts/check-sync-needed.js**:

   ```javascript
   const SYNC_TRIGGERS = [
     // ... existing files
     'lib/tier/rate-limits.ts', // NEW
   ];
   ```

3. **test-sync-workflow.sh**:

   ```bash
   # Add sync test
   print_test_header "Verify lib/tier/rate-limits.ts is in sync"
   diff -q lib/tier/rate-limits.ts frontend/lib/tier/rate-limits.ts
   check_result

   # Add to existence tests
   for f in "lib/tier/rate-limits.ts" ...; do
   ```

4. **frontend/SYNC-WORKFLOW.md**:
   ```markdown
   | `lib/tier/rate-limits.ts` | Run `npm run sync:frontend` | Rate limit configurations |
   ```

#### Change 3: Remove File from Sync List

**Example**: Remove `lib/utils.ts` (no longer shared)

**Files to Update**:

1. **scripts/sync-frontend.sh**:

   ```bash
   SHARED_FILES=(
       "lib/tier-config.ts"
       # "lib/utils.ts"  # REMOVED - now backend-only
       "lib/tier-helpers.ts"
   )
   ```

2. **scripts/check-sync-needed.js**:

   ```javascript
   const SYNC_TRIGGERS = [
     'types/',
     // 'lib/utils.ts',  // REMOVED
     'lib/tier-config.ts',
   ];
   ```

3. **test-sync-workflow.sh**:

   ```bash
   # Remove from Section 3
   # print_test_header "Verify lib/utils.ts is in sync"  # REMOVED
   # diff -q lib/utils.ts frontend/lib/utils.ts
   # check_result

   # Remove from Section 5 existence tests
   for f in "types/api.ts" "lib/tier-config.ts" ...; do  # utils.ts removed
   ```

4. **frontend/SYNC-WORKFLOW.md**:
   ```markdown
   ### Sync is NOT required for:

   - `lib/utils.ts` - Backend only (utility functions)
   ```

#### Change 4: Change Sync Strategy

**Example**: Sync entire `lib/tier/` directory instead of individual files

**Files to Update**:

1. **scripts/sync-frontend.sh**:

   ```bash
   # OLD: Individual files
   # SHARED_FILES=(
   #     "lib/tier/constants.ts"
   #     "lib/tier/validator.ts"
   # )

   # NEW: Entire directory
   echo "Syncing lib/tier/ directory..."
   mkdir -p "$FRONTEND_DIR/lib/tier"
   cp -r lib/tier/* "$FRONTEND_DIR/lib/tier/"
   ```

2. **scripts/check-sync-needed.js**:

   ```javascript
   // OLD: Individual files
   // const SYNC_TRIGGERS = [
   //   'lib/tier/constants.ts',
   //   'lib/tier/validator.ts',
   // ];

   // NEW: Directory pattern
   const SYNC_TRIGGERS = [
     'lib/tier/', // Matches entire directory
   ];
   ```

3. **test-sync-workflow.sh**:
   ```bash
   # Instead of individual file tests, test directory sync
   print_test_header "Verify lib/tier/ directory is in sync"
   diff -r lib/tier/ frontend/lib/tier/ > /dev/null 2>&1
   check_result
   ```

---

## Test Maintenance Checklist

Use this checklist when making architecture changes:

### When Adding New Shared Files

- [ ] Add file path to `scripts/sync-frontend.sh` SHARED_FILES array
- [ ] Add file path to `scripts/check-sync-needed.js` SYNC_TRIGGERS array
- [ ] Add sync verification test to `test-sync-workflow.sh` Section 3
- [ ] Add file existence check to `test-sync-workflow.sh` Section 5 (root)
- [ ] Add file existence check to `test-sync-workflow.sh` Section 5 (frontend)
- [ ] Add entry to `frontend/SYNC-WORKFLOW.md` table
- [ ] Run test suite: `bash /tmp/test-sync-workflow.sh`
- [ ] Run actual sync: `npm run sync:frontend`
- [ ] Verify files are synced: `diff <file> frontend/<file>`
- [ ] Commit all changes together

### When Removing Shared Files

- [ ] Remove file path from `scripts/sync-frontend.sh`
- [ ] Remove file path from `scripts/check-sync-needed.js`
- [ ] Remove sync test from `test-sync-workflow.sh` Section 3
- [ ] Remove existence checks from `test-sync-workflow.sh` Section 5
- [ ] Move entry to "NOT required" section in `frontend/SYNC-WORKFLOW.md`
- [ ] Run test suite to verify removal: `bash /tmp/test-sync-workflow.sh`
- [ ] Delete frontend copy if no longer needed: `rm frontend/<file>`
- [ ] Commit all changes together

### When Moving/Renaming Files

- [ ] Update file path in `scripts/sync-frontend.sh`
- [ ] Update file path in `scripts/check-sync-needed.js`
- [ ] Update file path in all tests in `test-sync-workflow.sh`
- [ ] Update file path in `frontend/SYNC-WORKFLOW.md`
- [ ] Update imports in TypeScript files if needed
- [ ] Run test suite: `bash /tmp/test-sync-workflow.sh`
- [ ] Run sync: `npm run sync:frontend`
- [ ] Delete old frontend file: `rm frontend/<old-path>`
- [ ] Verify new file synced: `diff <new-path> frontend/<new-path>`
- [ ] Commit all changes together

### When Changing Sync Logic

- [ ] Update sync implementation in `scripts/sync-frontend.sh`
- [ ] Update detection logic in `scripts/check-sync-needed.js` if needed
- [ ] Update tests to match new behavior in `test-sync-workflow.sh`
- [ ] Update documentation in `frontend/SYNC-WORKFLOW.md`
- [ ] Test with manual file modification
- [ ] Run full test suite: `bash /tmp/test-sync-workflow.sh`
- [ ] Test CI/CD integration locally
- [ ] Commit and push to test in CI
- [ ] Monitor CI/CD execution
- [ ] Document changes in git commit message

### Quarterly Maintenance

- [ ] Review all synced files - are they still needed?
- [ ] Check for files that should be synced but aren't
- [ ] Verify test suite still covers all scenarios
- [ ] Update test count in documentation
- [ ] Review and update this maintenance document
- [ ] Test full workflow end-to-end
- [ ] Update version number in this document

---

## Troubleshooting Test Failures

### Common Test Failures and Fixes

#### Failure: "npm script not found"

**Symptoms**:

```
❌ FAIL - Verify npm sync:frontend script exists
```

**Cause**: Script missing from `package.json`

**Fix**:

```json
// package.json
"scripts": {
  "sync:frontend": "bash scripts/sync-frontend.sh",  // Add this
  "sync:check": "node scripts/check-sync-needed.js",
  "sync:all": "npm run sync:frontend && npm run validate"
}
```

#### Failure: "File path not found in sync script"

**Symptoms**:

```
❌ FAIL - Check sync-frontend.sh has correct file paths
```

**Cause**: File path not in SHARED_FILES array

**Fix**:

```bash
# scripts/sync-frontend.sh
SHARED_FILES=(
    "lib/tier-config.ts"
    "lib/tier/validator.ts"  # Add missing path
)
```

#### Failure: "Files are not in sync"

**Symptoms**:

```
❌ FAIL - Verify lib/tier-config.ts is in sync
Files lib/tier-config.ts and frontend/lib/tier-config.ts differ
```

**Cause**: Frontend file is outdated

**Fix**:

```bash
# Run sync to update frontend
npm run sync:frontend

# Or manually copy
cp lib/tier-config.ts frontend/lib/tier-config.ts
```

#### Failure: "File does not exist"

**Symptoms**:

```
❌ FAIL - Verify all synced files exist in root
  ❌ Missing: lib/tier/permissions.ts
```

**Cause**: File referenced in tests but doesn't exist

**Fix**:

```bash
# Option 1: Create the missing file
touch lib/tier/permissions.ts

# Option 2: Remove from sync list if not needed
# Edit scripts/sync-frontend.sh and remove the reference
```

#### Failure: "Type definition not found"

**Symptoms**:

```
❌ FAIL - Verify CompleteMarketData exists in frontend/types/indicator.ts
```

**Cause**: Type not synced or file outdated

**Fix**:

```bash
# Sync types
npm run sync:frontend

# Verify
grep "CompleteMarketData" frontend/types/indicator.ts
```

#### Failure: "Sync detection not working"

**Symptoms**:

```
❌ FAIL - Test sync detection with file modification
Expected: SYNC REQUIRED
Got: No sync required
```

**Cause**: File pattern not in SYNC_TRIGGERS

**Fix**:

```javascript
// scripts/check-sync-needed.js
const SYNC_TRIGGERS = [
  'types/',
  'lib/tier-config.ts', // Make sure this file is listed
];
```

---

## Version History

| Version | Date       | Changes                         | Author      |
| ------- | ---------- | ------------------------------- | ----------- |
| 1.0.0   | 2026-01-20 | Initial testing design document | DevOps Team |

---

## See Also

- [Frontend Sync Workflow Usage Guide](./SYNC-WORKFLOW-USAGE-GUIDE.md) - How to use sync commands
- [frontend/SYNC-WORKFLOW.md](./frontend/SYNC-WORKFLOW.md) - User-facing sync workflow documentation
- [SYNC-WORKFLOW-REVIEW.md](./SYNC-WORKFLOW-REVIEW.md) - Initial review and issues found
- [PRIORITY-1-FIXES-SUMMARY.md](./PRIORITY-1-FIXES-SUMMARY.md) - Fixes implementation
- [PRIORITY-2-TEST-RESULTS.md](./PRIORITY-2-TEST-RESULTS.md) - Test execution results

---

**Document maintained by**: DevOps Team
**Last review**: 2026-01-20
**Next review**: 2026-04-20 (quarterly)
