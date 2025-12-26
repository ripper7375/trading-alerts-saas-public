# Backend & Infrastructure Pre-Localhost Testing Guide

## 🚨 CRITICAL ARCHITECTURAL CONSTRAINTS

### **DIRECTORY STRUCTURE - ABSOLUTELY NO CHANGES ALLOWED**

```
✅ CORRECT (Next.js Route Group Syntax):
app/(marketing)/pricing/page.tsx → URL: /pricing
app/(dashboard)/alerts/page.tsx → URL: /alerts
app/(dashboard)/admin/page.tsx → URL: /admin

❌ FORBIDDEN - DO NOT CREATE:
app/marketing/pricing/page.tsx
app/dashboard/alerts/page.tsx
app/dashboard/admin/page.tsx
```

**YOU MUST:**

- ✅ ONLY validate files INSIDE `app/(dashboard)/` and `app/(marketing)/`
- ✅ Keep the parentheses: `(dashboard)` and `(marketing)` - this is Next.js route group syntax
- ✅ NEVER suggest creating `app/dashboard/` or `app/marketing/` directories
- ✅ NEVER suggest deleting existing files from `app/(dashboard)/` or `app/(marketing)/`
- ✅ Structure must be maintained exactly as designed

**IF YOU FIND `app/dashboard/` in files list → FLAG AS CRITICAL ERROR**
**IF YOU SUGGEST CREATING `app/dashboard/` → YOU FAILED THE VALIDATION**

**This is a VALIDATION task - you are reviewing code quality, NOT modifying directory structure.**

---

## Overview

This document provides comprehensive methodology for Backend and Infrastructure validation before local deployment testing. The validation is conducted in two phases:

- **Phase 1: Static Validation** - Code structure, configuration, and implementation quality (10 steps)
- **Phase 2: Automated Pre-Flight Checks** - Code quality validation without runtime (3 steps)

This methodology applies to **backend-only** parts of the Trading Alerts SaaS platform:

- **Part 1**: Foundation (config files only)
- **Part 2**: Database (Prisma schema only)
- **Part 3**: Types (TypeScript types only)
- **Part 4**: Tier System (lib/tier logic only)
- **Part 6**: Flask MT5 Service (Python framework only)
- **Part 7**: Indicators API (API routes only)

---

## ⚠️ CRITICAL VALIDATION PRINCIPLES

### Principle 1: Backend-Focused Validation

This validation focuses EXCLUSIVELY on backend concerns:

✅ **Configuration Files** (Part 1)

- Environment configuration
- TypeScript/ESLint/Prettier config
- Build configuration
- Package dependencies

✅ **Database Schema** (Part 2)

- Prisma schema correctness
- Model relationships
- Indexes and constraints
- Migration files

✅ **Type System** (Part 3)

- TypeScript type definitions
- Type safety and consistency
- No 'any' types
- Proper interface definitions

✅ **Business Logic Libraries** (Part 4)

- Utility functions correctness
- Business logic implementation
- Error handling
- Unit test coverage

✅ **Python Backend Services** (Part 6)

- Flask application structure
- API endpoint implementation
- MT5 integration logic
- Python code quality

✅ **API Implementation** (Part 7)

- API route handlers
- Request/response validation
- Error handling
- Authentication/authorization

❌ **NOT Validated** (These are Frontend concerns):

- UI components
- Pages and layouts
- Styling systems (Tailwind/shadcn)
- Dashboard components
- Interactive elements
- Navigation/routing

### Principle 2: Codebase is Source of Truth

**Same principle as Frontend validation:**

- OpenAPI specifications are REFERENCE documents, NOT compliance requirements
- Validate actual code quality based on implementation
- Document variances from specs as informational notes
- Focus on code quality, security, and maintainability

---

## Input Requirements

You will receive two documents:

1. **List of Files Completion** - A markdown file listing all files for a specific part
   - Format: `part-[XX]-files-completion.md`
   - Example: `part-02-database-files-completion.md`

2. **OpenAPI Specification** (if applicable) - A YAML file defining the API contract
   - Format: `part-[XX]-[name]-openapi.yaml`
   - Example: `part-07-indicators-api-openapi.yaml`
   - **Note**: Not all backend parts have OpenAPI specs (e.g., Part 1, 2, 3, 4)

---

## Phase 1: Static Validation

### Step 1: Parse Files Completion List

**Objective:** Analyze the provided files completion list and categorize files.

**Actions:**

1. Read the files completion markdown document
2. Extract all file paths listed
3. Count total number of files
4. Identify file types (config, schema, types, lib, routes, etc.)
5. **🚨 CRITICAL: Verify directory structure compliance**

