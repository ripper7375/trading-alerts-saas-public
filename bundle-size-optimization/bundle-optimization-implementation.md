# Implementation Plan Document

## Trading Alerts SaaS Public: Bundle Size Reduction & Performance Optimization

**Document Version**: 1.1  
**Date**: December 30, 2025  
**Author**: Implementation Team  
**Status**: Active Implementation Guide  
**Related**: Architecture Design Document

---

## How to Use This Document

**For Claude Code:**
This document provides step-by-step implementation instructions. Each phase includes:

- Concrete code examples
- File paths and structures
- Validation commands
- Success criteria
- Rollback procedures

**For Developer:**

- Follow phases sequentially
- Validate each step before proceeding
- Commit working changes frequently
- Review metrics at phase completion

**Implementation Workflow:**

1. Read phase objectives
2. Execute implementation steps
3. Run validation commands
4. Verify success criteria met
5. Commit and document
6. Proceed to next phase

---

## PHASE 0: Damage Control & Monitoring Setup

**Timeline**: Days 1-2  
**Goal**: Unblock CI/CD pipeline, establish visibility  
**Bundle Target**: 375MB → 340MB  
**Risk Level**: Low

---

### Step 0.1: Install Bundle Analyzer

**Objective**: Gain visibility into bundle composition

**Installation:**

```bash
# Install bundle analyzer
npm install --save-dev @next/bundle-analyzer

# Verify installation
npm list @next/bundle-analyzer
```

**Configuration:**

Create or update `next.config.js`:

```javascript
// next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... your existing config
};

module.exports = withBundleAnalyzer(nextConfig);
```

**Usage:**

```bash
# Run build with analyzer
ANALYZE=true npm run build

# This will open browser with interactive bundle visualization
# Identify top 5 largest chunks
```

**Expected Output:**

- Interactive tree map showing bundle composition
- Identification of largest dependencies
- Clear view of what's bloating bundle

**Action Items:**

1. Screenshot top 5 contributors
2. Document sizes in table:

```markdown
| Component/Library | Size | % of Bundle |
| ----------------- | ---- | ----------- |
| 1. [Name]         | XXmb | XX%         |
| 2. [Name]         | XXmb | XX%         |
| 3. [Name]         | XXmb | XX%         |
```

**Validation:**

```bash
# Analyzer installed successfully
npm list @next/bundle-analyzer

# Build completes without errors
ANALYZE=true npm run build
```

**Commit:**

```bash
git add next.config.js package.json package-lock.json
git commit -m "feat: install bundle analyzer for visibility"
```

---

### Step 0.2: Setup Bundle Monitoring in CI/CD

**Objective**: Track bundle size in every build (warning-only)

**Create GitHub Action:**

Create `.github/workflows/bundle-monitor.yml`:

```yaml
name: Bundle Size Monitor

on:
  pull_request:
  push:
    branches: [main, develop]

jobs:
  monitor-bundle:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build Next.js
        run: npm run build

      - name: Check bundle size
        run: |
          BUNDLE_SIZE=$(du -sm .next | cut -f1)
          echo "📊 Current bundle size: ${BUNDLE_SIZE}MB"

          # Warning at 450MB
          if [ $BUNDLE_SIZE -gt 450 ]; then
            echo "⚠️ WARNING: Bundle size approaching limit (450MB+)"
          fi

          # Hard fail at 500MB (panic threshold)
          if [ $BUNDLE_SIZE -gt 500 ]; then
            echo "❌ CRITICAL: Bundle size exceeded panic threshold (500MB)"
            exit 1
          fi

          echo "✅ Bundle size within acceptable limits"

      - name: Save bundle size
        run: |
          BUNDLE_SIZE=$(du -sm .next | cut -f1)
          echo "BUNDLE_SIZE=${BUNDLE_SIZE}" >> $GITHUB_ENV

      - name: Comment PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `📦 **Bundle Size**: ${process.env.BUNDLE_SIZE}MB`
            })
```

**Update existing tests workflow:**

Modify `.github/workflows/tests.yml`:

```yaml
# .github/workflows/tests.yml
jobs:
  build-check:
    runs-on: ubuntu-latest
    steps:
      # ... existing steps

      - name: Build Next.js
        run: npm run build

      - name: Check bundle size (temporary higher threshold)
        run: |
          BUNDLE_SIZE=$(du -sm .next | cut -f1)
          echo "Bundle size: ${BUNDLE_SIZE}MB"

          # Temporary threshold during Phase 0-1
          if [ $BUNDLE_SIZE -gt 450 ]; then
            echo "❌ Bundle size exceeded 450MB"
            exit 1
          fi

          echo "✅ Bundle size: ${BUNDLE_SIZE}MB (under 450MB limit)"
```

**Validation:**

```bash
# Trigger CI manually
git add .github/workflows/bundle-monitor.yml
git commit -m "ci: add bundle size monitoring"
git push

# Check Actions tab on GitHub
# Verify bundle size appears in logs
```

**Success Criteria:**

- ✅ CI runs successfully
- ✅ Bundle size displayed in logs
- ✅ PR comments show bundle size
- ✅ Hard limit at 500MB enforced

---

### Step 0.3: Convert Landing Page to SSG

**Objective**: Quick win - static marketing page

**Current State:**

```typescript
// app/page.tsx
// Likely SSR or client-side
export default function HomePage() {
  return <div>...</div>
}
```

**Target State:**

```typescript
// app/page.tsx
// Force static generation
export const dynamic = 'force-static'
export const revalidate = false // Never revalidate (truly static)

export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <FeaturesSection />
      <PricingPreview />
      <CTASection />
    </main>
  )
}
```

**Ensure all components are Server Components:**

```typescript
// app/_components/HeroSection.tsx
// No 'use client' directive = Server Component

export default function HeroSection() {
  return (
    <section className="hero">
      <h1>Real-Time Trading Alerts</h1>
      <p>Professional MT5 alerts delivered instantly</p>
      <a href="/dashboard" className="cta-button">
        Get Started Free
      </a>
    </section>
  )
}
```

**Also convert pricing page:**

```typescript
// app/pricing/page.tsx
export const dynamic = 'force-static'
export const revalidate = false

export default function PricingPage() {
  return (
    <div>
      <h1>Pricing</h1>

      <PricingTier
        name="FREE"
        price={0}
        features={[
          '5 symbols (BTCUSD, EURUSD, USDJPY, US30, XAUUSD)',
          '3 timeframes (H1, H4, D1)',
          '15 chart combinations',
          '5 max alerts',
          'Basic indicators (fractals, trendlines)',
        ]}
      />

      <PricingTier
        name="PRO"
        price={29}
        yearlyPrice={290}
        trialDays={7}
        features={[
          '15 symbols (all FREE + 10 more)',
          '9 timeframes (M5, M15, M30, H1, H2, H4, H8, H12, D1)',
          '135 chart combinations',
          '20 max alerts',
          'All 8 indicators (momentum, keltner, tema, hrma, smma, zigzag, fractals, trendlines)',
          'Advanced charts',
          'Export data',
          'API access',
          'Priority support',
        ]}
      />
    </div>
  )
}
```

**Validation:**

```bash
# Build and check for static pages
npm run build

# Look for output:
# ○ / (Static)
# ○ /pricing (Static)
#
# ○ = Static
# λ = Server-rendered
```

**Test locally:**

```bash
npm run build
npm run start

# Visit http://localhost:3000
# View source - should see fully rendered HTML
```

**Success Criteria:**

- ✅ Landing page shows ○ (Static) in build output
- ✅ Pricing page shows ○ (Static)
- ✅ View source shows complete HTML (not loading states)
- ✅ Bundle size unchanged (marketing pages were already simple)

**Commit:**

