## PHASE 4: DEPLOYMENT

### Timeline: Week 11 (7 hours)

### Goal: Deploy to production with automated testing gates

💡 BEGINNER TIP: Your app works locally. Now make it live for the world! Phase 3.5 built automated testing gates that protect production from broken code.

---

## 🛡️ IMPORTANT: Phase 3.5 Integration

**Phase 4 builds on Phase 3.5's automated testing infrastructure:**

- ✅ All tests must pass before deployment
- ✅ GitHub Actions runs automatically on every push
- ✅ Deployment workflow respects test gates
- ✅ Manual deployment requires local test verification

**Key principle:** Broken code cannot reach production! 🚫

---

### MILESTONE 4.0: Verify Phase 3.5 Protection System (15 minutes)

**Before deployment, confirm your safety net is active!**

☐ STEP 1: Verify GitHub Actions Status (5 minutes)

Check that Phase 3.5 CI/CD is working:

```bash
# View recent workflow runs
gh run list --limit 5

# View latest test run
gh run view
```

Expected output:

```
✓ Unit & Component Tests      success
✓ Integration Tests            success
✓ Production Build Check       success
✓ Test Summary                 success
```

💡 BEGINNER TIP: These checks run automatically on every push. If they fail, deployment won't happen!

☐ STEP 2: Verify Branch Protection Rules (5 minutes)

1.  Go to GitHub repo → Settings → Branches
2.  Check `main` branch rules:
    - ✅ Require pull request before merging
    - ✅ Require status checks to pass
    - ✅ Required checks: `unit-and-component-tests`, `integration-tests`, `build-check`, `test-summary`

Not configured? Follow `docs/BRANCH-PROTECTION-RULES.md`

☐ STEP 3: Sync Local Branch (5 minutes)

```bash
# Ensure you're on main with latest changes
git checkout main
git pull origin main

# Verify tests pass locally
npm test
npm run build
```

All passing? ✅ → Ready for deployment!

✅ CHECKPOINT: Phase 3.5 protection system verified and active!

💡 BEGINNER TIP: With these protections, you can deploy with confidence. Tests catch bugs before they reach production!

---

### MILESTONE 4.1: Create Automated Deployment Workflow (1 hour)

**What:** Automate deployment via GitHub Actions with Phase 3.5 test gates
**Why:** Deployments respect test results, safe and consistent

☐ STEP 1: Create Deployment Workflow (30 minutes)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch: # Allow manual trigger

jobs:
  # GATE 1: Run Phase 3.5 tests (MUST PASS)
  tests:
    name: Run Phase 3.5 Test Suite
    uses: ./.github/workflows/tests.yml
    secrets: inherit

  # GATE 2: Deploy Frontend (only if tests pass)
  deploy-frontend:
    name: Deploy Frontend to Vercel
    runs-on: ubuntu-latest
    needs: [tests]
    environment:
      name: production
      url: ${{ steps.deploy.outputs.url }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Deploy to Vercel
        id: deploy
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
          working-directory: ./

      - name: Comment PR with deployment URL
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '✅ Deployed to production: ' + '${{ steps.deploy.outputs.url }}'
            })

  # GATE 3: Deploy Backend (only if tests pass)
  deploy-backend:
    name: Deploy Backend to Railway
    runs-on: ubuntu-latest
    needs: [tests]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Deploy Flask to Railway
        run: |
          curl -X POST https://railway.app/api/deploy \
            -H "Authorization: Bearer ${{ secrets.RAILWAY_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{
              "service": "${{ secrets.RAILWAY_SERVICE_ID }}",
              "branch": "main"
            }'

      - name: Wait for Railway deployment
        run: sleep 60

  # GATE 4: Post-deployment verification
  verify-deployment:
    name: Verify Production Deployment
    runs-on: ubuntu-latest
    needs: [deploy-frontend, deploy-backend]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Health check - Frontend
        run: |
          response=$(curl -s -o /dev/null -w "%{http_code}" ${{ secrets.PRODUCTION_URL }})
          if [ $response -eq 200 ]; then
            echo "✅ Frontend is healthy"
          else
            echo "❌ Frontend health check failed: $response"
            exit 1
          fi

      - name: Health check - Backend
        run: |
          response=$(curl -s ${{ secrets.FLASK_URL }}/health | jq -r '.status')
          if [ "$response" = "healthy" ]; then
            echo "✅ Backend is healthy"
          else
            echo "❌ Backend health check failed"
            exit 1
          fi

  # Notify team of deployment result
  notify:
    name: Notify Deployment Status
    runs-on: ubuntu-latest
    needs: [verify-deployment]
    if: always()

    steps:
      - name: Send success notification
        if: needs.verify-deployment.result == 'success'
        run: |
          echo "🎉 Deployment successful!"
          echo "Frontend: ${{ secrets.PRODUCTION_URL }}"
          echo "Backend: ${{ secrets.FLASK_URL }}"

      - name: Send failure notification
        if: needs.verify-deployment.result != 'success'
        run: |
          echo "❌ Deployment failed!"
          echo "Check GitHub Actions logs for details"
          exit 1
