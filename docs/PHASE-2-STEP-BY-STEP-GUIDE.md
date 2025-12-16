# PHASE 2: STEP-BY-STEP IMPLEMENTATION GUIDE

**Complete Roadmap for CI/CD & Database Foundation Setup**

**Timeline:** 5 hours
**Your Advisor:** Claude Chat (for screenshot help when stuck)
**This Guide:** Your detailed roadmap and reference

---

## 📋 TABLE OF CONTENTS

1. [Overview & Preparation](#overview--preparation)
2. [Milestone 2.1: GitHub Actions Setup](#milestone-21-github-actions-setup-2-hours)
3. [Milestone 2.2: GitHub Secrets Configuration](#milestone-22-github-secrets-configuration-30-minutes)
4. [Milestone 2.3: Railway PostgreSQL Setup](#milestone-23-railway-postgresql-setup-15-hours)
5. [Milestone 2.4: Prisma Workflow Understanding](#milestone-24-prisma-workflow-understanding-30-minutes)
6. [Milestone 2.5: Docker Configuration](#milestone-25-docker-configuration-1-hour)
7. [Milestone 2.6: Testing Framework Setup](#milestone-26-testing-framework-setup-30-minutes)
8. [Completion Checklist](#completion-checklist)
9. [Troubleshooting Guide](#troubleshooting-guide)

---

## 🎯 OVERVIEW & PREPARATION

### What You'll Accomplish in Phase 2

✅ **Automation Infrastructure** - 5 GitHub Actions workflows (including 2 pre-built!)
✅ **Security Setup** - GitHub secrets for sensitive credentials
✅ **Database Deployment** - Railway PostgreSQL live in Week 2 (prevents migration hell!)
✅ **Workflow Understanding** - Prisma database migrations
✅ **Container Setup** - Docker configuration for Flask service
✅ **Testing Framework** - Jest ready for Phase 3

### Why This Matters

**CRITICAL INSIGHT:** By deploying the database in **Week 2** (not Week 10!), you'll:

- Test database changes on Railway throughout Phase 3
- Discover problems early when they're easy to fix
- Avoid "migration hell" at the end when everything depends on the database

### Before You Start

**Prerequisites Check:**

- ✅ Phase 1 complete (all 18 build-order files verified)
- ✅ Python 3.11 installed
- ✅ Aider installed (`pip install aider-chat`)
- ✅ MiniMax M2 API key set in environment variables
- ✅ Git configured and repository ready
- ✅ GitHub account with access to your repository

**Tools You'll Need:**

- Terminal/Command Prompt
- Web browser (for GitHub, Railway)
- Text editor (for reviewing files Aider creates)
- Claude Chat (for screenshot help when stuck)

---

## 🔨 MILESTONE 2.1: GitHub Actions Setup (2 hours)

### Overview

Set up automated CI/CD workflows that run on every code push to ensure quality and catch errors early.

### What You'll Create

1. ✅ Next.js CI workflow (build, type-check, lint)
2. ✅ Flask CI workflow (build, lint, type-check)
3. ✅ OpenAPI validation workflow (spec validation)
4. ✅ OpenAPI auto-sync workflow (**PRE-BUILT - already exists!**)
5. ✅ API auto-testing workflow (**PRE-BUILT - already exists!**)

---

### STEP 1: Start Aider (2 minutes)

**Open Terminal:**

```bash
# Navigate to your project
cd /home/user/trading-alerts-saas-v7

# Start Aider with MiniMax M2
py -3.11 -m aider --model anthropic/MiniMax-M2
```

**Expected Output:**

```
Aider v0.x.x
Model: anthropic/MiniMax-M2
Git repo: trading-alerts-saas-v7
Files loaded:
  ✓ docs/policies/00-tier-specifications.md
  ✓ docs/policies/01-approval-policies.md
  ... (all policy files load)
  ✓ PROGRESS.md

Ready!
```

**If Stuck:** Take a screenshot of the error and ask Claude Chat: "I'm getting this error when starting Aider. What should I do?"

---

### STEP 2: Create Next.js CI Workflow (30 minutes)

**Copy and paste this EXACT prompt to Aider:**

```
Create .github/workflows/ci-nextjs.yml

Requirements:
- Trigger on push to main branch
- Trigger on pull requests
- Build Next.js 15 with Turbopack
- Validate docs/trading_alerts_openapi.yaml with swagger-cli
- Run TypeScript type checking (npx tsc --noEmit)
- Run ESLint (npm run lint)
- Use Node.js 18.x
- Cache npm dependencies for faster builds
- Follow GitHub Actions best practices from policies

Show me the complete workflow file for approval.
```

**What Happens:**

1. Aider reads your policies and requirements
2. Aider generates a complete GitHub Actions YAML file
3. Aider shows you the file content for review

**Review the Output:**

- Check file location: `.github/workflows/ci-nextjs.yml` ✓
- Check trigger events: `push` to main, `pull_request` ✓
- Check Node.js version: 18.x ✓
- Check steps: install, build, type-check, lint ✓

**Approve:**
Type in Aider: `Yes, create this file`

**Aider Will:**

- Create `.github/workflows/ci-nextjs.yml`
- Commit the file with a proper commit message

**Verify:**

```bash
cat .github/workflows/ci-nextjs.yml
```

**Expected:** A complete GitHub Actions workflow file (50-100 lines)

**If Stuck:** Screenshot the Aider output and ask Claude Chat: "Does this workflow look correct for Next.js 15?"

---

### STEP 3: Create Flask CI Workflow (30 minutes)

**Copy and paste this EXACT prompt to Aider:**

```
Create .github/workflows/ci-flask.yml

Requirements:
- Trigger on push to main branch
- Trigger on pull requests
- Build Flask application
- Validate docs/flask_mt5_openapi.yaml with swagger-cli
- Run Python linting with flake8
- Run Python type checking with mypy
- Use Python 3.11
- Cache pip dependencies
- Install requirements from mt5-service/requirements.txt
- Follow GitHub Actions best practices

Show me the complete workflow file for approval.
```

**Review the Output:**

- Check file location: `.github/workflows/ci-flask.yml` ✓
- Check Python version: 3.11 ✓
- Check steps: install, lint, type-check ✓
- Check requirements path: `mt5-service/requirements.txt` ✓

**Approve:**
Type in Aider: `Yes, create this file`

**Verify:**

```bash
cat .github/workflows/ci-flask.yml
```

---

### STEP 4: Create OpenAPI Validation Workflow (30 minutes)

**Copy and paste this EXACT prompt to Aider:**

```
Create .github/workflows/openapi-validation.yml

Requirements:
- Trigger on any change to *.yaml files in docs/ directory
- Validate docs/trading_alerts_openapi.yaml
- Validate docs/flask_mt5_openapi.yaml
- Validate docs/dlocal-openapi-endpoints.yaml
- Check for breaking changes in API specs
- Use swagger-cli for validation
- Report validation errors clearly in workflow output
- Fail the workflow if any spec is invalid

Show me the complete workflow file for approval.
```

**Review the Output:**

- Check trigger: `paths: ['docs/*.yaml']` ✓
- Check all 3 specs are validated ✓
- Check swagger-cli is used ✓

**Approve:**
Type in Aider: `Yes, create this file`

**Verify:**

```bash
cat .github/workflows/openapi-validation.yml
```

---

### STEP 5: Verify Pre-Built OpenAPI Auto-Sync Workflow (5 minutes)

**This workflow is ALREADY CREATED for you!** 🎉

**What it does automatically:**

- Detects changes to OpenAPI YAML files
- Validates OpenAPI specs
- Runs `scripts/generate-nextjs-types.sh` automatically
- Runs `scripts/generate-flask-types.sh` automatically
- Commits and pushes updated types to your branch
- **No human intervention needed!**

**Verify it exists:**

```bash
cat .github/workflows/openapi-sync.yml
```

**Expected:** A complete workflow file that auto-generates types

**Automation Win:** You'll NEVER need to manually run type generation scripts after Phase 2! Just update the YAML, push, and GitHub Actions handles the rest.

**Note:** If file doesn't exist, it will be created in the next section.

---

### STEP 6: Verify Pre-Built API Auto-Testing Workflow (5 minutes)

**This workflow is ALSO ALREADY CREATED for you!** 🎉

**What it does automatically:**

- Starts test database (PostgreSQL)
- Runs database migrations
- Starts Next.js dev server
- Runs all Postman collections via Newman CLI
- Generates HTML test reports
- Uploads reports to GitHub artifacts
- **No manual Postman testing needed in CI!**

**Verify it exists:**

```bash
cat .github/workflows/api-tests.yml
```

**Expected:** A complete Newman testing workflow

**Important Note:** This workflow activates AFTER Phase 3 Part 5 when you export Postman collections. For now, it will skip if no collections exist (that's normal!).

**How to activate later (after Phase 3 Part 5):**

1. Open Postman
2. Right-click "Trading Alerts API" collection
3. Export → Collection v2.1
4. Save as: `postman/trading-alerts-api.postman_collection.json`
5. Export environment as: `postman/environment.json`
6. Commit both files
7. Push → CI will now auto-test APIs! 🎉

---

### STEP 7: Push Workflows and Verify (30 minutes)

**Exit Aider:**

```
/exit
```

**Stage all workflow files:**

```bash
git add .github/workflows/
git status
```

**Expected output:**

```
Changes to be committed:
  new file:   .github/workflows/ci-nextjs.yml
  new file:   .github/workflows/ci-flask.yml
  new file:   .github/workflows/openapi-validation.yml
  (possibly) .github/workflows/openapi-sync.yml
  (possibly) .github/workflows/api-tests.yml
```

**Commit:**

```bash
git commit -m "feat: add CI/CD workflows (Next.js, Flask, OpenAPI validation, auto-sync, API tests)"
```

**Push to your branch:**

```bash
git push -u origin claude/phase-2-foundation-setup
```

**Verify on GitHub:**

1. Go to GitHub.com
2. Navigate to your repository
3. Click **"Actions"** tab (top menu)
4. You should see workflows running

**Expected Results:**

| Workflow           | Status         | Why                                        |
| ------------------ | -------------- | ------------------------------------------ |
| OpenAPI Sync       | ✅ Should pass | Validates OpenAPI specs                    |
| OpenAPI Validation | ✅ Should pass | Specs are valid                            |
| Next.js CI         | ⚠️ May fail    | Project doesn't exist yet - **NORMAL!**    |
| Flask CI           | ⚠️ May fail    | Flask code doesn't exist yet - **NORMAL!** |
| API Tests          | ⏭️ Skips       | No Postman collections yet - **NORMAL!**   |

**If Next.js/Flask workflows fail:** That's expected! The project code doesn't exist yet. They'll pass after Phase 3.

**If Stuck:** Take a screenshot of the GitHub Actions page and ask Claude Chat: "Are these workflow results normal for Phase 2?"

---

### ✅ Checkpoint: Milestone 2.1 Complete

You should now have:

- ✅ 5 GitHub Actions workflows created
- ✅ Workflows running automatically on push
- ✅ Automation foundation ready for Phase 3

**Time Spent:** ~2 hours
**Next:** Milestone 2.2 - GitHub Secrets Configuration

---

## 🔐 MILESTONE 2.2: GitHub Secrets Configuration (30 minutes)

### Overview

Store sensitive credentials securely in GitHub. **NEVER commit secrets to code!**

---

### STEP 1: Navigate to GitHub Secrets (5 minutes)

**In your web browser:**

1. Go to GitHub.com
2. Navigate to your repository: `ripper7375/trading-alerts-saas-v7`
3. Click **"Settings"** tab (top menu)
4. In left sidebar, click **"Secrets and variables"**
5. Click **"Actions"**

**You should see:** "New repository secret" button (green)

**If Stuck:** Screenshot the Settings page and ask Claude Chat: "I can't find the Secrets section. Where is it?"

---

### STEP 2: Generate NextAuth Secret (5 minutes)

**In your terminal:**

```bash
openssl rand -base64 32
```

**Expected output:** A long random string like:

```
abc123xyz789defghijklmnopqrstuvwxyz1234567890==
```

**IMPORTANT:** Copy this output! You'll need it in the next step.

**Save it temporarily:** Paste into a text file for reference (delete after adding to GitHub)

**If you don't have openssl:** Use an online generator (search "random base64 generator") or ask Claude Chat for alternatives.

---

### STEP 3: Add GitHub Secrets (15 minutes)

**For EACH secret below, follow these steps:**

1. Click **"New repository secret"** (green button)
2. Enter the **Name** (exact case-sensitive match)
3. Enter the **Value**
4. Click **"Add secret"**

**Secrets to Add:**

| #   | Name                 | Value                                   | Where to Get It                                      |
| --- | -------------------- | --------------------------------------- | ---------------------------------------------------- |
| 1   | `NEXTAUTH_SECRET`    | [from Step 2]                           | The base64 string you just generated                 |
| 2   | `DATABASE_URL`       | `postgresql://temp:temp@localhost/temp` | Temporary placeholder (will update in Milestone 2.3) |
| 3   | `MT5_API_KEY`        | `temp-key-123`                          | Temporary placeholder (will update later)            |
| 4   | `ANTHROPIC_API_KEY`  | [your MiniMax M2 key]                   | Your actual MiniMax M2 API key                       |
| 5   | `ANTHROPIC_API_BASE` | `https://api.minimaxi.com/v1`           | MiniMax API endpoint                                 |

**Important Notes:**

- SECRET NAMES are case-sensitive - use EXACT names above
- Values 2 and 3 are temporary - you'll update them later
- Value 4 should be your REAL MiniMax M2 API key
- Value 5 is always the same MiniMax endpoint

**After adding each secret, it will show in the list with:**

- ✅ Name visible
- ✅ Value hidden (shows as `•••••••`)
- ✅ "Updated X seconds ago"

---

### STEP 4: Verify Secrets (5 minutes)

**Check your secrets list:**

You should see exactly **5 secrets** listed:

1. ✅ NEXTAUTH_SECRET
2. ✅ DATABASE_URL
3. ✅ MT5_API_KEY
4. ✅ ANTHROPIC_API_KEY
5. ✅ ANTHROPIC_API_BASE

**All values should be hidden** (showing dots: `•••••••`)

**If you made a mistake:**

- Click on the secret name
- Click "Update" to change the value
- Or "Remove" to delete and re-add

**If Stuck:** Screenshot the secrets list and ask Claude Chat: "Do these secrets look correct?"

---

### ✅ Checkpoint: Milestone 2.2 Complete

You should now have:

- ✅ All 5 GitHub secrets configured
- ✅ Values are hidden (secure)
- ✅ NextAuth secret is cryptographically random

**Security Win:** Secrets are now secure and never committed to code!

**Time Spent:** ~30 minutes
**Next:** Milestone 2.3 - Railway PostgreSQL Setup (**CRITICAL**)

---

## 🚂 MILESTONE 2.3: Railway PostgreSQL Setup (1.5 hours)

### Overview

Deploy your PostgreSQL database to Railway cloud **NOW** (Week 2, not Week 10!). This is the critical difference in V7 - test database deployment early to prevent migration hell later.

**Why This Matters:** Testing database changes on Railway throughout Phase 3 means you discover problems early when they're easy to fix!

---

### STEP 1: Create Railway Account (10 minutes)

**In your web browser:**

1. Go to **railway.app**
2. Click **"Login"** (top right)
3. Select **"Login with GitHub"**
4. Click **"Authorize Railway"** (green button)
5. Check your email for verification link
6. Click verification link

**You should see:** Railway dashboard with "New Project" button

**Free Tier Benefits:**

- $5 free credit (enough for development)
- 5GB PostgreSQL storage
- No credit card required initially

**If Stuck:** Screenshot the Railway page and ask Claude Chat: "I'm stuck at Railway signup. What should I do?"

---

### STEP 2: Create Railway Project (10 minutes)

**On Railway dashboard:**

1. Click **"New Project"** (purple button)
2. Select **"Provision PostgreSQL"**
3. **Project name:** `trading-alerts-saas-v7`
4. **Region:** Select the one closest to you:
   - US West (Oregon) - if you're in North America West
   - US East (Virginia) - if you're in North America East
   - Europe (Frankfurt) - if you're in Europe
   - Asia (Singapore) - if you're in Asia
5. Click **"Deploy"** (or it deploys automatically)

**Wait 2-3 minutes:** Railway is provisioning your PostgreSQL database

**You should see:**

- Database status: "Active" (green)
- Database icon with "PostgreSQL" label
- Deployment logs scrolling

**If deployment fails:** Screenshot the error and ask Claude Chat: "Railway deployment failed with this error. What should I do?"

---

### STEP 3: Get Database Connection URL (10 minutes)

**On Railway project page:**

1. Click on the **PostgreSQL** service card
2. Click **"Connect"** tab (top menu)
3. Look for **"DATABASE_URL"** section
4. Click the **"Copy"** icon next to the URL

**The URL looks like:**

```
postgresql://postgres:PASSWORD@containers-us-west-XXX.railway.app:5432/railway
```

**IMPORTANT - Save this URL securely:**

1. Open a text editor
2. Paste the Railway URL
3. Save as `RAILWAY-CREDENTIALS.txt` (temporary, DON'T commit to git!)
4. You'll need this URL in the next steps

**Security Note:** This URL contains your database password - keep it private!

**Alternative view:** Under "Variables" tab, you'll see:

- PGHOST
- PGPORT
- PGUSER
- PGPASSWORD
- PGDATABASE

These combine to form DATABASE_URL.

---

### STEP 4: Test Connection Locally (15 minutes)

**This step verifies Railway database is accessible from your computer.**

**Create test file:**

```bash
# In your project root
cat > test-db-connection.js << 'EOF'
const { Client } = require('pg');

const connectionString = 'PASTE_YOUR_RAILWAY_URL_HERE';

const client = new Client({ connectionString });

console.log('🔄 Connecting to Railway PostgreSQL...');

client.connect()
  .then(() => {
    console.log('✅ Connected successfully to Railway PostgreSQL!');
    console.log('📊 Database:', client.database);
    console.log('🖥️  Host:', client.host);
    return client.end();
  })
  .catch(err => {
    console.error('❌ Connection failed!');
    console.error('Error:', err.message);
    console.error('Code:', err.code);
  });
EOF
```

**Edit the file and replace `PASTE_YOUR_RAILWAY_URL_HERE` with your actual Railway URL:**

```bash
# Open in your editor
nano test-db-connection.js
# or
code test-db-connection.js
```

**Install pg library temporarily:**

```bash
npm install pg
```

**Run the test:**

```bash
node test-db-connection.js
```

**Expected Success Output:**

```
🔄 Connecting to Railway PostgreSQL...
✅ Connected successfully to Railway PostgreSQL!
📊 Database: railway
🖥️  Host: containers-us-west-XXX.railway.app
```

**If you see this:** ✅ SUCCESS! Your Railway database is accessible!

**Common Errors and Solutions:**

| Error                            | Cause                  | Solution                                  |
| -------------------------------- | ---------------------- | ----------------------------------------- |
| `ENOTFOUND`                      | Wrong host             | Double-check Railway URL is correct       |
| `ECONNREFUSED`                   | Wrong port or firewall | Check if Railway service is "Active"      |
| `password authentication failed` | Wrong password         | Re-copy DATABASE_URL from Railway         |
| `timeout`                        | Network issue          | Check your internet connection, try again |

**Delete test file after success:**

```bash
rm test-db-connection.js
npm uninstall pg
```

**If Stuck:** Screenshot the error and ask Claude Chat: "I'm getting this database connection error. What does it mean?"

---

### STEP 5: Update GitHub Secret DATABASE_URL (5 minutes)

**Now update the GitHub secret with your REAL Railway URL:**

1. Go to GitHub.com → Your repo → Settings → Secrets → Actions
2. Find **`DATABASE_URL`** in the list
3. Click on it
4. Click **"Update"** button
5. **Replace** the temporary value with your **Railway DATABASE_URL**
6. Click **"Update secret"**

**Verify:**

- Secret name: `DATABASE_URL` ✓
- Value: Hidden (shows `•••••••`) ✓
- Updated: "Updated X seconds ago" ✓

**Important:** The secret value should be your full Railway URL starting with `postgresql://`

---

### STEP 6: Save Railway Info for Reference (5 minutes)

**Create a private reference document (DON'T commit this to git!):**

```bash
cat > RAILWAY-INFO.md << 'EOF'
# Railway Connection Info

## PostgreSQL Database

**Project Name:** trading-alerts-saas-v7
**Region:** [YOUR REGION - e.g., US West (Oregon)]
**Status:** Active
**Deployed:** [TODAY'S DATE]

## Connection Details

**DATABASE_URL:**
```

[YOUR FULL RAILWAY DATABASE_URL - KEEP PRIVATE!]

```

**Dashboard URL:**
https://railway.app/project/[YOUR-PROJECT-ID]

## Railway Plan

- **Plan:** Free Tier
- **Credits:** $5 included
- **Storage:** 5GB PostgreSQL
- **Note:** No credit card required for development

## Important Notes

1. This database is LIVE in production-like environment
2. Test all Prisma migrations here immediately after local testing
3. DO NOT commit this file to git (already in .gitignore)
4. Check Railway dashboard regularly for usage/credits
5. Upgrade to paid plan before production launch

## Quick Links

- Railway Dashboard: https://railway.app
- Railway Docs: https://docs.railway.app
- PostgreSQL Status: Check dashboard for uptime

EOF
```

**Edit and fill in your information:**

```bash
nano RAILWAY-INFO.md
```

**Add to .gitignore (ensure it's not committed):**

```bash
echo "RAILWAY-INFO.md" >> .gitignore
echo "RAILWAY-CREDENTIALS.txt" >> .gitignore
git add .gitignore
git commit -m "chore: ignore Railway credentials"
```

---

### ✅ Checkpoint: Milestone 2.3 Complete

You should now have:

- ✅ Railway account created
- ✅ PostgreSQL database deployed and active
- ✅ Database connection tested successfully from local machine
- ✅ GitHub secret DATABASE_URL updated with Railway URL
- ✅ Railway info saved for reference (not committed)

**CRITICAL WIN:** Your database is live in Week 2! When you build your app in Phase 3, you'll test on this production-like database immediately. No surprises later!

**Time Spent:** ~1.5 hours
**Next:** Milestone 2.4 - Prisma Workflow Understanding

---

## 📚 MILESTONE 2.4: Prisma Workflow Understanding (30 minutes)

### Overview

Learn how Prisma database migrations work. You won't execute this until Phase 3, but understanding it now prevents confusion later.

**What is Prisma?** A tool that talks to PostgreSQL for you. You write a schema (like a blueprint), Prisma creates tables automatically.

---

### STEP 1: Understanding Prisma Basics (15 minutes)

**Read this carefully - ask Claude Chat if anything is unclear!**

#### What is Prisma?

Prisma is an ORM (Object-Relational Mapper) that:

- Converts TypeScript code into SQL queries
- Manages database schema and migrations
- Provides type-safe database access

**Think of it like this:**

```
Without Prisma (old way):
You write SQL → "CREATE TABLE users (id SERIAL, name VARCHAR(255));"
You query manually → "SELECT * FROM users WHERE id = 1;"
Risk: Typos, SQL injection, no type safety

With Prisma (modern way):
You write schema → model User { id Int @id @default(autoincrement()), name String }
Prisma creates table automatically
You query → const user = await prisma.user.findUnique({ where: { id: 1 } })
Benefits: Type-safe, auto-completion, no SQL injection
```

#### What is `prisma/schema.prisma`?

This is the "blueprint" file where you define your database structure:

```prisma
// Example from your Part 2 build-order
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  password      String?
  tier          UserTier  @default(FREE)
  emailVerified DateTime?
  alerts        Alert[]
}

enum UserTier {
  FREE
  PRO
}
```

**This says:**

- Create a "users" table
- "id" column is primary key, auto-generated
- "email" column must be unique
- "tier" defaults to FREE
- User can have multiple alerts

#### What are Migrations?

Migrations are **change snapshots** that update your database:

```
Migration 1: "Create users table"
Migration 2: "Add tier column to users"
Migration 3: "Create alerts table"
```

Each migration is a folder with SQL inside. Prisma generates these automatically!

---

### STEP 2: The Prisma Workflow (15 minutes)

**You'll do this in Phase 3 Part 2. For now, just understand the process:**

```
┌─────────────────────────────────────────────────────┐
│ STEP 1: Write Schema                               │
├─────────────────────────────────────────────────────┤
│ File: prisma/schema.prisma                         │
│ You: Define models (User, Alert, etc.)             │
│ Location: Your computer                            │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ STEP 2: Generate Migration (Local)                 │
├─────────────────────────────────────────────────────┤
│ Command: npx prisma migrate dev --name init_users  │
│ What happens:                                       │
│   1. Prisma creates SQL migration file             │
│   2. Applies migration to local PostgreSQL         │
│   3. Generates TypeScript types                    │
│ Result: Local database has new tables              │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ STEP 3: Test Locally                               │
├─────────────────────────────────────────────────────┤
│ Command: npx prisma studio                         │
│ What happens: Opens browser GUI to view tables     │
│ You: Verify tables look correct                    │
│ Result: ✅ Local database is correct               │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ STEP 4: Deploy to Railway (CRITICAL!)              │
├─────────────────────────────────────────────────────┤
│ Command: DATABASE_URL=[Railway] npx prisma migrate │
│          deploy                                     │
│ What happens:                                       │
│   1. Connects to Railway database                  │
│   2. Applies same migration                        │
│   3. Railway now has same tables as local          │
│ Result: ✅ Railway database matches local          │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ STEP 5: Verify Railway                             │
├─────────────────────────────────────────────────────┤
│ Command: DATABASE_URL=[Railway] npx prisma studio  │
│ What happens: Opens GUI showing Railway database   │
│ You: Verify Railway matches local                  │
│ Result: ✅ Both databases identical                │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ STEP 6: Continue Building (Phase 3)                │
├─────────────────────────────────────────────────────┤
│ Both databases now have same structure!            │
│ Code works on local → will work on Railway         │
│ No "migration hell" surprises!                     │
└─────────────────────────────────────────────────────┘
```

**KEY INSIGHT:** Test on Railway IMMEDIATELY after local test. Don't wait until Phase 10!

**The Commands You'll Use in Phase 3:**

| Command                                            | When                        | What It Does                         |
| -------------------------------------------------- | --------------------------- | ------------------------------------ |
| `npx prisma migrate dev --name init`               | After writing schema        | Creates migration + updates local DB |
| `npx prisma studio`                                | To view local database      | Opens GUI to see tables              |
| `DATABASE_URL=[Railway] npx prisma migrate deploy` | After local migration works | Applies migration to Railway         |
| `DATABASE_URL=[Railway] npx prisma studio`         | To verify Railway           | Opens GUI to see Railway tables      |
| `npx prisma generate`                              | After schema changes        | Regenerates TypeScript types         |

**Common Questions:**

**Q: Do I need local PostgreSQL?**
A: No! You can develop against Railway directly. But local is faster for testing.

**Q: What if I make a mistake in the schema?**
A: Create a new migration to fix it. Migrations are sequential.

**Q: Can I delete and start over?**
A: Yes! Use `npx prisma migrate reset` (local only). Don't reset Railway!

**Q: What if Railway and local get out of sync?**
A: Run `DATABASE_URL=[Railway] npx prisma migrate deploy` to sync Railway to your latest migrations.

---

### ✅ Checkpoint: Milestone 2.4 Complete

You should now understand:

- ✅ What Prisma is and why we use it
- ✅ What `prisma/schema.prisma` defines
- ✅ What migrations are (change snapshots)
- ✅ The workflow: schema → local migration → Railway deployment
- ✅ The commands you'll use in Phase 3
- ✅ Why testing on Railway early prevents problems

**Note:** You don't execute this until Phase 3 Part 2. This milestone is just for understanding!

**Time Spent:** ~30 minutes
**Next:** Milestone 2.5 - Docker Configuration

---

## 🐳 MILESTONE 2.5: Docker Configuration (1 hour)

### Overview

Create Docker configuration for the Flask MT5 service. **Docker is OPTIONAL for local development** - you can run Flask with `python run.py`. Docker is required for Railway deployment later.

**Beginner-Friendly Note:** If Docker feels overwhelming, you can develop Flask locally without it and add Docker later before deployment.

---

### STEP 1: Start Aider (2 minutes)

```bash
py -3.11 -m aider --model anthropic/MiniMax-M2
```

---

### STEP 2: Create Dockerfile for Flask (25 minutes)

**Copy and paste this EXACT prompt to Aider:**

```
Create Dockerfile for Flask MT5 service

Location: mt5-service/Dockerfile

Requirements:
- Use Python 3.11-slim as base image
- Install system dependencies for MetaTrader5 library
- Set working directory to /app
- Copy requirements.txt and install Python dependencies
- Copy application code (app/, indicators/, run.py)
- Expose port 5001
- Use gunicorn as production WSGI server
- Set environment variables for production mode
- Follow Docker best practices (multi-stage build, non-root user, layer caching)
- Include health check endpoint

Show me the complete Dockerfile for approval.
```

**What Aider Will Generate:**

A Dockerfile with sections like:

```dockerfile
# Base image
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Expose port
EXPOSE 5001

# Run with gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:5001", "run:app"]
```

**Review the Output:**

- Check base image: `python:3.11-slim` ✓
- Check port: `5001` ✓
- Check entry point: `gunicorn` ✓
- Check working directory: `/app` ✓

**Approve:**
Type in Aider: `Yes, create this file`

**Verify:**

```bash
cat mt5-service/Dockerfile
```

---

### STEP 3: Create docker-compose.yml (25 minutes)

**Copy and paste this EXACT prompt to Aider:**

```
Create docker-compose.yml for local development environment

Location: docker-compose.yml (project root)

Requirements:
- Define 2 services: postgres (database) and mt5-service (Flask app)
- PostgreSQL service:
  - Use postgres:15 image
  - Port 5432
  - Environment: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
  - Volume for data persistence
- MT5 service:
  - Build from ./mt5-service
  - Port 5001:5001
  - Environment variables from .env file
  - Depends on postgres service
  - Volume mount for hot-reload development
- Network: Custom bridge network for service communication
- Follow docker-compose best practices

Show me the complete docker-compose.yml for approval.
```

**What Aider Will Generate:**

A docker-compose.yml with:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    ports:
      - '5432:5432'
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: trading_alerts_dev
    volumes:
      - postgres_data:/var/lib/postgresql/data

  mt5-service:
    build: ./mt5-service
    ports:
      - '5001:5001'
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/trading_alerts_dev
      FLASK_ENV: development
    volumes:
      - ./mt5-service:/app

volumes:
  postgres_data:
```

**Review the Output:**

- Check services: `postgres` and `mt5-service` ✓
- Check ports: 5432, 5001 ✓
- Check dependencies: mt5-service depends on postgres ✓
- Check volume mounts for development ✓

**Approve:**
Type in Aider: `Yes, create this file`

**Verify:**

```bash
cat docker-compose.yml
```

**Exit Aider:**

```
/exit
```

---

### STEP 4: Test Docker Build (10 minutes) - OPTIONAL

**Note:** This will fail because Flask code doesn't exist yet. That's completely normal!

**Try building (optional - just to see the process):**

```bash
cd mt5-service
docker build -t mt5-service .
```

**Expected Error:**

```
ERROR: failed to solve: failed to read dockerfile: open /path/to/mt5-service/requirements.txt: no such file or directory
```

**This is NORMAL!** The Flask code doesn't exist until Phase 3 Part 6.

**Beginner Note:**

- You DON'T need Docker working now
- Docker is for **later deployment**, not local development
- You'll test Docker properly in Phase 3 when Flask code exists

---

### STEP 5: Commit Docker Configuration (5 minutes)

```bash
git add mt5-service/Dockerfile docker-compose.yml
git commit -m "feat: add Docker configuration for Flask service and local development"
git push
```

---

### ✅ Checkpoint: Milestone 2.5 Complete

You should now have:

- ✅ `mt5-service/Dockerfile` created
- ✅ `docker-compose.yml` created
- ✅ Docker configuration ready for Phase 4 deployment
- ✅ Understanding: Docker is optional for local dev

**Important:** You don't need Docker running yet. These files are ready for when you deploy to Railway in Phase 4.

**Time Spent:** ~1 hour
**Next:** Milestone 2.6 - Testing Framework Setup

---

## 🧪 MILESTONE 2.6: Testing Framework Setup (30 minutes)

### Overview

Set up Jest testing framework so you can write tests as you build features in Phase 3.

---

### STEP 1: Start Aider (2 minutes)

```bash
py -3.11 -m aider --model anthropic/MiniMax-M2
```

---

### STEP 2: Configure Jest for Next.js 15 (25 minutes)

**Copy and paste this EXACT prompt to Aider:**

```
Set up Jest testing framework for Next.js 15 with TypeScript

Requirements:
1. Install dependencies:
   - jest
   - @testing-library/react
   - @testing-library/jest-dom
   - @testing-library/user-event
   - jest-environment-jsdom
   - @types/jest

2. Create jest.config.js:
   - Configure for Next.js 15
   - Use jsdom environment
   - Set up module name mapper for @/ imports
   - Configure transform for TypeScript/JSX
   - Set up coverage collection

3. Create jest.setup.js:
   - Import @testing-library/jest-dom
   - Configure global test utilities

4. Create __tests__/example.test.ts:
   - Simple example test that passes
   - Tests a basic utility function
   - Shows proper test structure

5. Update package.json scripts:
   - Add "test" script: "jest"
   - Add "test:watch" script: "jest --watch"
   - Add "test:coverage" script: "jest --coverage"

Show me all files for approval.
```

**What Aider Will Generate:**

1. **jest.config.js** - Jest configuration
2. **jest.setup.js** - Test setup file
3. \***\*tests**/example.test.ts\*\* - Example test
4. **Updated package.json** - New test scripts

**Review the Output:**

- Check jest.config.js has Next.js setup ✓
- Check jest.setup.js imports testing-library ✓
- Check example test is simple and passes ✓
- Check package.json has test scripts ✓

**Approve:**
Type in Aider: `Yes, create all these files`

**Aider Will:**

- Update `package.json` with dependencies and scripts
- Create `jest.config.js`
- Create `jest.setup.js`
- Create `__tests__/example.test.ts`
- Commit all files

---

### STEP 3: Install Dependencies (3 minutes)

**Exit Aider:**

```
/exit
```

**Install the Jest dependencies:**

```bash
npm install
```

**Expected:** All Jest packages install successfully

---

### STEP 4: Verify Jest Works (5 minutes)

**Run the example test:**

```bash
npm test
```

**Expected Output:**

```
PASS  __tests__/example.test.ts
  ✓ example test should pass (2 ms)

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        1.234 s
```

**If the test passes:** ✅ Jest is working correctly!

**If the test fails:** Screenshot the error and ask Claude Chat: "Jest test is failing with this error. What should I do?"

---

### STEP 5: Commit Testing Setup (5 minutes)

```bash
git add .
git commit -m "feat: set up Jest testing framework for Next.js 15"
git push
```

---

### ✅ Checkpoint: Milestone 2.6 Complete

You should now have:

- ✅ Jest configured for Next.js 15
- ✅ Testing utilities installed
- ✅ Example test passing
- ✅ Test scripts in package.json
- ✅ Ready to write tests in Phase 3

**Time Spent:** ~30 minutes

---

## 🎉 PHASE 2 COMPLETION CHECKLIST

### Overall Progress

**Total Time:** ~5 hours
**Milestones Completed:** 6/6

### Detailed Checklist

#### Milestone 2.1: GitHub Actions ✅

- ✅ ci-nextjs.yml created
- ✅ ci-flask.yml created
- ✅ openapi-validation.yml created
- ✅ openapi-sync.yml verified (pre-built)
- ✅ api-tests.yml verified (pre-built)
- ✅ All workflows pushed to GitHub
- ✅ Workflows visible in Actions tab

#### Milestone 2.2: GitHub Secrets ✅

- ✅ NEXTAUTH_SECRET added (cryptographically random)
- ✅ DATABASE_URL added (Railway PostgreSQL URL)
- ✅ MT5_API_KEY added (temporary)
- ✅ ANTHROPIC_API_KEY added (MiniMax M2)
- ✅ ANTHROPIC_API_BASE added (MiniMax endpoint)
- ✅ All 5 secrets showing as hidden

#### Milestone 2.3: Railway PostgreSQL ✅

- ✅ Railway account created
- ✅ Project "trading-alerts-saas-v7" created
- ✅ PostgreSQL database deployed and active
- ✅ DATABASE_URL obtained
- ✅ Connection tested locally (successful)
- ✅ GitHub secret DATABASE_URL updated
- ✅ Railway info saved privately

#### Milestone 2.4: Prisma Workflow ✅

- ✅ Understand what Prisma is
- ✅ Understand prisma/schema.prisma purpose
- ✅ Understand migrations concept
- ✅ Understand the workflow: schema → local → Railway
- ✅ Know the commands for Phase 3
- ✅ Know why early Railway testing prevents problems

#### Milestone 2.5: Docker Configuration ✅

- ✅ mt5-service/Dockerfile created
- ✅ docker-compose.yml created
- ✅ Docker files committed
- ✅ Understand Docker is optional for local dev
- ✅ Ready for Phase 4 deployment

#### Milestone 2.6: Testing Framework ✅

- ✅ Jest dependencies installed
- ✅ jest.config.js created
- ✅ jest.setup.js created
- ✅ Example test created and passing
- ✅ Test scripts added to package.json
- ✅ `npm test` works

### What You Accomplished

**Infrastructure:**

- 🤖 5 automated GitHub Actions workflows
- 🔐 5 secure GitHub secrets
- 🗄️ PostgreSQL database live on Railway
- 🐳 Docker ready for deployment
- 🧪 Testing framework configured

**Skills Learned:**

- CI/CD automation setup
- Secure credentials management
- Cloud database deployment
- Database migration concepts
- Container configuration
- Test-driven development setup

**Critical Win:**
🎯 **Database deployed in Week 2!** You'll test database changes on Railway throughout Phase 3, preventing "migration hell" later.

### Automation Benefits

**Before Phase 2:**

- ❌ Manual type generation after OpenAPI changes
- ❌ Manual API testing in Postman
- ❌ Database deployed late (Week 10+)
- ⏱️ Hours of manual work per change

**After Phase 2:**

- ✅ Types auto-generate on OpenAPI changes
- ✅ API tests auto-run on every push
- ✅ Database live early (Week 2)
- ✅ Test reports auto-generated
- ⏱️ Zero manual work - 95%+ automation!

---

## 🚀 READY FOR PHASE 3!

### What's Next

**Phase 3: Building (170+ files, autonomous with Aider)**

You'll build the complete application using:

- Aider + MiniMax M2 (autonomous code generation)
- 18 build-order files (file-by-file instructions)
- 9 policy files (quality standards)
- Claude Code (automated validation)

**Expected Timeline:** 6-8 weeks (with 95%+ automation)

**Expected Escalation Rate:** 2-5% (thanks to detailed build-orders!)

### Before Starting Phase 3

**Quick Verification:**

1. Run `./scripts/verify-build-orders.sh` - Should show 18/18 complete ✅
2. Check GitHub Actions tab - Workflows should be visible
3. Visit Railway dashboard - PostgreSQL should be "Active"
4. Run `npm test` - Jest test should pass

**If all pass:** You're ready for Phase 3! 🎉

---

## 🆘 TROUBLESHOOTING GUIDE

### Common Issues and Solutions

#### Issue: Aider won't start

**Symptoms:**

```
aider: command not found
```

**Solution:**

```bash
# Reinstall aider
pip install -U aider-chat

# Or use full path
py -3.11 -m aider --model anthropic/MiniMax-M2
```

**Ask Claude Chat:** Screenshot the error for specific help

---

#### Issue: GitHub Actions workflows not visible

**Symptoms:**

- Actions tab is empty
- Workflows don't appear

**Solution:**

1. Ensure files are in `.github/workflows/` directory
2. Ensure files end with `.yml` extension
3. Ensure you pushed to the repository: `git push`
4. Refresh GitHub page (hard refresh: Ctrl+F5)

**Ask Claude Chat:** Screenshot the GitHub Actions page

---

#### Issue: Railway database connection fails

**Symptoms:**

```
Error: ECONNREFUSED
Error: ENOTFOUND
```

**Solution:**

1. Check Railway dashboard - is database "Active"?
2. Verify DATABASE_URL is correct (copy again from Railway)
3. Check your internet connection
4. Try connecting from Railway console (Settings → Terminal)

**Ask Claude Chat:** Screenshot the error for diagnosis

---

#### Issue: GitHub secret not working in workflow

**Symptoms:**

- Workflow fails with "secret not found"
- Workflow shows empty value for secret

**Solution:**

1. Check secret NAME matches exactly (case-sensitive)
2. Ensure secret has a VALUE (not empty)
3. Re-save the secret (Edit → Update)
4. Re-run the workflow after saving

**Ask Claude Chat:** Screenshot the workflow error

---

#### Issue: Jest test fails

**Symptoms:**

```
Test suite failed to run
Cannot find module...
```

**Solution:**

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Verify jest.config.js exists
cat jest.config.js

# Try running test again
npm test
```

**Ask Claude Chat:** Screenshot the jest error

---

#### Issue: Docker build fails

**Symptoms:**

```
ERROR: failed to solve
```

**Solution:**

- This is EXPECTED in Phase 2! Flask code doesn't exist yet
- Docker will work in Phase 3 when you build the Flask service
- For now, just ensure Dockerfile and docker-compose.yml files exist

**No action needed** - Docker testing happens in Phase 3

---

### When to Ask Claude Chat for Help

**Good times to ask Claude Chat:**

1. When you see an error you don't understand
2. When a step doesn't work as described
3. When you need help interpreting a screenshot
4. When you're stuck for more than 10 minutes

**How to ask effectively:**

1. Take a screenshot of the error
2. Describe what step you're on
3. Mention what you've already tried
4. Paste the exact error message (if text)

**Example:**

> "I'm on Phase 2, Milestone 2.3, Step 4 (testing Railway connection). I'm getting this error: [paste error]. Here's a screenshot: [attach]. I've verified the DATABASE_URL is correct. What should I try next?"

---

## 📋 PHASE 2 SUMMARY

**Congratulations!** You've completed Phase 2 and built a solid foundation for Phase 3.

### Key Achievements

1. **Automation:** 5 GitHub Actions workflows (95%+ automation achieved)
2. **Security:** All credentials stored securely in GitHub Secrets
3. **Database:** PostgreSQL deployed early on Railway (prevents migration hell!)
4. **Understanding:** Prisma workflow mastered conceptually
5. **Deployment:** Docker ready for later Railway deployment
6. **Testing:** Jest configured and working

### Time Breakdown

| Milestone                | Estimated    | Your Time |
| ------------------------ | ------------ | --------- |
| 2.1 GitHub Actions       | 2 hours      | \_\_\_    |
| 2.2 GitHub Secrets       | 30 min       | \_\_\_    |
| 2.3 Railway PostgreSQL   | 1.5 hours    | \_\_\_    |
| 2.4 Prisma Understanding | 30 min       | \_\_\_    |
| 2.5 Docker Config        | 1 hour       | \_\_\_    |
| 2.6 Jest Setup           | 30 min       | \_\_\_    |
| **Total**                | **~5 hours** | \_\_\_    |

### What You Learned

- ✅ CI/CD automation with GitHub Actions
- ✅ Secure credential management
- ✅ Cloud database deployment with Railway
- ✅ Database migration workflows with Prisma
- ✅ Container orchestration with Docker
- ✅ Test-driven development with Jest
- ✅ Working with AI coding assistants (Aider + MiniMax M2)

### The Big Win

🎯 **DATABASE DEPLOYED IN WEEK 2!**

This is the V7 advantage - you'll test all database changes on Railway throughout Phase 3. No surprises at the end. No migration hell. Just smooth, predictable development.

---

## 🎯 NEXT STEPS

**You are now ready for Phase 3: Building!**

Phase 3 will use:

- 🤖 **Aider** - AI coding assistant with MiniMax M2
- 📋 **18 build-order files** - Detailed file-by-file instructions
- 📜 **9 policy files** - Quality and architecture standards
- ✅ **Claude Code** - Automated validation (2-5% escalation rate)

**Estimated Timeline:** 6-8 weeks with 95%+ automation

**Before starting Phase 3:**

1. ✅ Verify all Phase 2 checkpoints passed
2. ✅ Run `./scripts/verify-build-orders.sh` (should show 18/18)
3. ✅ Check Railway dashboard (PostgreSQL should be Active)
4. ✅ Test `npm test` (should pass)
5. ✅ Rest and prepare for autonomous building! 🚀

---

**Last Updated:** 2025-11-19
**Phase:** 2 - Foundation Complete
**Next Phase:** 3 - Building (Autonomous)
**Your Progress:** Foundation → **Building** → Testing → Deployment

**You've got this!** 💪 Phase 3 is where Aider and MiniMax M2 build 170+ files autonomously while you supervise. You've set up the perfect infrastructure for success!

---

## 📞 GETTING HELP

**Primary Support:** Claude Chat (for screenshots and real-time help)

**Ask Claude Chat when:**

- You see an error and need interpretation
- A step doesn't work as described
- You need help with a screenshot
- You're stuck for >10 minutes

**How to ask effectively:**

1. Specify which milestone and step
2. Include screenshot of error
3. Mention what you've tried
4. Paste exact error message

**Example:**

> "Phase 2, Milestone 2.3, Step 4 - Railway connection test failing. Error: ECONNREFUSED. Screenshot attached. Verified DATABASE_URL is correct. What should I check next?"

---

**END OF PHASE 2 GUIDE**

🎉 **Congratulations on completing Phase 2!** You're ready for Phase 3! 🚀