```bash
git add app/page.tsx app/pricing/page.tsx
git commit -m "perf: convert landing and pricing to SSG"
```

---

### Step 0.4: Implement Top 3 Dynamic Imports

**Objective**: Identify and lazy-load heaviest components

**Step 4a: Identify Heavy Components**

From bundle analyzer (Step 0.1), identify likely culprits:

1. Chart/visualization libraries
2. Payment modal components
3. Symbol-specific components

**Step 4b: Dynamic Import Pattern**

**Example 1: Chart Component**

Before:

```typescript
// app/dashboard/page.tsx
import TradingChart from '@/components/TradingChart'

export default function Dashboard() {
  return (
    <div>
      <TradingChart data={...} />
    </div>
  )
}
```

After:

```typescript
// app/dashboard/page.tsx
import dynamic from 'next/dynamic'

const TradingChart = dynamic(
  () => import('@/components/TradingChart'),
  {
    loading: () => <ChartSkeleton />,
    ssr: false // Charts don't need server rendering
  }
)

export default function Dashboard() {
  return (
    <div>
      <TradingChart data={...} />
    </div>
  )
}
```

Create skeleton component:

```typescript
// components/TradingChart/ChartSkeleton.tsx
export default function ChartSkeleton() {
  return (
    <div className="w-full h-96 bg-gray-200 animate-pulse rounded-lg">
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400">Loading chart...</p>
      </div>
    </div>
  )
}
```

**Example 2: Payment Modal**

```typescript
// components/UpgradeButton.tsx
'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'

const UpgradeModal = dynamic(
  () => import('@/components/UpgradeModal'),
  {
    loading: () => <div>Loading...</div>,
    ssr: false
  }
)

export default function UpgradeButton() {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <button onClick={() => setShowModal(true)}>
        Upgrade to PRO
      </button>

      {showModal && (
        <UpgradeModal onClose={() => setShowModal(false)} />
      )}
    </>
  )
}
```

**Example 3: Symbol-Specific Components**

```typescript
// app/dashboard/page.tsx
import dynamic from 'next/dynamic'

// FREE tier symbols - always loaded (no dynamic import needed)
import BTCUSDCard from '@/components/symbols/BTCUSDCard'
import EURUSDCard from '@/components/symbols/EURUSDCard'
import USDJPYCard from '@/components/symbols/USDJPYCard'
import US30Card from '@/components/symbols/US30Card'
import XAUUSDCard from '@/components/symbols/XAUUSDCard'

// PRO exclusive symbols - lazy load these 10
const AUDJPYCard = dynamic(() => import('@/components/symbols/AUDJPYCard'))
const AUDUSDCard = dynamic(() => import('@/components/symbols/AUDUSDCard'))
const ETHUSDCard = dynamic(() => import('@/components/symbols/ETHUSDCard'))
const GBPJPYCard = dynamic(() => import('@/components/symbols/GBPJPYCard'))
const GBPUSDCard = dynamic(() => import('@/components/symbols/GBPUSDCard'))
const NDX100Card = dynamic(() => import('@/components/symbols/NDX100Card'))
const NZDUSDCard = dynamic(() => import('@/components/symbols/NZDUSDCard'))
const USDCADCard = dynamic(() => import('@/components/symbols/USDCADCard'))
const USDCHFCard = dynamic(() => import('@/components/symbols/USDCHFCard'))
const XAGUSDCard = dynamic(() => import('@/components/symbols/XAGUSDCard'))

// PRO-only indicators - lazy load
const MomentumCandles = dynamic(() => import('@/components/indicators/MomentumCandles'))
const KeltnerChannels = dynamic(() => import('@/components/indicators/KeltnerChannels'))
const TEMA = dynamic(() => import('@/components/indicators/TEMA'))
const HRMA = dynamic(() => import('@/components/indicators/HRMA'))
const SMMA = dynamic(() => import('@/components/indicators/SMMA'))
const ZigZag = dynamic(() => import('@/components/indicators/ZigZag'))

export default async function Dashboard() {
  const tier = await getUserTier()

  return (
    <div>
      {/* FREE symbols always loaded */}
      <div className="grid grid-cols-3 gap-4">
        <BTCUSDCard />
        <EURUSDCard />
        <USDJPYCard />
        <US30Card />
        <XAUUSDCard />
      </div>

      {/* PRO symbols lazy loaded */}
      {tier === 'PRO' && (
        <div className="grid grid-cols-3 gap-4">
          <AUDJPYCard />
          <AUDUSDCard />
          <ETHUSDCard />
          <GBPJPYCard />
          <GBPUSDCard />
          <NDX100Card />
          <NZDUSDCard />
          <USDCADCard />
          <USDCHFCard />
          <XAGUSDCard />
        </div>
      )}

      {/* PRO indicators lazy loaded */}
      {tier === 'PRO' && (
        <div className="indicators">
          <MomentumCandles />
          <KeltnerChannels />
          <TEMA />
          <HRMA />
          <SMMA />
          <ZigZag />
        </div>
      )}
    </div>
  )
}
```

**Validation:**

```bash
# Build and check chunk files
npm run build

# Look for new chunk files in .next/static/chunks/
# Dynamic imports create separate chunks

# Test loading in browser
npm run start
# Open DevTools > Network
# Verify chunks load on-demand (not on initial page load)
```

**Success Criteria:**

- ✅ Build creates separate chunks for dynamic imports
- ✅ Initial page load is faster
- ✅ Components load on-demand when needed
- ✅ Bundle reduction: ~40-80MB

**Commit:**

```bash
git add app/ components/
git commit -m "perf: implement dynamic imports for heavy components"
```

---

### Step 0.5: Remove Unused Dependencies

**Objective**: Clean up dependency bloat

**Scan for unused dependencies:**

```bash
# Install depcheck
npm install -g depcheck

# Run scan
depcheck

# Output shows:
# - Unused dependencies (in package.json but not imported)
# - Missing dependencies (imported but not in package.json)
```

**Common culprits to remove:**

```bash
# If using date-fns, remove moment.js (90% smaller)
npm uninstall moment

# If using Tailwind, remove other CSS-in-JS libraries
npm uninstall @emotion/react @emotion/styled styled-components

# Remove unused UI libraries
npm uninstall @mui/material  # If not used

# Remove redundant chart libraries (keep only one)
npm uninstall chart.js  # If using recharts or tradingview-widget
# OR
npm uninstall recharts  # If using chart.js

# Remove unused form libraries
npm uninstall formik  # If using react-hook-form or Server Actions

# Remove unused indicator libraries (if built custom)
npm uninstall ta-lib  # If using custom implementations
```

**Replace heavy libraries:**

```bash
# Replace moment.js with date-fns (if needed)
npm uninstall moment
npm install date-fns

# Replace lodash with lodash-es (tree-shakeable)
npm uninstall lodash
npm install lodash-es
```

**Update imports:**

Before:

```typescript
import moment from 'moment';
import _ from 'lodash';

const date = moment().format('YYYY-MM-DD');
const uniq = _.uniq([1, 2, 2, 3]);
```

After:

```typescript
import { format } from 'date-fns';
import { uniq } from 'lodash-es';

const date = format(new Date(), 'yyyy-MM-dd');
const uniqueArray = uniq([1, 2, 2, 3]);
```

**Validation:**

```bash
# Ensure no broken imports
npm run build

# Check for errors
# If errors, fix missing imports

# Verify bundle size reduction
ANALYZE=true npm run build
```

**Success Criteria:**

- ✅ Build succeeds without errors
- ✅ All imports resolved correctly
- ✅ Bundle reduction: ~20-40MB
- ✅ No unused dependencies in package.json

**Commit:**

```bash
git add package.json package-lock.json
git commit -m "chore: remove unused dependencies and replace heavy libraries"
```

---

### Step 0.6: Verify Phase 0 Success