```

💡 BEGINNER TIP: This workflow ensures tests MUST pass before deployment. If tests fail, deployment is blocked automatically!

☐ STEP 2: Configure GitHub Secrets (20 minutes)

Go to GitHub repo → Settings → Secrets and variables → Actions

Add these secrets:

| Secret               | How to Get                          | Purpose                         |
| -------------------- | ----------------------------------- | ------------------------------- |
| `VERCEL_TOKEN`       | Vercel → Settings → Tokens → Create | Authenticate Vercel deployment  |
| `VERCEL_ORG_ID`      | Vercel project settings             | Your organization ID            |
| `VERCEL_PROJECT_ID`  | Vercel project settings             | Your project ID                 |
| `RAILWAY_TOKEN`      | Railway → Account → Tokens          | Authenticate Railway deployment |
| `RAILWAY_SERVICE_ID` | Railway service settings            | Flask service ID                |
| `PRODUCTION_URL`     | https://your-app.vercel.app         | Frontend URL for health check   |
| `FLASK_URL`          | https://your-flask.railway.app      | Backend URL for health check    |

**Getting Vercel Tokens:**

```bash
# Install Vercel CLI
npm i -g vercel

# Login and get org/project IDs
vercel login
vercel link
# Follow prompts, then check .vercel/project.json
cat .vercel/project.json
```

**Getting Railway Token:**

1. Go to railway.app → Account Settings
2. Click "Tokens" tab
3. Click "Create New Token"
4. Copy token immediately (shown only once!)

☐ STEP 3: Test Deployment Workflow (10 minutes)

**Option A: Manual trigger (recommended for first test)**

```bash
# Go to GitHub repo → Actions → Deploy to Production
# Click "Run workflow" → "Run workflow"
# Watch it run!
```

**Option B: Push to main**

```bash
git checkout main
git commit --allow-empty -m "test: trigger deployment workflow"
git push origin main
```

Expected flow:

```
1. ✅ Run Phase 3.5 Test Suite (3-5 min)
   └─ Unit tests, integration tests, build check
2. ✅ Deploy Frontend to Vercel (2-3 min)
3. ✅ Deploy Backend to Railway (2-3 min)
4. ✅ Verify Production Deployment (1 min)
5. ✅ Notify Deployment Status
```

💡 BEGINNER TIP: If step 1 (tests) fails, steps 2-5 are skipped. This is your safety net!

✅ CHECKPOINT: Automated deployment with test gates working!

---

### MILESTONE 4.1.5: Manual Deployment Fallback (30 minutes)

**⚠️ EMERGENCY USE ONLY**

Use manual deployment ONLY when:

- GitHub Actions is down (rare)
- Urgent hotfix needed
- Automated deployment is broken

**CRITICAL: You MUST verify tests pass locally before manual deployment!**

☐ STEP 1: Verify Local Tests (REQUIRED) (10 minutes)

```bash
# Run ALL Phase 3.5 tests
npm test                  # Must pass ✅
npm run test:integration  # Must pass ✅
npm run test:coverage     # Check coverage ✅
npm run build             # Must succeed ✅

# TypeScript and linting
npm run type-check        # Must pass ✅
npm run lint              # Must pass ✅
```

**❌ If ANY test fails, DO NOT DEPLOY MANUALLY!**

Fix the issues and run tests again until all pass.

☐ STEP 2: Manual Vercel Deployment (10 minutes)

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Login
vercel login

# Deploy to production
vercel --prod

# Wait for deployment (2-3 minutes)
```

☐ STEP 3: Manual Railway Deployment (10 minutes)

```bash
# Install Railway CLI if needed
npm i -g @railway/cli

# Login
railway login

# Link to project
railway link

# Deploy Flask service
cd mt5-service
railway up
```

☐ STEP 4: Document Emergency Deployment

Create incident report:

```bash
echo "$(date): Manual deployment performed" >> deployment-log.txt
echo "Reason: [your reason]" >> deployment-log.txt
echo "Tests verified: YES" >> deployment-log.txt
git add deployment-log.txt
git commit -m "docs: manual deployment incident log"
git push
```

