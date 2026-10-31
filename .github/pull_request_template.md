# Pull Request

## 📝 Description

<!-- Provide a clear and concise description of the changes -->

### What does this PR do?

<!-- Describe the feature, fix, or improvement -->

### Why is this change needed?

<!-- Explain the motivation and context -->

### Related Issues

<!-- Link to related GitHub issues -->

Closes #

---

## 🧪 Testing

### How has this been tested?

<!-- Describe the testing you performed -->

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed
- [ ] All existing tests pass

### Test Coverage

```bash
# Run this locally and paste results
npm run test:coverage
```

**Coverage:** **%
**New Tests:\*\* \*\*
**Updated Tests:** \_\_

---

## 🛡️ Quality Gate Checklist (MANDATORY)

Before submitting this PR, verify ALL items pass:

### Layer 1: Local Validation

- [ ] ✅ `npm run validate` passed locally (TypeScript, ESLint, Prettier, Policies)
- [ ] ✅ `npm run test` passed locally (all tests green)
- [ ] ✅ `npm run build` succeeded (Next.js build completes)

### Layer 2: Pre-Commit/Pre-Push Hooks

- [ ] ✅ Pre-commit hook ran successfully (ESLint + Prettier)
- [ ] ✅ Pre-push hook ran successfully (Type check + Quick tests)
- [ ] ✅ No hooks were bypassed with `--no-verify`

### Code Quality Standards

#### TypeScript Compliance

- [ ] ✅ All functions have explicit return types
- [ ] ✅ No `any` types used (or justified in comments)
- [ ] ✅ Proper type imports from `@prisma/client` or OpenAPI
- [ ] ✅ Nullable types handled with `?.` or `??`

#### Error Handling

- [ ] ✅ Try-catch blocks in all async functions
- [ ] ✅ User-friendly error messages
- [ ] ✅ Proper HTTP status codes (400, 401, 403, 404, 500)
- [ ] ✅ No `console.log()` statements (only console.error for errors)

#### Authentication & Security

- [ ] ✅ Protected routes check session
- [ ] ✅ Resource ownership verified (userId checks)
- [ ] ✅ Input validation with Zod schemas
- [ ] ✅ No hardcoded secrets or credentials

#### Tier Validation (if applicable)

- [ ] ✅ Symbol/timeframe restrictions enforced
- [ ] ✅ Tier checks before operations
- [ ] N/A - Does not involve tier-restricted features

---

## 📚 Documentation

- [ ] ✅ Code comments added for complex logic
- [ ] ✅ API endpoints documented in OpenAPI spec (if new endpoints)
- [ ] ✅ README updated (if new features)
- [ ] ✅ Environment variables documented in `.env.example` (if new vars)
- [ ] ✅ Database schema changes documented (if schema modified)

---

## 🚀 Deployment Checklist

- [ ] ✅ No breaking changes to existing APIs
- [ ] ✅ Database migrations included (if schema changed)
- [ ] ✅ Environment variables added to Railway/Vercel (if new vars)
- [ ] ✅ No dependencies with known vulnerabilities
- [ ] N/A - No deployment-specific changes

---

## 📊 Layer 3: GitHub Actions (Auto-Checked)

<!-- These run automatically - no manual checkboxes needed -->

**Track 1: Development CI (Non-Blocking)**

- OpenAPI Validation: Auto-checked ⏳
- Dependencies Security: Auto-checked ⏳
- Flask CI: Auto-checked ⏳
- Next.js CI: Auto-checked ⏳
- API Tests: Auto-checked ⏳

**Track 2: Deployment Gate (BLOCKING)**

- tests.yml: Auto-checked ⏳ (**MUST PASS**)
- Deployment: no deploy workflow; Vercel builds `main` itself and Railway follows `docs/runbooks/railway-services-deploy.md`

---

## 🔍 Code Review Focus Areas

<!-- Help reviewers by highlighting areas needing attention -->

**Please review:**

- [ ] Logic in `<file>:<line>` - complex algorithm
- [ ] Database queries in `<file>` - performance concerns
- [ ] Security checks in `<file>` - authorization logic

---

## 📷 Screenshots (if applicable)

<!-- Add screenshots for UI changes -->

**Before:**

<!-- Screenshot before changes -->

**After:**

<!-- Screenshot after changes -->

---

## ✅ Pre-Merge Verification

**Before merging, confirm:**

- [ ] ✅ All GitHub Actions workflows passed (green checkmarks)
- [ ] ✅ At least 1 approving review received
- [ ] ✅ No merge conflicts with base branch
- [ ] ✅ Branch is up to date with main
- [ ] ✅ All conversations resolved

---

## 📖 References

- [Shift-Left Testing Principles](../docs/principles/shift-left-testing.md)
- [Testing Framework Compliance](../docs/policies/09-testing-framework-compliance.md)
- [Quality Rules Summary](../docs/aider-context/quality-rules-summary.md)
- [CI/CD Workflows](../.github/workflows/README.md)

---

**PR Author:** @<!-- your-github-username -->
**Date Created:** <!-- YYYY-MM-DD -->
**Target Branch:** `main`
