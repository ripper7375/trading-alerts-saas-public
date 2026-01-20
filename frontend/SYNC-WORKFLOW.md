# Frontend-Backend Synchronization Workflow

**Purpose**: Keep shared types and utilities synchronized between monolith and modular frontend during migration (Steps 4-8)

---

## When to Sync

Run the sync check before committing:

```bash
npm run sync:check
```

### Sync is REQUIRED when you modify:

| Modified File/Directory        | Action Required                            | Why                          |
|--------------------------------|--------------------------------------------|------------------------------|
| `types/*`                      | Run `npm run sync:frontend`                | Shared type definitions      |
| `lib/tier-config.ts`           | Run `npm run sync:frontend`                | Tier limits (FREE/PRO)       |
| `lib/tier-helpers.ts`          | Run `npm run sync:frontend`                | Tier validation helpers      |
| `lib/tier-validation.ts`       | Run `npm run sync:frontend`                | Tier validation logic        |
| `lib/utils.ts`                 | Run `npm run sync:frontend`                | Shared utility functions     |
| `lib/constants/business-rules.ts` | Run `npm run sync:frontend`             | Business rule constants      |
| `lib/tier/constants.ts`        | Run `npm run sync:frontend`                | Tier-specific constants      |
| `lib/tier/validator.ts`        | Run `npm run sync:frontend`                | Tier validation utilities    |
| `prisma/schema.prisma`         | Run `npx prisma generate` then sync       | Database schema changed      |
| `app/api/*` (response changes) | Update `frontend/types/` manually          | API contract changed         |
| `.env.example`                 | Update `frontend/.env.example` manually    | Environment vars changed     |

### Sync is NOT required for:

- `frontend/components/*` - Frontend only (UI components)
- `frontend/app/*` - Frontend only (pages, layouts)
- `app/api/*` (internal logic, no response change) - Backend only
- `lib/db/*` - Backend only (database utilities)
- `lib/auth/session.ts` - Backend only (session management)
- `lib/email/*` - Backend only (email templates)
- `lib/stripe/*` - Backend only (payment processing)

---

## How to Sync

### Automatic Sync (Recommended)

```bash
# From project root
npm run sync:frontend
```

This will:

1. ✅ Copy `types/*` → `frontend/types/`
2. ✅ Copy shared lib files → `frontend/lib/`
3. ✅ Sync Prisma schema (if changed)
4. ✅ Run TypeScript check in frontend
5. ✅ Report any errors

**Output**:
```
🔄 Frontend-Backend Sync Tool
==============================

Step 1: Syncing types...
✓ Types synced

Step 2: Syncing shared utilities...
✓ Synced lib/tier-config.ts
✓ Synced lib/tier-helpers.ts
✓ Synced lib/utils.ts

Step 3: Checking Prisma schema...
✓ Prisma schemas already in sync

Step 4: Verifying TypeScript...
✓ TypeScript verification passed

==============================
Sync completed successfully!
==============================
```

### Manual Sync (Selective)

If automatic sync fails or you need selective sync:

```bash
# Copy specific type file
cp types/alert.ts frontend/types/

# Copy specific lib file
cp lib/tier-config.ts frontend/lib/

# Verify TypeScript
cd frontend && npm run type-check
```

### Sync All + Validate

```bash
# Sync and run full validation
npm run sync:all
```

This runs:
1. Frontend sync
2. TypeScript type checking
3. Reports any issues

---

## Git Workflow

### Commit Messages

Use these commit message conventions:

```bash
# Backend change requiring sync
git commit -m "feat(api): add priority to alerts

SYNC-REQUIRED: frontend/types/alert.ts"

# After running sync
git commit -m "sync: update frontend types from backend changes"

# Frontend-only change
git commit -m "feat(ui): add priority badge component"

# Both backend and frontend in one commit
git commit -m "feat: add alert priority feature

- Backend: Add priority field to Alert model
- Frontend: Add priority badge to alert cards
- Synced types and updated components"
```

### Branch Strategy

For changes affecting both backend and frontend:

**Option A: Single Branch (Recommended)**
1. Create feature branch
2. Make backend changes
3. Run `npm run sync:frontend`
4. Make frontend changes
5. Commit all together
6. Single PR with both changes

```bash
git checkout -b feat/add-alert-priority
# ... make backend changes ...
npm run sync:frontend
# ... make frontend changes ...
git add .
git commit -m "feat: add alert priority feature"
git push
```

**Option B: Sequential Commits**
1. Make backend changes
2. Commit backend
3. Run sync
4. Commit synced files
5. Make frontend changes
6. Commit frontend

```bash
git checkout -b feat/add-alert-priority
# ... make backend changes ...
git commit -m "feat(backend): add priority to alerts"
npm run sync:frontend
git commit -m "sync: update frontend types"
# ... make frontend changes ...
git commit -m "feat(frontend): add priority UI"
git push
```

---

## Common Scenarios

### Scenario 1: Add New Field to API Response

**Example**: Add `priority` field to Alert type

**Steps**:
1. Update `types/alert.ts`:
   ```typescript
   export interface Alert {
     id: string;
     // ... existing fields ...
     priority: 'low' | 'medium' | 'high'; // NEW
   }
   ```

2. Update Prisma schema:
   ```prisma
   model Alert {
     // ... existing fields ...
     priority String @default("medium") // NEW
   }
   ```

3. Run sync:
   ```bash
   npm run sync:frontend
   ```

4. Update frontend components to use new field:
   ```tsx
   // frontend/components/alerts/alert-card.tsx
   <Badge variant={alert.priority}>{alert.priority}</Badge>
   ```

5. Commit all changes:
   ```bash
   git add .
   git commit -m "feat: add alert priority feature"
   ```

### Scenario 2: Change Tier Limits

**Example**: Increase PRO tier symbol limit from 15 to 20

**Steps**:
1. Update `lib/tier-config.ts`:
   ```typescript
   export const TIER_LIMITS = {
     FREE: { symbols: 5, timeframes: 3, alerts: 5 },
     PRO: { symbols: 20, timeframes: 9, alerts: 20 }, // Changed from 15
   };
   ```

2. Run sync:
   ```bash
   npm run sync:frontend
   ```

3. Frontend automatically gets updated limits (no code change needed)

4. Commit:
   ```bash
   git add lib/tier-config.ts frontend/lib/tier-config.ts
   git commit -m "feat: increase PRO tier symbol limit to 20"
   ```

### Scenario 3: Update Prisma Schema

**Example**: Add new field to User model

**Steps**:
1. Update `prisma/schema.prisma`:
   ```prisma
   model User {
     // ... existing fields ...
     lastLoginAt DateTime? // NEW
   }
   ```

2. Generate Prisma client:
   ```bash
   npx prisma generate
   ```

3. Run migration (if in development):
   ```bash
   npx prisma migrate dev
   ```

4. Run sync:
   ```bash
   npm run sync:frontend
   ```

5. Generate frontend Prisma client:
   ```bash
   cd frontend && npx prisma generate
   ```

6. Commit:
   ```bash
   git add prisma/ frontend/prisma/
   git commit -m "feat: add lastLoginAt to User model"
   ```

---

## Troubleshooting

### "TypeScript errors after sync"

**Problem**: After running sync, frontend has TypeScript errors

**Solution**:
```bash
# Check what changed
git diff frontend/types/

# If breaking change, search for usage
cd frontend
grep -r "oldFieldName" .

# Update components
# Example: alert.symbol → alert.symbolName
find ./components -name "*.tsx" -exec sed -i 's/alert\.symbol/alert.symbolName/g' {} +

# Verify fix
npm run type-check

# Build to double-check
npm run build
```

### "Sync script not found"

**Problem**: `bash: scripts/sync-frontend.sh: No such file or directory`

**Solution**:
```bash
# Make script executable
chmod +x scripts/sync-frontend.sh

# Or run directly
bash scripts/sync-frontend.sh
```

### "frontend/ directory not found"