💡 BEGINNER TIP: Manual deployments bypass automated safety checks. Use them rarely and document why!

✅ CHECKPOINT: Know how to deploy manually in emergencies (but prefer automated!)

---

### MILESTONE 4.2: Vercel Configuration (One-time Setup) (1 hour)

**What:** Configure Vercel project (automated deployment handles actual deploys)
**Why:** Set up environment variables and domain settings

💡 BEGINNER NOTE: This is ONE-TIME SETUP. After this, GitHub Actions handles all deployments automatically!

☐ STEP 1: Create Vercel Project (15 minutes)

1.  Go to vercel.com
2.  Click "Add New Project"
3.  Import GitHub repo: trading-alerts-saas-v7
4.  Framework: Next.js (auto-detected)
5.  **IMPORTANT:** Do NOT click "Deploy" yet!
6.  Click "Environment Variables" first

☐ STEP 2: Configure Environment Variables (30 minutes)

Add these for Production, Preview, and Development:

| Variable                           | Value                               | Notes                      |
| ---------------------------------- | ----------------------------------- | -------------------------- |
| NEXTAUTH_SECRET                    | [generate: openssl rand -base64 32] | Auth encryption key        |
| NEXTAUTH_URL                       | https://your-app.vercel.app         | Your Vercel URL            |
| DATABASE_URL                       | [from Railway]                      | PostgreSQL connection      |
| MT5_API_URL                        | [from Railway Flask]                | Will add after 4.3         |
| STRIPE_SECRET_KEY                  | [from Stripe dashboard]             | sk*live*... or sk*test*... |
| STRIPE_WEBHOOK_SECRET              | [from Stripe webhooks]              | whsec\_...                 |
| NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY | [from Stripe]                       | pk*live*... or pk*test*... |
| RESEND_API_KEY                     | [from resend.com]                   | re\_... for emails         |
| NODE_ENV                           | production                          | Production mode            |

💡 BEGINNER TIP: Variables starting with NEXT*PUBLIC* are visible in browser. Never put secrets there!

☐ STEP 3: Configure Custom Domain (Optional) (15 minutes)

1.  Vercel → Settings → Domains
2.  Add your domain
3.  Configure DNS as instructed
4.  Wait for SSL (automatic, ~1 minute)

✅ CHECKPOINT: Vercel configured (GitHub Actions will handle deployments!)

---

### MILESTONE 4.3: Railway Flask Configuration (1 hour)

**What:** Configure Flask service on Railway
**Why:** Backend for real-time market data

☐ STEP 1: Prepare Flask for Railway (20 minutes)

Verify these files exist in `mt5-service/`:

☐ `requirements.txt` (Python dependencies)
☐ `Dockerfile` (container config)
☐ `.dockerignore`
☐ `railway.json` or start command

If missing, create them:

**requirements.txt:**

```txt
flask==3.0.0
flask-cors==4.0.0
MetaTrader5==5.0.4500
pandas==2.1.4
numpy==1.26.2
python-dotenv==1.0.0
psycopg2-binary==2.9.9
gunicorn==21.2.0
```

**Dockerfile:**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["gunicorn", "-b", "0.0.0.0:5000", "app:app"]
```

**.dockerignore:**

```
__pycache__
*.pyc
.env
venv/
.git/
```

☐ STEP 2: Create Railway Service (15 minutes)

1.  Go to railway.app
2.  Open project: "trading-alerts-saas-v7"
3.  Click "+ New" → "GitHub Repo"
4.  Root Directory: `mt5-service`
5.  Builder: Dockerfile
6.  Click "Deploy"

☐ STEP 3: Configure Environment Variables (20 minutes)

Railway Flask service → Variables:

| Variable     | Value                            |
| ------------ | -------------------------------- |
| MT5_LOGIN    | [your MT5 login]                 |
| MT5_PASSWORD | [your MT5 password]              |
| MT5_SERVER   | [e.g., "MetaQuotes-Demo"]        |
| MT5_API_KEY  | [generate: openssl rand -hex 32] |
| FLASK_ENV    | production                       |
| DATABASE_URL | ${{Postgres.DATABASE_URL}}       |
| PORT         | 5000                             |

☐ STEP 4: Get Flask Service URL (5 minutes)

1.  Railway → Flask service → Settings
2.  Generate Domain → Copy URL
3.  Update Vercel environment variable `MT5_API_URL`
4.  Update GitHub secret `FLASK_URL`

✅ CHECKPOINT: Railway Flask configured!

---

### MILESTONE 4.4: Stripe Webhook Setup (30 minutes)

**What:** Configure Stripe to notify your app of payments
**Why:** Handle subscription upgrades/cancellations

☐ STEP 1: Create Webhook Endpoint (10 minutes)

1.  Go to dashboard.stripe.com
2.  Developers → Webhooks
3.  "+ Add endpoint"
4.  URL: `https://your-app.vercel.app/api/webhooks/stripe`
5.  Events:
    - `customer.subscription.created`
    - `customer.subscription.updated`
    - `customer.subscription.deleted`
    - `invoice.paid`
    - `invoice.payment_failed`