**🔴 DIRECTORY STRUCTURE VALIDATION (CRITICAL):**

Check for forbidden directory patterns:

- [ ] NO files in `app/dashboard/` (without parentheses)
- [ ] NO files in `app/marketing/` (without parentheses)
- [ ] ALL route files are in `app/(dashboard)/` or `app/(marketing)/` (with parentheses)
- [ ] Route group syntax is preserved

**If you find violations:**

```
🔴 CRITICAL STRUCTURAL VIOLATION DETECTED

Found: app/dashboard/admin/page.tsx
Should be: app/(dashboard)/admin/page.tsx

This violates Next.js route group architecture.
The parentheses are REQUIRED and intentional.

DO NOT PROCEED WITH VALIDATION - FLAG THIS IMMEDIATELY
```

**Output:** Summary of file inventory + Directory structure compliance check

---

### Step 2: Categorize Files by Type

**Objective:** Group files by their function and purpose.

**File Categories for Backend Parts:**

#### Configuration Files (Part 1)

- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `next.config.js` - Next.js configuration
- `.eslintrc.json` - Linting rules
- `.prettierrc` - Code formatting
- `.env.example` - Environment variables template
- `tailwind.config.ts` - Styling config (if present)
- `components.json` - shadcn/ui config (if present)

#### Database Files (Part 2)

- `prisma/schema.prisma` - Database schema
- `prisma/migrations/*` - Migration files
- `lib/prisma.ts` - Prisma client singleton
- Database seed files (if any)

#### Type Definition Files (Part 3)

- `types/**/*.d.ts` - Global type definitions
- `types/**/*.ts` - Type utility files
- Interface definitions
- Enum definitions

#### Business Logic Libraries (Part 4)

- `lib/**/*.ts` - Utility functions
- Business logic modules
- Helper functions
- Constants and configurations

#### Python Services (Part 6)

- `flask-mt5-service/**/*.py` - Flask application
- API routes
- MT5 integration modules
- Configuration files
- Requirements files

#### API Routes (Part 7)

- `app/api/**/*.ts` - API route handlers
- Middleware files
- Validation schemas
- Response types

**Output:** Categorized file lists with counts

---

### Step 3: Parse OpenAPI Specification (If Applicable)

**Objective:** Extract API contract details (for Parts 6 and 7 only).

**IMPORTANT:** Same principle as Frontend - OpenAPI is REFERENCE only.

**Actions:**

1. Check if OpenAPI spec exists for this part
2. If yes, extract all endpoints
3. Document intended API design
4. Use as comparison reference, NOT as strict requirement

**Output:** OpenAPI Reference Summary (informational only)

---

### Step 4: Configuration Validation (Part 1)

**Objective:** Validate all configuration files are correct and complete.

**Validation Checks:**

#### 4.1 Package Dependencies

- [ ] `package.json` exists and is valid JSON
- [ ] All required dependencies listed
- [ ] No conflicting dependency versions
- [ ] Scripts defined (dev, build, lint, test)
- [ ] Engines specified (Node version)

**Check for:**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "jest"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

#### 4.2 TypeScript Configuration

- [ ] `tsconfig.json` exists and is valid
- [ ] Strict mode enabled
- [ ] Proper paths/aliases configured
- [ ] Output directory configured
- [ ] Include/exclude patterns correct

**Critical settings:**

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2020",
    "lib": ["ES2020"],
    "moduleResolution": "bundler",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

#### 4.3 Linting Configuration

- [ ] `.eslintrc.json` exists
- [ ] Extends proper configs (next/core-web-vitals)
- [ ] Custom rules defined (if needed)
- [ ] Ignored files configured

#### 4.4 Environment Variables

- [ ] `.env.example` exists and is complete
- [ ] All required variables documented
- [ ] Variable descriptions/comments present
- [ ] No sensitive data in example file
- [ ] Validation for required env vars

**Required variables:**

```bash
# Database
DATABASE_URL=

# Authentication
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# OAuth (if applicable)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Email (if applicable)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
```

#### 4.5 Build Configuration

- [ ] `next.config.js` exists
- [ ] Proper configuration options
- [ ] Environment variables properly handled
- [ ] Security headers configured (if needed)

**Output:** Configuration Validation Report

---

### Step 5: Database Schema Validation (Part 2)

**Objective:** Validate Prisma schema correctness and quality.

**Validation Checks:**

#### 5.1 Schema File Validation

