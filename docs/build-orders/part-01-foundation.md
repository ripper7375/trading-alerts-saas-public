# Part 1: Foundation & Root Configuration - Build Order

**From:** `docs/v5-structure-division.md` Part 1
**Total Files:** 12 files
**Estimated Time:** 2 hours
**Priority:** ⭐⭐⭐ High (Must complete first)
**Complexity:** Low

---

## Overview

**Scope:** Root-level configuration files for Next.js 15, TypeScript, Tailwind CSS, ESLint, and development environment setup.

**Implementation Guide References:**

- `docs/implementation-guides/v5_part_a.md` - Technology stack, Next.js 15 configuration, and environment setup

**Key Changes from V4:**

- ✅ `next.config.js` - Updated for Next.js 15 with Turbopack
- ✅ `package.json` - Next.js 15, React 19 dependencies
- ✅ `.env.example` - 2-tier system environment variables

**Note:** Part 1 consists primarily of configuration files (JSON, YAML, etc.). While `docs/policies/05-coding-patterns.md` focuses on TypeScript/API patterns, the configuration standards from `docs/policies/02-quality-standards.md` apply here.

**Dependencies:**

- None (this is the foundation - builds first)

**Integration Points:**

- Provides configuration for ALL subsequent parts
- Sets up TypeScript compiler options for type safety
- Establishes Tailwind CSS design system
- Configures linting and formatting standards

---

## File Build Order

Build these files **in sequence**:

---

### File 1/12: `.vscode/settings.json`

**Purpose:** VS Code workspace settings for consistent development environment

**From v5-structure-division.md:**

> VS Code settings for TypeScript, ESLint, Prettier integration

**Implementation Details:**

- **Reference Guide:** `docs/implementation-guides/v5_part_a.md` Section 7.5
- **Pattern:** Configuration file (no specific pattern - JSON config)
- **Seed Code Reference:** `seed-code/saas-starter/.vscode/settings.json`

**Dependencies:**

- None (first file)

**Build Steps:**

1. **Read Requirements**

   ```
   - seed-code/saas-starter/.vscode/settings.json
   - Standard VS Code settings for Next.js/TypeScript projects
   ```

2. **Generate Code**

   ```json
   {
     "editor.formatOnSave": true,
     "editor.defaultFormatter": "esbenp.prettier-vscode",
     "editor.codeActionsOnSave": {
       "source.fixAll.eslint": true
     },
     "typescript.tsdk": "node_modules/typescript/lib",
     "typescript.enablePromptUseWorkspaceTsdk": true
   }
   ```

3. **Validation**
   - Valid JSON format
   - Standard VS Code settings

4. **Commit**
   ```
   git add .vscode/settings.json
   git commit -m "chore: add VS Code workspace settings"
   ```

---

### File 2/12: `.vscode/extensions.json`

**Purpose:** Recommended VS Code extensions for the project

**Implementation Details:**

- **Seed Code Reference:** `seed-code/saas-starter/.vscode/extensions.json`

**Build Steps:**

1. **Generate Code**

   ```json
   {
     "recommendations": [
       "dbaeumer.vscode-eslint",
       "esbenp.prettier-vscode",
       "bradlc.vscode-tailwindcss",
       "Prisma.prisma"
     ]
   }
   ```

2. **Commit**
   ```
   git add .vscode/extensions.json
   git commit -m "chore: add recommended VS Code extensions"
   ```

---

### File 3/12: `next.config.js`

**Purpose:** Next.js 15 configuration with Turbopack, image domains, environment variables

**Implementation Details:**

- **Reference Guide:** `docs/implementation-guides/v5_part_a.md` Section 7.4
- **Pattern:** Next.js 15 config pattern
- **Seed Code Reference:** `seed-code/saas-starter/next.config.mjs`

**Dependencies:**

- None

**Build Steps:**

1. **Read Requirements**

   ```
   - v5_part_a.md Section 7.4 (Next.js 15 features)
   - Turbopack enabled
   - Image domains: Vercel, avatars
   - Environment variables: MT5_API_URL, NEXTAUTH_URL
   ```

2. **Generate Code**

   ```javascript
   /** @type {import('next').NextConfig} */
   const nextConfig = {
     experimental: {
       turbo: {
         rules: {
           '*.svg': {
             loaders: ['@svgr/webpack'],
             as: '*.js',
           },
         },
       },
     },
     images: {
       remotePatterns: [
         {
           protocol: 'https',
           hostname: 'avatars.githubusercontent.com',
         },
         {
           protocol: 'https',
           hostname: 'lh3.googleusercontent.com',
         },
       ],
     },
     env: {
       MT5_API_URL: process.env.MT5_API_URL,
     },
   };

   export default nextConfig;
   ```

