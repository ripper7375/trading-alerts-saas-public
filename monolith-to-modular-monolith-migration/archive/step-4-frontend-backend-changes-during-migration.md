## Synchronization: Frontend-Backend Changes During Migration

**Critical Consideration**: During the monolith to modular monolith migration (Steps 4-8), the backend logic may evolve while the frontend is being developed separately. This section defines how to handle changes that affect both systems.

### Synchronization Strategy Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CHANGE PROPAGATION WORKFLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  MONOLITH (source of truth during transition)                              │
│  ├── app/api/*                 ← Backend logic changes here                │
│  ├── lib/*                     ← Shared utilities/types                    │
│  └── types/*                   ← TypeScript interfaces                     │
│       │                                                                     │
│       │ SYNC (manual or automated)                                          │
│       ▼                                                                     │
│  FRONTEND (frontend/ directory)                                            │
│  ├── lib/api-client.ts         ← Update API calls                          │
│  ├── types/                    ← Mirror shared types                       │
│  └── components/               ← Update if props change                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Types of Changes and How to Handle Them

#### 1. API Contract Changes (Endpoints, Request/Response)

**When backend adds/modifies/removes an API endpoint:**

```bash
# Example: Backend adds new field to /api/alerts response
# In monolith: app/api/alerts/route.ts returns { ...alert, priority: 'HIGH' }

# Step 1: Update shared types
# In: types/alert.ts (root)
export interface Alert {
  id: string;
  symbol: string;
  // ... existing fields
  priority: 'HIGH' | 'MEDIUM' | 'LOW';  // NEW FIELD
}

# Step 2: Copy updated types to frontend
cp types/alert.ts frontend/types/

# Step 3: Update frontend components using this type
# frontend/components/alerts/alert-card.tsx - add priority badge
```

**Automated sync script (create this):**

```bash
#!/bin/bash
# scripts/sync-types.sh

# Sync shared types from monolith to frontend
echo "🔄 Syncing types from root to frontend..."

# Copy type definitions
cp -r types/* frontend/types/ 2>/dev/null || mkdir -p frontend/types && cp -r types/* frontend/types/

# Copy shared lib utilities (non-server-specific)
cp lib/tier-config.ts frontend/lib/
cp lib/constants.ts frontend/lib/
cp lib/utils.ts frontend/lib/

echo "✅ Types synced successfully"

# Verify TypeScript compilation
echo "🔍 Verifying frontend TypeScript..."
cd frontend && pnpm run type-check
```

#### 2. Database Schema Changes (Prisma)

**When backend modifies database schema:**

```bash
# Step 1: Backend updates schema
# In: prisma/schema.prisma (root)
model Alert {
  id        String   @id
  symbol    String
  priority  Priority @default(MEDIUM)  // NEW FIELD
}

enum Priority {
  HIGH
  MEDIUM
  LOW
}

# Step 2: Generate new Prisma client
pnpm prisma generate

# Step 3: Update frontend types to match
# frontend/types/alert.ts should mirror the Prisma types

# Step 4: If frontend uses Prisma directly (during transition):
cp -r node_modules/.prisma frontend/node_modules/
# OR better: frontend should use API calls, not direct Prisma
```

**Recommended pattern during migration:**

```
Frontend should NOT use Prisma directly.
Frontend → API calls → Backend → Prisma → Database
```

#### 3. Environment Variables Changes

**When backend adds new env vars:**

```bash
# Create env sync checklist file
# frontend/.env.sync-checklist

# Variables that MUST be synced:
NEXT_PUBLIC_API_URL=           # Frontend needs this
NEXTAUTH_SECRET=               # Must match for session compatibility
NEXTAUTH_URL=                  # Different per deployment

# Variables frontend does NOT need:
# DATABASE_URL                 # Backend only
# STRIPE_SECRET_KEY            # Backend only
# REDIS_URL                    # Backend only

# Variables to ADD to frontend .env:
NEXT_PUBLIC_DEPLOYMENT_TYPE=modular-frontend
NEXT_PUBLIC_BACKEND_VERSION=v2  # Track which backend version
```

#### 4. Shared Utility Changes

**When lib/ utilities are updated:**

```bash
# Categorize utilities:

# SHARED (copy to frontend):
lib/tier-config.ts          # Tier definitions - copy
lib/constants.ts            # App constants - copy
lib/utils.ts                # Generic utilities - copy
lib/format.ts               # Formatting helpers - copy

# BACKEND-ONLY (do NOT copy):
lib/db/prisma.ts            # Database client
lib/auth/session.ts         # Server-side session
lib/api/rate-limit.ts       # Server middleware

# FRONTEND-SPECIFIC (create new):
frontend/lib/api-client.ts  # API fetch wrapper
frontend/lib/hooks/         # React hooks
```

### Change Propagation Workflow

#### Workflow A: Backend Change → Frontend Update

```
┌──────────────────────────────────────────────────────────────────┐
│ BACKEND CHANGE DETECTED                                          │
├──────────────────────────────────────────────────────────────────┤
│ 1. Developer modifies backend (app/api/*, lib/*)                 │
│ 2. Run: pnpm run sync:check                                      │
│    └── Detects files changed that need frontend sync             │
│ 3. Run: pnpm run sync:frontend                                   │
│    └── Copies shared types/utils to frontend/                    │
│ 4. Run: cd frontend && pnpm run type-check                       │
│    └── Verify no TypeScript errors                               │
│ 5. Run: cd frontend && pnpm run build                            │
│    └── Verify build succeeds                                     │
│ 6. Commit both monolith and frontend changes together            │
└──────────────────────────────────────────────────────────────────┘
```

**package.json scripts to add:**

```json
{
  "scripts": {
    "sync:check": "node scripts/check-sync-needed.js",
    "sync:frontend": "bash scripts/sync-types.sh",
    "sync:all": "npm run sync:frontend && cd frontend && npm run type-check"
  }
}
```

#### Workflow B: Frontend-Specific Changes (No Backend Impact)

```
┌──────────────────────────────────────────────────────────────────┐
│ FRONTEND-ONLY CHANGE                                             │
├──────────────────────────────────────────────────────────────────┤
│ Changes in these directories do NOT need sync:                   │
│ ├── frontend/components/readable/*   (Server Components)        │
│ ├── frontend/components/interactive/* (Client Components)       │
│ ├── frontend/app/*/page.tsx          (Page layouts)             │
│ └── frontend/styles/*                (CSS/Tailwind)             │
│                                                                  │
│ Just commit frontend changes independently.                      │
└──────────────────────────────────────────────────────────────────┘
```

### Git Workflow for Coordinated Changes

#### Branch Strategy During Migration

```
main
├── feature/backend-user-preferences     # Backend changes
├── feature/frontend-user-preferences    # Frontend changes (synced)
└── claude/modular-monolith-migration-*  # Migration work

# When changes affect both:
1. Create backend branch first
2. Make backend changes, test
3. Run sync:frontend
4. Commit frontend changes in same branch
5. PR includes both backend + frontend changes
```

#### Commit Message Convention

```bash
# Backend change that affects frontend
git commit -m "feat(api): add priority field to alerts endpoint

SYNC-REQUIRED: frontend/types/alert.ts"

# Frontend sync commit
git commit -m "sync: update frontend types for alert priority field"

# Frontend-only change
git commit -m "feat(ui): add priority badge to alert cards"
```

### Configuration Files Sync Matrix

| File                 | Location        | Sync Strategy                 |
| -------------------- | --------------- | ----------------------------- |
| `tsconfig.json`      | Both            | Manual - different configs    |
| `tailwind.config.ts` | Both            | Copy if shared theme          |
| `package.json`       | Both            | Manual - different deps       |
| `.env.example`       | Both            | Manual - document differences |
| `next.config.js`     | Both            | Manual - different settings   |
| `types/*.ts`         | Root → Frontend | Auto-sync via script          |
| `lib/constants.ts`   | Root → Frontend | Auto-sync via script          |
| `lib/tier-config.ts` | Root → Frontend | Auto-sync via script          |

### Handling Breaking Changes

#### Scenario: Backend removes a field

```typescript
// BEFORE: Alert had 'deprecated_field'
interface Alert {
  id: string;
  deprecated_field: string; // Being removed
}

// AFTER: Field removed
interface Alert {
  id: string;
}

// FRONTEND IMPACT:
// 1. Search for usage: grep -r "deprecated_field" frontend/
// 2. Update all components using this field
// 3. Run type-check to catch any misses
// 4. Build and test
```

**Breaking change checklist:**

```markdown
## Breaking Change Checklist

When backend removes/renames a field:

- [ ] Search frontend for field usage: `grep -r "fieldName" frontend/`
- [ ] Update types in `frontend/types/`
- [ ] Update components using the field
- [ ] Update any mocks/fixtures in tests
- [ ] Run `pnpm run type-check` in frontend
- [ ] Run `pnpm run test` in frontend
- [ ] Run `pnpm run build` in frontend
- [ ] Document in CHANGELOG.md
```

### Automated Sync Script (Full Implementation)

Create `scripts/sync-frontend.sh`:

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
    exit 1
fi

# Step 1: Sync Types
echo -e "\n${YELLOW}Step 1: Syncing types...${NC}"
mkdir -p "$FRONTEND_DIR/types"
if [ -d "types" ]; then
    cp -r types/* "$FRONTEND_DIR/types/"
    echo -e "${GREEN}✓ Types synced${NC}"
else
    echo -e "${YELLOW}⚠ No types/ directory found${NC}"
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
    fi
done

# Step 3: Verify TypeScript
echo -e "\n${YELLOW}Step 3: Verifying TypeScript...${NC}"
cd "$FRONTEND_DIR"
if pnpm run type-check 2>/dev/null; then
    echo -e "${GREEN}✓ TypeScript verification passed${NC}"
else
    echo -e "${RED}✗ TypeScript errors found - please fix before committing${NC}"
    exit 1
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

### When to Sync (Decision Tree)

```
┌─────────────────────────────────────────────────┐
│ Did you modify files in these directories?      │
├─────────────────────────────────────────────────┤
│                                                 │
│ app/api/*          → Check if response changed  │
│   └── YES → Sync types, update frontend API     │
│                                                 │
│ types/*            → Sync to frontend/types/    │
│   └── YES → Run sync script                     │
│                                                 │
│ lib/tier-*.ts      → Sync to frontend           │
│   └── YES → Run sync script                     │
│                                                 │
│ lib/constants.ts   → Sync to frontend           │
│   └── YES → Run sync script                     │
│                                                 │
│ prisma/schema.prisma → Regenerate types         │
│   └── YES → Run prisma generate, sync types     │
│                                                 │
│ .env.example       → Update frontend/.env       │
│   └── YES → Manual update frontend/.env.example │
│                                                 │
│ Everything else    → No sync needed             │
│                                                 │
└─────────────────────────────────────────────────┘
```

---