- [ ] `prisma/schema.prisma` exists
- [ ] Valid Prisma schema syntax
- [ ] Database provider configured
- [ ] Generator configuration present

**Basic structure:**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

#### 5.2 Model Definitions

- [ ] All required models defined
- [ ] Field types are appropriate
- [ ] Required fields marked with `@default` or proper validation
- [ ] Optional fields marked with `?`
- [ ] ID fields properly configured

**For each model, check:**

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

#### 5.3 Relationships

- [ ] One-to-one relationships configured correctly
- [ ] One-to-many relationships have proper foreign keys
- [ ] Many-to-many relationships use join tables
- [ ] Cascade delete behavior defined where appropriate
- [ ] Referential integrity maintained

**Relationship patterns:**

```prisma
model User {
  id       String   @id
  alerts   Alert[]  // One-to-many
}

model Alert {
  id       String   @id
  userId   String
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

#### 5.4 Indexes and Constraints

- [ ] Unique constraints on appropriate fields
- [ ] Composite unique constraints where needed
- [ ] Indexes on frequently queried fields
- [ ] Foreign key indexes exist

**Index examples:**

```prisma
model Alert {
  userId    String
  symbol    String
  createdAt DateTime

  @@unique([userId, symbol])
  @@index([userId, createdAt])
}
```

#### 5.5 Enums and Types

- [ ] Enums defined for fixed value sets
- [ ] Enum values are appropriate
- [ ] No magic strings/numbers

```prisma
enum UserRole {
  USER
  ADMIN
}

enum SubscriptionTier {
  FREE
  PRO
}
```

#### 5.6 Migrations

- [ ] Migration files exist in `prisma/migrations/`
- [ ] Migrations are sequential and named
- [ ] No conflicting migrations
- [ ] Initial migration present

#### 5.7 Prisma Client Setup

- [ ] `lib/prisma.ts` exists
- [ ] Singleton pattern implemented (prevents multiple instances)
- [ ] Proper error handling

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['query'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

**Output:** Database Schema Validation Report

---

### Step 6: Type System Validation (Part 3)

**Objective:** Validate TypeScript type definitions are comprehensive and correct.

**Validation Checks:**

#### 6.1 Type Definition Files Inventory

- [ ] All `.d.ts` files in `types/` directory
- [ ] Global type augmentations (next-auth.d.ts, etc.)
- [ ] Shared type definitions
- [ ] Enum definitions

#### 6.2 Type Quality Checks

- [ ] No usage of `any` type (use `unknown` instead)
- [ ] Proper use of generics
- [ ] Interface vs Type usage is appropriate
- [ ] Type guards defined where needed
- [ ] Utility types used correctly (Partial, Pick, Omit, etc.)

#### 6.3 NextAuth Type Augmentation (if applicable)

- [ ] `types/next-auth.d.ts` exists
- [ ] Session and JWT types extended
- [ ] Custom user properties defined

```typescript
// types/next-auth.d.ts
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      tier: 'FREE' | 'PRO';
      role: 'USER' | 'ADMIN';
    } & DefaultSession['user'];
  }
}
```

#### 6.4 API Types

- [ ] Request body types defined
- [ ] Response types defined
- [ ] Error types defined
- [ ] Types match Prisma models where applicable

#### 6.5 Shared Types

- [ ] Common types exported from single location
- [ ] No duplicate type definitions
- [ ] Types are reusable across codebase

**Output:** Type System Validation Report

---

### Step 7: Business Logic Validation (Part 4)

**Objective:** Validate utility libraries and business logic implementation.

**Validation Checks:**

#### 7.1 Library Files Inventory

- [ ] All utility files in `lib/` directory
- [ ] Proper module organization
- [ ] No circular dependencies

#### 7.2 Tier System Logic (Part 4 Specific)

- [ ] Tier constants defined (FREE, PRO)
- [ ] Tier validation functions
- [ ] Tier-based feature checks
- [ ] Tier upgrade/downgrade logic

**Example validation:**

```typescript
// lib/tier.ts
export const TIERS = {
  FREE: 'FREE',
  PRO: 'PRO',
} as const;

export type Tier = (typeof TIERS)[keyof typeof TIERS];

