## 🔧 AFTER CREATING deploy.yml

### **Additional Manual Steps:**

**You still need to manually configure** (cannot be automated):

1. **GitHub Secrets** (in GitHub UI):

   Repository Settings → Secrets and variables → Actions

   Add:
   ├─ VERCEL_TOKEN
   ├─ VERCEL_ORG_ID
   ├─ VERCEL_PROJECT_ID
   └─ RAILWAY_TOKEN

2. **Vercel Project Setup** (one-time):
   - Create Vercel project
   - Link to GitHub repo
   - Configure environment variables

3. **Railway Service Setup** (one-time):
   - Create Railway services
   - Link to GitHub repo
   - Configure environment variables

## 📊 IMPLEMENTATION TIMELINE

Phase 3.5 Complete:
├─ ✅ tests.yml exists
├─ ✅ All test files exist
└─ ✅ Quality gate active

Phase 4 Implementation:
├─ ☐ Create deploy.yml (Claude Code)
├─ ☐ Configure GitHub secrets (Manual)
├─ ☐ Setup Vercel project (Manual - Milestone 4.2)
├─ ☐ Setup Railway service (Manual - Milestone 4.3)
└─ ☐ Test deployment (Manual - Milestone 4.6)

## 🎯 SUMMARY

### **What Claude Code MUST Create:**

✅ .github/workflows/deploy.yml

- Automated deployment workflow
- Depends on tests.yml (Phase 3.5)
- Deploys to Vercel + Railway
- CRITICAL FILE - Cannot deploy without it

### **What YOU Must Do Manually:**

After Claude Code creates deploy.yml:

1. Configure GitHub secrets (Milestone 4.1, Step 2)
2. Setup Vercel project (Milestone 4.2)
3. Setup Railway services (Milestone 4.3)
4. Test deployment workflow (Milestone 4.1, Step 3)