**Run comprehensive validation:**

```bash
# 1. Build succeeds
npm run build

# 2. Check bundle size
BUNDLE_SIZE=$(du -sm .next | cut -f1)
echo "Bundle size: ${BUNDLE_SIZE}MB"

# Should be < 370MB (ideally 320-340MB)

# 3. Run tests
npm test

# 4. Run linter
npm run lint

# 5. Local preview
npm run start
# Test all major routes manually
```

**Create Phase 0 summary:**

```markdown
## Phase 0 Completion Report

**Date**: [Current Date]
**Bundle Size Before**: 375MB
**Bundle Size After**: [Actual]MB
**Reduction**: [Difference]MB ([Percentage]%)

### Changes Implemented:

- ✅ Bundle analyzer installed
- ✅ CI/CD monitoring added
- ✅ Landing/pricing converted to SSG
- ✅ Dynamic imports for [list components]
- ✅ Removed dependencies: [list]

### Metrics:

- CI/CD Status: ✅ Passing
- Build Time: [X] minutes
- Lighthouse Score (Landing): [X]/100

### Next Steps:

- Proceed to Phase 1
- Monitor bundle size weekly
- Document patterns for new components
```

**Commit:**

```bash
git add .
git commit -m "docs: Phase 0 completion - bundle size reduced to [X]MB"
git push origin main
```

**Success Criteria:**

- ✅ Bundle size <370MB (ideally <340MB)
- ✅ CI/CD pipeline passing
- ✅ All tests passing
- ✅ Application functionality unchanged
- ✅ Documentation complete

---

## PHASE 1: Smart Defaults During Development

**Timeline**: Weeks 2-8 (during active development)  
**Goal**: Prevent bundle growth  
**Bundle Target**: Maintain <450MB  
**Risk Level**: Very Low

**Philosophy**: Don't refactor existing code, just use better patterns for NEW features.

---

### Ongoing Practice 1.1: Dynamic Import Pattern for New Components

**Rule**: Any new component >50KB or conditionally used → Dynamic import

**Pattern Template:**

```typescript
// For any new heavy component:
import dynamic from 'next/dynamic'

const NewHeavyComponent = dynamic(
  () => import('@/components/NewHeavyComponent'),
  {
    loading: () => <Skeleton />,
    ssr: false // If component doesn't need SSR
  }
)
```

**Examples:**

**New Analytics Dashboard (PRO only):**

```typescript
// app/dashboard/page.tsx
const AnalyticsDashboard = dynamic(
  () => import('@/components/AnalyticsDashboard'),
  {
    loading: () => <AnalyticsSkeleton />,
    ssr: false
  }
)

export default async function Dashboard() {
  const tier = await getUserTier()

  return (
    <div>
      {tier === 'PRO' && <AnalyticsDashboard />}
    </div>
  )
}
```

**New Export Feature:**

```typescript
// components/ExportButton.tsx
'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'

const ExportDialog = dynamic(
  () => import('@/components/ExportDialog')
)

export default function ExportButton() {
  const [showDialog, setShowDialog] = useState(false)

  return (
    <>
      <button onClick={() => setShowDialog(true)}>Export</button>
      {showDialog && <ExportDialog onClose={() => setShowDialog(false)} />}
    </>
  )
}
```

**Validation:**

- Before committing new component, check if it should be dynamic
- Run bundle analyzer monthly to verify

---

### Ongoing Practice 1.2: Server Components by Default

**Rule**: Always use Server Components unless you need:

- `useState`, `useEffect`, or other React hooks
- Browser APIs (`window`, `localStorage`)
- Event handlers (`onClick`, `onChange`)

**Pattern:**

```typescript
// ✅ GOOD: Server Component (no 'use client')
// components/AlertList.tsx
export default async function AlertList({ symbol }: { symbol: string }) {
  const alerts = await fetchAlerts(symbol)

  return (
    <div>
      {alerts.map(alert => (
        <AlertCard key={alert.id} alert={alert} />
      ))}
    </div>
  )
}
```

```typescript
// ✅ GOOD: Small Client Component island
// components/SubscribeButton.tsx
'use client'

export default function SubscribeButton({ symbol }: { symbol: string }) {
  const [subscribed, setSubscribed] = useState(false)

  const handleClick = async () => {
    await subscribeToSymbol(symbol)
    setSubscribed(true)
  }

  return (
    <button onClick={handleClick}>
      {subscribed ? 'Subscribed' : 'Subscribe'}
    </button>
  )
}
```

```typescript
// ❌ BAD: Unnecessary 'use client'
'use client'

export default function AlertCard({ alert }) {
  // No interactivity, no hooks, no browser APIs
  // Should be Server Component!
  return <div>{alert.title}</div>
}
```

**Validation:**

- Before adding `'use client'`, ask: "Does this REALLY need to be client-side?"
- Review in code reviews
- Bundle analyzer shows reduction over time

---

### Ongoing Practice 1.3: SSG for New Static Pages

**Rule**: Any new marketing/docs page → SSG

**Pattern:**

```typescript
// app/docs/[slug]/page.tsx
export const dynamic = 'force-static'

export async function generateStaticParams() {
  return [
    { slug: 'getting-started' },
    { slug: 'api-reference' },
    { slug: 'faq' },
  ]
}

export default function DocPage({ params }: { params: { slug: string } }) {
  return <Documentation slug={params.slug} />
}
```

**New blog (if added):**

```typescript
// app/blog/[slug]/page.tsx
export const dynamic = 'force-static'
export const revalidate = 3600 // ISR: Rebuild every hour

export default async function BlogPost({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug)
  return <Article post={post} />
}
```

---

### Ongoing Practice 1.4: Monthly Bundle Health Check

**Schedule**: Last Friday of each month (15 minutes)

**Checklist:**

```bash
# 1. Run analyzer
ANALYZE=true npm run build

# 2. Answer these questions:
# - What are top 5 largest chunks?
# - Did any grow >20% since last month?
# - Any obvious quick wins?

# 3. Document findings
cat > docs/bundle-health-YYYY-MM.md << EOF
# Bundle Health Check - [Month Year]

## Metrics
- Total Size: XXXmb
- Change from last month: +/-XXmb (+/-XX%)
- Top 5 Chunks:
  1. [Name] - XXmb
  2. [Name] - XXmb
  3. [Name] - XXmb
  4. [Name] - XXmb
  5. [Name] - XXmb

## Observations
- [Any concerning growth patterns]
- [New dependencies added]

## Action Items
- [If any remediation needed]
EOF

git add docs/bundle-health-YYYY-MM.md
git commit -m "docs: monthly bundle health check"
```

**Alert Triggers:**

If bundle size:

- > 450MB → Investigate immediately
- Grew >15% in one month → Mandatory review
- > 500MB → STOP development, remediate

---

### Ongoing Practice 1.5: Dependency Size Awareness

**Before installing new dependencies:**

```bash
# Check size before installing
npm install --dry-run package-name

# Use bundlephobia.com to check package size
# Example: https://bundlephobia.com/package/[package-name]

# Prefer smaller alternatives:
# - date-fns over moment.js
# - lodash-es over lodash
# - zustand over redux
```

**Weekly cleanup (5 minutes):**

```bash
# Check for unused deps
npx depcheck

# Remove if truly unused
npm uninstall [package]
```

---

### Phase 1 Success Criteria

**Quantitative:**

- ✅ Bundle size maintained <450MB throughout development
- ✅ No single month with >15% growth
- ✅ All new static pages use SSG
- ✅ All new heavy components use dynamic imports

**Qualitative:**

- ✅ Development velocity maintained
- ✅ No broken features from optimization attempts
- ✅ Patterns documented and followed
- ✅ Monthly reviews completed

---

## PHASE 2: Quick Wins (Feature Freeze Week)

