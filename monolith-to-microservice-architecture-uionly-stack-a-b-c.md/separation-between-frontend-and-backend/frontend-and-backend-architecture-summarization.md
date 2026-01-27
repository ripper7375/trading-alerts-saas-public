## Updated Categorization Rules

### FRONTEND (Next.js → Vercel) - 323 files

```
✅ Include:
├── app/**/*                          # Next.js App Router (ALL files)
│   ├── **/*.tsx                      # Pages, layouts, components
│   ├── **/*.ts                       # Page logic
│   └── api/**/*.ts                   # 🔥 API ROUTES (Edge Functions)
├── components/**/*                   # React components
├── hooks/**/*                        # React hooks (use-*.ts)
├── context/**/*                      # React context
├── public/**/*                       # Static assets
├── styles/**/*                       # CSS/Styling
├── lib/**/use-*.ts                  # 🔥 React hooks (any directory)
├── next.config.js                    # Next.js config
├── tailwind.config.ts               # Tailwind config
├── postcss.config.js                # PostCSS config
├── vercel.json                      # Vercel deployment
├── __tests__/components/**/*         # Component tests
├── __tests__/hooks/**/*             # Hook tests
└── __tests__/api/**/*.test.ts       # 🔥 API route tests

🔥 = Critical rules often missed
```

### BACKEND (Server Logic → Railway) - 168 files

```
✅ Include:
├── src/**/*                          # Nest.js source (if separate)
├── controllers/**/*                  # API controllers
├── services/**/*                     # Business logic
├── modules/**/*                      # Nest.js modules
├── entities/**/*                     # Database entities
├── dto/**/*                          # Data Transfer Objects
├── guards/**/*                       # Auth guards
├── interceptors/**/*                 # Interceptors
├── pipes/**/*                        # Validation pipes
├── filters/**/*                      # Exception filters
├── prisma/**/*                       # Database ORM
├── lib/**/*                          # 🔥 Server-side utilities (NOT hooks)
├── emails/**/*.tsx                   # 🔥 Server-side email templates
├── lib/email/templates/**/*         # 🔥 Email templates
├── nest-cli.json                     # Nest.js config
└── __tests__/lib/**/*.test.ts       # 🔥 Lib tests (business logic)

🔥 = Rules that differ from typical .tsx categorization
```

### SHARING (Both Stacks) - 15 files

```
✅ Include:
├── types/**/*                        # TypeScript types
├── interfaces/**/*                   # TypeScript interfaces
├── constants/**/*                    # Shared constants
├── enums/**/*                        # TypeScript enums
├── shared/**/*                       # Shared utilities
├── scripts/**/*                      # 🔥 Build/config scripts
├── **/*.types.ts                     # Type definitions
├── **/*.interface.ts                 # Interface definitions
├── **/*.constants.ts                 # Constant definitions
├── tsconfig.json                     # TypeScript config
├── .env.example                      # Environment template
└── package.json                      # Dependencies (if monorepo)

🔥 = Often overlooked
```

### TEST (Framework-Agnostic) - 17 files

```
✅ Include:
├── __tests__/e2e/**/*               # End-to-end tests
├── __tests__/integration/**/*        # Integration tests
├── __tests__/helpers/**/*            # Test utilities
└── __tests__/*.test.ts              # Generic test setup

❌ Exclude (categorize to their stack):
├── __tests__/components/**/*         → FRONTEND
├── __tests__/hooks/**/*             → FRONTEND
├── __tests__/api/**/*               → FRONTEND (tests Next.js routes)
└── __tests__/lib/**/*               → BACKEND (tests business logic)
```

---

## Deployment Architecture

### Frontend Deployment (Vercel)

```
📦 Next.js Application Bundle
├── app/ directory (ALL contents)
│   ├── Pages & Layouts (.tsx)
│   ├── Components (.tsx)
│   └── API Routes (.ts) ← Edge Functions
├── components/
├── hooks/
├── public/
├── styles/
├── next.config.js
└── vercel.json

Tests for above: __tests__/{components,hooks,api}/**/*
```

### Backend Deployment (Railway)

```
📦 Server Application Bundle
├── lib/ (business logic)
├── emails/ (templates)
├── prisma/ (database)
├── services/
├── controllers/
└── Server utilities

Tests for above: __tests__/lib/**/*
```

### Shared Code (Both)

```
📦 Shared Package
├── types/
├── interfaces/
├── constants/
└── scripts/

Not deployed separately, consumed by both
```

---

CI/CD Configuration

Ensure deployment pipelines align with categorization:

```yaml
# Vercel (Frontend)
- app/**/*
- components/**/*
- hooks/**/*
- public/**/*
- styles/**/*
- lib/**/use-*.ts # React hooks
- next.config.js
- tailwind.config.ts
- postcss.config.js

# Railway (Backend)
- lib/**/* # Exclude use-*.ts
- emails/**/*
- prisma/**/*
- services/**/*
- controllers/**/*
# Both use types/ and constants/
```

### Testing Strategy

```bash
# Frontend tests (run in Vercel test environment)
npm test __tests__/components
npm test __tests__/hooks
npm test __tests__/api  # API route tests

# Backend tests (run in Railway test environment)
npm test __tests__/lib  # Business logic tests

# Integration tests (run in both or CI)
npm test __tests__/integration
npm test __tests__/e2e
```

---
