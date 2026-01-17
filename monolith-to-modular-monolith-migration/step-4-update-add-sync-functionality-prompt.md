# UPDATE PROMPT: Add Frontend-Backend Synchronization to Step 4 Implementation

## Purpose

This is an **UPDATE/ENHANCEMENT prompt** for Claude Code (web) to add synchronization functionality to the existing Step 4 Frontend UI Deployment work that is already in progress.

**Use this prompt when:** Claude Code has already started working on Step 4 (Frontend UI Deployment to Vercel) using the original prompt, and you need to add the frontend-backend synchronization capability.

---

## Prompt for Claude Code (Web)

---

### Context: Updating Existing Work

You have already started implementing Step 4 of the Monolith to Modular Monolith Architecture Migration (Frontend UI Deployment to Vercel with Interactive/Readable Elements Separation).

**NEW REQUIREMENT**: We need to add **frontend-backend synchronization** functionality to handle changes that occur in both systems during the ongoing migration.

### Problem Statement

During the monolith to modular monolith migration (Steps 4-8), the backend logic may evolve while the frontend is being developed in the separate `frontend/` directory. We need:

1. A way to keep shared types synchronized
2. A workflow for propagating backend changes to frontend
3. Scripts to automate the sync process
4. Documentation for the team on when and how to sync

### Your Task: Add These Synchronization Features

Please add the following to your existing Step 4 implementation:

---

#### Task 1: Create Sync Scripts

Create these files in the repository:

**File 1: `scripts/sync-frontend.sh`**

```bash
#!/bin/bash
set -e

echo "🔄 Frontend-Backend Sync Tool"
echo "=============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Directories
ROOT_DIR=$(pwd)
FRONTEND_DIR="$ROOT_DIR/frontend"

# Check frontend directory exists
if [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${RED}Error: frontend/ directory not found${NC}"
    echo "Please run Step E first to create the frontend directory"
    exit 1
fi

# Step 1: Sync Types
echo -e "\n${YELLOW}Step 1: Syncing types...${NC}"
mkdir -p "$FRONTEND_DIR/types"
if [ -d "types" ]; then
    cp -r types/* "$FRONTEND_DIR/types/"
    echo -e "${GREEN}✓ Types synced${NC}"
else
    echo -e "${YELLOW}⚠ No types/ directory found in root${NC}"
fi

# Step 2: Sync shared utilities
echo -e "\n${YELLOW}Step 2: Syncing shared utilities...${NC}"
SHARED_FILES=(
    "lib/tier-config.ts"
    "lib/constants.ts"
    "lib/utils.ts"
    "lib/format.ts"
)

for file in "${SHARED_FILES[@]}"; do
    if [ -f "$ROOT_DIR/$file" ]; then
        mkdir -p "$FRONTEND_DIR/$(dirname $file)"
        cp "$ROOT_DIR/$file" "$FRONTEND_DIR/$file"
        echo -e "${GREEN}✓ Synced $file${NC}"
    else
        echo -e "${YELLOW}⚠ File not found: $file${NC}"
    fi
done

# Step 3: Verify TypeScript (if type-check script exists)
echo -e "\n${YELLOW}Step 3: Verifying TypeScript...${NC}"
cd "$FRONTEND_DIR"
if [ -f "package.json" ] && grep -q "type-check" package.json 2>/dev/null; then
    if pnpm run type-check 2>/dev/null; then
        echo -e "${GREEN}✓ TypeScript verification passed${NC}"
    else
        echo -e "${RED}✗ TypeScript errors found - please fix before committing${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠ Skipping type-check (script not found in package.json)${NC}"
fi

# Step 4: Summary
echo -e "\n${GREEN}=============================="
echo "Sync completed successfully!"
echo -e "==============================${NC}"
echo ""
echo "Next steps:"
echo "1. Review changes: git diff frontend/"
echo "2. Test the frontend: cd frontend && pnpm run build"
echo "3. Commit changes: git add frontend/ && git commit -m 'sync: update frontend from backend changes'"
```

**File 2: `scripts/check-sync-needed.js`**