export function canAccessFeature(userTier: Tier, requiredTier: Tier): boolean {
  // Implementation
}
```

#### 7.3 Function Quality

- [ ] Functions are pure where possible
- [ ] Proper error handling (try/catch)
- [ ] Input validation
- [ ] Return types explicitly defined
- [ ] JSDoc comments for complex functions

#### 7.4 Constants and Configuration

- [ ] Constants defined in appropriate files
- [ ] No magic numbers/strings
- [ ] Configuration values properly typed

#### 7.5 Utility Functions

- [ ] Email validation utilities
- [ ] Date formatting utilities
- [ ] String manipulation utilities
- [ ] Data transformation utilities
- [ ] Error handling utilities

**Output:** Business Logic Validation Report

---

### Step 8: Python Service Validation (Part 6)

**Objective:** Validate Flask MT5 service implementation.

**Validation Checks:**

#### 8.1 Flask Application Structure

- [ ] `app.py` or `__init__.py` exists
- [ ] Flask app properly initialized
- [ ] Configuration loaded correctly
- [ ] Blueprints registered (if used)

#### 8.2 Dependencies

- [ ] `requirements.txt` exists
- [ ] All required packages listed with versions
- [ ] Compatible package versions

**Expected packages:**

```txt
Flask==3.0.0
Flask-CORS==4.0.0
MetaTrader5==5.0.45
python-dotenv==1.0.0
```

#### 8.3 MT5 Integration

- [ ] MT5 initialization code present
- [ ] MT5 connection handling
- [ ] MT5 error handling
- [ ] Account credentials management

#### 8.4 API Endpoints

- [ ] RESTful route definitions
- [ ] Request validation
- [ ] Response formatting
- [ ] Error responses

#### 8.5 Code Quality

- [ ] PEP 8 compliance (Python style guide)
- [ ] Proper exception handling
- [ ] Type hints used (Python 3.7+)
- [ ] Docstrings present

```python
from typing import Dict, List, Optional
from flask import Flask, jsonify, request

@app.route('/api/mt5/symbols', methods=['GET'])
def get_symbols() -> Dict:
    """
    Retrieve available trading symbols from MT5.

    Returns:
        Dict: JSON response with symbols list
    """
    try:
        # Implementation
        return jsonify({"symbols": symbols})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
```

#### 8.6 Configuration

- [ ] Environment variables for sensitive data
- [ ] Configuration file structure
- [ ] Different configs for dev/prod

**Output:** Python Service Validation Report

---

### Step 9: API Routes Validation (Part 7)

**Objective:** Validate API route implementations.

**Validation Checks:**

#### 9.1 Route File Structure

- [ ] Routes organized in `app/api/` directory
- [ ] Proper Next.js App Router structure
- [ ] `route.ts` files for endpoints

#### 9.2 HTTP Methods Implementation

- [ ] GET handlers for data retrieval
- [ ] POST handlers for data creation
- [ ] PUT/PATCH handlers for updates
- [ ] DELETE handlers for deletion
- [ ] Proper HTTP status codes

#### 9.3 Request Validation

- [ ] Input validation present (Zod recommended)
- [ ] Type safety for request bodies
- [ ] Query parameter validation
- [ ] Path parameter validation

```typescript
import { z } from 'zod';

const requestSchema = z.object({
  symbol: z.string().min(1),
  interval: z.enum(['M1', 'M5', 'M15', 'M30', 'H1']),
});

export async function POST(request: Request) {
  const body = await request.json();
  const result = requestSchema.safeParse(body);

  if (!result.success) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  // Process request
}
```

#### 9.4 Response Formatting

- [ ] Consistent response structure
- [ ] Proper error responses
- [ ] Success responses well-typed
- [ ] HTTP headers set correctly

#### 9.5 Authentication & Authorization

- [ ] Protected routes use auth middleware
- [ ] Session validation implemented
- [ ] Role-based access control
- [ ] API key validation (if applicable)

#### 9.6 Error Handling

- [ ] Try/catch blocks present
- [ ] Specific error messages
- [ ] Error logging
- [ ] Graceful degradation

#### 9.7 Performance Considerations

- [ ] Database queries optimized
- [ ] Response caching (if applicable)
- [ ] Rate limiting considered
- [ ] No N+1 query problems

**Output:** API Routes Validation Report

---

### Step 10: OpenAPI Comparison (If Applicable)

**Objective:** Compare actual implementation with OpenAPI spec.

**IMPORTANT:** This is INFORMATIONAL ONLY - same as Frontend validation.

**Comparison Areas:**

#### 10.1 Endpoint Coverage

- Document endpoints in spec vs code
- Note undocumented features (VALID)
- Note planned features not yet implemented (VALID)

#### 10.2 Request/Response Variance

- Compare actual vs specified schemas
- Document improvements to spec (VALID)
- Note breaking changes (if any)

#### 10.3 Recommendations

- Suggest spec updates to match reality
- Document intentional deviations

**Output:** OpenAPI vs Reality Comparison Report (informational)

---

## Phase 2: Automated Pre-Flight Checks

### Step 11: TypeScript Compilation Check

**Objective:** Validate TypeScript code compiles without errors.

**Command to Simulate:**

```bash
npx tsc --noEmit --project tsconfig.json
```

**Validation Checks:**

- [ ] No TypeScript compilation errors
- [ ] All imports resolve correctly
- [ ] Type definitions are complete
- [ ] No implicit `any` types (if strict mode enabled)
- [ ] Generic types properly constrained

**Output:** TypeScript Validation Report

**Report Structure:**

```markdown
### TypeScript Compilation Status: [PASS/FAIL]