**Timeline**: Week 9 (1 week, 5 days)  
**Goal**: Low-hanging fruit before comprehensive refactoring  
**Bundle Target**: 450MB → 300MB  
**Risk Level**: Low-Medium

---

### Day 1-2: Convert All Marketing Pages to SSG

**Objective**: Static generation for all non-dynamic pages

**Step 2.1: Audit Current Pages**

```bash
# List all routes
npm run build | grep -E "○|λ|ƒ"

# ○ = Static (already good)
# λ = Server-rendered (convert to SSG if possible)
# ƒ = Dynamic (keep as-is)
```

**Candidates for SSG:**

- About page
- Terms of Service
- Privacy Policy
- Help/FAQ pages
- Documentation
- Blog posts (if static)
- Indicator information pages (8 indicators)
- Symbol information pages (15 symbols)

**Step 2.2: Convert Each Page**

Example: About page

```typescript
// app/about/page.tsx
export const dynamic = 'force-static'
export const revalidate = false

export default function AboutPage() {
  return (
    <div>
      <h1>About Trading Alerts</h1>
      <p>Professional MT5 alerts...</p>
    </div>
  )
}
```

**If page has dynamic data:**

```typescript
// app/help/[topic]/page.tsx
export const dynamic = 'force-static'

// Pre-generate all help topics at build time
export async function generateStaticParams() {
  const topics = ['getting-started', 'alerts', 'pricing', 'api']
  return topics.map(topic => ({ topic }))
}

export default function HelpPage({ params }: { params: { topic: string } }) {
  return <HelpArticle topic={params.topic} />
}
```

**Validation:**

```bash
# Build and verify
npm run build

# All marketing pages should show ○ (Static)
# ○ /about
# ○ /terms
# ○ /privacy
# ○ /help/[topic]

# Test locally
npm run start
# View source - should see complete HTML
```

**Expected Savings**: 10-20MB (reduced runtime JS)

**Commit:**

```bash
git add app/
git commit -m "perf: convert all marketing pages to SSG"
```

---

### Day 2-3: Dynamic Imports for Existing Heavy Components

**Objective**: Retrofit dynamic imports to existing codebase

**Step 2.3: Identify Targets from Bundle Analyzer**

```bash
ANALYZE=true npm run build
# Look for large chunks that could be lazy-loaded
```

**Common targets:**

1. Chart/visualization components
2. Rich text editors
3. Image galleries
4. Video players
5. Complex modals/dialogs

**Step 2.4: Implement Dynamic Imports**

**Example: Existing chart in dashboard**

Before:

```typescript
// app/dashboard/page.tsx
import PerformanceChart from '@/components/PerformanceChart'

export default function Dashboard() {
  return (
    <div>
      <PerformanceChart />
    </div>
  )
}
```

After:

```typescript
// app/dashboard/page.tsx
import dynamic from 'next/dynamic'

const PerformanceChart = dynamic(
  () => import('@/components/PerformanceChart'),
  {
    loading: () => <ChartSkeleton />,
    ssr: false
  }
)

export default function Dashboard() {
  return (
    <div>
      {/* Chart now loads on-demand */}
      <PerformanceChart />
    </div>
  )
}
```

**Step 2.5: Test Each Conversion**

```bash
# After each dynamic import:
npm run build
npm run start

# Test in browser:
# 1. Component loads correctly
# 2. Skeleton appears briefly
# 3. Functionality unchanged
```

**Validation:**

- ✅ All retrofitted components work correctly
- ✅ No broken functionality
- ✅ Bundle analyzer shows separate chunks

**Expected Savings**: 30-60MB

**Commit:**

```bash
git add app/ components/
git commit -m "perf: retrofit dynamic imports to existing components"
```

---

### Day 4: Dependency Cleanup Audit

**Objective**: Remove all unused/redundant dependencies

**Step 2.6: Comprehensive Scan**

```bash
# Full dependency audit
npx depcheck

# Check for duplicates
npm dedupe

# Check for outdated packages (may have smaller versions)
npm outdated
```

**Step 2.7: Remove Unused**

```bash
# Example removals
npm uninstall [unused-package-1]
npm uninstall [unused-package-2]
# ... etc
```

**Step 2.8: Replace Heavy Dependencies**

```bash
# Example: Replace moment with date-fns
npm uninstall moment
npm install date-fns

# Update imports throughout codebase
# Before: import moment from 'moment'
# After: import { format, parseISO } from 'date-fns'
```

**Step 2.9: Optimize Imports**

Before:

```typescript
import _ from 'lodash'; // Imports entire library
```

After:

```typescript
import { uniq, sortBy } from 'lodash-es'; // Tree-shakeable
```

**Validation:**

```bash
# Ensure no broken imports
npm run build

# Run tests
npm test

# Check bundle size
ANALYZE=true npm run build
```

**Expected Savings**: 20-40MB

**Commit:**

```bash
git add package.json package-lock.json
git commit -m "chore: comprehensive dependency cleanup"
```

---

### Day 5: Image & Font Optimization

**Objective**: Optimize static assets

**Step 2.10: Image Optimization**

**Replace <img> with Next.js <Image>:**

Before:

```typescript
<img src="/hero-image.jpg" alt="Hero" style={{ width: '100%' }} />
```

After:

```typescript
import Image from 'next/image'

<Image
  src="/hero-image.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority  // For above-fold images
  quality={80}  // Balance quality/size
/>
```

**Optimize all images:**

```bash
# Install sharp (if not already)
npm install sharp

# Next.js will automatically optimize images using sharp
```

**Step 2.11: Font Optimization**

**Use Next.js font optimization:**

```typescript
// app/layout.tsx
import { Inter, Roboto_Mono } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],  // Only load Latin characters
  display: 'swap',
  variable: '--font-inter',
})

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto-mono',
  weight: ['400', '700'],  // Only needed weights
})

export default function RootLayout({ children }) {
  return (
    <html className={`${inter.variable} ${robotoMono.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  )
}
```

**Remove unused font files:**

```bash
# Check public/fonts directory
ls -lh public/fonts/

# Remove any unused font files
rm public/fonts/unused-font.woff2
```

**Validation:**

```bash
# Build and check
npm run build

# Lighthouse audit
npx lighthouse http://localhost:3000 --view

# Check font loading in DevTools Network tab
```

**Expected Savings**: 5-10MB

**Commit:**

```bash
git add app/ public/
git commit -m "perf: optimize images and fonts"
```

---

### Phase 2 Completion: Validate & Document

**Final validation:**

```bash
# 1. Full build
npm run build

# 2. Check bundle size
BUNDLE_SIZE=$(du -sm .next | cut -f1)
echo "Phase 2 bundle size: ${BUNDLE_SIZE}MB"

# Target: <300MB

# 3. Run all tests
npm test

# 4. Lighthouse audit all key pages
npx lighthouse http://localhost:3000 --view
npx lighthouse http://localhost:3000/dashboard --view
npx lighthouse http://localhost:3000/pricing --view

# 5. Manual testing checklist:
# - Landing page loads
# - Dashboard works for FREE tier
# - Dashboard works for PRO tier
# - Forms submit correctly
# - Charts display correctly
# - Images load properly
```

**Create Phase 2 summary:**

```markdown
## Phase 2 Completion Report

**Date**: [Current Date]
**Bundle Size Before**: 450MB
**Bundle Size After**: [Actual]MB
**Reduction**: [Difference]MB ([Percentage]%)

### Changes Implemented:

- ✅ Marketing pages converted to SSG: [list]
- ✅ Dynamic imports retrofitted: [list components]
- ✅ Dependencies removed: [list]
- ✅ Images optimized: [count] images
- ✅ Fonts optimized

### Metrics:

- Lighthouse Score (Landing): [X]/100
- Lighthouse Score (Dashboard): [X]/100
- First Contentful Paint: [X]s
- Largest Contentful Paint: [X]s

### Next Steps:

- Proceed to Phase 3 (comprehensive refactoring)
- Update CI/CD threshold to 370MB
```

**Update CI/CD threshold:**

```yaml
# .github/workflows/tests.yml
- name: Check bundle size
  run: |
    BUNDLE_SIZE=$(du -sm .next | cut -f1)
    if [ $BUNDLE_SIZE -gt 370 ]; then  # Back to original threshold
      echo "❌ Bundle size exceeded 370MB"
      exit 1
    fi
```

**Commit:**

```bash
git add .
git commit -m "docs: Phase 2 completion - bundle reduced to [X]MB"
git push origin main
```

**Phase 2 Success Criteria:**

- ✅ Bundle size <300MB (preferably 280-300MB)
- ✅ All tests passing
- ✅ Lighthouse scores improved
- ✅ No broken functionality
- ✅ Ready for Phase 3 refactoring

---

## PHASE 3: Comprehensive Optimization (Stabilization)

**Timeline**: Weeks 10-13 (4 weeks)  
**Goal**: Production-ready performance  
**Bundle Target**: 300MB → 100-150MB  
**Risk Level**: High

**IMPORTANT**: Only begin Phase 3 when:

- ✅ All features complete
- ✅ No major development planned
- ✅ Comprehensive test coverage exists
- ✅ Rollback plan documented

---

### Week 10: Server Components Migration

**Objective**: Convert dashboard to Server Components architecture

**Step 3.1: Create Feature Flag**

```typescript
// lib/feature-flags.ts
export const USE_NEW_DASHBOARD =
  process.env.NEXT_PUBLIC_NEW_DASHBOARD === 'true';
```

```bash
# .env.local
NEXT_PUBLIC_NEW_DASHBOARD=false  # Start disabled
```

**Step 3.2: Create New Dashboard (Server Components)**

**New file structure:**

```
app/
  dashboard-new/
    page.tsx                    # Server Component
    loading.tsx                 # Skeleton
    error.tsx                   # Error boundary
    _components/
      AlertList.tsx             # Server Component
      AlertCard.tsx             # Server Component
      SubscribeButton.tsx       # Client Component
      RealtimeUpdates.tsx       # Client Component
```

**Implementation:**

```typescript
// app/dashboard-new/page.tsx
import { Suspense } from 'react'
import { getUserTier } from '@/lib/auth'
import AlertList from './_components/AlertList'
import RealtimeUpdates from './_components/RealtimeUpdates'
import TrialBanner from './_components/TrialBanner'

export default async function DashboardNew() {
  // Server-side data fetching
  const tier = await getUserTier()
  const trialStatus = await getTrialStatus() // 'ACTIVE', 'EXPIRED', etc.

  return (
    <div className="dashboard">
      {/* Trial banner for active trials */}
      {trialStatus === 'ACTIVE' && (
        <Suspense fallback={null}>
          <TrialBanner />
        </Suspense>
      )}

      <h1>Dashboard - {tier} Tier</h1>

      {/* FREE tier symbols (5 symbols) - Server Component, no client JS */}
      <Suspense fallback={<div>Loading FREE tier symbols...</div>}>
        <AlertList symbols={['BTCUSD', 'EURUSD', 'USDJPY', 'US30', 'XAUUSD']} />
      </Suspense>

      {/* PRO tier: Additional 10 symbols */}
      {(tier === 'PRO' || trialStatus === 'ACTIVE') && (
        <Suspense fallback={<div>Loading PRO symbols...</div>}>
          <AlertList symbols={[
            'AUDJPY', 'AUDUSD', 'ETHUSD', 'GBPJPY', 'GBPUSD',
            'NDX100', 'NZDUSD', 'USDCAD', 'USDCHF', 'XAGUSD'
          ]} />
        </Suspense>
      )}

      {/* PRO tier: Advanced indicators */}
      {(tier === 'PRO' || trialStatus === 'ACTIVE') && (
        <Suspense fallback={<div>Loading indicators...</div>}>
          <ProIndicatorPanel />
        </Suspense>
      )}

      {/* Small client component for real-time updates */}
      <RealtimeUpdates tier={tier} />
    </div>
  )
}
```

```typescript
// app/dashboard-new/_components/AlertList.tsx
// Server Component (no 'use client')
import { getAlerts } from '@/lib/data'
import AlertCard from './AlertCard'

export default async function AlertList({ symbol }: { symbol: string }) {
  const alerts = await getAlerts(symbol)

  return (
    <div className="alert-list">
      {alerts.map(alert => (
        <AlertCard key={alert.id} alert={alert} />
      ))}
    </div>
  )
}
```

```typescript
// app/dashboard-new/_components/AlertCard.tsx
// Server Component
import SubscribeButton from './SubscribeButton'

export default function AlertCard({ alert }: { alert: Alert }) {
  return (
    <div className="alert-card">
      <h3>{alert.symbol}</h3>
      <p>{alert.message}</p>
      <p>{alert.timestamp}</p>

      {/* Client component island */}
      <SubscribeButton symbol={alert.symbol} />
    </div>
  )
}
```

```typescript
// app/dashboard-new/_components/SubscribeButton.tsx
'use client'  // Tiny client component

import { subscribeToSymbol } from '@/app/actions/subscribe'
import { useState } from 'react'

export default function SubscribeButton({ symbol }: { symbol: string }) {
  const [subscribed, setSubscribed] = useState(false)

  return (
    <form action={subscribeToSymbol}>
      <input type="hidden" name="symbol" value={symbol} />
      <button type="submit" onClick={() => setSubscribed(true)}>
        {subscribed ? 'Subscribed' : 'Subscribe'}
      </button>
    </form>
  )
}
```

**Step 3.3: A/B Test New Dashboard**

```typescript
// app/dashboard/page.tsx (router)
import { USE_NEW_DASHBOARD } from '@/lib/feature-flags'
import DashboardOld from './_old/page'
import DashboardNew from '../dashboard-new/page'

export default function DashboardRouter() {
  if (USE_NEW_DASHBOARD) {
    return <DashboardNew />
  }
  return <DashboardOld />
}
```

**Step 3.4: Gradual Rollout**

```bash
# Week 10 Day 1-2: Build and test new dashboard
NEXT_PUBLIC_NEW_DASHBOARD=true npm run build
npm run start
# Manual testing

# Week 10 Day 3: Deploy with feature flag off
git push origin main
# Dashboard still uses old version

# Week 10 Day 4: Enable for 10% of users
# (Use environment variables or edge config)

# Week 10 Day 5: Monitor metrics
# - Check error rates
# - Compare performance
# - User feedback

# Week 10 End: 100% rollout if successful
```

**Rollback plan:**

```bash
# If issues found:
NEXT_PUBLIC_NEW_DASHBOARD=false

# Redeploy
git revert [commit]
git push
```

**Validation:**

```bash
# Compare bundle sizes
# Old dashboard: ~150MB client JS
# New dashboard: ~20-30MB client JS (only client components)

ANALYZE=true npm run build
```

**Expected Savings**: 80-120MB

**Commit:**

```bash
git add app/dashboard-new/
git commit -m "feat: new Server Components dashboard (feature flagged)"
```

---

### Week 11: ISR Implementation & Streaming

**Step 3.5: Convert Alert History to ISR**

```typescript
// app/alerts/[symbol]/page.tsx
export const revalidate = 60  // Revalidate every 60 seconds