3. **Validation**
   - Valid JavaScript syntax
   - Next.js 15 compatible
   - Turbopack configuration present

4. **Commit**
   ```
   git add next.config.js
   git commit -m "feat: add Next.js 15 config with Turbopack"
   ```

---

### File 4/12: `tailwind.config.ts`

**Purpose:** Tailwind CSS configuration with design system colors, animations

**Implementation Details:**

- **Seed Code Reference:** `seed-code/saas-starter/tailwind.config.ts`
- **Reference:** shadcn/ui color variables

**Build Steps:**

1. **Generate Code**

   ```typescript
   import type { Config } from 'tailwindcss';

   const config: Config = {
     darkMode: ['class'],
     content: [
       './pages/**/*.{ts,tsx}',
       './components/**/*.{ts,tsx}',
       './app/**/*.{ts,tsx}',
       './src/**/*.{ts,tsx}',
     ],
     theme: {
       container: {
         center: true,
         padding: '2rem',
         screens: {
           '2xl': '1400px',
         },
       },
       extend: {
         colors: {
           border: 'hsl(var(--border))',
           input: 'hsl(var(--input))',
           ring: 'hsl(var(--ring))',
           background: 'hsl(var(--background))',
           foreground: 'hsl(var(--foreground))',
           primary: {
             DEFAULT: 'hsl(var(--primary))',
             foreground: 'hsl(var(--primary-foreground))',
           },
           secondary: {
             DEFAULT: 'hsl(var(--secondary))',
             foreground: 'hsl(var(--secondary-foreground))',
           },
           destructive: {
             DEFAULT: 'hsl(var(--destructive))',
             foreground: 'hsl(var(--destructive-foreground))',
           },
           muted: {
             DEFAULT: 'hsl(var(--muted))',
             foreground: 'hsl(var(--muted-foreground))',
           },
           accent: {
             DEFAULT: 'hsl(var(--accent))',
             foreground: 'hsl(var(--accent-foreground))',
           },
           popover: {
             DEFAULT: 'hsl(var(--popover))',
             foreground: 'hsl(var(--popover-foreground))',
           },
           card: {
             DEFAULT: 'hsl(var(--card))',
             foreground: 'hsl(var(--card-foreground))',
           },
         },
         borderRadius: {
           lg: 'var(--radius)',
           md: 'calc(var(--radius) - 2px)',
           sm: 'calc(var(--radius) - 4px)',
         },
         keyframes: {
           'accordion-down': {
             from: { height: '0' },
             to: { height: 'var(--radix-accordion-content-height)' },
           },
           'accordion-up': {
             from: { height: 'var(--radix-accordion-content-height)' },
             to: { height: '0' },
           },
         },
         animation: {
           'accordion-down': 'accordion-down 0.2s ease-out',
           'accordion-up': 'accordion-up 0.2s ease-out',
         },
       },
     },
     plugins: [require('tailwindcss-animate')],
   };

   export default config;
   ```

2. **Commit**
   ```
   git add tailwind.config.ts
   git commit -m "feat: add Tailwind CSS config with shadcn/ui design tokens"
   ```

---

### File 5/12: `tsconfig.json`

**Purpose:** TypeScript compiler configuration for strict type checking

**Implementation Details:**

- **Seed Code Reference:** `seed-code/saas-starter/tsconfig.json`

**Build Steps:**

1. **Generate Code**

   ```json
   {
     "compilerOptions": {
       "target": "ES2020",
       "lib": ["dom", "dom.iterable", "esnext"],
       "allowJs": true,
       "skipLibCheck": true,
       "strict": true,
       "noEmit": true,
       "esModuleInterop": true,
       "module": "esnext",
       "moduleResolution": "bundler",
       "resolveJsonModule": true,
       "isolatedModules": true,
       "jsx": "preserve",
       "incremental": true,
       "plugins": [
         {
           "name": "next"
         }
       ],
       "paths": {
         "@/*": ["./*"]
       }
     },
     "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
     "exclude": ["node_modules"]
   }
   ```

2. **Commit**
   ```
   git add tsconfig.json
   git commit -m "feat: add TypeScript config with strict mode"
   ```

---

### File 6/12: `package.json`

**Purpose:** Project dependencies for Next.js 15, React 19, Prisma, NextAuth, Stripe, etc.

**Implementation Details:**

- **Reference Guide:** `docs/implementation-guides/v5_part_a.md` Section 4 (Technology Stack)
- **Pattern:** Next.js 15 + React 19 package.json

**Build Steps:**

