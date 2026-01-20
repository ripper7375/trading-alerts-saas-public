# Frontend Sync Workflow Usage Guide

**Document Version**: 1.0.0
**Last Updated**: 2026-01-20
**Maintainer**: DevOps Team
**Purpose**: Practical guide for checking sync status, running sync, and validation

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Command Reference](#command-reference)
3. [Check If Sync Is Needed](#check-if-sync-is-needed)
4. [Run Sync](#run-sync)
5. [Run Sync + Validation](#run-sync--validation)
6. [Common Workflows](#common-workflows)
7. [Troubleshooting](#troubleshooting)
8. [Integration with Git](#integration-with-git)
9. [CI/CD Integration](#cicd-integration)
10. [Best Practices](#best-practices)

---

## Quick Start

### 30-Second Overview

```bash
# 1. Check if sync is needed
npm run sync:check

# 2. If sync needed, run it
npm run sync:frontend

# 3. Verify everything works
npm run sync:all
```

That's it! These three commands handle 90% of sync operations.

---

## Command Reference

### Available npm Scripts

| Command | Script | Purpose | Exit Code |
|---------|--------|---------|-----------|
| `npm run sync:check` | `node scripts/check-sync-needed.js` | Check if sync needed | 0 = No sync, 1 = Sync needed |
| `npm run sync:frontend` | `bash scripts/sync-frontend.sh` | Execute sync operation | 0 = Success, 1 = Error |
| `npm run sync:all` | `npm run sync:frontend && npm run validate` | Sync + full validation | 0 = All pass, 1 = Failure |

### Script Locations

| Script | Path | Language | Executable |
|--------|------|----------|-----------|
| Sync Check | `scripts/check-sync-needed.js` | Node.js | ✅ Via npm |
| Sync Execute | `scripts/sync-frontend.sh` | Bash | ✅ Via npm or direct |

---

## Check If Sync Is Needed

### Purpose

Determines whether shared files between backend (root) and frontend have diverged and need synchronization.

### When to Use

- **Before committing** - Ensure you haven't forgotten to sync
- **After pulling changes** - Check if upstream changes need sync
- **During code review** - Verify PR includes synced files
- **In CI/CD pipeline** - Automated sync verification

### Command

```bash
npm run sync:check
```

### What It Does

1. **Retrieves changed files** from git:
   ```bash
   git diff --cached --name-only  # Staged files
   git diff --name-only           # Unstaged files
   ```

2. **Compares against trigger patterns**:
   - `types/` - All type files
   - `lib/tier-config.ts`
   - `lib/tier-helpers.ts`
   - `lib/tier-validation.ts`
   - `lib/utils.ts`
   - `lib/constants/business-rules.ts`
   - `lib/tier/constants.ts`
   - `lib/tier/validator.ts`
   - `prisma/schema.prisma`

3. **Reports results**:
   - Exit 0: No sync needed ✅
   - Exit 1: Sync required ⚠️

### Example Outputs

#### ✅ No Sync Needed

```bash
$ npm run sync:check

> trading-alerts-saas-v7@0.1.0 sync:check
> node scripts/check-sync-needed.js

🔍 Checking if frontend sync is needed...

Found 3 changed file(s):
  - app/api/auth/route.ts
  - lib/db/client.ts
  - README.md

✅ No sync required - changes do not affect frontend.
```

**Exit Code**: 0
**Meaning**: You can commit without running sync

#### ⚠️ Sync Required

```bash
$ npm run sync:check

> trading-alerts-saas-v7@0.1.0 sync:check
> node scripts/check-sync-needed.js

🔍 Checking if frontend sync is needed...

Found 2 changed file(s):
  - types/api.ts
  - lib/tier-config.ts

⚠️  SYNC REQUIRED - The following changes affect frontend:

  📁 types/api.ts
     └── Matches trigger: types/

  📁 lib/tier-config.ts
     └── Matches trigger: lib/tier-config.ts

📋 Action needed:
   Run: npm run sync:frontend
   Or:  bash scripts/sync-frontend.sh
```

**Exit Code**: 1
**Meaning**: You must run sync before committing

### Using in Scripts

```bash
# Check sync status and act accordingly
if npm run sync:check; then
    echo "✅ Ready to commit"
    git commit -m "feat: add new feature"
else
    echo "⚠️  Running sync first..."
    npm run sync:frontend
    git add frontend/
    git commit -m "feat: add new feature + sync"
fi
```

### Integration with Git Hooks

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Check if sync is needed
npm run sync:check || {
  echo ""
  echo "❌ Frontend sync required!"
  echo ""
  echo "Please run: npm run sync:frontend"
  echo "Then commit again."
  exit 1
}
```

---

## Run Sync

### Purpose

Synchronizes shared files from backend (root) to frontend directory.

### When to Use

- **After modifying shared files** - Sync changes to frontend
- **After pulling upstream** - Apply upstream changes to frontend
- **Before committing** - Ensure frontend is up-to-date
- **Manual sync check failed** - Respond to sync:check warning

### Command

```bash
npm run sync:frontend
```

### What It Does

#### Step 1: Sync Types

```bash
# Copies all type files
cp -r types/* frontend/types/
```

**Files Synced**:
- `types/api.ts`
- `types/indicator.ts`
- `types/tier.ts`
- `types/alert.ts`
- `types/watchlist.ts`
- `types/user.ts`
- `types/payment.ts`
- `types/disbursement.ts`
- `types/dlocal.ts`
- All other type files

#### Step 2: Sync Shared Utilities

```bash
# Copies individual shared lib files
SHARED_FILES=(
    "lib/tier-config.ts"
    "lib/tier-helpers.ts"
    "lib/tier-validation.ts"
    "lib/utils.ts"
    "lib/constants/business-rules.ts"
    "lib/tier/constants.ts"
    "lib/tier/validator.ts"
)

for file in "${SHARED_FILES[@]}"; do
    cp "$file" "frontend/$file"
done
```

#### Step 3: Check Prisma Schema

```bash
# If schema changed, copy it
if ! diff -q prisma/schema.prisma frontend/prisma/schema.prisma; then
    cp prisma/schema.prisma frontend/prisma/schema.prisma
    echo "⚠️ Run 'cd frontend && npx prisma generate' to update client"
fi
```

#### Step 4: Verify TypeScript

```bash
cd frontend
npx tsc --noEmit  # Type check frontend code
```

### Example Output

```bash
$ npm run sync:frontend

> trading-alerts-saas-v7@0.1.0 sync:frontend
> bash scripts/sync-frontend.sh

🔄 Frontend-Backend Sync Tool
==============================

Step 1: Syncing types...
✓ Types synced

Step 2: Syncing shared utilities...
✓ Synced lib/tier-config.ts
✓ Synced lib/tier-helpers.ts
✓ Synced lib/tier-validation.ts
✓ Synced lib/utils.ts
✓ Synced lib/constants/business-rules.ts
✓ Synced lib/tier/constants.ts
✓ Synced lib/tier/validator.ts

Step 3: Checking Prisma schema...
✓ Prisma schemas already in sync

Step 4: Verifying TypeScript...
✓ TypeScript verification passed

==============================
Sync completed successfully!
==============================

Next steps:
1. Review changes: git diff frontend/
2. Test the frontend: cd frontend && npm run build
3. Commit changes: git add frontend/ && git commit -m 'sync: update frontend from backend changes'
```

### After Sync

Always review what changed:

```bash
# See all changes
git diff frontend/

# See specific file changes
git diff frontend/types/api.ts
git diff frontend/lib/tier-config.ts
```

### Common Warnings

#### ⚠️ File Not Found

```bash
⚠ File not found: lib/tier/permissions.ts
```

**Meaning**: File listed in SHARED_FILES doesn't exist
**Action**: Either create the file or remove from SHARED_FILES array

#### ⚠️ TypeScript Errors

```bash
✗ TypeScript errors found - please fix before committing
```

**Meaning**: Synced files have TypeScript errors
**Action**: Fix type errors in root files, then re-sync

#### ⚠️ Prisma Generate Needed

```bash
⚠️ Run 'cd frontend && npx prisma generate' to update Prisma client
```

**Meaning**: Prisma schema changed
**Action**: Regenerate Prisma client in frontend

```bash
cd frontend
npx prisma generate
cd ..
git add frontend/prisma/ frontend/node_modules/.prisma/
```

---

## Run Sync + Validation

### Purpose

Runs sync operation followed by comprehensive validation to ensure code quality.

### When to Use

- **Before pushing to remote** - Full quality check
- **Before creating PR** - Ensure everything passes
- **After major changes** - Comprehensive verification
- **Scheduled quality checks** - Nightly/weekly full validation

### Command

```bash
npm run sync:all
```

### What It Does

This command runs two operations sequentially:

```bash
npm run sync:frontend && npm run validate
```

#### Part 1: Sync Frontend

(See [Run Sync](#run-sync) section above)

#### Part 2: Validate

Runs multiple validation layers:

```bash
npm run validate:types    # TypeScript type checking
npm run validate:lint     # ESLint code quality
npm run validate:format   # Prettier formatting
npm run validate:policies # Custom policy checks
```

### Example Output

```bash
$ npm run sync:all

> trading-alerts-saas-v7@0.1.0 sync:all
> npm run sync:frontend && npm run validate

> trading-alerts-saas-v7@0.1.0 sync:frontend
> bash scripts/sync-frontend.sh

🔄 Frontend-Backend Sync Tool
==============================
[... sync output ...]
✓ Sync completed successfully!

> trading-alerts-saas-v7@0.1.0 validate
> npm run validate:types && npm run validate:lint && npm run validate:format && npm run validate:policies

> trading-alerts-saas-v7@0.1.0 validate:types
> echo '🔍 Checking TypeScript types...' && tsc --noEmit

🔍 Checking TypeScript types...
✅ TypeScript validation passed

> trading-alerts-saas-v7@0.1.0 validate:lint
> echo '🔍 Checking code quality...' && next lint --max-warnings 0

🔍 Checking code quality...
✅ ESLint validation passed

> trading-alerts-saas-v7@0.1.0 validate:format
> echo '🔍 Checking code formatting...' && prettier --check .

🔍 Checking code formatting...
✅ Prettier validation passed

> trading-alerts-saas-v7@0.1.0 validate:policies
> echo '🔍 Checking policy compliance...' && node scripts/validate-file.js --all

🔍 Checking policy compliance...
✅ All policy checks passed!

✅ All validations complete!
```

### Validation Layers Explained

#### Layer 1: TypeScript Type Checking

```bash
tsc --noEmit
```

**Checks**:
- No type errors
- All imports resolve
- No implicit `any` types
- Return types specified
- Type definitions complete

**Common Failures**:
```bash
error TS2304: Cannot find name 'CompleteMarketData'.
error TS2345: Argument of type 'unknown' not assignable to parameter of type 'string'.
```

**Fix**: Correct type definitions or run sync again

#### Layer 2: ESLint Code Quality

```bash
next lint --max-warnings 0
```

**Checks**:
- No ESLint errors
- No ESLint warnings (strict mode)
- React hooks rules followed
- Import organization correct
- No unused variables

**Common Failures**:
```bash
✖ Problems (0 errors, 2 warnings)
ESLint found too many warnings (maximum: 0)
```

**Fix**: Run `npm run lint:fix` to auto-fix

#### Layer 3: Prettier Formatting

```bash
prettier --check .
```

**Checks**:
- All files properly formatted
- Consistent indentation
- Correct quote style
- Proper line endings

**Common Failures**:
```bash
[warn] lib/tier-config.ts
[warn] types/api.ts
[warn] Code style issues found in the above file(s). Forgot to run Prettier?
```

**Fix**: Run `npm run format` to auto-format

#### Layer 4: Policy Compliance

```bash
node scripts/validate-file.js --all
```

**Checks**:
- Authentication present
- Tier validation included
- Error handling comprehensive
- Input validation present
- Security standards met

**Common Failures**:
```bash
🔴 Critical Issues (1):
  - Missing authentication check in app/api/alerts/route.ts
```

**Fix**: Add missing patterns per policy guidelines

---

## Common Workflows

### Workflow 1: Daily Development

**Scenario**: You're working on a feature that modifies shared types

```bash
# 1. Make changes to backend
vim types/api.ts
vim lib/tier-config.ts

# 2. Check if sync needed (optional, informational)
npm run sync:check
# Output: ⚠️  SYNC REQUIRED

# 3. Run sync
npm run sync:frontend

# 4. Review synced changes
git diff frontend/

# 5. Commit everything together
git add types/api.ts lib/tier-config.ts frontend/
git commit -m "feat: add new tier validation logic"

# 6. Push
git push
```

### Workflow 2: Before Creating PR

**Scenario**: You want to ensure everything is perfect before PR

```bash
# 1. Run full sync + validation
npm run sync:all

# 2. If validation fails, fix issues
npm run lint:fix    # Fix linting
npm run format      # Fix formatting
# Fix type errors manually

# 3. Re-run validation
npm run sync:all

# 4. Create PR
gh pr create --title "feat: new feature" --body "Description..."
```

### Workflow 3: After Pulling Upstream

**Scenario**: You pulled changes from main and need to update frontend

```bash
# 1. Pull latest changes
git pull origin main

# 2. Check if sync needed
npm run sync:check

# 3. If needed, sync
npm run sync:frontend

# 4. Commit synced files
git add frontend/
git commit -m "sync: update frontend after pulling main"

# 5. Continue working
```

### Workflow 4: Automated CI/CD

**Scenario**: CI/CD pipeline needs to verify sync status

```yaml
# .github/workflows/ci.yml
- name: Check frontend sync
  run: npm run sync:check

- name: Run sync if needed
  if: failure()
  run: |
    npm run sync:frontend
    git diff --exit-code frontend/ || {
      echo "❌ Frontend not synced! Please run npm run sync:frontend locally."
      exit 1
    }
```

### Workflow 5: Pre-commit Hook

**Scenario**: Automatically check sync before every commit

```bash
# .husky/pre-commit
#!/bin/sh
npm run sync:check || {
  echo ""
  echo "Running automatic sync..."
  npm run sync:frontend
  git add frontend/
  echo "✅ Frontend synced automatically"
}
```

### Workflow 6: Fixing Sync Issues

**Scenario**: CI failed with "Frontend sync required"

```bash
# 1. Pull latest (if not already)
git pull

# 2. Run sync
npm run sync:frontend

# 3. Check what changed
git status
git diff frontend/

# 4. Add and commit
git add frontend/
git commit -m "sync: update frontend files"

# 5. Push
git push

# 6. CI should pass now
```

---

## Troubleshooting

### Issue 1: Sync Check Says "No Changed Files"

**Symptoms**:
```bash
$ npm run sync:check
No changed files detected.
✅ No sync required
```

**But you know you changed files!**

**Cause**: Files not tracked by git

**Solution**:
```bash
# Add files to git first
git add types/api.ts
git add lib/tier-config.ts

# Then check sync
npm run sync:check
# Now shows: ⚠️  SYNC REQUIRED
```

### Issue 2: Sync Completes but Files Still Different

**Symptoms**:
```bash
$ npm run sync:frontend
✓ Sync completed successfully!

$ diff types/api.ts frontend/types/api.ts
Files differ
```

**Cause 1**: File not in SHARED_FILES list

**Solution**:
```bash
# Add to scripts/sync-frontend.sh
SHARED_FILES=(
    # ... existing files
    "types/api.ts"  # Add this if missing
)
```

**Cause 2**: File manually modified in frontend

**Solution**:
```bash
# Manually copy to override
cp types/api.ts frontend/types/api.ts

# Or re-run sync
npm run sync:frontend
```

### Issue 3: TypeScript Errors After Sync

**Symptoms**:
```bash
$ npm run sync:frontend
✗ TypeScript errors found
error TS2307: Cannot find module './indicator'
```

**Cause**: Missing dependency file not synced

**Solution**:
```bash
# Check what file is being imported
grep "from './indicator'" types/api.ts
# Output: import type { CompleteMarketData } from './indicator';

# Ensure indicator.ts is synced
ls frontend/types/indicator.ts
# If missing, add to sync list or check sync script
```

### Issue 4: Permission Denied Running Sync

**Symptoms**:
```bash
$ npm run sync:frontend
bash: scripts/sync-frontend.sh: Permission denied
```

**Cause**: Script not executable

**Solution**:
```bash
# Make script executable
chmod +x scripts/sync-frontend.sh

# Or run via bash
bash scripts/sync-frontend.sh
```

### Issue 5: CI Fails but Local Passes

**Symptoms**:
- Local: `npm run sync:check` → ✅ No sync required
- CI: Frontend sync check FAILED

**Cause**: Different git state in CI

**Solution**:
```bash
# CI checks commits, not working directory
# Ensure you committed synced files

git status
# Should show: nothing to commit

# If frontend/ shows changes:
git add frontend/
git commit -m "sync: add missing frontend files"
git push
```

### Issue 6: Prisma Client Out of Date

**Symptoms**:
```bash
⚠️ Run 'cd frontend && npx prisma generate' to update Prisma client
```

**Cause**: Prisma schema changed

**Solution**:
```bash
# Generate in frontend
cd frontend
npx prisma generate

# Return to root
cd ..

# Commit generated files
git add frontend/prisma/ frontend/node_modules/.prisma/
git commit -m "chore: regenerate Prisma client"
```

---

## Integration with Git

### Git Workflow Integration

#### Option 1: Manual Sync (Recommended)

```bash
# 1. Make changes
vim types/api.ts

# 2. Check if sync needed
npm run sync:check

# 3. If needed, sync manually
npm run sync:frontend

# 4. Review and commit
git add types/api.ts frontend/types/api.ts
git commit -m "feat: update API types"
```

**Pros**: Full control, review changes
**Cons**: Can forget to sync

#### Option 2: Pre-commit Hook Check

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
npm run sync:check || {
  echo "❌ Frontend sync required!"
  echo "Run: npm run sync:frontend"
  exit 1
}
```

**Pros**: Never forget to sync
**Cons**: Blocks commits if not synced

#### Option 3: Automatic Pre-commit Sync

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
if ! npm run sync:check; then
  echo "Running automatic sync..."
  npm run sync:frontend
  git add frontend/
fi
```

**Pros**: Fully automated
**Cons**: May commit unintended changes

### Git Ignore Patterns

**DO NOT** ignore synced files:

```gitignore
# ❌ WRONG - Do not ignore
# frontend/types/
# frontend/lib/

# ✅ CORRECT - Keep synced files tracked
```

Synced files should be committed and tracked.

### Git Diff Tips

```bash
# See all synced file changes
git diff frontend/types/ frontend/lib/

# See specific file
git diff frontend/types/api.ts

# See what would be committed
git diff --cached frontend/

# Compare root and frontend
diff -u types/api.ts frontend/types/api.ts
```

---

## CI/CD Integration

### GitHub Actions Integration

The sync check runs automatically in CI via `.github/workflows/ci-nextjs-progressive.yml`:

```yaml
check-frontend-sync:
  name: Check Frontend Sync Status
  runs-on: ubuntu-latest
  needs: check-project-status
  if: needs.check-project-status.outputs.has_config == 'true'

  steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: Install pnpm
      uses: pnpm/action-setup@v4
      with:
        version: 10

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: 'pnpm'

    - name: Install dependencies
      run: pnpm install --frozen-lockfile

    - name: Check if frontend sync is needed
      run: |
        if pnpm run sync:check; then
          echo "✅ Frontend is in sync"
        else
          echo "❌ Frontend sync required!"
          exit 1
        fi
```

### CI Workflow

```
Push to GitHub
    ↓
CI Triggered
    ↓
check-frontend-sync job runs
    ↓
Runs: pnpm run sync:check
    ↓
├─ ✅ Exit 0 → Pass → Continue to build
└─ ❌ Exit 1 → Fail → Stop CI, show error
```

### CI Failure Response

When CI fails with sync error:

```bash
# 1. Local: Run sync
npm run sync:frontend

# 2. Local: Commit synced files
git add frontend/
git commit -m "sync: update frontend files"

# 3. Local: Push
git push

# 4. CI: Re-runs automatically
# 5. CI: Should pass now ✅
```

### Testing CI Integration Locally

```bash
# Simulate CI check
git stash  # Stash working changes
git checkout main
npm install
npm run sync:check
git stash pop

# If sync needed, CI would fail
```

---

## Best Practices

### 1. Check Sync Before Committing

```bash
# Always check
npm run sync:check

# If sync needed
npm run sync:frontend
```

### 2. Commit Synced Files Together

```bash
# ✅ GOOD - Atomic commit
git add types/api.ts frontend/types/api.ts
git commit -m "feat: update API types"

# ❌ BAD - Separate commits (can cause drift)
git add types/api.ts
git commit -m "feat: update API types"
# (Forgot to sync!)
```

### 3. Review Synced Changes

```bash
# Always review what changed
git diff frontend/

# Ensure changes are expected
```

### 4. Run Full Validation Before PR

```bash
# Before creating PR
npm run sync:all

# Fix any issues
npm run lint:fix
npm run format

# Re-validate
npm run sync:all
```

### 5. Document Sync in Commit Messages

```bash
# ✅ GOOD - Clear commit message
git commit -m "feat: add tier permissions + sync"

# ✅ GOOD - Separate sync commit
git commit -m "sync: update frontend after tier changes"

# ❌ BAD - No mention of sync
git commit -m "fix stuff"
```

### 6. Keep Sync Scripts Updated

When adding new shared files:

```bash
# 1. Add to sync-frontend.sh
# 2. Add to check-sync-needed.js
# 3. Test sync works
# 4. Update documentation
```

### 7. Monitor CI Failures

If CI fails with sync errors:
- Fix immediately
- Don't merge until passing
- Investigate why sync was missed

### 8. Use Pre-commit Hooks

Automate sync checking:

```bash
# .husky/pre-commit
npm run sync:check || {
  echo "Run: npm run sync:frontend"
  exit 1
}
```

### 9. Regular Sync Audits

Monthly:
- Review all synced files
- Check for drift
- Verify sync scripts are correct
- Update documentation

### 10. Document Architecture Changes

When changing sync strategy:
- Update scripts
- Update documentation
- Update tests
- Notify team

---

## Quick Reference Card

### Commands

| Task | Command | Exit Code |
|------|---------|-----------|
| Check if sync needed | `npm run sync:check` | 0 = No, 1 = Yes |
| Run sync | `npm run sync:frontend` | 0 = Success |
| Sync + validate | `npm run sync:all` | 0 = All pass |
| Fix formatting | `npm run format` | - |
| Fix linting | `npm run lint:fix` | - |

### Files That Trigger Sync

- `types/*` - All type files
- `lib/tier-config.ts`
- `lib/tier-helpers.ts`
- `lib/tier-validation.ts`
- `lib/utils.ts`
- `lib/constants/business-rules.ts`
- `lib/tier/constants.ts`
- `lib/tier/validator.ts`
- `prisma/schema.prisma`

### Sync Script Locations

- Check: `scripts/check-sync-needed.js`
- Execute: `scripts/sync-frontend.sh`
- CI: `.github/workflows/ci-nextjs-progressive.yml`

### Common Issues

| Problem | Solution |
|---------|----------|
| CI fails with sync error | Run `npm run sync:frontend` and commit |
| Files differ after sync | Check SHARED_FILES includes file |
| TypeScript errors | Sync dependencies first |
| Permission denied | `chmod +x scripts/sync-frontend.sh` |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-01-20 | Initial usage guide | DevOps Team |

---

## See Also

- [Sync Workflow Testing Design](./SYNC-WORKFLOW-TESTING-DESIGN.md) - Testing architecture
- [frontend/SYNC-WORKFLOW.md](./frontend/SYNC-WORKFLOW.md) - User documentation
- [SYNC-WORKFLOW-REVIEW.md](./SYNC-WORKFLOW-REVIEW.md) - Review findings

---

**Document maintained by**: DevOps Team
**Last review**: 2026-01-20
**Next review**: 2026-04-20 (quarterly)
