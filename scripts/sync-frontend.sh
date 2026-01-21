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
    echo "Please run Step 4 first to create the frontend directory"
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
    "lib/tier-helpers.ts"
    "lib/tier-validation.ts"
    "lib/utils.ts"
    "lib/constants/business-rules.ts"
    "lib/tier/constants.ts"
    "lib/tier/validator.ts"
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

# Step 3: Sync Prisma types (if schema changed)
echo -e "\n${YELLOW}Step 3: Checking Prisma schema...${NC}"
if [ -f "$ROOT_DIR/prisma/schema.prisma" ]; then
    # Check if frontend has prisma schema
    if [ -f "$FRONTEND_DIR/prisma/schema.prisma" ]; then
        # Compare schemas
        if ! diff -q "$ROOT_DIR/prisma/schema.prisma" "$FRONTEND_DIR/prisma/schema.prisma" > /dev/null 2>&1; then
            echo -e "${YELLOW}⚠ Prisma schemas differ - syncing...${NC}"
            cp "$ROOT_DIR/prisma/schema.prisma" "$FRONTEND_DIR/prisma/schema.prisma"
            echo -e "${GREEN}✓ Prisma schema synced${NC}"
            echo -e "${YELLOW}⚠ Run 'cd frontend && npx prisma generate' to update Prisma client${NC}"
        else
            echo -e "${GREEN}✓ Prisma schemas already in sync${NC}"
        fi
    else
        mkdir -p "$FRONTEND_DIR/prisma"
        cp "$ROOT_DIR/prisma/schema.prisma" "$FRONTEND_DIR/prisma/schema.prisma"
        echo -e "${GREEN}✓ Prisma schema copied to frontend${NC}"
        echo -e "${YELLOW}⚠ Run 'cd frontend && npx prisma generate' to generate Prisma client${NC}"
    fi
else
    echo -e "${YELLOW}⚠ No Prisma schema found in root${NC}"
fi

# Step 4: Verify TypeScript (if type-check script exists)
echo -e "\n${YELLOW}Step 4: Verifying TypeScript...${NC}"
cd "$FRONTEND_DIR"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠ node_modules not found - skipping type check${NC}"
    echo -e "${YELLOW}  Run 'cd frontend && npm install' first${NC}"
else
    if [ -f "package.json" ] && grep -q '"type-check"' package.json 2>/dev/null; then
        if npm run type-check 2>/dev/null; then
            echo -e "${GREEN}✓ TypeScript verification passed${NC}"
        else
            echo -e "${RED}✗ TypeScript errors found - please fix before committing${NC}"
            exit 1
        fi
    else
        # Try npx tsc directly
        if command -v tsc &> /dev/null || [ -f "node_modules/.bin/tsc" ]; then
            if npx tsc --noEmit 2>/dev/null; then
                echo -e "${GREEN}✓ TypeScript verification passed${NC}"
            else
                echo -e "${YELLOW}⚠ TypeScript errors found (non-critical)${NC}"
            fi
        else
            echo -e "${YELLOW}⚠ Skipping type-check (TypeScript not available)${NC}"
        fi
    fi
fi

# Step 5: Summary
cd "$ROOT_DIR"
echo -e "\n${GREEN}=============================="
echo "Sync completed successfully!"
echo -e "==============================${NC}"
echo ""
echo "Next steps:"
echo "1. Review changes: git diff frontend/"
echo "2. Test the frontend: cd frontend && npm run build"
echo "3. Commit changes: git add frontend/ && git commit -m 'sync: update frontend from backend changes'"
