# Validation Guide Selection Reference

## Quick Decision Matrix

| Part         | Name                       | Frontend UI? | Use This Guide          | Upload These Files                      |
| ------------ | -------------------------- | ------------ | ----------------------- | --------------------------------------- |
| **Part 1**   | Foundation                 | ❌ NO        | **Backend Validation**  | Guide + Files List                      |
| **Part 2**   | Database                   | ❌ NO        | **Backend Validation**  | Guide + Files List                      |
| **Part 3**   | Types                      | ❌ NO        | **Backend Validation**  | Guide + Files List                      |
| **Part 4**   | Tier System                | ❌ NO        | **Backend Validation**  | Guide + Files List                      |
| **Part 5**   | Authentication             | ✅ YES       | **Frontend Validation** | Guide + Files List + OpenAPI            |
| **Part 6**   | Flask MT5 Service          | ❌ NO        | **Backend Validation**  | Guide + Files List + OpenAPI (optional) |
| **Part 7**   | Indicators API             | ❌ NO        | **Backend Validation**  | Guide + Files List + OpenAPI            |
| **Part 8**   | Dashboard & Layout         | ✅ YES       | **Frontend Validation** | Guide + Files List + OpenAPI            |
| **Part 9**   | Charts & Visualization     | ✅ YES       | **Frontend Validation** | Guide + Files List + OpenAPI            |
| **Part 10**  | Watchlist System           | ✅ YES       | **Frontend Validation** | Guide + Files List + OpenAPI            |
| **Part 11**  | Alerts System              | ✅ YES       | **Frontend Validation** | Guide + Files List + OpenAPI            |
| **Part 12**  | E-commerce & Billing       | ✅ YES       | **Frontend Validation** | Guide + Files List + OpenAPI            |
| **Part 13**  | Settings System            | ✅ YES       | **Frontend Validation** | Guide + Files List + OpenAPI            |
| **Part 14**  | Admin Dashboard            | ✅ YES       | **Frontend Validation** | Guide + Files List + OpenAPI            |
| **Part 15**  | Notifications & Real-time  | ✅ YES       | **Frontend Validation** | Guide + Files List + OpenAPI            |
| **Part 16**  | Utilities & Infrastructure | ✅ YES       | **Frontend Validation** | Guide + Files List + OpenAPI            |
| **Part 17A** | Affiliate Portal           | ✅ YES       | **Frontend Validation** | Guide + Files List + OpenAPI            |
| **Part 17B** | Affiliate Admin            | ✅ YES       | **Frontend Validation** | Guide + Files List + OpenAPI            |
| **Part 18**  | Local Payments             | ✅ YES       | **Frontend Validation** | Guide + Files List + OpenAPI            |
| **Part 19**  | Riseworks Disbursements    | ✅ YES       | **Frontend Validation** | Guide + Files List + OpenAPI            |

---

## Validation Guide Usage

### Frontend UI Validation Guide

**Use for:** 14 parts (5, 8-19)

**What it validates:**

- ✅ Dashboard components (cards, charts, widgets)
- ✅ Styling system (Tailwind + shadcn/ui)
- ✅ Layout components (header, sidebar, footer)
- ✅ Pages and sub-pages
- ✅ Navigation and routing
- ✅ Interactive elements (buttons, forms, modals)
- ✅ API integration (frontend perspective)
- ✅ TypeScript, linting, build

**Files to upload:**

1. Pre-Localhost Testing Implementation Guide (Frontend)
2. part-[XX]-files-completion.md
3. part-[XX]-[name]-openapi.yaml

**Prompt to use:** "Frontend Validation Execution Request"

---

### Backend & Infrastructure Validation Guide

**Use for:** 6 parts (1-4, 6-7)

**What it validates:**

- ✅ Configuration files (Part 1)
- ✅ Database schema (Part 2)
- ✅ Type definitions (Part 3)
- ✅ Business logic libraries (Part 4)
- ✅ Python Flask service (Part 6)
- ✅ API route implementations (Part 7)
- ✅ TypeScript, linting, build
- ❌ NO UI/styling validation

**Files to upload:**

1. Backend & Infrastructure Pre-Localhost Testing Guide
2. part-[XX]-files-completion.md
3. part-[XX]-[name]-openapi.yaml (only for Parts 6, 7)

**Prompt to use:** "Backend Validation Execution Request"

