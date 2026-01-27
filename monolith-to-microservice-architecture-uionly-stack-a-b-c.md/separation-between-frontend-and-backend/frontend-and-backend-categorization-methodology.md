## Architecture Context

### Deployment Strategy

- **Frontend (Next.js)** → Vercel
  - Client-side UI, React components, pages, hooks, styles
  - Next.js API routes in `app/api/` (edge functions on Vercel)
- **Backend (Nest.js)** → Railway
  - Business logic, services, database operations
  - Separate API server with controllers, modules, services
- **Shared Code**
  - TypeScript types, interfaces, constants
  - Utilities used by both frontend and backend

---

## Categorization Rules

### FRONTEND (Next.js → Vercel)

```
✅ Include:
- app/**/*.tsx, app/**/*.ts         # Next.js pages and layouts
- app/api/**/*.ts                    # Next.js API routes (CRITICAL)
- components/**/*                    # React components
- public/**/*                        # Static assets
- styles/**/*                        # CSS and styling
- hooks/**/*                         # React hooks
- context/**/*                       # React context
- lib/client/**/*                    # Client-side utilities
- next.config.js                     # Next.js config
- tailwind.config.ts                 # Tailwind config
- postcss.config.js                  # PostCSS config
- vercel.json                        # Vercel config
- __tests__/components/**/*          # Component tests
```

### BACKEND (Nest.js → Railway)

```
✅ Include:
- src/**/*                           # Nest.js source code
- controllers/**/*                   # API controllers
- services/**/*                      # Business logic
- modules/**/*                       # Nest.js modules
- entities/**/*                      # Database entities
- dto/**/*                           # Data Transfer Objects
- guards/**/*                        # Auth guards
- interceptors/**/*                  # Interceptors
- pipes/**/*                         # Validation pipes
- filters/**/*                       # Exception filters
- prisma/**/*                        # Prisma ORM
- lib/server/**/*                    # Server-side utilities
- nest-cli.json                      # Nest.js config
- __tests__/api/**/*.test.ts         # API tests
- __tests__/lib/**/*.test.ts         # Service tests
```

### SHARING (Both Frontend & Backend)

```
✅ Include:
- types/**/*                         # TypeScript types
- interfaces/**/*                    # TypeScript interfaces
- constants/**/*                     # Shared constants
- enums/**/*                         # TypeScript enums
- shared/**/*                        # Shared utilities
- **/*.types.ts                      # Type definition files
- **/*.interface.ts                  # Interface definition files
- **/*.constants.ts                  # Constant definition files
- tsconfig.json                      # TypeScript config
- .env.example                       # Environment template
- package.json                       # Dependency manifest
```

---

## Validation Methodology

The validation uses microservice architecture best practices:

1. **Path-based Pattern Matching**
   - Analyzes file paths against known Next.js and Nest.js conventions
   - Identifies framework-specific directories and files

2. **Deployment Context**
   - Frontend: Files that deploy to Vercel (Next.js application)
   - Backend: Files that deploy to Railway (separate API service)
   - Shared: Configuration and types used by both

3. **Next.js Specific Handling**
   - `app/api/**/*.ts` are edge functions (Frontend)
   - `app/**/*.tsx` are React components (Frontend)
   - Pages and layouts follow Next.js conventions (Frontend)

4. **Test File Context**
   - Component tests follow their components (Frontend)
   - API tests follow their endpoints (Backend)
   - Service tests follow their services (Backend)

---

## Recommendations

### For Next.js + Vercel Deployment

- All `app/` directory contents should be FRONTEND
- This includes `app/api/` which contains edge functions
- Never split the Next.js `app/` directory between deployments

### For Nest.js + Railway Deployment

- Only pure backend services should be BACKEND
- Controllers, services, and database code belong here
- Keep this completely separate from Next.js codebase

### For Shared Code

- Minimize SHARING category to truly reusable code
- Types, interfaces, and constants that both use
- Configuration files that affect both deployments
- Consider npm workspace or shared package for larger projects

---
