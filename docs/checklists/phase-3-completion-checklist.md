# Phase 3 Completion Checklist

**Purpose:** Ensure code quality before marking Phase 3 complete
**When to Use:** After code generation, before moving to Phase 3.5
**Part of:** Shift-left testing strategy (Layer 1 validation)

---

## 📋 Pre-Completion Validation

Before marking Phase 3 complete, verify ALL items below:

### ✅ 1. Local Validation Passed

Run complete validation suite locally:

```bash
npm run validate
```

**Expected Result:** All checks pass with 0 errors

- [ ] ✅ TypeScript type checking passed (0 errors)
- [ ] ✅ ESLint code quality passed (0 errors, 0 warnings)
- [ ] ✅ Prettier formatting passed (all files formatted)
- [ ] ✅ Policy compliance passed (0 critical issues)

**If any fail:** Run `npm run fix` to auto-fix, then validate again.

---

### ✅ 2. Test Suite Health

Run test suite and check coverage:

```bash
npm run test:coverage
```

**Expected Result:** All tests pass, coverage meets thresholds

- [ ] ✅ All tests pass (0 failures)
- [ ] ✅ Coverage thresholds met:
  - Branches: ≥50%
  - Functions: ≥60%
  - Lines: ≥45%
  - Statements: ≥45%
- [ ] ✅ No test warnings or console errors

**If tests fail:** Fix failing tests before proceeding.

---

### ✅ 3. Build Verification

Verify Next.js build succeeds:

```bash
npm run build
```

**Expected Result:** Build completes without errors

- [ ] ✅ Build completed successfully
- [ ] ✅ No TypeScript errors during build
- [ ] ✅ No ESLint errors during build
- [ ] ✅ Build output size reasonable (<5MB for critical bundles)

**If build fails:** Fix build errors before proceeding.

---

### ✅ 4. Code Quality Checks

Manual code review checklist:

#### TypeScript Standards

- [ ] ✅ All functions have explicit return types
- [ ] ✅ No `any` types used (except in test files)
- [ ] ✅ All interfaces properly defined
- [ ] ✅ Proper imports from `@prisma/client` or OpenAPI types

#### Error Handling

- [ ] ✅ Try-catch blocks present in async functions
- [ ] ✅ User-friendly error messages
- [ ] ✅ Proper HTTP status codes (400, 401, 403, 404, 500)
- [ ] ✅ Errors logged with console.error (no console.log)

#### Authentication & Authorization

- [ ] ✅ Protected routes check session
- [ ] ✅ Resource ownership verified
- [ ] ✅ Proper 401/403 responses

#### Tier Validation

- [ ] ✅ Symbol/timeframe restrictions enforced
- [ ] ✅ Tier checks before operations
- [ ] ✅ Clear error messages for tier violations

#### Security

- [ ] ✅ No hardcoded secrets
- [ ] ✅ Environment variables used correctly
- [ ] ✅ Input validation with Zod schemas
- [ ] ✅ No SQL injection vulnerabilities

---

### ✅ 5. Git Status Check

Verify repository cleanliness:

```bash
git status
```

**Expected Result:** All changes committed, working directory clean

- [ ] ✅ All files committed (no uncommitted changes)
- [ ] ✅ Meaningful commit messages used
- [ ] ✅ No debug files in commits (.log, .tmp, etc.)
- [ ] ✅ No accidentally committed secrets

**If dirty:** Commit or stash changes before proceeding.

---

### ✅ 6. Pre-Push Validation

Test that pre-push hook will pass:

```bash
# This simulates what happens on git push
npm run type-check && npm run test:quick
```

**Expected Result:** Both commands pass

- [ ] ✅ Type check passed
- [ ] ✅ Quick tests passed

**If fails:** Fix issues before pushing.

---

### ✅ 7. Documentation Check

Verify documentation is up to date:

- [ ] ✅ API endpoints documented in OpenAPI spec
- [ ] ✅ Component README updated (if applicable)
- [ ] ✅ Environment variables documented in .env.example
- [ ] ✅ Database schema changes noted

---

## 🚀 Ready to Proceed

If ALL checkboxes above are checked ✅:

1. **Push to remote:**

   ```bash
   git push -u origin <branch-name>
   ```

2. **Monitor GitHub Actions:**
   - Wait for Track 1 CI workflows (non-blocking)
   - Verify Track 2 tests.yml passes (blocking)

3. **If all GitHub Actions pass:**
   - ✅ Phase 3 is complete
   - ✅ Ready for Phase 3.5 (Integration Testing)

4. **If any GitHub Actions fail:**
   - Review failure logs
   - Fix issues locally
   - Re-validate with this checklist
   - Push again

---

## 📊 Success Criteria

**Phase 3 is considered complete when:**

- ✅ All 7 sections above are checked
- ✅ Code pushed to remote branch
- ✅ All GitHub Actions workflows pass
- ✅ No merge conflicts with main branch

---

## 🔗 Related Documents

- `docs/principles/shift-left-testing.md` - Testing strategy overview
- `docs/policies/09-testing-framework-compliance.md` - Quality standards
- `docs/aider-context/quality-rules-summary.md` - Quick reference
- `.github/workflows/README.md` - CI/CD documentation

---

**Last Updated:** 2025-11-26
**Version:** 1.0
**Part of:** Shift-Left Testing Infrastructure