---

## Part-by-Part Breakdown

### Backend Parts (6 total)

#### Part 1: Foundation

- **Type:** Configuration files only
- **Validates:** package.json, tsconfig.json, .env.example, linting configs
- **OpenAPI:** Not applicable
- **Prompt:** Backend validation

#### Part 2: Database

- **Type:** Prisma schema only
- **Validates:** Models, relationships, indexes, migrations
- **OpenAPI:** Not applicable
- **Prompt:** Backend validation

#### Part 3: Types

- **Type:** TypeScript types only
- **Validates:** Type definitions, no 'any', type augmentations
- **OpenAPI:** Not applicable
- **Prompt:** Backend validation

#### Part 4: Tier System

- **Type:** Business logic library
- **Validates:** Utility functions, tier logic, error handling
- **OpenAPI:** Not applicable
- **Prompt:** Backend validation

#### Part 6: Flask MT5 Service

- **Type:** Python framework only
- **Validates:** Flask app, MT5 integration, Python code quality
- **OpenAPI:** Optional (if API spec exists)
- **Prompt:** Backend validation

#### Part 7: Indicators API

- **Type:** API routes only
- **Validates:** Route handlers, validation, error handling
- **OpenAPI:** Yes (recommended)
- **Prompt:** Backend validation

---

### Frontend Parts (14 total)

All parts 5, 8-19 use **Frontend Validation Guide**

**Common validation for all:**

- Dashboard components
- Styling system (Tailwind + shadcn/ui)
- Pages and layouts
- Navigation and routing
- Interactive elements
- API integration
- TypeScript + Build

---

## Workflow Summary

### For Backend Parts (1-4, 6-7):

```
1. Upload to Claude Code:
   - Backend & Infrastructure Validation Guide
   - part-[XX]-files-completion.md
   - part-[XX]-openapi.yaml (Parts 6, 7 only)

2. Use prompt:
   "Backend Validation Execution Request"

3. Claude Code generates:
   - Part-specific validation report
   - TypeScript/Linting/Build reports
   - Actionable fixes with prompts

4. Fix issues and re-validate
```

### For Frontend Parts (5, 8-19):

```
1. Upload to Claude Code:
   - Pre-Localhost Testing Implementation Guide (Frontend)
   - part-[XX]-files-completion.md
   - part-[XX]-openapi.yaml

2. Use prompt:
   "Frontend Validation Execution Request"

3. Claude Code generates:
   - Master validation report
   - Styling system report
   - Pages/Layouts/Components reports
   - Navigation/Interactions reports
   - TypeScript/Linting/Build reports
   - Actionable fixes with prompts

4. Fix issues and re-validate
```

---

## Key Differences

| Aspect             | Backend Validation                  | Frontend Validation                    |
| ------------------ | ----------------------------------- | -------------------------------------- |
| **Focus**          | Code quality, config, schema, logic | UI components, styling, interactions   |
| **Steps**          | 13 steps (10 static + 3 automated)  | 16 steps (13 static + 3 automated)     |
| **Validates**      | Config, DB, Types, Logic, APIs      | Components, Styling, Pages, Navigation |
| **No Validation**  | UI/Styling concerns                 | N/A (validates everything)             |
| **Output Reports** | 7 reports                           | 11 reports                             |
| **Part Types**     | Infrastructure parts                | User-facing parts                      |

---

## Important Notes

### Both Guides Share These Principles:

✅ **Codebase is source of truth** (not OpenAPI spec)
✅ **OpenAPI is reference only** (variances are informational)
✅ **Focus on code quality** (type safety, security, error handling)
✅ **Provide actionable fixes** (with ready-to-use prompts)
✅ **Clear prioritization** (Blockers → Warnings → Enhancements)

### When in Doubt:

**Does this part have:**

- Pages? (`app/**/*.tsx`)
- Components? (`components/**/*.tsx`)
- Styling? (Tailwind, shadcn/ui)
- Dashboard UI?

**YES →** Use Frontend Validation
**NO →** Use Backend Validation

---

## Quick Reference

**Backend Parts (6):** 1, 2, 3, 4, 6, 7
**Frontend Parts (14):** 5, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17A, 17B, 18, 19

**Total Parts:** 20 (6 backend + 14 frontend)

---

**END OF SELECTION REFERENCE**
