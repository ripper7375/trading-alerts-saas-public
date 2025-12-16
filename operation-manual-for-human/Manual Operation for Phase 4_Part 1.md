📊 Required GitHub Secrets
Add these to GitHub repo → Settings → Secrets:

Secret Purpose Example
VERCEL_TOKEN Vercel authentication vercel_abc123...
VERCEL_ORG_ID Organization ID team_abc123...
VERCEL_PROJECT_ID Project ID prj_abc123...
RAILWAY_TOKEN Railway authentication railway_abc123...
RAILWAY_SERVICE_ID Flask service ID svc-abc123...
PRODUCTION_URL Frontend URL https://your-app.vercel.app
FLASK_URL Backend URL https://flask.railway.app

===================================================

🎯 How to Use

1. Configure Secrets (First Time)

# Get Vercel credentials

npm i -g vercel
vercel login
vercel link
cat .vercel/project.json

# Get Railway token

# Go to railway.app → Account Settings → Tokens

Add all secrets to GitHub.

2. Test Workflow (Manual Trigger)

# Go to: GitHub repo → Actions → Deploy to Production

# Click "Run workflow" → "Run workflow"

# Watch it run!

3. Automatic Deployment

# Just push to main

git checkout main
git merge your-feature-branch
git push origin main

# Deployment happens automatically!

4. Monitor Deployment

# Watch live

gh run watch

# View logs

gh run view --log

# Check specific job

gh run view --job=deploy-frontend

=========================================

✅ Verification Checklist
Before first deployment:

Add all 7 GitHub secrets
Verify Vercel project exists
Verify Railway service exists
Test manual workflow trigger
Verify tests pass locally: npm test
Push to main and monitor
Check deployment URLs work
Verify health checks pass

=========================================

🚀 Next Steps
Add GitHub Secrets (Milestone 4.1 Step 2)

Follow Phase 4 documentation
Get Vercel and Railway credentials
Test Deployment Workflow (Milestone 4.1 Step 3)

Manual trigger recommended first
Verify all jobs pass
Set Up Branch Protection (if not already done)

Follow docs/BRANCH-PROTECTION-RULES.md
Require status checks
Complete Phase 4

Milestone 4.2: Vercel configuration
Milestone 4.3: Railway configuration
Milestone 4.4: Stripe webhooks
Milestone 4.5: Monitoring
Milestone 4.6: Final testing