```javascript
#!/usr/bin/env node

/**
 * Check if frontend sync is needed based on changed files
 * Usage: node scripts/check-sync-needed.js
 */

const { execSync } = require('child_process');
const path = require('path');

// Files/directories that require frontend sync when modified
const SYNC_TRIGGERS = [
  'types/',
  'lib/tier-config.ts',
  'lib/constants.ts',
  'lib/utils.ts',
  'lib/format.ts',
  'prisma/schema.prisma',
];

// Get changed files from git
function getChangedFiles() {
  try {
    // Check staged files
    const staged = execSync('git diff --cached --name-only', { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);

    // Check unstaged files
    const unstaged = execSync('git diff --name-only', { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);

    return [...new Set([...staged, ...unstaged])];
  } catch (error) {
    console.error('Error getting changed files:', error.message);
    return [];
  }
}

// Check if any changed file triggers sync
function checkSyncNeeded(changedFiles) {
  const triggerMatches = [];

  for (const file of changedFiles) {
    for (const trigger of SYNC_TRIGGERS) {
      if (file.startsWith(trigger) || file === trigger.replace('/', '')) {
        triggerMatches.push({ file, trigger });
      }
    }
  }

  return triggerMatches;
}

// Main
function main() {
  console.log('🔍 Checking if frontend sync is needed...\n');

  const changedFiles = getChangedFiles();

  if (changedFiles.length === 0) {
    console.log('No changed files detected.');
    process.exit(0);
  }

  console.log(`Found ${changedFiles.length} changed file(s):`);
  changedFiles.forEach(f => console.log(`  - ${f}`));
  console.log('');

  const matches = checkSyncNeeded(changedFiles);

  if (matches.length === 0) {
    console.log('✅ No sync required - changes do not affect frontend.');
    process.exit(0);
  }

  console.log('⚠️  SYNC REQUIRED - The following changes affect frontend:\n');
  matches.forEach(({ file, trigger }) => {
    console.log(`  📁 ${file}`);
    console.log(`     └── Matches trigger: ${trigger}`);
  });

  console.log('\n📋 Action needed:');
  console.log('   Run: pnpm run sync:frontend');
  console.log('   Or:  bash scripts/sync-frontend.sh');

  process.exit(1); // Exit with error to fail CI if sync needed but not done
}

main();
```

---

#### Task 2: Update package.json

Add these scripts to the root `package.json`:

```json
{
  "scripts": {
    "sync:check": "node scripts/check-sync-needed.js",
    "sync:frontend": "bash scripts/sync-frontend.sh",
    "sync:all": "npm run sync:frontend && cd frontend && npm run type-check",
    "presync:frontend": "echo '🔄 Starting frontend sync...'"
  }
}
```

---

#### Task 3: Create .env.sync-checklist in frontend/

Create `frontend/.env.sync-checklist`:

```bash
# Frontend-Backend Environment Variable Sync Checklist
# =====================================================
# This file documents which env vars need to be synced between
# the monolith (root) and the modular frontend (frontend/)

# ===== MUST SYNC (same values) =====
NEXTAUTH_SECRET=               # Must match for session compatibility
# Copy from root .env to frontend/.env

# ===== DIFFERENT VALUES (per deployment) =====
NEXTAUTH_URL=                  # Different URL per deployment
# Root: https://trading-alerts.vercel.app
# Frontend: https://trading-alerts-v2.vercel.app

# ===== FRONTEND ONLY =====
NEXT_PUBLIC_API_URL=           # Backend API URL
# Set to: https://api.trading-alerts.railway.app (after Step 5)
# Or: http://localhost:5000 (for local development)

NEXT_PUBLIC_DEPLOYMENT_TYPE=modular-frontend
NEXT_PUBLIC_BACKEND_VERSION=v2

# ===== BACKEND ONLY (do NOT copy to frontend) =====
# DATABASE_URL                 # Backend only - frontend uses API
# STRIPE_SECRET_KEY            # Backend only
# REDIS_URL                    # Backend only
# WEBHOOK_SECRET               # Backend only
```

---

#### Task 4: Update frontend/package.json

Ensure the frontend package.json has these scripts:

```json
{
  "scripts": {
    "type-check": "tsc --noEmit",
    "build": "next build",
    "dev": "next dev",
    "start": "next start",
    "lint": "next lint"
  }
}
```

---

#### Task 5: Create SYNC-WORKFLOW.md

Create `frontend/SYNC-WORKFLOW.md` for team documentation:

```markdown
# Frontend-Backend Synchronization Workflow

## When to Sync

Run the sync check before committing:

```bash
pnpm run sync:check
```

### Sync is REQUIRED when you modify:

| Modified File/Directory | Action Required |
|------------------------|-----------------|
| `types/*` | Run `pnpm run sync:frontend` |
| `lib/tier-config.ts` | Run `pnpm run sync:frontend` |
| `lib/constants.ts` | Run `pnpm run sync:frontend` |
| `lib/utils.ts` | Run `pnpm run sync:frontend` |
| `lib/format.ts` | Run `pnpm run sync:frontend` |
| `prisma/schema.prisma` | Run `pnpm prisma generate` then sync types |
| `app/api/*` (response changes) | Update `frontend/types/` manually |
| `.env.example` | Update `frontend/.env.example` manually |

### Sync is NOT required for:

- `frontend/components/*` - Frontend only
- `frontend/app/*` - Frontend only
- `app/api/*` (internal logic, no response change) - Backend only
- `lib/db/*` - Backend only
- `lib/auth/session.ts` - Backend only

## How to Sync

### Automatic Sync (Recommended)

```bash
# From project root
pnpm run sync:frontend
```

This will:
1. Copy `types/*` → `frontend/types/`
2. Copy shared lib files → `frontend/lib/`
3. Run TypeScript check in frontend
4. Report any errors

### Manual Sync

If automatic sync fails or you need selective sync:

```bash
# Copy specific type file
cp types/alert.ts frontend/types/

# Copy specific lib file
cp lib/tier-config.ts frontend/lib/

# Verify
cd frontend && pnpm run type-check
```

## Git Workflow

### Commit Messages

```bash
# Backend change requiring sync
git commit -m "feat(api): add priority to alerts

SYNC-REQUIRED: frontend/types/alert.ts"

# After running sync
git commit -m "sync: update frontend types from backend changes"

# Frontend-only change
git commit -m "feat(ui): add priority badge component"
```

### Branch Strategy

For changes affecting both backend and frontend:

1. Make backend changes first
2. Run `pnpm run sync:frontend`
3. Commit both in same branch
4. Single PR with both changes

## Troubleshooting

### "TypeScript errors after sync"

```bash
# Check what changed
git diff frontend/types/

# If breaking change, search for usage
grep -r "oldFieldName" frontend/

# Update components, then rebuild
cd frontend && pnpm run build
```

### "Sync script not found"

```bash
# Make script executable
chmod +x scripts/sync-frontend.sh

# Or run directly
bash scripts/sync-frontend.sh
```

### "frontend/ directory not found"

You need to complete Step E first (Create Frontend Directory Structure):

```bash
mkdir -p frontend/{app,components,lib,types}
cp -r app/* frontend/app/
cp -r components/* frontend/components/
# ... continue with Step E
```
```

---

#### Task 6: Add Pre-commit Hook (Optional but Recommended)

Create `.husky/pre-commit` (if using Husky) or update existing:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Check if sync is needed
echo "🔍 Checking if frontend sync is needed..."
if ! pnpm run sync:check; then
    echo ""
    echo "❌ Commit blocked: Frontend sync required"
    echo "   Run: pnpm run sync:frontend"
    echo "   Then: git add frontend/ && git commit"
    exit 1
fi
```

---

### Integration with Existing Work

After adding these synchronization features, update your existing implementation to:

1. **Step E (Create Frontend Directory)**: After copying files, mention running sync script
2. **Step I (Verification Checklist)**: Add sync script verification
3. **Commit workflow**: Use the new commit message conventions

### Verification Checklist

After implementing the sync functionality, verify:

- [ ] `scripts/sync-frontend.sh` exists and is executable
- [ ] `scripts/check-sync-needed.js` exists and works
- [ ] `package.json` has sync scripts added
- [ ] `frontend/.env.sync-checklist` created
- [ ] `frontend/SYNC-WORKFLOW.md` created
- [ ] Running `pnpm run sync:check` works
- [ ] Running `pnpm run sync:frontend` works (after frontend/ exists)

---

### Summary

This update adds:
1. **Automated sync scripts** - Copy shared types/utils from monolith to frontend
2. **Sync check tool** - Detect when sync is needed based on changed files
3. **Documentation** - Team workflow guide for synchronization
4. **Environment checklist** - Track which env vars need syncing
5. **Pre-commit hook** - (Optional) Block commits when sync is needed

These additions ensure that during the ongoing migration (Steps 4-8), any backend changes that affect the frontend can be properly propagated and validated.

---

## Related Files

- Main Step 4 prompt: `monolith-to-modular-monolith-migration/step-4-frontend-ui-deployment-vercel-prompt.md`
- Migration overview: `monolith-to-modular-monolith-migration/monolith-to-modular-monolith-migration.md`