#### Compilation Summary

- Total files checked: [X]
- Errors found: [X]
- Warnings: [X]

#### Issues Found (if any)

1. [File path] - [Error message]
   - Line: [X]
   - Issue: [Description]
   - Fix: [Recommendation]

#### Recommendations

- [List of improvements]
```

---

### Step 12: Linting Validation

**Objective:** Ensure code follows best practices.

**Command to Simulate:**

```bash
npm run lint
# or
npx eslint . --ext .ts,.tsx,.py
```

**Validation Checks:**

#### For TypeScript/JavaScript:

- [ ] No unused variables/imports
- [ ] No console.log statements (except intended)
- [ ] Proper error handling
- [ ] Consistent naming conventions

#### For Python (Part 6):

- [ ] PEP 8 compliance
- [ ] No unused imports
- [ ] Proper naming conventions
- [ ] Docstring presence

**Output:** Linting Validation Report

---

### Step 13: Build Test Validation

**Objective:** Verify the project can build successfully.

**For TypeScript/Next.js parts:**

```bash
npm run build
```

**For Python parts:**

```bash
python -m py_compile *.py
```

**Validation Checks:**

- [ ] Build completes without errors
- [ ] No critical warnings
- [ ] All dependencies resolve
- [ ] No circular dependencies

**Output:** Build Validation Report

---

## Report Generation Instructions

### Master Validation Report

```markdown
# Part [XX] - [Part Name] Backend Validation Report

**Generated:** [Timestamp]
**Status:** [PASS/FAIL/PARTIAL]
**Part Type:** [Configuration/Database/Types/Library/Python Service/API]

---

## Executive Summary

- Total Files: [X]
- File Categories:
  - Configuration files: [X]
  - Schema files: [X]
  - Type definition files: [X]
  - Library files: [X]
  - Python files: [X]
  - API route files: [X]

### Overall Health Score: [X]/100

#### Score Breakdown

- Configuration Quality: [X]/20 (Part 1)
- Database Schema Quality: [X]/25 (Part 2)
- Type System Quality: [X]/25 (Part 3)
- Business Logic Quality: [X]/20 (Part 4)
- Python Service Quality: [X]/25 (Part 6)
- API Implementation Quality: [X]/25 (Part 7)
- TypeScript Quality: [X]/15
- Linting: [X]/10
- Build Success: [X]/5

---

## Phase 1: Static Validation Results

### 1. File Inventory

[Categorized file lists]

### 2. [Part-Specific Validation]

- Part 1: Configuration Validation
- Part 2: Database Schema Validation
- Part 3: Type System Validation
- Part 4: Business Logic Validation
- Part 6: Python Service Validation
- Part 7: API Routes Validation

### 3. OpenAPI Comparison (if applicable)

[Informational only - variances documented, not penalized]

---

## Phase 2: Automated Pre-Flight Results

### 4. TypeScript Validation

[TypeScript compilation report]

### 5. Linting Validation

[Linting report]

### 6. Build Validation

[Build report]

---

## Critical Issues Summary

### 🔴 Blockers (Must Fix Before Localhost)

1. [Issue description]
   - Severity: CRITICAL
   - Category: [Config/Database/Types/Logic/Python/API]
   - File: [path]
   - Fix: [recommendation]

### 🟡 Warnings (Should Fix)

1. [Issue description]
   - Severity: MEDIUM
   - File: [path]
   - Fix: [recommendation]

### 🟢 Enhancements (Nice to Have)

1. [Issue description]
   - Severity: LOW
   - File: [path]
   - Fix: [recommendation]

### ℹ️ Informational (OpenAPI Variances)

1. [Variance description]
   - Not an error - documentation only

---

## Localhost Testing Readiness

### Prerequisites Checklist

- [ ] Configuration files are valid
- [ ] TypeScript compiles without errors
- [ ] Linting passes
- [ ] Build succeeds
- [ ] No critical security issues
- [ ] [Part-specific requirements]

