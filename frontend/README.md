# Frontend - Modular Deployment

This directory contains the frontend-only deployment for the Trading Alerts SaaS application, optimized for Vercel deployment with minimal JavaScript bundle size.

## Overview

This is a **separate deployment** from the monolith, implementing Step 4 of the Modular Monolith Migration. The key optimization is separating Interactive Elements (Client Components) from Readable Elements (Server Components) to minimize JavaScript sent to the browser.

## Directory Structure

```
frontend/
├── app/                    # Next.js App Router pages (copied from root)
│   ├── (auth)/            # Authentication pages
│   ├── (dashboard)/       # Dashboard & admin pages
│   ├── (marketing)/       # Marketing pages
│   └── */loading.tsx      # Loading skeletons for each route
│
├── components/
│   ├── readable/          # Server Components (0 KB JS)
│   ├── interactive/       # Client Components (minimal JS)
│   └── ui/                # Shared UI components
│
├── lib/                   # Utilities and helpers
│   ├── auth/             # Authentication utilities
│   ├── db/               # Database access (Prisma)
│   └── ...               # Other utilities
│
├── public/               # Static assets
│
├── next.config.js        # Optimized Next.js configuration
├── vercel.json           # Vercel deployment configuration
├── package.json          # Frontend-specific dependencies
├── tsconfig.json         # TypeScript configuration
└── README.md             # This file
```

## Key Optimizations

### 1. Server Components by Default
- **95%+ of UI** rendered on server
- **0 KB JavaScript** for static content
- Direct database access (no API calls)

### 2. Client Component Islands
- **<5% of UI** requires client-side JavaScript
- Forms, buttons, interactive widgets
- Lazy-loaded when needed

### 3. Loading Skeletons
- Instant visual feedback
- Matches page layout
- Reduces perceived load time

### 4. Tier-Based Loading
- FREE users: Load only FREE features (~30KB JS)
- PRO users: Load PRO features on demand (~50KB JS)
- 75-80% bundle size reduction

## Deployment

### Fresh Vercel Project
This MUST be deployed as a **NEW** Vercel project, separate from the existing monolith:

```bash
# Option 1: Vercel CLI
cd frontend
vercel login
vercel --prod

# Option 2: Vercel Dashboard
# 1. Go to https://vercel.com/new
# 2. Import repository
# 3. Set Root Directory: frontend
# 4. Deploy
```

### Environment Variables
Configure in Vercel project settings:

```bash
# Database (same as monolith during transition)
DATABASE_URL=<postgresql-connection-string>

# Auth (same secrets for session compatibility)
NEXTAUTH_SECRET=<same-as-monolith>
NEXTAUTH_URL=https://trading-alerts-v2.vercel.app

# Backend API (Railway NestJS - after Step 5)
NEXT_PUBLIC_API_URL=https://api.trading-alerts.railway.app

# Feature Flags
NEXT_PUBLIC_USE_MODULAR_BACKEND=false
```

### Vercel Project Settings
- **Framework**: Next.js
- **Root Directory**: `frontend`
- **Build Command**: `pnpm run build`
- **Install Command**: `pnpm install`
- **Output Directory**: `.next`

## Development

### Local Development

```bash
# Install dependencies
cd frontend
pnpm install

# Generate Prisma client
pnpm run db:generate

# Run development server
pnpm run dev

# Open http://localhost:3000
```

### Building

```bash
# Production build
pnpm run build

# Build with bundle analysis
pnpm run build:analyze
```

### Validation

```bash
# Type check
pnpm run type-check

# Lint
pnpm run lint

# Format check
pnpm run format:check

# All validations
pnpm run validate
```

## Bundle Size Targets

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| FREE tier JS | ~150KB | ~30KB | 80% reduction |
| PRO tier JS | ~200KB | ~50KB | 75% reduction |
| Time to Interactive (Mobile) | 8-12s | 1.5-2s | 75% faster |
| Lighthouse Score | 45 | 90+ | 2x improvement |

## Migration Status

### ✅ Completed
- [x] Directory structure created
- [x] Configuration files set up
- [x] Loading skeletons created
- [x] Component organization

### 🚧 In Progress
- [ ] Admin pages conversion
- [ ] Auth pages conversion
- [ ] Dashboard & Charts conversion

### ⏳ Pending
- [ ] Tier-based optimization
- [ ] Bundle analysis
- [ ] Fresh Vercel deployment

## Files

- **CONVERSION_GUIDE.md**: Detailed conversion patterns and progress
- **components/README.md**: Component organization guide

## Related Documentation

- Main migration guide: `../monolith-to-modular-monolith-migration/`
- Bundle optimization: `../bundle-size-optimization/`
- Frontend pages list: `../docs/files-completion-list/frontend-ui-pages.md`

## Deployment Strategy

### Phase 1: Staging (Current)
1. Deploy frontend to new Vercel project
2. Test with existing monolith backend
3. Validate performance improvements
4. A/B test with subset of users

### Phase 2: Production Rollout
1. Gradual traffic shift (10% → 50% → 100%)
2. Monitor metrics and error rates
3. Keep monolith as fallback
4. Full cutover after validation

### Phase 3: Backend Migration (Step 5+)
1. Deploy NestJS backend to Railway
2. Update `NEXT_PUBLIC_API_URL`
3. Enable `NEXT_PUBLIC_USE_MODULAR_BACKEND`
4. Complete modular architecture

## Support

For issues or questions:
- Check `CONVERSION_GUIDE.md` for common patterns
- Review main migration docs
- File GitHub issue with `frontend` label