6.  Add endpoint

☐ STEP 2: Get Webhook Secret (5 minutes)

1.  Click webhook
2.  Copy "Signing secret" (whsec\_...)
3.  Add to Vercel: `STRIPE_WEBHOOK_SECRET`

☐ STEP 3: Test Webhook (15 minutes)
Stripe dashboard → Send test webhook

Check Vercel logs: "Webhook received" ✅

✅ CHECKPOINT: Stripe configured!

---

### MILESTONE 4.5: Production Monitoring (30 minutes)

**What:** Setup error tracking and monitoring
**Why:** Know when things break!

☐ STEP 1: Railway Monitoring (10 minutes)

1.  Railway → Observability
2.  Configure alerts:
    - Service crashes
    - High CPU/memory
    - Deployment failures
3.  Add notification email

☐ STEP 2: Vercel Analytics (10 minutes)

1.  Vercel → Analytics
2.  Enable Web Analytics (free)
3.  View real-time traffic

☐ STEP 3: GitHub Actions Badge (10 minutes)

Add deployment badge to README.md:

```markdown
![Deploy to Production](https://github.com/your-username/trading-alerts-saas-v7/actions/workflows/deploy.yml/badge.svg)
![Tests](https://github.com/your-username/trading-alerts-saas-v7/actions/workflows/tests.yml/badge.svg)
```

Shows deployment and test status at a glance! 📊

✅ CHECKPOINT: Monitoring configured!

---

### MILESTONE 4.6: Final Production Testing (1 hour)

**The moment of truth! Test EVERYTHING in production!**

☐ PART 1: Verify GitHub Actions Integration (15 minutes)

**Test 1: Deployment blocks on test failure**

1.  Create test branch:

    ```bash
    git checkout -b test/deployment-gate
    ```

2.  Introduce a failing test:

    ```bash
    # Edit a test file to make it fail
    echo "test('should fail', () => { expect(true).toBe(false); });" >> __tests__/lib/utils.test.ts
    ```

3.  Commit and push:

    ```bash
    git add .
    git commit -m "test: intentional failure to verify gates"
    git push origin test/deployment-gate
    ```

4.  Create PR to main

5.  Verify:
    - ❌ GitHub Actions tests fail
    - ❌ PR shows "Some checks were not successful"
    - ❌ Merge button is disabled
    - ❌ Deployment workflow does NOT run

6.  Fix the test and push again:

    ```bash
    git revert HEAD
    git push
    ```

7.  Verify:
    - ✅ Tests pass
    - ✅ PR shows "All checks have passed"
    - ✅ Can merge now

💡 BEGINNER VICTORY: Your Phase 3.5 gates are working! Broken code cannot reach production! 🛡️

**Test 2: Successful deployment flow**

1.  Merge the PR (with passing tests)
2.  Watch GitHub Actions → Deploy to Production
3.  Verify each step:
    - ✅ Run Phase 3.5 Test Suite (passes)
    - ✅ Deploy Frontend to Vercel (succeeds)
    - ✅ Deploy Backend to Railway (succeeds)
    - ✅ Verify Production Deployment (healthy)
    - ✅ Notify Deployment Status (success)

Expected time: 8-12 minutes total

**Test 3: Check deployment badge**

1.  Visit your GitHub repo
2.  Look at README badges
3.  Both should be green:
    - ![Deploy to Production](badge showing "passing")
    - ![Tests](badge showing "passing")

☐ PART 2: Complete Feature Test Checklist (45 minutes)

**Authentication:**
☐ Register new account (use real email)
☐ Verify email works
☐ Login with new account
☐ Password reset flow
☐ Logout

**FREE Tier:**
☐ Dashboard loads
☐ Can see 5 symbols (BTCUSD, EURUSD, USDJPY, US30, XAUUSD)
☐ Can see 3 timeframes (H1, H4, D1)
☐ Create watchlist with EURUSD + H4
☐ View chart with indicators
☐ Create alert for USDJPY
☐ Try M5 timeframe (should block - PRO only ✓)
☐ Try AUDJPY symbol (should block - PRO only ✓)