### Part-Specific Readiness

**For Part 1 (Foundation):**

- [ ] All configs validated
- [ ] Dependencies installed
- [ ] Environment variables documented

**For Part 2 (Database):**

- [ ] Prisma schema valid
- [ ] Migrations present
- [ ] Prisma client generated

**For Part 3 (Types):**

- [ ] All types defined
- [ ] No 'any' types in critical paths
- [ ] Type augmentations correct

**For Part 4 (Tier System):**

- [ ] Business logic implemented
- [ ] Validation functions present
- [ ] Error handling complete

**For Part 6 (Flask MT5):**

- [ ] Flask app structure correct
- [ ] MT5 integration implemented
- [ ] Python dependencies installed

**For Part 7 (Indicators API):**

- [ ] All endpoints implemented
- [ ] Request validation present
- [ ] Error handling complete

---

## Next Steps

### Before Localhost Testing

1. Fix all 🔴 CRITICAL BLOCKERS
2. Run re-validation
3. Verify [part-specific requirements]

### During Localhost Testing

1. [Part-specific test scenarios]

### After Localhost Testing

1. Document runtime issues
2. Update documentation

---

## Appendices

### A. Complete File Listing

[Full list of all files]

### B. Configuration Details

[Complete configuration documentation]

### C. Schema/Types Reference

[Database schema or type definitions]

### D. API Reference (if applicable)

[Actual API documentation based on code]
```

---

## Detailed Report Templates

### Part 1: Configuration Validation Report

```markdown
# Configuration Validation Report

## 1. Package Configuration

**File:** `package.json`
**Status:** [✅ VALID / ⚠️ ISSUES / ❌ MISSING]

### Dependencies Analysis

- Total dependencies: [X]
- Dev dependencies: [X]
- Outdated packages: [X]
- Security vulnerabilities: [X]

### Scripts Validation

- [x] dev script present
- [x] build script present
- [x] start script present
- [x] lint script present
- [ ] test script present

**Issues:**

1. [Issue description]

---

## 2. TypeScript Configuration

**File:** `tsconfig.json`
**Status:** [✅ VALID / ⚠️ ISSUES / ❌ MISSING]

### Compiler Options

- Strict mode: [✅ Enabled / ❌ Disabled]
- Target: [ES2020]
- Module resolution: [bundler]
- Path aliases: [✅ Configured / ❌ Missing]

**Issues:**

1. [Issue description]

---

## 3. Environment Variables

**File:** `.env.example`
**Status:** [✅ COMPLETE / ⚠️ PARTIAL / ❌ MISSING]

### Required Variables

- [ ] DATABASE_URL
- [ ] NEXTAUTH_SECRET
- [ ] NEXTAUTH_URL
- [ ] [Other variables]

**Missing:**

1. [Variable name] - [Description]

---

## Summary

**Overall Config Health:** [X]/100
**Readiness:** [READY / NEEDS FIXES / BLOCKED]
```

---

### Part 2: Database Schema Validation Report

```markdown
# Database Schema Validation Report

## 1. Schema File Validation

**File:** `prisma/schema.prisma`
**Status:** [✅ VALID / ⚠️ ISSUES / ❌ INVALID]

### Basic Configuration

- [x] Generator configured
- [x] Datasource configured
- [x] Provider: PostgreSQL

---

## 2. Models Analysis

**Total Models:** [X]

| Model   | Fields | Relationships | Indexes | Status     |
| ------- | ------ | ------------- | ------- | ---------- |
| User    | 10     | 3             | 2       | ✅         |
| Alert   | 8      | 2             | 3       | ✅         |
| [Model] | [X]    | [X]           | [X]     | [✅/⚠️/❌] |

---

## 3. Relationships Validation

### One-to-Many

- User → Alerts: ✅ Correct
- User → Sessions: ✅ Correct

### Many-to-Many

- [Relationship]: [✅/⚠️/❌]

**Issues:**

1. [Issue description]

---

## 4. Indexes and Performance

### Indexed Fields

- User.email (unique): ✅
- Alert.userId: ✅
- Alert.createdAt: ⚠️ Missing

**Recommendations:**

1. Add index on frequently queried fields

---

## 5. Migrations

**Total Migrations:** [X]
**Latest Migration:** [Name/Date]

- [x] Initial migration present
- [x] Sequential migrations
- [ ] Migration conflicts

---

## Summary

**Schema Health:** [X]/100
**Readiness:** [READY / NEEDS FIXES / BLOCKED]
```

---

### Part 3: Type System Validation Report

```markdown
# Type System Validation Report