1. **Read Requirements**

   ```
   - Next.js 15
   - React 19
   - Prisma 5.x
   - NextAuth v4.24.5
   - Stripe SDK
   - shadcn/ui dependencies
   - TradingView Lightweight Charts
   ```

2. **Generate Code**

   ```json
   {
     "name": "trading-alerts-saas-v7",
     "version": "7.0.0",
     "private": true,
     "scripts": {
       "dev": "next dev --turbo",
       "build": "next build",
       "start": "next start",
       "lint": "next lint",
       "format": "prettier --write .",
       "db:push": "prisma db push",
       "db:studio": "prisma studio",
       "db:generate": "prisma generate",
       "db:migrate": "prisma migrate dev",
       "db:seed": "ts-node prisma/seed.ts"
     },
     "dependencies": {
       "next": "^15.0.0",
       "react": "^19.0.0",
       "react-dom": "^19.0.0",
       "next-auth": "^4.24.5",
       "@prisma/client": "^5.7.0",
       "stripe": "^14.10.0",
       "lightweight-charts": "^4.1.1",
       "zod": "^3.22.4",
       "react-hook-form": "^7.49.0",
       "@radix-ui/react-dialog": "^1.0.5",
       "@radix-ui/react-dropdown-menu": "^2.0.6",
       "@radix-ui/react-label": "^2.0.2",
       "@radix-ui/react-select": "^2.0.0",
       "@radix-ui/react-slot": "^1.0.2",
       "@radix-ui/react-toast": "^1.1.5",
       "class-variance-authority": "^0.7.0",
       "clsx": "^2.1.0",
       "tailwind-merge": "^2.2.0",
       "tailwindcss-animate": "^1.0.7",
       "lucide-react": "^0.303.0",
       "date-fns": "^3.0.6",
       "bcryptjs": "^2.4.3",
       "resend": "^3.0.0"
     },
     "devDependencies": {
       "typescript": "^5.3.3",
       "@types/node": "^20.10.6",
       "@types/react": "^18.2.47",
       "@types/react-dom": "^18.2.18",
       "@types/bcryptjs": "^2.4.6",
       "prisma": "^5.7.0",
       "eslint": "^8.56.0",
       "eslint-config-next": "^15.0.0",
       "prettier": "^3.1.1",
       "tailwindcss": "^3.4.0",
       "postcss": "^8.4.33",
       "autoprefixer": "^10.4.16",
       "ts-node": "^10.9.2"
     }
   }
   ```

3. **Validation**
   - Valid JSON
   - Next.js 15 dependency
   - React 19 dependency
   - All required packages present

4. **Commit**
   ```
   git add package.json
   git commit -m "feat: add package.json with Next.js 15 and React 19 dependencies"
   ```

---

### File 7/12: `.env.example`

**Purpose:** Example environment variables for 2-tier SaaS system

**Implementation Details:**

- **Reference Guide:** `docs/implementation-guides/v5_part_a.md` Section 7.6

**Build Steps:**

1. **Generate Code**

   ```bash
   # Database
   DATABASE_URL="postgresql://user:password@localhost:5432/trading_alerts_v7"

   # NextAuth
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your_secret_here_generate_with_openssl_rand_base64_32"

   # Google OAuth
   GOOGLE_CLIENT_ID="your_google_client_id"
   GOOGLE_CLIENT_SECRET="your_google_client_secret"

   # Stripe (2-tier system: FREE + PRO)
   STRIPE_SECRET_KEY="sk_test_..."
   STRIPE_PUBLISHABLE_KEY="pk_test_..."
   STRIPE_WEBHOOK_SECRET="whsec_..."
   STRIPE_PRO_PRICE_ID="price_..."

   # Flask MT5 Service
   MT5_API_URL="http://localhost:5001"

   # Email (Resend)
   RESEND_API_KEY="re_..."

   # Redis (optional for caching)
   REDIS_URL="redis://localhost:6379"

   # Feature Flags
   ENABLE_GOOGLE_OAUTH=true
   ENABLE_DLOCAL_PAYMENTS=false
   ENABLE_AFFILIATE_PROGRAM=false
   ```

2. **Commit**
   ```
   git add .env.example
   git commit -m "feat: add environment variables template for 2-tier SaaS"
   ```

---

### File 8/12: `.eslintrc.json`

**Purpose:** ESLint configuration for Next.js and TypeScript

**Build Steps:**

1. **Generate Code**

   ```json
   {
     "extends": ["next/core-web-vitals", "prettier"],
     "rules": {
       "@typescript-eslint/no-unused-vars": "warn",
       "@typescript-eslint/no-explicit-any": "error"
     }
   }
   ```