**Upgrade to PRO:**
☐ Click "Upgrade to PRO"
☐ Stripe checkout loads
☐ Test card: 4242 4242 4242 4242
☐ Payment succeeds
☐ Dashboard shows PRO badge
☐ Can access all 15 symbols
☐ Can access all 9 timeframes
☐ Create alerts for any symbol/timeframe

**Watchlists:**
☐ Create watchlist
☐ Add multiple symbols (PRO only)
☐ Rename watchlist
☐ Delete watchlist

**Alerts:**
☐ Create price alert
☐ Edit alert
☐ Delete alert
☐ Verify notifications work

**Settings:**
☐ Update profile
☐ Change email preferences
☐ Update password

All tests passing? ✅ → **APPLICATION IS LIVE!** 🌐🎉

---

## ✅ PHASE 4 COMPLETE! 🎊

### What You Accomplished:

☐ Verified Phase 3.5 protection system active
☐ Created automated deployment workflow with test gates
☐ Configured Vercel with environment variables
☐ Configured Railway Flask service
☐ Set up Stripe webhooks
☐ Configured production monitoring
☐ **Verified deployment blocks on test failures** ✅
☐ **Verified successful automated deployment** ✅
☐ **APPLICATION IS LIVE AND PROTECTED BY AUTOMATED TESTS!** 🚀

### What You Learned:

✓ CI/CD with GitHub Actions
✓ Automated deployment workflows
✓ Test gates and deployment blocking
✓ Environment variable management
✓ Service integration (Vercel + Railway)
✓ Webhook configuration
✓ Production monitoring
✓ Emergency manual deployment procedures
✓ Testing in production

### Time Invested: 7 hours

### The Payoff:

You now have:

- ✅ Live SaaS application
- ✅ **Automated deployment with test gates** 🛡️
- ✅ **Tests MUST pass before production** 🔒
- ✅ **GitHub Actions protects production** ✅
- ✅ Real payments processing
- ✅ Professional CI/CD infrastructure
- ✅ Monitoring and alerts
- ✅ Emergency manual fallback

### Your Live URLs:

- **Frontend:** https://your-app.vercel.app
- **API:** https://your-app.vercel.app/api
- **Flask Service:** https://your-flask.railway.app
- **GitHub Actions:** https://github.com/your-username/trading-alerts-saas-v7/actions

### Deployment Flow:

```
Push to main
    ↓
GitHub Actions triggers
    ↓
Run Phase 3.5 tests (GATE)
    ├─ ❌ Tests fail → Deployment BLOCKED
    └─ ✅ Tests pass → Continue
         ↓
    Deploy to Vercel
         ↓
    Deploy to Railway
         ↓
    Health checks
         ↓
    ✅ Production updated!
```

---

## 📊 Integration Summary

**Phase 3.5 + Phase 4 = Production Safety:**

| Feature        | Phase 3.5           | Phase 4                  | Result                  |
| -------------- | ------------------- | ------------------------ | ----------------------- |
| **Testing**    | 102 automated tests | Runs before every deploy | ✅ Quality guaranteed   |
| **Coverage**   | 92% code coverage   | Enforced pre-deployment  | ✅ Bugs caught early    |
| **API Tests**  | 42 endpoints tested | Validated before release | ✅ Integration verified |
| **Deployment** | N/A                 | Automated with gates     | ✅ Safe releases        |
| **Rollback**   | N/A                 | Manual fallback ready    | ✅ Emergency prepared   |

**Your SaaS is now production-ready with enterprise-grade CI/CD! 🎉**

---

## 🚨 Important Reminders

**DO:**

- ✅ Always push to `main` for production deploys
- ✅ Trust the automated test gates
- ✅ Monitor GitHub Actions after pushes
- ✅ Check deployment badges in README
- ✅ Use manual deployment only for emergencies
- ✅ Document manual deployments

**DON'T:**

- ❌ Bypass test gates (they protect you!)
- ❌ Push directly to production without tests
- ❌ Disable branch protection rules
- ❌ Skip local testing before manual deploy
- ❌ Ignore failing deployment notifications

---

**🎉 Congratulations! Your Trading Alerts SaaS V7 is now live with automated CI/CD protection! 🚀**

**The journey:**

- Phase 1-2: Built the foundation
- Phase 3: Implemented features
- **Phase 3.5: Created automated testing safety net** 🛡️
- **Phase 4: Deployed with automated test gates** 🚀

**You've built a production-grade SaaS with enterprise-level deployment automation!**