## 1. Type Definition Files

**Total Files:** [X]

| File                 | Purpose               | Status |
| -------------------- | --------------------- | ------ |
| types/next-auth.d.ts | NextAuth augmentation | ✅     |
| types/api.d.ts       | API types             | ✅     |
| types/database.d.ts  | DB types              | ⚠️     |

---

## 2. Type Quality Analysis

### No 'any' Type Usage

- Total 'any' occurrences: [X]
- Critical path 'any' usage: [X]

**Violations:**

1. File: [path] - Line: [X] - Should use: [recommendation]

---

## 3. Type Coverage

- Functions with return types: [X]%
- Function parameters typed: [X]%
- Interface completeness: [X]%

---

## 4. Type Augmentation

### NextAuth Types

- [x] Session extended
- [x] User extended
- [x] JWT extended

**Quality:** [✅ Complete / ⚠️ Partial / ❌ Missing]

---

## Summary

**Type System Health:** [X]/100
**Readiness:** [READY / NEEDS FIXES / BLOCKED]
```

---

## Actionable Fixes & Next Steps Document

```markdown
# Part [XX] - Actionable Fixes & Next Steps

**Generated:** [Timestamp]
**Overall Status:** [READY/NEEDS_FIXES/BLOCKED]
**Part Type:** [Configuration/Database/Types/Library/Python/API]

---

## Executive Summary

**Current Health Score:** [X]/100

**Status Breakdown:**

- 🔴 Critical Blockers: [X]
- 🟡 Warnings: [X]
- 🟢 Enhancements: [X]
- ℹ️ Informational Notes: [X]

**Estimated Fix Time:** [X hours]

**Localhost Ready:** [YES/NO]

---

## 🔴 CRITICAL BLOCKERS

### 🚨 STRUCTURAL VIOLATION (If Found)

**Issue:**
Files are placed in incorrect directory structure (e.g., `app/dashboard/` instead of `app/(dashboard)/`)

**Impact:**

- Severity: CRITICAL - STRUCTURAL VIOLATION
- Affects: Next.js routing, entire application architecture
- Blocks: ALL functionality - this breaks the route group pattern

**Location:**

- Incorrect: `app/dashboard/[file]`
- Should be: `app/(dashboard)/[file]`

**FORBIDDEN PATTERNS:**
```

❌ app/dashboard/alerts/page.tsx
❌ app/dashboard/admin/page.tsx
❌ app/marketing/pricing/page.tsx

```

**REQUIRED PATTERNS:**
```

✅ app/(dashboard)/alerts/page.tsx
✅ app/(dashboard)/admin/page.tsx
✅ app/(marketing)/pricing/page.tsx

```

**Required Fix:**
```

THIS IS NOT A CODE FIX - THIS IS A STRUCTURAL ERROR

The files list provided contains incorrect directory structure.
This must be corrected in the source files completion document.

DO NOT proceed with validation until structure is corrected.

````

**Critical Instructions:**
1. **STOP VALIDATION IMMEDIATELY**
2. Inform the user that the directory structure violates Next.js route group architecture
3. Provide list of all incorrectly placed files
4. Request corrected files completion list before proceeding

**Validation After Fix:**
- [ ] ALL route files use `(dashboard)` or `(marketing)` with parentheses
- [ ] NO files exist in `app/dashboard/` or `app/marketing/` without parentheses
- [ ] Structure matches Next.js route group pattern

---

### Blocker #1: [Issue Title]

**Issue:**
[Clear description]

**Impact:**
- Severity: CRITICAL
- Affects: [Functionality]
- Blocks: [What can't work without this]

**Location:**
- File: `[file path]`
- Line: [line number]

**Current Code:**
```[language]
// Problematic code
````

**Required Fix:**

```[language]
// Corrected code
```

**Step-by-Step Fix:**

1. [Step 1]
2. [Step 2]

**Prompt for Claude Code:**

```
Fix [issue] in [file]:
- [Instruction 1]
- [Instruction 2]
```

**Validation:**

- [ ] [Check 1]
- [ ] [Check 2]

---

## 🟡 WARNINGS

[Same structure as blockers]

---

## 🟢 ENHANCEMENTS

[Same structure]

---

## 📋 FIX CATEGORIES

### Category 1: Configuration Issues (Part 1)

[Batch fix instructions]

### Category 2: Schema Issues (Part 2)

[Batch fix instructions]

### Category 3: Type Issues (Part 3)

[Batch fix instructions]

### Category 4: Logic Issues (Part 4)

[Batch fix instructions]

### Category 5: Python Issues (Part 6)

