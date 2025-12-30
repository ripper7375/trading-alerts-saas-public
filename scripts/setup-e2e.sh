#!/bin/bash
# ============================================================================
# E2E Testing Setup Script
# ============================================================================
# This script sets up the environment for running Playwright E2E tests.
# Run this once before running E2E tests for the first time.
# ============================================================================

set -e  # Exit on any error

echo "🎭 Setting up Playwright E2E Testing Environment"
echo "================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Step 1: Check Node.js version
print_status "Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js 18+ is required. Current version: $(node -v)"
    exit 1
fi
print_success "Node.js version: $(node -v)"

# Step 2: Check pnpm
print_status "Checking pnpm..."
if ! command -v pnpm &> /dev/null; then
    print_error "pnpm is not installed. Install it with: npm install -g pnpm"
    exit 1
fi
print_success "pnpm version: $(pnpm -v)"

# Step 3: Install dependencies (if needed)
print_status "Checking dependencies..."
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    pnpm install
fi
print_success "Dependencies installed"

# Step 4: Install Playwright browsers
print_status "Installing Playwright browsers..."
echo "This may take a few minutes on first run..."
pnpm exec playwright install --with-deps chromium firefox webkit
print_success "Playwright browsers installed"

# Step 5: Generate Prisma client (needed for API helpers)
print_status "Generating Prisma client..."
pnpm exec prisma generate
print_success "Prisma client generated"

# Step 6: Verify installation
print_status "Verifying Playwright installation..."
pnpm exec playwright --version
print_success "Playwright is ready!"

echo ""
echo "================================================="
echo -e "${GREEN}✅ E2E Testing Environment Setup Complete!${NC}"
echo "================================================="
echo ""
echo "Next steps:"
echo ""
echo "  1. Start the development server:"
echo "     ${BLUE}pnpm run dev${NC}"
echo ""
echo "  2. In another terminal, run E2E tests:"
echo "     ${BLUE}pnpm run test:e2e${NC}              # Run all tests"
echo "     ${BLUE}pnpm run test:e2e:ui${NC}           # Run with UI mode"
echo "     ${BLUE}pnpm run test:e2e:headed${NC}       # Run in headed browser"
echo ""
echo "  3. Run specific test groups:"
echo "     ${BLUE}pnpm run test:e2e:group-a${NC}      # Paths 1, 2, 3"
echo "     ${BLUE}pnpm run test:e2e:group-b${NC}      # Paths 4, 5, 6, 7"
echo ""
echo "  4. View test report:"
echo "     ${BLUE}pnpm run test:e2e:report${NC}"
echo ""