export async function generateStaticParams() {
  // Pre-generate pages for all 15 symbols
  return [
    // FREE tier symbols
    { symbol: 'BTCUSD' },
    { symbol: 'EURUSD' },
    { symbol: 'USDJPY' },
    { symbol: 'US30' },
    { symbol: 'XAUUSD' },
    // PRO exclusive symbols
    { symbol: 'AUDJPY' },
    { symbol: 'AUDUSD' },
    { symbol: 'ETHUSD' },
    { symbol: 'GBPJPY' },
    { symbol: 'GBPUSD' },
    { symbol: 'NDX100' },
    { symbol: 'NZDUSD' },
    { symbol: 'USDCAD' },
    { symbol: 'USDCHF' },
    { symbol: 'XAGUSD' },
  ]
}

export default async function AlertHistoryPage({
  params
}: {
  params: { symbol: string }
}) {
  // Fetched on first request, cached for 60s
  const history = await getAlertHistory(params.symbol)

  return (
    <div>
      <h1>{params.symbol} Alert History</h1>
      <AlertHistoryList alerts={history} />
    </div>
  )
}
```

**Step 3.6: Implement Streaming**

```typescript
// app/dashboard-new/page.tsx
import { Suspense } from 'react'

export default async function Dashboard() {
  const tier = await getUserTier()

  return (
    <div>
      {/* Instant shell */}
      <DashboardHeader />

      {/* Layer 1: Fast data (50-200ms) */}
      <Suspense fallback={<UserSkeleton />}>
        <UserInfo tier={tier} />
      </Suspense>

      {/* Layer 2: FREE tier symbols (200-500ms) */}
      <Suspense fallback={<SymbolsSkeleton count={5} />}>
        <FreeTierSymbols /> {/* BTCUSD, EURUSD, USDJPY, US30, XAUUSD */}
      </Suspense>

      {/* Layer 3: PRO exclusive symbols (500ms+) - only if PRO */}
      {tier === 'PRO' && (
        <Suspense fallback={<SymbolsSkeleton count={10} />}>
          <ProExclusiveSymbols /> {/* 10 additional symbols */}
        </Suspense>
      )}

      {/* Layer 4: PRO indicators (lazy loaded) - only if PRO */}
      {tier === 'PRO' && (
        <Suspense fallback={<IndicatorSkeleton />}>
          <ProIndicators /> {/* momentum, keltner, tema, hrma, smma, zigzag */}
        </Suspense>
      )}
    </div>
  )
}
```

**Create loading skeletons:**

```typescript
// app/dashboard-new/_components/AlertSkeleton.tsx
export default function AlertSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
    </div>
  )
}
```

**Validation:**

```bash
# Test streaming behavior
npm run build
npm run start

# Open DevTools > Network
# Watch HTML streaming (multiple chunks)
# Verify fast content appears immediately
```

---

### Week 12: Server Actions & Caching

**Step 3.7: Convert Forms to Server Actions**

**Before (client-side):**

```typescript
// components/SubscribeForm.tsx
'use client'

import { useState } from 'react'