[Batch fix instructions]

### Category 6: API Issues (Part 7)

[Batch fix instructions]

---

## 🎯 EXECUTION PLAN

### Phase 1: Critical Blockers

**Time:** [X hours]

1. **Session 1:**
   ```
   [Prompt for Claude Code]
   ```

### Phase 2: Warnings

**Time:** [X hours]

[Instructions]

### Phase 3: Enhancements

**Time:** [X hours]

[Instructions]

---

## 📊 PROGRESS TRACKING

- [ ] Blocker #1
- [ ] Blocker #2
- [ ] Warning #1
- [ ] [...]

---

## 🔄 RE-VALIDATION

After fixes, re-run:

**Prompt for Claude Code:**

```
Re-validate Part [XX] after fixes:
- Same files uploaded
- Execute validation again
- Compare health scores
- Confirm issues resolved
```

---

## 🚀 LOCALHOST READINESS

**Status:** [READY / NOT READY]

**If NOT READY:**
Must fix: [X] blockers

**If READY:**
Proceed to localhost testing

**Part-Specific Tests:**

- Part 1: Verify configs load correctly
- Part 2: Run Prisma migrations
- Part 3: TypeScript compilation succeeds
- Part 4: Test business logic functions
- Part 6: Start Flask service
- Part 7: Test API endpoints

---

**End of Actionable Fixes Document**

```

---

## Execution Instructions for Claude Code

When you receive this document:

### 1. Acknowledge Part Type

Confirm which part you're validating:
- Part 1: Configuration
- Part 2: Database
- Part 3: Types
- Part 4: Business Logic
- Part 6: Python Service
- Part 7: API Routes

### 2. Execute Appropriate Validation Steps

**All Parts:** Steps 1-2 (file inventory)

**Part 1:** Step 4 (Configuration)
**Part 2:** Step 5 (Database Schema)
**Part 3:** Step 6 (Type System)
**Part 4:** Step 7 (Business Logic)
**Part 6:** Step 8 (Python Service)
**Part 7:** Step 9 (API Routes)

**If OpenAPI exists:** Step 10 (Comparison - informational)

**All Parts:** Steps 11-13 (TypeScript, Linting, Build)

### 3. Generate Required Reports

Create:
1. Master Validation Report
2. Part-specific detailed report
3. TypeScript/Linting/Build reports
4. Actionable Fixes document

### 4. Focus on Code Quality

Validate:
- Type safety
- Error handling
- Security
- Best practices
- Code organization

### 5. Provide Clear Recommendations

Prioritize:
- 🔴 Critical blockers
- 🟡 Warnings
- 🟢 Enhancements
- ℹ️ Informational notes

---

## Success Criteria

**READY FOR LOCALHOST** when:

✅ TypeScript compiles without errors
✅ Linting passes
✅ Build succeeds
✅ Part-specific requirements met:

**Part 1:**
- All configs valid
- Dependencies correct
- Environment vars documented

**Part 2:**
- Schema is valid
- Migrations present
- Relationships correct

**Part 3:**
- Types complete
- No 'any' in critical paths
- Type augmentations correct

**Part 4:**
- Business logic implemented
- Functions properly typed
- Error handling present

**Part 6:**
- Flask app structure correct
- Dependencies installed
- MT5 integration ready

**Part 7:**
- All endpoints implemented
- Validation present
- Auth configured

---

## Health Score Interpretation

- **90-100**: Excellent - Production ready
- **75-89**: Good - Minor improvements
- **60-74**: Fair - Address warnings
- **Below 60**: Poor - Fix blockers

---

## 🚨 FINAL STRUCTURAL COMPLIANCE CHECK

**Before submitting any validation report:**

1. **Verify NO structural violations exist:**
   - [ ] NO files in `app/dashboard/` (forbidden)
   - [ ] NO files in `app/marketing/` (forbidden)
   - [ ] ALL routes use `app/(dashboard)/` or `app/(marketing)/` (required)

2. **If violations found:**
   - 🔴 FLAG as CRITICAL BLOCKER immediately
   - STOP validation
   - Request corrected files list
   - Do NOT proceed until fixed

3. **In ALL recommendations and fixes:**
   - ✅ NEVER suggest creating `app/dashboard/` directories
   - ✅ NEVER suggest moving files out of `app/(dashboard)/`
   - ✅ ALWAYS preserve the route group parentheses syntax
   - ✅ This is VALIDATION only - NOT restructuring

**Remember: This is a code quality REVIEW, not a restructuring task.**

---

**END OF BACKEND VALIDATION GUIDE**
```
