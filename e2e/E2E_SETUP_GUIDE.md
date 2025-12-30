# E2E Testing Setup Guide

**For:** Trading Alerts SaaS
**Framework:** Playwright
**Last Updated:** 2025-12-30

---

## 📖 Table of Contents

1. [Quick Start](#quick-start)
2. [Step 1: Playwright Setup](#step-1-playwright-setup)
3. [Step 2: Running Tests with 2 Claude Code Instances](#step-2-running-tests-with-2-claude-code-instances)
4. [Step 3: CI/CD Integration](#step-3-cicd-integration)
5. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

```bash
# One-time setup
pnpm run e2e:setup

# Run all E2E tests
pnpm run test:e2e

# Run specific group
pnpm run test:e2e:group-a  # Paths 1, 2, 3
pnpm run test:e2e:group-b  # Paths 4, 5, 6, 7
```

---

## 📋 Step 1: Playwright Setup

### Prerequisites

| Requirement | Minimum Version | Check Command |
|-------------|-----------------|---------------|
| Node.js | 18.x or higher | `node -v` |
| pnpm | 8.x or higher | `pnpm -v` |
| Git | Any recent | `git --version` |

### Automated Setup (Recommended)

Run the setup script that handles everything:

```bash
pnpm run e2e:setup
```

This script will:
1. ✅ Verify Node.js version
2. ✅ Check pnpm installation
3. ✅ Install project dependencies
4. ✅ Install Playwright browsers (Chromium, Firefox, WebKit)
5. ✅ Generate Prisma client

### Manual Setup (Alternative)

If you prefer manual setup:

```bash
# 1. Install dependencies
pnpm install

# 2. Install Playwright browsers
pnpm run playwright:install

# 3. Generate Prisma client
pnpm exec prisma generate

# 4. Verify installation
pnpm exec playwright --version
```

### Running Your First Test

```bash
# Terminal 1: Start the development server
pnpm run dev

# Terminal 2: Run E2E tests
pnpm run test:e2e
```

### Test Commands Reference

| Command | Description |
|---------|-------------|
| `pnpm run test:e2e` | Run all E2E tests headless |
| `pnpm run test:e2e:ui` | Run with Playwright UI (visual debugging) |
| `pnpm run test:e2e:headed` | Run with visible browser |
| `pnpm run test:e2e:debug` | Run in debug mode |
| `pnpm run test:e2e:report` | View HTML test report |
| `pnpm run test:e2e:group-a` | Run Paths 1, 2, 3 only |
| `pnpm run test:e2e:group-b` | Run Paths 4, 5, 6, 7 only |

---

## 👥 Step 2: Running Tests with 2 Claude Code Instances

### Why Split Tests?

Running tests in parallel across 2 Claude Code instances:
- ⚡ **Faster execution** - ~50% time reduction
- 🔄 **Independent testing** - Each group can fail independently
- 📊 **Better resource usage** - Utilize multiple machines

### Test Groups Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     E2E TEST GROUPS                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  GROUP A (Claude Code Instance 1)                               │
│  ─────────────────────────────────                              │
│  📌 Path 1: Authentication (Login/Register/OAuth)              │
│  📌 Path 2: Subscription Upgrade (FREE → PRO)                  │
│  📌 Path 3: Subscription Cancel (PRO → FREE)                   │
│                                                                 │
│  Why grouped: Sequential flow (must authenticate first,        │
│               then subscribe, then cancel)                     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  GROUP B (Claude Code Instance 2)                               │
│  ─────────────────────────────────                              │
│  📌 Path 4: Discount Code Redemption                           │
│  📌 Path 5: Affiliate Commissions                              │
│  📌 Path 6: MT5 Data & Charts                                  │
│  📌 Path 7: Alert Triggers & Notifications                     │
│                                                                 │
│  Why grouped: Independent features (can run in parallel        │
│               with their own test users)                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Step-by-Step Instructions

#### Claude Code Instance 1 (Group A)

```bash
# 1. Setup (if not done)
pnpm run e2e:setup

# 2. Start the dev server (or use production build)
pnpm run dev

# 3. Run Group A tests
pnpm run test:e2e:group-a

# 4. View report
pnpm run test:e2e:report
```

#### Claude Code Instance 2 (Group B)

```bash
# 1. Setup (if not done)
pnpm run e2e:setup

# 2. Start the dev server (or use production build)
pnpm run dev

# 3. Run Group B tests
pnpm run test:e2e:group-b

# 4. View report
pnpm run test:e2e:report
```

### Important: Avoiding Conflicts

| Concern | How We Handle It |
|---------|------------------|
| **Database conflicts** | Each test uses unique test users (`e2e_user_group_a_*`, `e2e_user_group_b_*`) |
| **Session conflicts** | Tests use isolated browser contexts |
| **Stripe conflicts** | Each group uses different test card numbers |
| **Port conflicts** | If running on same machine, use different ports (`PORT=3001`) |

### Running on Different Machines

If each Claude Code runs on a different machine:

```bash
# Machine 1 (Group A)
PORT=3000 pnpm run dev &
pnpm run test:e2e:group-a

# Machine 2 (Group B)
PORT=3000 pnpm run dev &
pnpm run test:e2e:group-b
```

### Running on Same Machine

If both Claude Code instances share the same machine:

```bash
# Terminal 1: Group A (port 3000)
PORT=3000 pnpm run dev &
BASE_URL=http://localhost:3000 pnpm run test:e2e:group-a

# Terminal 2: Group B (port 3001)
PORT=3001 pnpm run dev &
BASE_URL=http://localhost:3001 pnpm run test:e2e:group-b
```

---

## 🔄 Step 3: CI/CD Integration

### Workflow Triggers

The E2E workflow (`.github/workflows/e2e-tests.yml`) is configured with multiple triggers:

```
┌─────────────────────────────────────────────────────────────────┐
│                    E2E WORKFLOW TRIGGERS                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1️⃣  MANUAL TRIGGER (workflow_dispatch)                        │
│      └─ Run anytime from GitHub Actions UI                     │
│      └─ Choose: test group, browser, environment               │
│                                                                 │
│  2️⃣  SCHEDULED (cron)                                          │
│      └─ Runs every night at 2:00 AM UTC                        │
│      └─ Tests all browsers (Chromium, Firefox, WebKit)         │
│      └─ Creates GitHub issue on failure                        │
│                                                                 │
│  3️⃣  PRE-RELEASE (push to main)                                │
│      └─ Runs on every push to main branch                      │
│      └─ Tests Chromium only (fast feedback)                    │
│      └─ Only if app code changed (not docs)                    │
│                                                                 │
│  4️⃣  PULL REQUEST (optional, disabled by default)              │
│      └─ Uncomment in workflow to enable                        │
│      └─ Runs on PRs that change e2e/ directory                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Manual Trigger (On-Demand)

1. Go to **GitHub → Actions → E2E Tests**
2. Click **"Run workflow"**
3. Select options:
   - **Test group:** all, group-a, or group-b
   - **Browser:** chromium, firefox, webkit, or all
   - **Environment:** local, preview, or production
4. Click **"Run workflow"**

### Scheduled Runs (Nightly)

- **Schedule:** Every day at 2:00 AM UTC
- **What runs:** All tests on all browsers
- **On failure:** Automatically creates a GitHub issue

### Pre-Release Gates (Push to Main)

- **Trigger:** Every push to `main` branch
- **What runs:** All tests on Chromium only (fast)
- **Purpose:** Catch regressions before they reach production

### Viewing Test Results

1. **GitHub Actions UI:**
   - Go to Actions → E2E Tests → Select run
   - View logs for each test group

2. **Artifacts:**
   - Download `e2e-results-*` for HTML reports
   - Download `e2e-failures-*` for failure screenshots

3. **Job Summary:**
   - Each run shows a summary table with pass/fail status

### Workflow Features

| Feature | Description |
|---------|-------------|
| **Parallel execution** | Group A and Group B run simultaneously |
| **Browser caching** | Playwright browsers cached between runs |
| **Failure screenshots** | Automatically captured and uploaded |
| **HTML reports** | Detailed reports with traces |
| **Auto-issue creation** | Creates issue when nightly tests fail |
| **Concurrency control** | Prevents duplicate runs on same branch |

---

## 🔧 Troubleshooting

### Common Issues

#### 1. "Browser not installed"

```bash
# Solution: Install browsers
pnpm run playwright:install
```

#### 2. "Connection refused" or "Server not running"

```bash
# Solution: Start the dev server first
pnpm run dev
# Then in another terminal
pnpm run test:e2e
```

#### 3. "Test timeout"

```bash
# Solution: Increase timeout in playwright.config.ts
# Or check if the server is responding slowly
```

#### 4. "Database connection failed"

```bash
# Solution: Ensure DATABASE_URL is set
# And Prisma client is generated
pnpm exec prisma generate
```

#### 5. Tests pass locally but fail in CI

- Check environment variables are set in CI
- Verify database is accessible
- Check for timing-sensitive tests

### Debug Mode

```bash
# Run single test with debugging
pnpm run test:e2e:debug -- --grep "login"

# Run with visible browser
pnpm run test:e2e:headed

# Run with UI mode (recommended for debugging)
pnpm run test:e2e:ui
```

### Getting Help

1. Check test logs in `e2e/test-results/`
2. View HTML report: `pnpm run test:e2e:report`
3. Enable trace in `playwright.config.ts` for detailed debugging

---

## 📊 Summary

| Task | Command | Description |
|------|---------|-------------|
| Setup | `pnpm run e2e:setup` | One-time setup |
| Run all | `pnpm run test:e2e` | All 7 paths |
| Group A | `pnpm run test:e2e:group-a` | Paths 1, 2, 3 |
| Group B | `pnpm run test:e2e:group-b` | Paths 4, 5, 6, 7 |
| Debug | `pnpm run test:e2e:ui` | Visual debugging |
| Report | `pnpm run test:e2e:report` | View results |

**CI/CD is automatically configured** - E2E tests run:
- ✅ Nightly at 2 AM UTC
- ✅ On every push to main
- ✅ Manually via GitHub Actions UI