export default function SubscribeForm() {
  const [symbol, setSymbol] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    await fetch('/api/subscribe', {
      method: 'POST',
      body: JSON.stringify({ symbol })
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <input value={symbol} onChange={e => setSymbol(e.target.value)} />
      <button>Subscribe</button>
    </form>
  )
}
```

**After (Server Actions):**

```typescript
// app/actions/subscribe.ts
'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { validateTierAccess } from '@/lib/tier-validation';

export async function subscribeToSymbol(formData: FormData) {
  const symbol = formData.get('symbol') as string;
  const userId = await getCurrentUserId();
  const tier = await getUserTier();

  // Validation using tier-validation.ts
  const validation = validateTierAccess(tier, symbol);
  if (!validation.allowed) {
    return { error: validation.reason || 'Access denied' };
  }

  // Check alert limit
  const currentAlerts = await db.query(
    'SELECT COUNT(*) FROM alerts WHERE user_id = $1',
    [userId]
  );

  const alertLimit = tier === 'FREE' ? 5 : 20;
  if (currentAlerts.rows[0].count >= alertLimit) {
    return {
      error: `Alert limit reached (${alertLimit} max for ${tier} tier)`,
    };
  }

  // Save to database
  await db.subscriptions.create({
    userId,
    symbol,
    createdAt: new Date(),
  });

  // Revalidate dashboard to show new subscription
  revalidatePath('/dashboard');

  return { success: true };
}
```

```typescript
// components/SubscribeForm.tsx
// Much simpler, no 'use client' needed!

import { subscribeToSymbol } from '@/app/actions/subscribe'

export default function SubscribeForm() {
  return (
    <form action={subscribeToSymbol}>
      <input name="symbol" required />
      <button type="submit">Subscribe</button>
    </form>
  )
}
```

**Convert all existing forms:**

1. Subscription management
2. Account settings
3. Alert preferences
4. Contact forms
5. Tier upgrade forms (FREE → PRO, trial activation)

**Step 3.8: Implement Tier-Based Access Control**

**Objective**: Ensure proper tier validation using existing lib/tier-validation.ts

**Implementation:**

```typescript
// lib/tier-validation.ts already provides:
// - validateTierAccess(tier, symbol)
// - validateTimeframeAccess(tier, timeframe)
// - validateChartAccess(tier, symbol, timeframe)
// - canCreateAlert(tier, currentAlerts)
// - canAccessIndicator(tier, indicator)

// Use in Server Components and Server Actions:

// Example 1: Symbol access validation
import { validateTierAccess } from '@/lib/tier-validation'

export default async function SymbolPage({ params }: { params: { symbol: string } }) {
  const tier = await getUserTier()
  const validation = validateTierAccess(tier, params.symbol)

  if (!validation.allowed) {
    return <UpgradePrompt reason={validation.reason} />
  }

  // User has access, show content
  return <SymbolDetails symbol={params.symbol} />
}

// Example 2: Indicator access validation
import { canAccessIndicator } from '@/lib/tier/validator'

export default async function IndicatorPage({ params }: { params: { indicator: string } }) {
  const tier = await getUserTier()

  if (!canAccessIndicator(tier, params.indicator)) {
    return (
      <div>
        <h1>PRO Feature</h1>
        <p>The {params.indicator} indicator is only available on PRO tier.</p>
        <UpgradeButton />
      </div>
    )
  }

  return <IndicatorDetails indicator={params.indicator} />
}

// Example 3: Chart combination validation
import { validateChartAccess } from '@/lib/tier-validation'

export default async function ChartPage({
  params
}: {
  params: { symbol: string; timeframe: string }
}) {
  const tier = await getUserTier()
  const validation = validateChartAccess(tier, params.symbol, params.timeframe)

  if (!validation.allowed) {
    return <UpgradePrompt reason={validation.reason} />
  }

  return <TradingChart symbol={params.symbol} timeframe={params.timeframe} />
}

// Example 4: Alert limit validation
import { canCreateAlert, getAlertLimit } from '@/lib/tier-validation'

async function createAlertAction(formData: FormData) {
  'use server'

  const tier = await getUserTier()
  const currentAlerts = await getCurrentAlertCount()

  const validation = canCreateAlert(tier, currentAlerts)
  if (!validation.allowed) {
    return {
      error: `Alert limit reached. ${tier} tier allows ${getAlertLimit(tier)} alerts.`
    }
  }

  // Create alert
  await createAlert(formData)
  return { success: true }
}
```

**Step 3.9: Implement Smart Caching**

```typescript
// lib/data.ts

// 1. Static data - cache forever
export async function getSymbolMetadata(symbol: string) {
  return fetch(`/api/symbols/${symbol}/metadata`, {
    cache: 'force-cache',
  });
}

export async function getIndicatorMetadata(indicator: string) {
  // Indicator metadata from lib/tier/constants.ts
  return fetch(`/api/indicators/${indicator}/metadata`, {
    cache: 'force-cache',
  });
}

// 2. Slow-changing data - ISR with long revalidation
export async function getTradingHours(symbol: string) {
  return fetch(`/api/symbols/${symbol}/hours`, {
    next: { revalidate: 86400 }, // 24 hours
  });
}

export async function getTierConfig() {
  // Tier configuration rarely changes
  return fetch('/api/tier/config', {
    next: { revalidate: 3600 }, // 1 hour
  });
}

// 3. Frequently-changing data - ISR with short revalidation
export async function getAlertHistory(symbol: string) {
  return fetch(`/api/alerts/${symbol}/history`, {
    next: {
      revalidate: 60, // 1 minute
      tags: [`alerts-${symbol}`],
    },
  });
}

export async function getUserTier() {
  // User tier cached for session
  return fetch('/api/user/tier', {
    next: {
      revalidate: 300, // 5 minutes
      tags: ['user-tier'],
    },
  });
}

export async function getTrialStatus() {
  // Trial status updates frequently during trial period
  return fetch('/api/user/trial', {
    next: {
      revalidate: 60, // 1 minute
      tags: ['trial-status'],
    },
  });
}

// 4. Real-time data - no cache
export async function getLiveAlerts() {
  return fetch('/api/alerts/live', {
    cache: 'no-store',
  });
}

export async function getMT5ConnectionStatus() {
  return fetch('/api/mt5/status', {
    cache: 'no-store',
  });
}
```

**Implement request deduplication:**

```typescript
// lib/data-cached.ts
import { cache } from 'react';

export const getCachedAlerts = cache(async (symbol: string) => {
  // Multiple components can call this
  // React deduplicates to single request
  return fetch(`/api/alerts/${symbol}`);
});
```

**Parallel fetching:**

```typescript
// app/dashboard-new/page.tsx
export default async function Dashboard() {
  // Fetch all data in parallel
  const [user, xauusd, other] = await Promise.all([
    getUser(),
    getAlerts('XAUUSD'),
    getAlerts('ALL')
  ])

  // Render with all data ready
  return <DashboardContent user={user} xauusd={xauusd} other={other} />
}
```

**Validation:**

```bash
# Test caching behavior
npm run build
npm run start

# Check Network tab in DevTools
# Second requests should be cached (instant)

# Test Server Actions
# Forms should work without page reload
```

---

### Week 13: Performance Testing & Tuning

**Step 3.9: Comprehensive Performance Audit**

**Install monitoring:**

```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
```

**Run Lighthouse on all key pages:**

```bash
# Install Lighthouse CLI
npm install -g lighthouse

# Audit key pages
lighthouse http://localhost:3000 --view --output-path=./lighthouse-home.html
lighthouse http://localhost:3000/dashboard --view --output-path=./lighthouse-dashboard.html
lighthouse http://localhost:3000/pricing --view --output-path=./lighthouse-pricing.html
lighthouse http://localhost:3000/alerts/XAUUSD --view --output-path=./lighthouse-alerts.html
```

**Step 3.10: Optimize Based on Lighthouse**

**Common issues and fixes:**

**Issue: Largest Contentful Paint (LCP) >2.5s**

Fix: Preload critical assets

```typescript
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <link
          rel="preload"
          href="/fonts/inter-var.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

**Issue: Cumulative Layout Shift (CLS) >0.1**

Fix: Reserve space for dynamic content

```typescript
<div className="min-h-[400px]">
  <Suspense fallback={<Skeleton className="h-[400px]" />}>
    <DynamicContent />
  </Suspense>
</div>
```

**Issue: Unused JavaScript**

Fix: Code splitting with dynamic imports

```typescript
const HeavyComponent = dynamic(() => import('@/components/Heavy'));
```

**Step 3.11: Database Query Optimization**

**Add query monitoring:**

```typescript
// lib/db.ts
import { Pool } from 'pg'

const pool = new Pool({...})

export async function query(sql: string, params: any[]) {
  const start = Date.now()

  try {
    const result = await pool.query(sql, params)
    const duration = Date.now() - start

    // Log slow queries
    if (duration > 100) {
      console.warn(`Slow query (${duration}ms):`, sql.substring(0, 100))
    }

    return result
  } catch (error) {
    console.error('Query error:', error)
    throw error
  }
}
```

**Optimize N+1 queries:**

Before:

```typescript
for (const alert of alerts) {
  const user = await getUser(alert.userId); // N+1 problem!
}
```

After:

```typescript
const userIds = alerts.map((a) => a.userId);
const users = await getUsers(userIds); // Single query
const usersMap = new Map(users.map((u) => [u.id, u]));
alerts.forEach((alert) => {
  alert.user = usersMap.get(alert.userId);
});
```

**Step 3.12: Load Testing**

```bash
# Install k6
brew install k6  # macOS
# or download from k6.io

# Create load test script
cat > load-test.js << EOF
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Ramp up to 10 users
    { duration: '3m', target: 50 },   // Stay at 50 users
    { duration: '1m', target: 0 },    // Ramp down
  ],
};

export default function () {
  // Test dashboard
  const res = http.get('http://localhost:3000/dashboard');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
EOF

# Run load test
k6 run load-test.js
```

**Analyze results:**

- Response time p95 < 500ms
- Error rate < 0.1%
- Database connections < 10 (Railway limit)

**Step 3.13: Final Bundle Analysis**

```bash
# Generate detailed bundle report
ANALYZE=true npm run build

# Expected breakdown:
# - Total: 100-150MB (down from 375MB)
# - Server Components: 0 bytes client-side
# - Client Components: 20-40MB
#   - WebSocket client: ~10MB
#   - UI components: ~10-20MB
#   - Charts (lazy): ~40MB (separate chunk)
# - Static assets: ~10-20MB

# Verify all routes
npm run build | grep -E "Route|Size"
```

**Phase 3 Completion Report:**

```markdown
## Phase 3 Completion Report

**Date**: [Current Date]
**Duration**: 4 weeks
**Bundle Size Before**: 300MB
**Bundle Size After**: [Actual]MB
**Total Reduction**: [From 375MB to XMB] ([X]% reduction)

### Changes Implemented:

- ✅ Dashboard migrated to Server Components
- ✅ Alert history converted to ISR (60s revalidation)
- ✅ Streaming implemented with Suspense
- ✅ Forms converted to Server Actions
- ✅ Smart caching strategy deployed
- ✅ Database queries optimized (-60%)

### Performance Metrics:

**Lighthouse Scores:**

- Landing Page: [X]/100
- Dashboard: [X]/100
- Alert History: [X]/100

**Load Times:**

- Landing Page: [X]s
- Dashboard (FREE): [X]s
- Dashboard (PRO): [X]s

**Business Metrics:**

- Database queries/day: -60%
- Flask requests/day: -90%
- Estimated cost savings: $[X]/month

### Issues Encountered:

- [Any issues and resolutions]

### Next Steps:

- Deploy to production
- Monitor real-user metrics
- Proceed to Phase 4 (continuous optimization)
```

---

## PHASE 4: Monitoring & Continuous Optimization

**Timeline**: Ongoing  
**Goal**: Maintain performance, continuous improvement

---

### Ongoing Activity 4.1: Performance Monitoring

**Setup Vercel Analytics (if using Vercel):**

```bash
npm install @vercel/analytics @vercel/speed-insights
```

```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
```

**Create performance dashboard:**

```typescript
// app/admin/performance/page.tsx
export default async function PerformanceDashboard() {
  const metrics = await getPerformanceMetrics()

  return (
    <div>
      <h1>Performance Dashboard</h1>

      <MetricCard
        title="Bundle Size"
        value={`${metrics.bundleSize}MB`}
        trend={metrics.bundleTrend}
        threshold={200}
      />

      <MetricCard
        title="Lighthouse Score"
        value={metrics.lighthouseScore}
        trend={metrics.lighthouseTrend}
        threshold={90}
      />

      <MetricCard
        title="LCP (p75)"
        value={`${metrics.lcp}s`}
        trend={metrics.lcpTrend}
        threshold={2.5}
      />
    </div>
  )
}
```

**Alert Configuration:**

```typescript
// lib/monitoring.ts
export function checkPerformanceAlerts() {
  if (metrics.bundleSize > 200) {
    sendSlackAlert('Bundle size exceeded 200MB threshold');
  }

  if (metrics.lcpP75 > 3.0) {
    sendSlackAlert('LCP degraded to >3s for 75% of users');
  }

  if (metrics.errorRate > 0.01) {
    sendSlackAlert('Error rate exceeded 1%');
  }
}
```

---

### Ongoing Activity 4.2: Weekly Bundle Checks

**Automated weekly report:**

```yaml
# .github/workflows/weekly-bundle-report.yml
name: Weekly Bundle Report

on:
  schedule:
    - cron: '0 9 * * 1' # Every Monday 9 AM

jobs:
  bundle-report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build

      - name: Generate report
        run: |
          BUNDLE_SIZE=$(du -sm .next | cut -f1)

          cat > bundle-report.md << EOF
          # Weekly Bundle Report

          **Date**: $(date)
          **Bundle Size**: ${BUNDLE_SIZE}MB

          ## Status
          $(if [ $BUNDLE_SIZE -lt 200 ]; then echo "✅ Within target"; else echo "⚠️ Exceeds target"; fi)

          ## Top Chunks
          $(du -sm .next/static/chunks/* | sort -rn | head -5)
          EOF

          cat bundle-report.md

      - name: Post to Slack
        # Use Slack webhook to post report
```

---

### Ongoing Activity 4.3: Cost Optimization Monitoring

**Create cost dashboard:**

```typescript
// app/admin/costs/page.tsx
export default async function CostsDashboard() {
  const costs = await getCostMetrics()

  return (
    <div>
      <h1>Infrastructure Costs</h1>

      <MetricCard
        title="Railway PostgreSQL"
        value={`${costs.database}/mo`}
        breakdown={`${costs.queries} queries/day`}
      />

      <MetricCard
        title="Vercel Bandwidth"
        value={`${costs.bandwidth}GB/mo`}
        breakdown={`${costs.requests} requests/day`}
      />

      <MetricCard
        title="Cost per User"
        breakdown={{
          FREE: `${costs.perFreeTier} (5 symbols, basic indicators)`,
          PRO: `${costs.perProTier} (15 symbols, all indicators)`,
          TRIAL: `${costs.perTrialUser} (7-day PRO access)`
        }}
      />

      <MetricCard
        title="User Distribution"
        breakdown={{
          FREE: `${costs.freeUserCount} users (${costs.freeUserPercent}%)`,
          PRO: `${costs.proUserCount} users (${costs.proUserPercent}%)`,
          TRIAL: `${costs.trialUserCount} users (${costs.trialUserPercent}%)`
        }}
      />

      <h2>Revenue Analysis</h2>
      <MetricCard
        title="Monthly Revenue"
        value={`${costs.monthlyRevenue}`}
        breakdown={{
          'PRO Subscriptions': `${costs.proUserCount * 29}`,
          'Yearly Conversions': `${costs.yearlyRevenue}`
        }}
      />
    </div>
  )
}
```

---

## Rollback Procedures

### Emergency Rollback (Production Issue)

```bash
# 1. Immediate revert to previous stable version
git revert HEAD --no-edit
git push origin main

# 2. Or rollback to specific commit
git reset --hard [previous-stable-commit]
git push --force origin main

# 3. Verify deployment
# Check production site
# Monitor error rates

# 4. Investigate issue offline
git checkout -b fix/rollback-issue
# Fix and test thoroughly before redeploying
```

### Feature Flag Rollback (Partial Issue)

```bash
# Disable feature via environment variable
# .env.production
NEXT_PUBLIC_NEW_DASHBOARD=false

# Redeploy
git push origin main

# Features remain in codebase but inactive
# Can re-enable after fix
```

### Database Rollback (Schema Changes)

```bash
# Keep migrations reversible
# migrations/002_add_subscriptions.sql
BEGIN;

-- Up migration
CREATE TABLE subscriptions (...);

-- Down migration (in separate file)
-- migrations/002_add_subscriptions_down.sql
DROP TABLE subscriptions;

COMMIT;

# Rollback
psql $DATABASE_URL < migrations/002_add_subscriptions_down.sql
```

---

## Success Criteria Summary

### Phase 0 Success:

- ✅ Bundle: 375MB → <340MB
- ✅ CI/CD: Passing
- ✅ Monitoring: Active

### Phase 1 Success:

- ✅ Bundle: Maintained <450MB
- ✅ Development: Unimpeded
- ✅ Patterns: Documented

### Phase 2 Success:

- ✅ Bundle: <300MB
- ✅ Lighthouse: Improved scores
- ✅ Tests: All passing

### Phase 3 Success:

- ✅ Bundle: <150MB (ideal 100-150MB)
- ✅ Lighthouse: >90 all pages
- ✅ LCP: <2.5s
- ✅ Database: -60% queries
- ✅ Costs: -50%

### Phase 4 Success:

- ✅ Monitoring: Active and alerting
- ✅ Performance: Sustained
- ✅ Costs: Optimized

---

## Final Notes

**For Claude Code:**

- Follow phases sequentially
- Validate each step before proceeding
- Commit working changes frequently
- Document any deviations from plan
- Raise issues immediately if blocked

**For Developer:**

- This plan is a guide, not strict rules
- Adapt based on specific findings (bundle analyzer)
- Prioritize business value over perfect optimization
- Maintain test coverage throughout
- Monitor user impact of changes

**Key Principle:**

> "Make it work, make it right, make it fast"
>
> Phase 0-1: Make it work (unblock CI/CD, continue development)
> Phase 2: Make it right (clean up technical debt)
> Phase 3: Make it fast (comprehensive optimization)
> Phase 4: Keep it fast (continuous monitoring)

---

**Document Status**: Ready for implementation
**Last Updated**: December 30, 2025
**Version**: 1.1

**Important Implementation Notes:**

- **Project Name**: Trading Alerts SaaS Public
- **Tier System**: Fully implemented in codebase
  - Core config: `lib/tier-config.ts` (FREE vs PRO definitions)
  - Validation: `lib/tier-validation.ts` (symbol, timeframe, chart, alert limits)
  - Helpers: `lib/tier-helpers.ts` (utility functions)
  - Indicators: `lib/tier/constants.ts`, `lib/tier/validator.ts`
  - Types: `types/tier.ts` (Tier, Symbol, Timeframe types and constants)
- **Symbols**:
  - FREE: 5 symbols (BTCUSD, EURUSD, USDJPY, US30, XAUUSD)
  - PRO: 15 symbols (all FREE + 10 exclusive)
- **Timeframes**:
  - FREE: 3 timeframes (H1, H4, D1)
  - PRO: 9 timeframes (M5, M15, M30, H1, H2, H4, H8, H12, D1)
- **Indicators**:
  - FREE: 2 basic (fractals, trendlines)
  - PRO: All 8 (basic + momentum_candles, keltner_channels, tema, hrma, smma, zigzag)
- **Pricing**:
  - FREE: $0
  - PRO: $29/month or $290/year with 7-day free trial
- **Chart Combinations**:
  - FREE: 15 (5 symbols × 3 timeframes)
  - PRO: 135 (15 symbols × 9 timeframes)

**Use Existing Validation Functions:**

```typescript
// Always use these instead of creating new validation:
import { validateTierAccess } from '@/lib/tier-validation';
import { canAccessIndicator } from '@/lib/tier/validator';
import { getTierConfig } from '@/lib/tier-config';
```