2. **Commit**
   ```
   git add .eslintrc.json
   git commit -m "feat: add ESLint config with strict TypeScript rules"
   ```

---

### File 9/12: `.prettierrc`

**Purpose:** Prettier code formatting configuration

**Build Steps:**

1. **Generate Code**

   ```json
   {
     "semi": true,
     "trailingComma": "es5",
     "singleQuote": true,
     "printWidth": 80,
     "tabWidth": 2,
     "useTabs": false
   }
   ```

2. **Commit**
   ```
   git add .prettierrc
   git commit -m "feat: add Prettier formatting config"
   ```

---

### File 10/12: `.gitignore`

**Purpose:** Git ignore patterns for Next.js, Node, environment variables

**Build Steps:**

1. **Generate Code**

   ```
   # Dependencies
   node_modules/
   /.pnp
   .pnp.js

   # Testing
   /coverage

   # Next.js
   /.next/
   /out/

   # Production
   /build

   # Misc
   .DS_Store
   *.pem

   # Debug
   npm-debug.log*
   yarn-debug.log*
   yarn-error.log*

   # Local env files
   .env*.local
   .env

   # Vercel
   .vercel

   # Typescript
   *.tsbuildinfo
   next-env.d.ts

   # Prisma
   /prisma/migrations/**/migration.sql
   ```

2. **Commit**
   ```
   git add .gitignore
   git commit -m "feat: add .gitignore for Next.js project"
   ```

---

### File 11/12: `postcss.config.js`

**Purpose:** PostCSS configuration for Tailwind CSS

**Build Steps:**

1. **Generate Code**

   ```javascript
   module.exports = {
     plugins: {
       tailwindcss: {},
       autoprefixer: {},
     },
   };
   ```

2. **Commit**
   ```
   git add postcss.config.js
   git commit -m "feat: add PostCSS config for Tailwind CSS"
   ```

---

### File 12/12: `README.md`

**Purpose:** Project documentation and setup instructions

**Build Steps:**

1. **Generate Code**

   ````markdown
   # Trading Alerts SaaS V7

   A commercial SaaS platform for trading alerts and signal generation with real-time chart visualization.

   ## Tech Stack

   - **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS
   - **Backend:** Next.js API Routes, Prisma, PostgreSQL
   - **Auth:** NextAuth.js with Google OAuth
   - **Payments:** Stripe (2-tier: FREE + PRO)
   - **Charts:** TradingView Lightweight Charts
   - **MT5 Integration:** Flask microservice

   ## Getting Started

   1. Install dependencies:
      ```bash
      pnpm install
      ```
   ````

   2. Set up environment variables:

      ```bash
      cp .env.example .env.local
      # Edit .env.local with your credentials
      ```

   3. Set up database:

      ```bash
      pnpm db:push
      pnpm db:seed
      ```

   4. Run development server:
      ```bash
      pnpm dev
      ```

   Open [http://localhost:3000](http://localhost:3000)

   ## Project Structure
   - `/app` - Next.js 15 App Router
   - `/components` - React components
   - `/lib` - Utility functions and configurations
   - `/prisma` - Database schema and migrations
   - `/types` - TypeScript type definitions

   ## License

   Proprietary - All rights reserved

   ```

   ```

2. **Commit**
   ```
   git add README.md
   git commit -m "docs: add project README with setup instructions"
   ```

---

## Testing After Part Complete

Once all 12 files are built:

1. **Install Dependencies**

   ```bash
   pnpm install
   ```

2. **Verify TypeScript Config**

   ```bash
   npx tsc --noEmit
   ```

   Expected: No errors

3. **Verify Linting**

   ```bash
   pnpm lint
   ```

   Expected: No critical errors

4. **Verify Next.js Build**
   ```bash
   pnpm build
   ```
   Expected: Successful build

---

## Success Criteria

Part 1 is complete when:

- ✅ All 12 files built and committed
- ✅ `pnpm install` succeeds
- ✅ No TypeScript errors
- ✅ Linting passes
- ✅ Next.js builds successfully
- ✅ PROGRESS.md updated with Part 1 completion

---

## Next Steps

After Part 1 complete:

- Ready for Part 2: Database Schema & Migrations
- Unblocks: All subsequent development (foundation ready)

---

## Escalation Scenarios

No expected escalations for Part 1 (configuration files are straightforward).

If issues arise:

- Refer to `docs/policies/04-escalation-triggers.md`
- Check seed-code references
- Verify Node.js version (18+ required)

---

**Last Updated:** 2025-11-18
**Maintained By:** Build order system
**Alignment:** (E) Phase 3 → (B) Part 1 → (C) This file
