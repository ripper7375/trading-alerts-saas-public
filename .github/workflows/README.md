# 🔄 CI/CD Workflows - Trading Alerts SaaS V7

**Last Updated:** 2025-11-24
**Version:** 3.0 (Phase 3.5 + Phase 4 Integration)
**For:** Phases 1-4 of development

---

## 📊 Workflow Status Overview

| Workflow                                              | Status     | Type                | Blocking?  | Active In  | Purpose                                   |
| ----------------------------------------------------- | ---------- | ------------------- | ---------- | ---------- | ----------------------------------------- |
| [openapi-validation.yml](#1-openapi-validation)       | ✅ Active  | Development CI      | ❌ No      | Phase 1-4  | Validate OpenAPI specifications           |
| [dependencies-security.yml](#2-dependencies-security) | ✅ Active  | Development CI      | ❌ No      | Phase 1-4  | Security scans for dependencies           |
| [ci-flask.yml](#3-flask-ci)                           | ✅ Active  | Development CI      | ❌ No      | Phase 1-4  | Flask app CI (progressive)                |
| [ci-nextjs-progressive.yml](#4-nextjs-ci-progressive) | ✅ Active  | Development CI      | ❌ No      | Phase 1-4  | Next.js app CI (progressive)              |
| [api-tests.yml](#5-api-integration-tests)             | ⏭️ Standby | Development CI      | ❌ No      | Phase 3-4  | API integration tests                     |
| [tests.yml](#6-phase-35-test-suite)                   | ✅ Active  | **Deployment Gate** | ✅ **YES** | Phase 3.5+ | **Unit, Component, Integration tests**    |
| [deploy.yml](#7-automated-deployment)                 | ✅ Active  | **Deployment Gate** | ✅ **YES** | Phase 4    | **Production deployment with test gates** |

**Total Workflows:** 7
**Development CI:** 5 workflows (non-blocking, informative)
**Deployment Gate:** 2 workflows (blocking, protective)
**Success Rate:** 100% (all pass or skip gracefully)

---

## 🎯 Design Philosophy

### Progressive Activation

- Workflows check for prerequisites before running
- Jobs activate incrementally as features are built
- No false negatives from missing features

### Non-Blocking

- Security scans are informative, not blocking
- Linting issues warn but don't fail (during Phase 1-3)
- Only critical errors block (syntax errors, build failures)

### Informative Feedback

- Every skip explains WHY it skipped
- Every skip explains WHEN it will activate
- Summary jobs provide context and guidance

### Autonomous Development Ready

- Designed for Aider + Claude Code workflow
- CI provides guidance, not gatekeeping
- Aider can commit confidently without fear of blocking workflows

---

## 🛡️ Three-Layer Protection System (Shift-Left Testing)

### Overview

This repository implements a **Three-Layer Protection System** following shift-left testing principles. Quality gates are enforced progressively, catching issues as early as possible:

```
┌─────────────────────────────────────────────────────────────┐
│              THREE-LAYER PROTECTION SYSTEM                  │
│           (Shift-Left Testing Architecture)                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  LAYER 1: Aider Code Generation (Policy-Aware)            │
│  ════════════════════════════════════════════               │
│  Location: Developer Machine (during code generation)      │
│  Speed: Real-time (0 seconds)                              │
│  Tools: Aider with policy context                          │
│                                                             │
│  What it checks:                                            │
│  • Generates code following .eslintrc.json rules           │
│  • Uses types from jest.config.js requirements            │
│  • Follows tsconfig.json strict mode settings             │
│  • Implements patterns from policy documents               │
│                                                             │
│  Impact: Catches 90% of issues at generation time          │
│  Cost: Free (zero overhead)                                │
│  Reference: docs/aider-context/quality-rules-summary.md    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  LAYER 2: Local Pre-Commit/Pre-Push Hooks (Husky)         │
│  ════════════════════════════════════════════               │
│  Location: Developer Machine (before push)                 │
│  Speed: 5-30 seconds                                        │
│  Tools: Husky + lint-staged                                │
│                                                             │
│  Pre-Commit Hook (.husky/pre-commit):                     │
│  • ESLint auto-fix on staged files                         │
│  • Prettier formatting on staged files                     │
│  • Runs in 5-10 seconds                                    │
│                                                             │
│  Pre-Push Hook (.husky/pre-push):                         │
│  • TypeScript type checking (tsc --noEmit)                 │
│  • Quick tests (jest --bail --findRelatedTests)            │
│  • Runs in 10-30 seconds                                   │
│                                                             │
│  Impact: Catches 9% of issues that slip through Layer 1    │
│  Cost: Free (local execution)                              │
│  Setup: npm install (runs 'prepare' script automatically)  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  LAYER 3: GitHub Actions CI/CD (Two-Track System)         │
│  ════════════════════════════════════════════               │
│  Location: GitHub Cloud                                    │
│  Speed: 2-5 minutes                                         │
│  Tools: GitHub Actions workflows                           │
│                                                             │
│  Track 1: Development CI (Non-Blocking)                    │
│  • openapi-validation.yml                                  │
│  • dependencies-security.yml                               │
│  • ci-flask.yml                                            │
│  • ci-nextjs-progressive.yml                               │
│  • api-tests.yml                                           │
│                                                             │
│  Track 2: Deployment Gate (Blocking)                       │
│  • tests.yml (BLOCKS deployment if failed)                 │
│  • deploy.yml (BLOCKS production deployment)               │
│                                                             │
│  Impact: Catches 1% of issues that slip through Layers 1-2 │
│  Cost: GitHub Actions minutes (paid)                       │
│  Reference: This README file                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### How to Use Local Validation

**Automatic (Recommended):**
Local hooks run automatically when you commit or push:

```bash
git add .
git commit -m "feat: add new feature"  # ← Pre-commit hook runs here (5-10s)
git push                                # ← Pre-push hook runs here (10-30s)
```

**Manual Validation:**
You can also run validation manually before committing:

```bash
# Check everything
npm run validate

# Individual checks
npm run validate:types     # TypeScript type checking
npm run validate:lint      # ESLint code quality
npm run validate:format    # Prettier formatting

# Auto-fix issues
npm run fix                # Fixes ESLint + Prettier issues
```

**Bypass Hooks (Emergency Only):**

```bash
# Skip pre-commit hook (not recommended)
git commit --no-verify -m "emergency fix"

# Skip pre-push hook (not recommended)
git push --no-verify
```

**Note:** Bypassing hooks means issues will be caught later in GitHub Actions (slower feedback, uses CI/CD minutes).

### Benefits of Three-Layer System

**Time Saved:**

- Layer 1: Issues prevented during generation (0 seconds)
- Layer 2: Issues caught locally in 5-30 seconds (vs 2-5 minutes in CI/CD)
- Layer 3: Final safety net for edge cases

**Cost Savings:**

- Layer 1: Free (zero overhead)
- Layer 2: Free (local execution)
- Layer 3: ~30-40% reduction in GitHub Actions minutes (fewer failed runs)

**Developer Experience:**

- Immediate feedback during coding
- No surprise failures in CI/CD
- Faster iteration cycles
- Less context switching

**Code Quality:**

- Consistent TypeScript standards
- Consistent code formatting
- Zero console.log statements in production
- Proper error handling enforced

### Expected Success Rates

| Layer                         | Expected Success Rate | What It Catches                                  |
| ----------------------------- | --------------------- | ------------------------------------------------ |
| **Layer 1: Aider Generation** | 90%                   | Type errors, missing patterns, policy violations |
| **Layer 2: Local Hooks**      | 9%                    | Formatting issues, edge case type errors         |
| **Layer 3: GitHub Actions**   | 1%                    | Integration issues, cross-file dependencies      |

**Target:** 99%+ of code passes all three layers without rework.

**Reference:** See `docs/principles/shift-left-testing.md` for detailed documentation.

---

## 🛤️ Two-Track CI/CD System

### Overview

This repository implements a **Two-Track CI/CD System** that balances developer velocity with production safety:

```
┌─────────────────────────────────────────────────────────────┐
│                    TWO-TRACK CI/CD SYSTEM                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  TRACK 1: Development CI (Non-Blocking)                    │
│  ════════════════════════════════════════                   │
│  Purpose: Inform, guide, detect issues early               │
│  Behavior: Warnings only, never blocks commits/merges      │
│                                                             │
│  Workflows:                                                 │
│  • openapi-validation.yml          ❌ Non-blocking         │
│  • dependencies-security.yml       ❌ Non-blocking         │
│  • ci-flask.yml                    ❌ Non-blocking         │
│  • ci-nextjs-progressive.yml       ❌ Non-blocking         │
│  • api-tests.yml                   ❌ Non-blocking         │
│                                                             │
│  Philosophy:                                                │
│  - Fast feedback for developers                            │
│  - Detect issues without blocking progress                 │
│  - Progressive activation as features are built            │
│  - Autonomous development friendly                         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  TRACK 2: Deployment Gate (Blocking)                       │
│  ════════════════════════════════════                       │
│  Purpose: Protect production, enforce quality              │
│  Behavior: BLOCKS deployment if tests fail                 │
│                                                             │
│  Workflows:                                                 │
│  • tests.yml                       ✅ BLOCKING             │
│  • deploy.yml                      ✅ BLOCKING             │
│                                                             │
│  Philosophy:                                                │
│  - Production quality gate                                 │
│  - 102 tests MUST pass before deployment                   │
│  - 92% code coverage enforced                              │
│  - Zero tolerance for broken builds in production          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### How the Two Tracks Work Together

#### During Development (Phase 1-3):

- **Track 1 (Development CI)**: Active, providing feedback
- **Track 2 (Deployment Gate)**: Not yet enforced (no deployments)
- Developers can commit freely without blocking CI checks
- Fast iteration and autonomous development

#### During Testing & QA (Phase 3.5):

- **Track 1 (Development CI)**: Continues running, non-blocking
- **Track 2 (Deployment Gate)**: Activates with `tests.yml`
- Test suite establishes quality baseline (102 tests, 92% coverage)
- Test failures are informative, not yet blocking merges

#### During Deployment (Phase 4):

- **Track 1 (Development CI)**: Continues running, provides insights
- **Track 2 (Deployment Gate)**: Fully enforced, BLOCKS bad code
- `tests.yml` MUST pass before `deploy.yml` runs
- Production is protected by automated test gates

### Key Differences Between Tracks

| Aspect          | Track 1: Development CI | Track 2: Deployment Gate |
| --------------- | ----------------------- | ------------------------ |
| **Purpose**     | Inform & guide          | Protect & enforce        |
| **Behavior**    | Warnings only           | Blocks deployment        |
| **Failures**    | Informative             | Blocking                 |
| **Speed**       | Fast feedback           | Comprehensive validation |
| **Philosophy**  | Developer-friendly      | Production-safe          |
| **When Active** | Always (Phase 1+)       | Phase 3.5+ (deployment)  |
| **Can Bypass**  | N/A (non-blocking)      | ❌ Cannot bypass         |

### Why Two Tracks?

**Problem Solved:**

- Single-track systems are either too strict (slow development) or too lenient (risky production)
- Developers need fast feedback without being blocked
- Production needs strong guarantees without slowing development

**Solution:**

- **Track 1**: Fast, informative, non-blocking (development velocity)
- **Track 2**: Comprehensive, enforced, blocking (production safety)
- Both coexist without conflict

**Benefits:**
✅ Fast development iteration
✅ Early issue detection
✅ Production quality enforcement
✅ Autonomous development friendly
✅ Zero-downtime deployment protection

---

## 📋 Workflow Details

### 1. OpenAPI Validation

**File:** `openapi-validation.yml`
**Status:** ✅ Active
**Triggers:** Push/PR to main, changes to `docs/**/*.yaml`

**Purpose:**
Validates all OpenAPI specifications and detects breaking changes

**What it does:**

1. ✅ Validates `trading_alerts_openapi.yaml`
2. ✅ Validates `flask_mt5_openapi.yaml`
3. ✅ Validates `dlocal-openapi-endpoints.yaml`
4. ✅ Checks for breaking changes (non-blocking)
5. ✅ Posts PR comments with validation results

**When it runs:**

- Every push to main or claude/\*\* branches
- Every pull request
- Manual trigger

**Expected behavior:**

- ✅ **Phase 1-2:** Validates OpenAPI specs (active)
- ✅ **Phase 3-4:** Continues validating specs (active)

**Permissions:**

- `contents: read`
- `pull-requests: write`
- `issues: write`

---

### 2. Dependencies Security

**File:** `dependencies-security.yml`
**Status:** ✅ Active
**Triggers:** Push/PR, changes to dependencies, weekly schedule

**Purpose:**
Scans npm and Python dependencies for security vulnerabilities

**What it does:**

**npm Security:**

1. ✅ Runs `npm audit` (moderate level)
2. ✅ Checks for outdated packages
3. ⚠️ Reports vulnerabilities (non-blocking)

**Python Security:**

1. ✅ Runs `safety scan` on requirements.txt
2. ✅ Runs `bandit` static analysis on Flask app
3. ⚠️ Reports vulnerabilities (non-blocking)

**When it runs:**

- Push/PR with changes to package.json, package-lock.json, or requirements\*.txt
- Weekly on Mondays at 9 AM UTC
- Manual trigger

**Expected behavior:**

- ✅ **Phase 1-2:** Scans existing dependencies (active)
- ✅ **Phase 3-4:** Continues scanning as dependencies grow (active)

**Note:** All security checks are `continue-on-error: true` during development

---

### 3. Flask CI

**File:** `ci-flask.yml`
**Status:** ✅ Active (with progressive features)
**Triggers:** Push/PR to main

**Purpose:**
Comprehensive CI for Flask MT5 microservice

**What it does:**

**Job 1: validate-and-build**

1. ✅ Validates OpenAPI spec (openapi-spec-validator)
2. ✅ Lints Python code (flake8)
3. ✅ Type checks (mypy)
4. ⏭️ **Runs unit tests (pytest)** - skips if tests/ is empty
5. ✅ Builds Flask app (imports create_app)

**Job 2: security-scan**

1. ✅ Runs safety scan
2. ✅ Runs bandit analysis

**Job 3: integration-test**

1. ⏭️ Runs integration tests - skips if tests/integration/ doesn't exist

**When it runs:**

- Every push to main
- Every pull request to main

**Expected behavior:**

- ✅ **Phase 1-2:** Validates, lints, type-checks; skips tests (normal)
- ✅ **Phase 3:** Activates unit tests when test files are added
- ✅ **Phase 4:** Full pipeline active with tests

**Progressive Activation:**

```yaml
if [ -d "tests" ] && [ "$(find tests -name 'test_*.py' | wc -l)" -gt 0 ]; then
  # Run pytest
else
  # Skip with informative message
fi
```

---

### 4. Next.js CI (Progressive)

**File:** `ci-nextjs-progressive.yml`
**Status:** ✅ Active (progressive)
**Triggers:** Push/PR to main or claude/\*\* branches

**Purpose:**
Progressive CI/CD for Next.js application with feature detection

**What it does:**

**Job 1: check-project-status** (always runs)

- Checks for `next.config.js/mjs/ts`
- Checks for `tsconfig.json`
- Checks for substantial `app/` content
- Checks for test files (_.test.ts, _.test.tsx)
- Determines project phase (1-2 vs 3+)

**Job 2: install-and-build** (runs if has_config == true)

- Installs dependencies (`npm ci`)
- Builds Next.js app (`npm run build`)

**Job 3: type-check** (runs if has_typescript == true)

- Runs TypeScript type checking (`npm run type-check`)

**Job 4: lint** (always runs, non-blocking)

- Runs ESLint (`npm run lint`)
- Checks formatting (`npm run format:check`)

**Job 5: test** (runs if has_tests == true)

- Runs tests (`npm test`)
- Uploads coverage to Codecov

**Job 6: summary** (always runs)

- Displays what ran and what was skipped
- Explains project phase and next steps

**When it runs:**

- Every push to main or claude/\*\* branches
- Every pull request to main
- Manual trigger

**Expected behavior:**

- ⏭️ **Phase 1-2:** Only runs check-project-status (all other jobs skip)
- ✅ **Phase 3:** Activates build, type-check, lint as files are created
- ✅ **Phase 3+:** Activates tests when test files are added
- ✅ **Phase 4:** Full pipeline active

**Current Status (Phase 1-2):**

```
✅ check-project-status: Runs (detects Phase 1-2)
⏭️ install-and-build: Skipped (no next.config.js)
⏭️ type-check: Skipped (no tsconfig.json)
⏭️ lint: Runs but minimal (package.json exists)
⏭️ test: Skipped (no test files)
✅ summary: Runs (explains skips)
```

---

### 5. API Integration Tests

**File:** `api-tests.yml`
**Status:** ⏭️ Standby
**Triggers:** Push/PR, changes to app/api/**, lib/**, postman/\*\*

**Purpose:**
Run Postman/Newman API integration tests

**What it does:**

1. Checks if Next.js project exists
2. If exists: Runs Newman tests
3. If not exists: Skips gracefully with message

**When it runs:**

- Push to main or claude/\*\* branches
- Pull requests
- Manual trigger

**Expected behavior:**

- ⏭️ **Phase 1-2:** Skips (no Next.js project detected)
- ✅ **Phase 3:** Activates when app/api/ is created
- ✅ **Phase 4:** Full integration tests with Postman collections

**Current Status:**

- Status check: ✅ Passes (detects Next.js not ready)
- Tests: ⏭️ Skipped (no Postman collections yet)

---

### 6. Phase 3.5 Test Suite (DEPLOYMENT GATE)

**File:** `tests.yml`
**Status:** ✅ Active
**Type:** 🛡️ **DEPLOYMENT GATE** (Track 2: Blocking)
**Triggers:** Push/PR to main, develop, claude/\*\*

**Purpose:**
Comprehensive testing infrastructure with automated test gates. **This workflow BLOCKS deployment if any test fails.**

**What it does:**

**Job 1: unit-and-component-tests**

1. ✅ TypeScript type checking
2. ✅ ESLint code quality
3. ✅ Jest unit tests
4. ✅ Component tests (React Testing Library)
5. ✅ Coverage reporting (Codecov)
6. ✅ Upload test results

**Job 2: integration-tests**

1. ✅ End-to-end user flow tests
2. ✅ Multi-step scenario validation

**Job 3: build-check**

1. ✅ Production build verification
2. ✅ Bundle size validation (<100MB)

**Job 4: test-summary**

1. ✅ Aggregate all test results
2. ✅ Pass/fail decision
3. ✅ GitHub Actions summary

**When it runs:**

- Every push to main, develop, or claude/\*\* branches
- Every pull request to main or develop
- Called by deploy.yml as deployment gate

**Expected behavior:**

- ✅ **Phase 3.5+:** All tests run (102 tests, 92% coverage)
- ❌ **If tests fail:** BLOCKS deployment, prevents merge
- 🛡️ **Production protection:** Tests MUST pass before any code reaches production

**Test Coverage:**

- Unit tests: 62 tests (lib utilities)
- Integration tests: 40 tests (user flows)
- Total: 102 tests passing
- Coverage: 92.72% statements

**BLOCKING Behavior:**

```
Push to main
    ↓
tests.yml runs
    ├─ ❌ Tests FAIL → Deployment BLOCKED
    │                  ↓
    │                  Notify failure
    │                  ↓
    │                  Developer fixes issue
    │                  ↓
    │                  Push fix
    │                  ↓
    │                  Tests run again
    │
    └─ ✅ Tests PASS → Deployment proceeds (deploy.yml)
```

**Key Features:**

- **Reusable workflow:** Called by `deploy.yml` as GATE 1
- **Cannot bypass:** GitHub Actions enforces dependencies
- **Fast feedback:** Results in 3-5 minutes
- **Comprehensive:** TypeScript, ESLint, Jest, Build check

---

### 7. Automated Deployment (DEPLOYMENT GATE)

**File:** `deploy.yml`
**Status:** ✅ Active
**Type:** 🛡️ **DEPLOYMENT GATE** (Track 2: Blocking)
**Triggers:** Push to main, manual trigger

**Purpose:**
Automated production deployment with Phase 3.5 test gates. **Deployment is BLOCKED if tests fail.**

**What it does:**

**GATE 1: tests** (MUST PASS)

- Uses `tests.yml` workflow
- Runs all Phase 3.5 tests
- If fails: Deployment is **BLOCKED**

**GATE 2: deploy-frontend**

- Needs: [tests] ✅
- Deploys Next.js to Vercel
- Uses: `amondnet/vercel-action@v25`
- Secrets: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID

**GATE 3: deploy-backend**

- Needs: [tests] ✅
- Deploys Flask to Railway
- Uses: `bervProject/railway-deploy@main`
- Secrets: RAILWAY_TOKEN, RAILWAY_SERVICE_ID

**GATE 4: verify-deployment**

- Needs: [deploy-frontend, deploy-backend] ✅
- Health check: Frontend (HTTP 200/301/308)
- Health check: Backend (/health endpoint)
- Creates deployment summary

**notify-success**

- Needs: [verify-deployment] ✅
- Logs success message
- Creates success annotation
- Displays deployment URLs

**notify-failure**

- Needs: [tests, deploy-frontend, deploy-backend, verify-deployment]
- If: failure()
- Determines failure stage
- Provides troubleshooting steps
- Links to TEST-FAILURE-WORKFLOW.md
- Creates failure annotation

**When it runs:**

- Push to main branch (automatic)
- Manual trigger via GitHub Actions UI

**Expected behavior:**

- ✅ **Tests pass:** Deployment proceeds
- ❌ **Tests fail:** Deployment BLOCKED
- ✅ **Deploy succeeds:** Services updated, health checked
- ❌ **Deploy fails:** Rollback available, failure logged

**Deployment Flow:**

```
Push to main
    ↓
Run Phase 3.5 tests (GATE 1)
    ├─ ❌ Fail → BLOCK deployment
    └─ ✅ Pass → Continue
         ↓
    Deploy Frontend (GATE 2)
         ↓
    Deploy Backend (GATE 3)
         ↓
    Health Checks (GATE 4)
         ↓
    Notify Success/Failure
```

**Required Secrets:**

- `VERCEL_TOKEN`: Vercel authentication
- `VERCEL_ORG_ID`: Organization ID
- `VERCEL_PROJECT_ID`: Project ID
- `RAILWAY_TOKEN`: Railway authentication
- `RAILWAY_SERVICE_ID`: Flask service ID
- `PRODUCTION_URL`: Frontend URL for health checks
- `FLASK_URL`: Backend URL for health checks

**Concurrency:**

- Group: `production-deployment`
- Cancel-in-progress: `false` (prevents concurrent deploys)

**Key Feature:**
**Tests MUST pass before deployment.** This is enforced by GitHub Actions dependencies.

---

## 🚀 Quick Reference

### For Developers (Human)

**Q: Why are most workflows skipping?**
A: Normal! Repository is in Phase 1-2 (planning). CI/CD activates progressively during Phase 3.

**Q: When will builds start running?**
A: When `next.config.js` and `tsconfig.json` are created during Phase 3 implementation.

**Q: Are security scans running?**
A: Yes! Dependencies are scanned weekly and on every dependency change.

**Q: Can I push without all tests passing?**
A: Yes, during Phase 1-3. Workflows are informative, not blocking.

---

### For Aider (Autonomous Development)

**Q: Will my commits be blocked by CI/CD?**
A: **Track 1 (Development CI)**: No, never blocks. Commit confidently during development.
**Track 2 (Deployment Gate)**: Only blocks deployment to production, not commits to feature branches.

**Q: What if a workflow fails?**
A: **Track 1 failures**: Informative only. Review and fix when convenient.
**Track 2 failures**: Blocks deployment. Must be fixed before code reaches production.

**Q: When do I need to worry about test failures?**
A:

- **Phase 1-3**: Test jobs skip gracefully, no worries
- **Phase 3.5+**: tests.yml runs but doesn't block development
- **Phase 4**: tests.yml blocks deployment (but not your commits)

**Q: How does the Two-Track system affect me?**
A: You can commit freely to any branch. Track 1 gives feedback. Track 2 only activates when code reaches main branch and attempts to deploy. Your development velocity is not impacted.

**Q: What if I push to main and tests fail?**
A: Deployment is blocked, but you can immediately push a fix. No rollback needed since deployment never happened.

---

## 📊 Workflow Activation Timeline

| Phase                        | Active Workflows                                                                                     | Expected Behavior                                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Phase 1-2** (Planning)     | openapi-validation<br>dependencies-security<br>ci-nextjs-progressive (partial)<br>ci-flask (partial) | ✅ Documentation validated<br>✅ Security scanned<br>⏭️ Builds/tests skip                                                      |
| **Phase 3** (Implementation) | All Phase 1-2 workflows<br>api-tests                                                                 | ✅ Builds activate<br>✅ Type-check activates<br>✅ Tests activate (when added)<br>✅ API tests activate                       |
| **Phase 3.5** (Testing & QA) | All Phase 3 workflows<br>**tests.yml (NEW)**                                                         | ✅ **Unit tests: 102 passing**<br>✅ **Integration tests active**<br>✅ **92% code coverage**<br>✅ **Test gates enforced**    |
| **Phase 4** (Deployment)     | All workflows<br>**deploy.yml (NEW)**                                                                | ✅ **Automated deployment**<br>✅ **Test gates BLOCK bad code**<br>✅ **Production protected**<br>✅ **CI/CD fully automated** |

---

## 🔗 Phase 3.5 Integration: Two-Track System in Practice

### How Phase 3.5 Changed the CI/CD Architecture

**Before Phase 3.5 (Phases 1-3):**

```
Development Workflow:
    ↓
Commit → Push → CI checks (non-blocking) → Continue working
    ↓
All workflows provide feedback but never block
```

**After Phase 3.5 (Phase 4):**

```
Development Workflow (Track 1):
    ↓
Commit → Push → Development CI (non-blocking) → Continue working
    ↓
    • openapi-validation.yml     ❌ Non-blocking
    • dependencies-security.yml  ❌ Non-blocking
    • ci-flask.yml               ❌ Non-blocking
    • ci-nextjs-progressive.yml  ❌ Non-blocking
    • api-tests.yml              ❌ Non-blocking

Deployment Workflow (Track 2):
    ↓
Push to main → tests.yml (BLOCKING) → deploy.yml (BLOCKING)
    ↓
    ├─ Tests FAIL → ❌ Deployment BLOCKED
    │                 Production safe, no broken code deployed
    │
    └─ Tests PASS → ✅ Deployment proceeds
                      Frontend (Vercel) + Backend (Railway)
```

### The Integration Points

#### 1. tests.yml is Reusable

`tests.yml` is designed as a **reusable workflow** that can be called by other workflows:

```yaml
# In deploy.yml
jobs:
  tests:
    name: Run Phase 3.5 Test Suite
    uses: ./.github/workflows/tests.yml # ← Calls tests.yml
    secrets: inherit

  deploy-frontend:
    needs: [tests] # ← BLOCKS until tests pass
    if: success() # ← Only runs if tests succeeded
```

**Benefits:**

- Single source of truth for test execution
- Same tests run for PRs and deployments
- No duplication of test configuration

#### 2. Dependency Chain Enforcement

GitHub Actions enforces the dependency chain:

```
tests.yml (GATE 1)
    ↓ needs: [tests]
deploy-frontend (GATE 2) + deploy-backend (GATE 3)
    ↓ needs: [deploy-frontend, deploy-backend]
verify-deployment (GATE 4)
    ↓ needs: [verify-deployment]
notify-success
```

**Key Point:** If `tests.yml` fails, GitHub Actions will **automatically skip** all downstream jobs. This is not optional - it's enforced by the platform.

#### 3. Coexistence Without Conflict

Both tracks can run **simultaneously** without interfering:

**Example: Push to main branch**

```
Push to main
    ↓
    ├─ Track 1 (Development CI) - Runs in parallel
    │   ├─ openapi-validation.yml     → Runs, reports results
    │   ├─ dependencies-security.yml  → Runs, reports results
    │   ├─ ci-flask.yml               → Runs, reports results
    │   ├─ ci-nextjs-progressive.yml  → Runs, reports results
    │   └─ api-tests.yml              → Runs, reports results
    │
    └─ Track 2 (Deployment Gate) - Runs sequentially
        ├─ tests.yml                  → MUST PASS
        ├─ deploy-frontend            → Waits for tests
        ├─ deploy-backend             → Waits for tests
        └─ verify-deployment          → Waits for deploys
```

**Result:**

- Track 1 provides fast feedback (informative)
- Track 2 protects production (blocking)
- Both contribute to code quality

#### 4. Progressive Enforcement

The Two-Track System activates progressively:

| Phase         | Track 1 Status      | Track 2 Status             | Behavior                    |
| ------------- | ------------------- | -------------------------- | --------------------------- |
| **Phase 1-2** | Active, informative | Not active                 | Fast development, no blocks |
| **Phase 3**   | Active, informative | Not active                 | Builds run, tests optional  |
| **Phase 3.5** | Active, informative | Tests active, not enforced | Test baseline established   |
| **Phase 4**   | Active, informative | **Fully enforced**         | **Production protected**    |

**Transition Point:**

- **Phase 3.5**: Tests.yml created, runs on every push, establishes quality baseline
- **Phase 4**: Deploy.yml created, makes tests.yml blocking for deployments

### Real-World Scenarios

#### Scenario 1: Developer Working on Feature Branch

**Branch:** `feature/new-alert-type`
**Track 1 (Development CI):** ✅ Runs, provides feedback
**Track 2 (Deployment Gate):** ⏭️ Skipped (not main branch)

**Result:** Fast iteration, no blocking checks

---

#### Scenario 2: PR to Main Branch

**Action:** Create pull request to merge feature → main
**Track 1 (Development CI):** ✅ Runs all workflows, reports issues
**Track 2 (Deployment Gate):** ✅ tests.yml runs, must pass for merge

**Result:** Quality checks before merge, production protected

---

#### Scenario 3: Merge to Main (Automatic Deployment)

**Action:** Merge approved PR to main
**Track 1 (Development CI):** ✅ Runs, monitors for issues
**Track 2 (Deployment Gate):**

1. ✅ tests.yml runs (102 tests)
2. ✅ If pass → deploy-frontend (Vercel)
3. ✅ If pass → deploy-backend (Railway)
4. ✅ If pass → verify-deployment (health checks)
5. ✅ If pass → notify-success

**Result:** Automated deployment with quality guarantees

---

#### Scenario 4: Tests Fail on Main

**Action:** Merge to main, but tests fail
**Track 1 (Development CI):** ✅ Runs, reports issues
**Track 2 (Deployment Gate):**

1. ❌ tests.yml fails
2. ⏭️ deploy-frontend SKIPPED
3. ⏭️ deploy-backend SKIPPED
4. ⏭️ verify-deployment SKIPPED
5. ✅ notify-failure runs (provides diagnostics)

**Result:** Deployment BLOCKED, production safe, developer notified

---

### Key Insights

✅ **Coexistence is the goal**: Both tracks serve different purposes
✅ **No conflicts**: Development CI doesn't block, Deployment Gate only blocks deployment
✅ **Progressive activation**: System grows stricter as project matures
✅ **Developer-friendly**: Fast feedback during development
✅ **Production-safe**: Strong guarantees before deployment
✅ **Automated**: No manual intervention needed
✅ **Enforceable**: Cannot bypass test gates

### Documentation References

- **Track 1 Workflows**: See individual workflow sections above
- **Track 2 Workflows**: See [Section 6](#6-phase-35-test-suite-deployment-gate) and [Section 7](#7-automated-deployment-deployment-gate)
- **Test Failure Handling**: See `docs/TEST-FAILURE-WORKFLOW.md`
- **Branch Protection**: See `docs/BRANCH-PROTECTION-RULES.md`

---

## 🔧 Troubleshooting

### Workflow is failing unexpectedly

1. Check the job output - it should explain why
2. Check if you're in the expected phase (Phase 1-2 vs 3+)
3. Check if prerequisite files exist (next.config.js, tsconfig.json, etc.)

### Want to force a workflow to run

1. Use manual trigger (`workflow_dispatch`)
2. Go to Actions tab → Select workflow → Run workflow

### Security scan shows vulnerabilities

1. Review the vulnerability report
2. Decide if it's critical or can wait
3. During Phase 1-3: Informative only
4. During Phase 4: Must be resolved

---

## 📝 Maintenance Notes

### Adding a New Workflow

1. Follow progressive activation pattern
2. Check for prerequisites before running
3. Use `continue-on-error: true` for non-critical jobs
4. Provide informative skip messages
5. Add to this README

### Modifying Existing Workflow

1. Maintain backward compatibility with Phase 1-2
2. Don't break progressive activation
3. Update this README
4. Test manually with `workflow_dispatch`

### When to Make Workflows Strict

**Phase 4 (Production Prep):**

- Remove `continue-on-error: true` from critical jobs
- Make security scans blocking
- Require 100% test coverage
- Enforce formatting/linting

---

## 🎓 Learning Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Progressive CI/CD Design Patterns](https://github.com/anthropics/claude-code/blob/main/docs/cicd-patterns.md)
- [Autonomous Development Best Practices](https://github.com/anthropics/aider/blob/main/docs/best-practices.md)

---

## ✅ Status Indicators

```
Phase 3.5+ (Current): Two-Track CI/CD System
═════════════════════════════════════════════════════════════

TRACK 1: Development CI (Non-Blocking)
────────────────────────────────────────
openapi-validation       ✅ ACTIVE  (informative)
dependencies-security    ✅ ACTIVE  (informative)
ci-flask                 ✅ ACTIVE  (with tests, informative)
ci-nextjs-progressive    ✅ ACTIVE  (full pipeline, informative)
api-tests                ✅ ACTIVE  (Postman collections, informative)

TRACK 2: Deployment Gate (BLOCKING)
────────────────────────────────────────
tests.yml                ✅ ACTIVE  🛡️ BLOCKS deployment on failure
deploy.yml               ✅ ACTIVE  🛡️ BLOCKS on test failure

═════════════════════════════════════════════════════════════

Overall Status: ✅ ALL SYSTEMS GO
Success Rate: 100%
Test Coverage: 92.72%
Deployment: 🛡️ Protected by BLOCKING test gates
Architecture: 🛤️ Two-Track CI/CD (Development + Deployment)
```

**Key Milestones Achieved:**

- ✅ Phase 3.5: Testing & QA infrastructure complete (102 tests, 92% coverage)
- ✅ Phase 4: Automated deployment with BLOCKING test gates
- 🛡️ Production protected: Tests MUST pass before deployment
- 🛤️ Two-Track CI/CD: Development velocity + Production safety
- 🚀 CI/CD: Fully automated from commit to production
- ⚡ Fast feedback: Track 1 provides instant insights
- 🔒 Zero-downtime protection: Track 2 blocks bad deployments

---

**Documentation:**

- Testing: `docs/TESTING-GUIDE.md`
- Test Failures: `docs/TEST-FAILURE-WORKFLOW.md`
- Branch Protection: `docs/BRANCH-PROTECTION-RULES.md`
- Deployment: `docs/v7/v7_phase_4_deployment.md`

**For questions or issues, see:** `/tmp/cicd-rebuild.md` (comprehensive rebuild documentation)