**Problem**: Script exits with "frontend/ directory not found"

**Solution**: You need to complete Step 4 first (create frontend directory):

```bash
# Check if frontend exists
ls -la frontend/

# If not, create it with Step 4 structure
mkdir -p frontend/{app,components,lib,types,prisma}
```

### "Prisma client generation failed"

**Problem**: Sync completes but `npx prisma generate` fails

**Solution**:
```bash
# Check Prisma schema syntax
cd frontend
npx prisma validate

# If valid, regenerate
npx prisma generate

# If still fails, check DATABASE_URL
cat .env.local | grep DATABASE_URL
```

### "node_modules not found in frontend"

**Problem**: Type check fails because dependencies not installed

**Solution**:
```bash
cd frontend
npm install

# Then run sync again from root
cd ..
npm run sync:frontend
```

---

## CI/CD Integration

### GitHub Actions Workflow

Add to `.github/workflows/ci.yml`:

```yaml
name: CI

on: [push, pull_request]

jobs:
  check-sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Check if sync is needed
        run: npm run sync:check

      - name: Verify frontend types
        run: |
          cd frontend
          npm install
          npm run type-check
```

### Pre-commit Hook (Optional)

Create `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Check if sync is needed
echo "🔍 Checking if frontend sync is needed..."
if ! npm run sync:check; then
    echo ""
    echo "❌ Commit blocked: Frontend sync required"
    echo "   Run: npm run sync:frontend"
    echo "   Then: git add frontend/ && git commit"
    exit 1
fi

echo "✅ Sync check passed"
```

Install Husky (if not already):

```bash
npm install --save-dev husky
npx husky install
npx husky add .husky/pre-commit "npm run sync:check"
```

---

## Best Practices

### DO ✅

- **Run sync check** before every commit
- **Commit synced files** together with source changes
- **Document breaking changes** in commit messages
- **Test frontend** after syncing types
- **Keep sync triggers updated** as project evolves

### DON'T ❌

- **Skip sync check** even if "just a small change"
- **Manually copy files** instead of using sync script
- **Commit backend changes** without syncing to frontend
- **Modify synced files** in frontend (change in root instead)
- **Ignore sync warnings** in CI/CD

---

## FAQ

**Q: Why can't I just import from root in frontend?**
A: Frontend will be deployed separately (Vercel), so it needs its own copy of shared code.

**Q: What if I change a synced file in frontend?**
A: It will be overwritten next sync. Always make changes in root, then sync.

**Q: How do I add a new file to sync triggers?**
A: Edit `scripts/check-sync-needed.js` and add to `SYNC_TRIGGERS` array.

**Q: Can I run sync automatically on file change?**
A: Yes, but not recommended (can cause build loops). Use pre-commit hook instead.

**Q: What happens if I forget to sync?**
A: Frontend TypeScript build will fail due to missing/outdated types.

---

## Migration Phases and Sync

### Step 4 (Current)
- Frontend created in `frontend/` directory
- Shares types and utils with monolith
- **Sync required**: ✅ Yes, frequently

### Step 5 (Backend to NestJS)
- Backend moves to Railway
- Frontend calls backend API
- **Sync required**: ✅ Yes, for API types

### Step 6-7 (Integration & Testing)
- Frontend and backend fully separated
- Communication via REST/GraphQL
- **Sync required**: ⚠️ Only for type definitions

### Step 8 (Production Cutover)
- Frontend on Vercel, Backend on Railway
- Independent deployments
- **Sync required**: ⚠️ Minimal (OpenAPI codegen instead)

---

## Related Documentation

- **Main Roadmap**: `monolith-to-modular-monolith-migration/IMPLEMENTATION_ROADMAP.md`
- **Step 4 Guide**: `monolith-to-modular-monolith-migration/step-4-frontend-ui-deployment-vercel-prompt.md`
- **Environment Sync**: `frontend/.env.sync-checklist`

---

**Last Updated**: 2026-01-09
**Maintained By**: Migration Team
**Questions**: Review this doc or ask in #migration-support
