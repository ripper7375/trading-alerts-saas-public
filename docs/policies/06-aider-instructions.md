# Aider Instructions for MiniMax M2

## Purpose

This document is Aider's "operating manual" - it tells you (Aider with MiniMax M2 API) exactly HOW to work autonomously while building the Trading Alerts SaaS. Follow these instructions precisely to ensure quality, cost-effectiveness, and successful autonomous development.

---

## 1. INITIALIZATION

### 1.1 Files to Load on Startup

When Aider starts (via `.aider.conf.yml`), you automatically load these files:

**Policy Documents (Your Rules) - 9 Total:**

- `docs/policies/00-tier-specifications.md` - Tier system rules (FREE vs PRO)
- `docs/policies/01-approval-policies.md` - When to approve/fix/escalate
- `docs/policies/02-quality-standards.md` - What "good code" looks like
- `docs/policies/03-architecture-rules.md` - System design constraints
- `docs/policies/04-escalation-triggers.md` - When to stop and ask human
- `docs/policies/05-coding-patterns.md` - Copy-paste ready code examples
- `docs/policies/06-aider-instructions.md` - THIS FILE (how to work)
- `docs/policies/07-dlocal-integration-rules.md` - dLocal payment integration (emerging markets)
- `docs/policies/08-google-oauth-implementation-rules.md` - **NEW:** Google OAuth integration (NextAuth v4)
- `docs/policies/09-testing-framework-compliance.md` - **NEW:** ESLint, Jest, TypeScript standards (MANDATORY)

**Quality Rules (Context for Code Generation):**

- `.eslintrc.json` - Linting rules (explicit return types, no any, no console.log)
- `jest.config.js` - Test configuration (coverage thresholds, naming conventions)
- `tsconfig.json` - TypeScript compiler options (strict mode)
- `docs/aider-context/quality-rules-summary.md` - Quick reference for all quality gates

**Project Specifications:**

- `docs/v5-structure-division.md` - Part structure overview (18 parts, 170+ files)
- `docs/build-orders/part-XX-[name].md` - **PRIMARY:** File-by-file build sequences (18 files)
- `docs/implementation-guides/v5_part_*.md` - **REFERENCE:** Business logic and requirements
- `docs/trading_alerts_openapi.yaml` - Next.js API contract (v7.1.0 with OAuth)
- `docs/flask_mt5_openapi.yaml` - Flask MT5 API contract
- `docs/decisions/google-oauth-decisions.md` - OAuth architecture decisions
- `docs/OAUTH_IMPLEMENTATION_READY.md` - OAuth handoff document

**Seed Code (Reference Only):**

- `seed-code/market_ai_engine.py` - Flask/MT5 patterns

**Progress Tracking:**

- `PROGRESS.md` - Track completed files, escalations, time

---

### 1.2 Understanding Your Context

You are working with:

- **User:** Beginner developer learning SaaS development
- **Goal:** Build Trading Alerts SaaS (170+ files)
- **Your Role:** Autonomous builder with MiniMax M2 (cost-effective AI model)
- **Human's Role:** Handles escalations, makes decisions, tests
- **Model:** MiniMax M2 API (via OpenAI-compatible endpoint)

**Key Constraints:**

- FREE tier: 5 symbols × 3 timeframes (BTCUSD, EURUSD, USDJPY, US30, XAUUSD) × (H1, H4, D1)
- PRO tier: 15 symbols × 9 timeframes (all symbols) × (M5-D1)
- Next.js 15 + React 19 + TypeScript + Prisma + PostgreSQL
- Flask + MT5 for market data
- Deployment: Vercel (Next.js) + Railway (PostgreSQL + Flask)

---

## 2. SEED CODE USAGE

### 2.1 When to Reference Seed Code

Seed code = **inspiration and patterns**, NOT copy/paste!

**market_ai_engine.py:**

- **Use for:** Part 6 (Flask MT5 Service)
- **Reference:** Flask route patterns, MT5 API usage, indicator fetching logic
- **Adapt, don't copy:** Use as pattern reference, customize for our OpenAPI spec

**Important:** Always adapt seed code to:

- Match our OpenAPI contracts (trading_alerts_openapi.yaml, flask_mt5_openapi.yaml)
- Follow our tier system (FREE: 5×3, PRO: 15×9)
- Use our specific business logic
- Match our quality standards from 02-quality-standards.md

---

## 3. PRE-GENERATION QUALITY CHECKLIST (MANDATORY)

### 3.1 Before Generating ANY Code File

**⚠️ CRITICAL:** Run through this checklist BEFORE writing code to ensure first-pass CI/CD success.

#### Quality Gates Checklist

- [ ] **Review ESLint Rules** (`.eslintrc.json`)
  - What return type rules are active?
  - Are `any` types forbidden?
  - Are console statements allowed?

- [ ] **Review Jest Config** (`jest.config.js`)
  - What are current coverage thresholds?
  - Check existing package names for uniqueness
  - What naming convention is used?

- [ ] **Review TypeScript Config** (`tsconfig.json`)
  - Is strict mode enabled?
  - What compiler options are set?

- [ ] **Plan Function Signatures**
  - What are all parameter types?
  - What are all return types?
  - Are there any async functions?

- [ ] **Identify Required Interfaces**
  - What TypeScript types need to be defined?
  - Are there Prisma types to import?
  - Do we need to create new interfaces?

- [ ] **Consider Testability**
  - Is the code modular enough to test?
  - Are functions < 50 lines?
  - Can dependencies be mocked?

- [ ] **Verify No Debug Code**
  - Remove all console.log statements
  - Remove commented-out code
  - Remove TODO comments (or document them properly)

### 3.2 Quality Rules Quick Reference

See `docs/aider-context/quality-rules-summary.md` for compact reference, or `docs/policies/09-testing-framework-compliance.md` for complete rules.

**Most Common Violations to Avoid:**

1. Missing return types: `function foo()` → `function foo(): Promise<Data>`
2. Using `any` type: `results: any` → `results: SeedResults`
3. Console statements: `console.log()` → Remove or use `console.error()`
4. Duplicate package names: `"my-v0-project"` → `"alert-card-component"`

---

## 4. WORKFLOW FOR EACH FILE

Follow this **exact workflow** for every file you build:

### STEP 1: READ REQUIREMENTS

```
1. Read v5-structure-division.md for:
   - Part structure overview
   - Which part this file belongs to (Part 1-18)

2. Read build-order file for file-by-file sequence:
   - docs/build-orders/part-XX-[name].md (where XX is your current part)
   - EXACT file to build (e.g., "File 3/12: app/api/alerts/route.ts")
   - Build sequence (this is file 3 of 12 in this part)
   - Dependencies (what files must exist before building this one)
   - Pattern reference (which coding pattern to use)
   - OpenAPI reference (which schemas apply)
   - Seed code reference (which examples to look at)

3. Read implementation guide for business context:
   - docs/implementation-guides/v5_part_X.md (where X is your current part)
   - Business requirements and logic
   - Tier validation rules
   - Feature descriptions
   - UI/UX requirements
   - Special business rules

4. Read OpenAPI spec for API contracts:
   - API contract (request/response structure)
   - Required fields
   - Status codes
   - Types

5. **Check seed code for implementation patterns:**
   Use docs/SEED-CODE-REFERENCE-GUIDE.md to quickly find relevant examples

   Based on your file type, reference:

   Authentication files?
   → seed-code/saas-starter/app/(login)/*
   → seed-code/next-shadcn-dashboard-starter/src/app/auth/*

   Dashboard pages?
   → seed-code/saas-starter/app/(dashboard)/*
   → seed-code/v0-components/layouts/*

   API routes?
   → seed-code/saas-starter/app/api/user/route.ts
   → seed-code/saas-starter/app/api/stripe/*

   Forms?
   → seed-code/next-shadcn-dashboard-starter/src/components/forms/*

   Billing/subscription?
   → seed-code/saas-starter/app/(dashboard)/pricing/*
   → seed-code/saas-starter/app/api/stripe/*

   UI components?
   → seed-code/v0-components/*
   → seed-code/next-shadcn-dashboard-starter/src/components/layout/*

   Flask/MT5?
   → seed-code/market_ai_engine.py

   Extract from seed code:
   - Overall component/route structure
   - Error handling patterns
   - Validation approach (Zod schemas)
   - Loading state implementation
   - TypeScript type usage
   - Database query patterns

6. Read 05-coding-patterns.md for code templates:
   - Code templates specific to our project
   - Tier validation patterns
   - Pattern specified in build-order file (step 2)

7. **Check for SystemConfig Usage (Dynamic Configuration):**

   If building affiliate-related features (pricing, billing, admin settings, affiliate dashboard):

   **CRITICAL - Check if SystemConfig should be used:**
   - ✅ Frontend: Use `useAffiliateConfig()` hook for discount/commission percentages
   - ✅ Backend: Read from `SystemConfig` table for code generation
   - ❌ NEVER hardcode 20%, 20.0, or any affiliate percentages
   - 📖 Reference: `docs/SYSTEMCONFIG-USAGE-GUIDE.md`

   **Why this matters:** Admin can change affiliate percentages from dashboard without code deployment.
   All pages must reflect these changes automatically (within 1-5 minutes via SWR cache).

   **Files that MUST use SystemConfig:**
   - Any pricing page component
   - Affiliate dashboard pages
   - Admin affiliate settings pages
   - API routes that generate affiliate codes
   - Email templates mentioning commission/discount

   **Quick check:**
   - Does this file display or calculate discount/commission percentages?
   - Does this file generate new affiliate codes?
   - If YES to either → Use SystemConfig patterns from 01-approval-policies.md section 7.8
```

**IMPORTANT:** Build-order files (step 2) are your PRIMARY source for knowing WHAT to build and WHEN. Implementation guides (step 3) tell you WHY and provide business context.

### STEP 1.5: CREATE PLACEHOLDER FILES (LIFELINE STRATEGY)

**⚠️ IMPORTANT - DEPENDENCY MANAGEMENT**

Before building the main files for a part, create **empty placeholder files** for any imports that don't exist yet. This prevents TypeScript errors and provides flexibility if build order changes.

**When to Create Placeholders:**

```
IF current file will import from files not yet built:
   THEN create placeholder files FIRST
```

**Placeholder File Requirements:**

1. **Proper file extension:** `.ts`, `.tsx`, `.py`
2. **Valid syntax:** No compilation errors
3. **TODO comment:** Indicates which part will implement it
4. **Minimal export:** Type-appropriate export to satisfy imports

**Placeholder Types by File:**

**React Component Placeholder:**
```tsx
// components/alerts/alert-form.tsx (placeholder for Part 16)
// TODO: Properly implement in Part 16

export default function AlertFormPlaceholder() {
  return null
}
```

**API Route Placeholder:**
```typescript
// app/api/indicators/[symbol]/route.ts (placeholder for Part 7)
// TODO: Properly implement in Part 7

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    { error: 'Not implemented' },
    { status: 501 }
  )
}
```

**Utility Function Placeholder:**
```typescript
// lib/tier-validation.ts (placeholder for Part 15)
// TODO: Properly implement in Part 15

export function validateTierAccess(): boolean {
  throw new Error('Not implemented - will be built in Part 15')
}
```

**Type Definition Placeholder:**
```typescript
// types/alert.ts (placeholder for Part 8)
// TODO: Properly type in Part 8

export type Alert = any
```

**Workflow:**

```
STEP 0 (NEW): Create Placeholder Files
   ↓
1. Scan build-order for current part
2. Identify all imports that reference future files
3. For each missing import:
   a. Create directory if needed
   b. Create placeholder file
   c. Add TODO comment with part number
   d. Add minimal export matching expected type
4. Commit placeholders:
   git add [placeholder files]
   git commit -m "chore(part-X): add placeholder files for dependencies

   Placeholders created:
   - components/foo.tsx (Part Y)
   - lib/bar.ts (Part Z)

   These prevent TypeScript errors and act as lifeline if build order changes."

THEN proceed to STEP 2 (Plan Implementation)
```

**Example - Part 11 (Alerts) Placeholder Creation:**

```
Part 11 will import:
- @/lib/tier-validation (built in Part 4)
- @/components/ui/button (built in Part 3)
- @/types/alert (built in Part 2)

Check: Do these files exist?
- Part 4 complete? ✅ Yes → No placeholder needed
- Part 3 complete? ❌ No → Create placeholder for button.tsx
- Part 2 complete? ✅ Yes → No placeholder needed

Action: Create placeholder:
- components/ui/button.tsx
```

**Benefits:**

✅ **No TypeScript Errors** - All imports resolve
✅ **Builds Don't Break** - Each part compiles successfully
✅ **Clear TODOs** - Know what needs implementation
✅ **Flexibility** - Build order can change without breaking everything
✅ **CI/CD Works** - Tests pass (placeholders throw only when called)

---

### STEP 2: PLAN IMPLEMENTATION

```
1. Choose appropriate pattern from 05-coding-patterns.md
   - API route? Use Pattern 1
   - Client component? Use Pattern 2
   - Tier validation? Use Pattern 3
   - Database function? Use Pattern 4
   - Flask endpoint? Use Pattern 5

2. Adapt pattern for specific endpoint/component
   - Replace example data with actual requirements
   - Ensure matches OpenAPI contract

3. List all requirements
   - Authentication needed?
   - Tier validation needed?
   - Input validation schema
   - Database operations
   - Error handling
```

### STEP 3: GENERATE CODE

```
1. Use pattern from 05-coding-patterns.md as starting point

2. Customize for your specific requirements:
   - Update imports
   - Update Zod schema for input validation
   - Update tier validation calls
   - Update Prisma queries
   - Update response structure to match OpenAPI

3. Include ALL required elements:
   - TypeScript types (no 'any')
   - Error handling (try/catch)
   - JSDoc comments
   - Authentication checks (if protected route)
   - Tier validation (if symbol/timeframe endpoint)
   - Input validation (Zod schemas)

4. Follow quality standards from 02-quality-standards.md
```

### STEP 4: VALIDATE

```
1. Run automated validation:
   npm run validate

   This runs all validation layers:
   - TypeScript type checking (tsc --noEmit)
   - ESLint code quality (next lint)
   - Prettier formatting (prettier --check)
   - Policy compliance (scripts/validate-file.js)
   - Jest tests (if applicable)

2. Review validation output:
   - TypeScript errors (must be 0)
   - ESLint errors/warnings
   - Prettier formatting issues
   - Policy validation issues by severity:
     * Critical: Security vulnerabilities, missing auth, tier bypass
     * High: Missing error handling, wrong types, missing validation
     * Medium: Missing JSDoc, suboptimal patterns
     * Low: Style preferences, minor improvements

3. Categorize results:
   - ALL PASS: TypeScript ✓, ESLint ✓, Prettier ✓, Policies ✓
   - MINOR ISSUES: Auto-fixable (formatting, imports, JSDoc)
   - MAJOR ISSUES: Requires manual fix or architectural decision
```

### STEP 5: DECIDE

```
Check 01-approval-policies.md for decision logic:

IF all conditions met:
   - 0 Critical issues
   - ≤2 High issues
   - All High issues are auto-fixable
   - TypeScript types present
   - Error handling present
   - JSDoc present
   - No secrets in code
   - Input validation present
   - Tier validation present (if applicable)
   - Response matches OpenAPI
   - File in correct location
   THEN → APPROVE (go to STEP 6: ACT - Approve)

ELSE IF fixable issues AND attempts < 3:
   THEN → AUTO-FIX (go to STEP 6: ACT - Auto-Fix)

ELSE:
   THEN → ESCALATE (go to STEP 6: ACT - Escalate)
```

### STEP 6: ACT

**If Decision = APPROVE:**

```
1. Commit with detailed message:
   git add [filename]
   git commit -m "$(cat <<'EOF'
   feat(scope): description

   - Validation: X Critical, Y High, Z Medium issues
   - All approval conditions met: yes
   - Pattern used: [pattern name]
   - Model: MiniMax M2

   [Additional details about what this file does]
   EOF
   )"

2. Mark as complete internally
3. Proceed to next file
```

**If Decision = AUTO-FIX:**

```
1. Run auto-fix command:
   npm run fix

   This automatically fixes:
   - ESLint auto-fixable issues (imports, unused vars, etc.)
   - Prettier formatting issues
   - Import organization

2. For other fixable issues:

   Missing TypeScript types:
   - Add explicit return types
   - Add parameter types
   - Define interfaces for objects

   Missing error handling:
   - Wrap in try/catch
   - Add error logging
   - Return user-friendly error

   Missing JSDoc:
   - Add function description
   - Add @param for each parameter
   - Add @returns
   - Add @throws if applicable

3. Re-validate: npm run validate (STEP 4)
4. Re-decide (STEP 5)
5. If still issues after 3 attempts → ESCALATE
```

**If Decision = ESCALATE:**

```
1. Stop autonomous work
2. Format escalation message (see 04-escalation-triggers.md)
3. Present to human:
   - Issue type (1 of 10 categories)
   - File affected
   - Clear problem explanation
   - Options with pros/cons
   - Your recommendation
4. WAIT for human response
5. Once received:
   - Update relevant policy if gap found
   - Resume autonomous work
```

### STEP 7: UPDATE PROGRESS

```
After each file:

1. Update PROGRESS.md:
   - Mark file as complete
   - Note any escalations
   - Track time spent

2. Report status every 3 files:
   "Progress: 3/12 files complete (25%)
   - All files approved on first or second try
   - 0 escalations so far
   - Estimated time remaining: ~1 hour"

3. Keep human informed without overwhelming
```

---

## 4. COMMIT MESSAGE FORMAT

Use **conventional commits** with validation details:

```
<type>(<scope>): <description>

- Validation: X Critical, Y High, Z Medium, W Low issues
- All approval conditions met: yes/no
- Pattern used: [which pattern from 05-coding-patterns.md]
- Model: MiniMax M2

[Optional: Additional context]
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `docs`: Documentation
- `test`: Tests
- `chore`: Maintenance

**Examples:**

```
feat(alerts): add GET /api/alerts endpoint

- Validation: 0 Critical, 0 High, 0 Medium, 0 Low issues
- All approval conditions met: yes
- Pattern used: API Route Pattern (Pattern 1)
- Model: MiniMax M2

Implements alert fetching with authentication and proper error handling.
Matches AlertResponse schema from trading_alerts_openapi.yaml.
```

```
feat(alerts): add alert creation form component

- Validation: 0 Critical, 1 High (auto-fixed), 0 Medium, 2 Low issues
- All approval conditions met: yes (after auto-fix)
- Pattern used: Client Component with Form (Pattern 2)
- Model: MiniMax M2

Auto-fixed: Added missing JSDoc comment on handleSubmit function.
Form includes tier-aware symbol/timeframe selection with inline validation.
```

---

## 5. ERROR HANDLING STRATEGIES

### 5.1 How to Categorize Claude Code Errors

| Severity     | Examples                                                                     | Action                 |
| ------------ | ---------------------------------------------------------------------------- | ---------------------- |
| **Critical** | SQL injection, XSS, auth bypass, exposed secrets, tier bypass                | ESCALATE immediately   |
| **High**     | Missing error handling, wrong types, no tier validation, no input validation | AUTO-FIX (if possible) |
| **Medium**   | Missing JSDoc, suboptimal patterns, missing null checks                      | AUTO-FIX               |
| **Low**      | Formatting, style preferences, variable naming                               | AUTO-FIX               |

### 5.2 Auto-Fix Strategies

**Missing Types:**

```typescript
// Before (High issue)
function createAlert(userId, symbol) {
  return prisma.alert.create({ data: { userId, symbol } });
}

// After (Auto-fixed)
function createAlert(userId: string, symbol: string): Promise<Alert> {
  return prisma.alert.create({ data: { userId, symbol } });
}
```

**Missing Error Handling:**

```typescript
// Before (High issue)
export async function GET(req: Request) {
  const data = await prisma.alert.findMany();
  return Response.json(data);
}

// After (Auto-fixed)
export async function GET(req: Request) {
  try {
    const data = await prisma.alert.findMany();
    return Response.json(data);
  } catch (error) {
    console.error('GET /api/alerts error:', error);
    return Response.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}
```

**Missing JSDoc:**

```typescript
// Before (Medium issue)
async function createAlert(userId: string, symbol: string): Promise<Alert> {
  // Implementation
}

// After (Auto-fixed)
/**
 * Creates a new alert for a user
 * @param userId - User's unique identifier
 * @param symbol - Trading symbol (e.g., "EURUSD")
 * @returns Promise resolving to created alert
 */
async function createAlert(userId: string, symbol: string): Promise<Alert> {
  // Implementation
}
```

### 5.3 Decision Logic

```
Validation Results:
├─ 0 Critical + ≤2 High + all fixable → AUTO-FIX then APPROVE
├─ 0 Critical + ≤2 High + all fixed → APPROVE
├─ >0 Critical → ESCALATE immediately
├─ >2 High → ESCALATE
└─ 3 fix attempts exhausted → ESCALATE
```

---

## 6. INTERACTION WITH HUMAN

### 6.1 When to Notify

**Notify human when:**

- Starting new part: "Starting Part 5: Authentication (17 files)"
- Every 3 files completed: "Progress: 9/17 files (53%)"
- Escalation occurs: Use escalation format from 04-escalation-triggers.md
- Part completed: "Part 5 complete! All 17 files done. Ready for testing."

**Don't notify for:**

- Each individual file (too verbose)
- Auto-fix attempts (routine)
- Successful validations (expected)

### 6.2 Escalation Message Format

See `04-escalation-triggers.md` for complete format. Always include:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ESCALATION: [CATEGORY] ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue Type: [1 of 10 categories]
File: [filename]
Severity: [Critical/High/Medium/Low]

Problem:
[2-3 sentence clear explanation]

[Category-specific sections]

Options:
1. [Option 1] - Pros/Cons
2. [Option 2] - Pros/Cons
3. [Option 3] - Pros/Cons

Recommendation:
[Your best judgment with reasoning]

Awaiting human decision...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 7. PROGRESS TRACKING

### 7.1 Update PROGRESS.md After Each File

```markdown
### Part 11: Alerts - ⏳ In Progress

- Completed: 2024-01-15
- Files: 5/7 (71%)
- Escalations: 1 (database migration for triggeredAt field - resolved)
- Status: Building alert-form.tsx
- Time spent: 1.5 hours
- Model: MiniMax M2

Completed files:

- ✅ app/api/alerts/route.ts (GET, POST)
- ✅ app/api/alerts/[id]/route.ts (GET, PATCH, DELETE)
- ✅ lib/db/alerts.ts (database utilities)
- ✅ components/alerts/alert-card.tsx (display component)
- ✅ components/alerts/alert-list.tsx (list component)
- ⏳ components/alerts/alert-form.tsx (IN PROGRESS)
- ⏳ app/dashboard/alerts/page.tsx (pending)
```

### 7.2 Report Progress Every 3 Files

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 PROGRESS REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Part 11: Alerts
Files Complete: 3/7 (43%)

Recent completions:
- ✅ app/api/alerts/route.ts
  Validation: 0C/0H/0M/0L
  Auto-fixes: 0
  Status: Approved ✅

- ✅ app/api/alerts/[id]/route.ts
  Validation: 0C/1H/0M/1L
  Auto-fixes: 1 (added JSDoc)
  Status: Approved ✅

- ✅ lib/db/alerts.ts
  Validation: 0C/0H/0M/0L
  Auto-fixes: 0
  Status: Approved ✅

Escalations: 0
Estimated remaining: ~1 hour
Model: MiniMax M2

Continuing with components/alerts/alert-card.tsx...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 8. TESTING PROTOCOL

After building files, suggest testing to human:

### 8.1 API Route Testing (Postman)

```
Suggested Testing for Part 11 (Alerts):

Postman Collection: nextjs-api.postman_collection.json

Test these endpoints:
1. POST /api/alerts
   - Body: { "symbol": "EURUSD", "timeframe": "H1", "condition": "RSI > 70" }
   - Expected: 201 Created with alert object
   - Test tier: Try AUDJPY (should fail for FREE tier)

2. GET /api/alerts
   - Expected: 200 OK with array of alerts
   - Verify alerts ordered by createdAt desc

3. GET /api/alerts/[id]
   - Use ID from step 1
   - Expected: 200 OK with single alert

4. PATCH /api/alerts/[id]
   - Body: { "isActive": false }
   - Expected: 200 OK with updated alert

5. DELETE /api/alerts/[id]
   - Expected: 204 No Content

Edge Cases to Test:
- Unauthenticated request (should return 401)
- FREE tier accessing PRO symbol (should return 403)
- Invalid timeframe (should return 400)
- Alert limit reached (should return 403)
```

### 8.2 Browser Testing (Manual)

```
Suggested Manual Testing:

1. Navigate to /dashboard/alerts
2. Click "Create Alert" button
3. Fill form:
   - Symbol: EURUSD
   - Timeframe: H1
   - Condition: RSI > 70
4. Submit form
5. Verify:
   - Alert appears in list
   - Form resets or redirects
   - No errors in console

6. Try tier restriction (if FREE tier):
   - Select AUDJPY (should be disabled with 🔒 PRO badge)
   - Select M5 timeframe (should be disabled)

7. Try editing alert:
   - Click edit button
   - Change condition
   - Save
   - Verify changes appear

8. Try deleting alert:
   - Click delete button
   - Confirm deletion
   - Verify alert removed from list
```

---

## 9. SELF-IMPROVEMENT

### 9.1 Learn from Escalation Resolutions

```
When escalation is resolved:

1. Read human's decision
2. Understand the reasoning
3. Update relevant policy:
   - Add new rule
   - Clarify ambiguous rule
   - Add example to policy

4. Commit policy update:
   git add docs/policies/[policy].md
   git commit -m "Update policy: [what you learned]

   Learned from escalation: [brief explanation]
   This prevents similar escalations in future."

5. Apply learning to remaining files
```

### 9.2 Note Policy Updates

Keep track of policy improvements in PROGRESS.md:

```markdown
## Policy Updates

### Update 1 (2024-01-15)

- File: 01-approval-policies.md
- Added: "Always check authentication before using userId"
- Reason: Escalation #1 - TypeScript caught undefined userId
- Impact: Prevents similar TypeScript errors in all future routes

### Update 2 (2024-01-16)

- File: 03-architecture-rules.md
- Added: "Schema changes require local + Railway migration"
- Reason: Escalation #2 - Database migration for triggeredAt field
- Impact: Clear process for all future schema changes
```

---

## 10. MINIMAX M2 OPTIMIZATION

### 10.1 Cost-Conscious Development

MiniMax M2 is cost-effective, but still optimize:

**Batch Related Operations:**

```
Instead of:
- Read file 1, validate, commit
- Read file 2, validate, commit
- Read file 3, validate, commit

Do:
- Read files 1-3
- Validate all 3
- Commit all 3 (if approved)
```

**Minimize Redundant API Calls:**

- Load policies once at startup (not per file)
- Cache OpenAPI schema (don't re-parse each time)
- Reuse patterns (don't regenerate from scratch)

**Efficient Validation:**

- Run Claude Code validation once per file
- Don't re-validate unchanged code
- Auto-fix in batch when possible

**Why this matters:** MiniMax M2 is already cost-effective, but efficient usage allows more files to be built within budget.

---

## 11. EXAMPLE SESSION

### Complete Workflow for Building One File

**Goal:** Build `app/api/alerts/route.ts`

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Aider - Building app/api/alerts/route.ts - MiniMax M2]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1: Reading requirements...
✓ v5-structure-division.md Part 11: Alerts
  Location: app/api/alerts/route.ts (GET /api/alerts, POST /api/alerts)

✓ trading_alerts_openapi.yaml
  AlertResponse schema: { id, userId, symbol, timeframe, condition, isActive, createdAt, triggeredAt }
  CreateAlertRequest schema: { symbol, timeframe, condition }

✓ 05-coding-patterns.md
  Using: Pattern 1 (Next.js API Route)

STEP 2: Planning implementation...
- Handler: GET (fetch user's alerts)
- Handler: POST (create new alert with tier validation)
- Authentication: Required (both handlers)
- Tier validation: Required (POST handler, symbol+timeframe)
- Input validation: Zod schema for POST body
- Database: Prisma alert queries
- Response: Match AlertResponse schema

STEP 3: Generating code...
[Generating based on Pattern 1, adapted for alerts endpoint]

STEP 4: Validating with Claude Code...
Running: claude code "validate app/api/alerts/route.ts"

Validation results:
- Critical: 0
- High: 1 (Missing JSDoc on POST handler function)
- Medium: 0
- Low: 2 (Formatting issues)

STEP 5: Checking approval conditions...
✓ 0 Critical issues
✓ 1 High issue (≤2 threshold)
✓ High issue is fixable (add JSDoc)
✓ TypeScript types: Present
✓ Error handling: Present
✓ Authentication: Present
✓ Tier validation: Present
✓ OpenAPI compliance: Response matches schema
✓ File location: Correct (app/api/alerts/route.ts)

Decision: AUTO-FIX (1 High issue - missing JSDoc)

STEP 6: Acting - Auto-fix...
Fixing: Adding JSDoc comment to POST handler

/**
 * POST /api/alerts - Create a new alert with tier validation
 *
 * Validates user's tier can access the symbol/timeframe combination.
 * Checks alert count limits (FREE: 5, PRO: 20).
 * Creates alert in database.
 *
 * @param req - Request body: { symbol, timeframe, condition }
 * @returns 201: Created alert matching AlertResponse schema
 * @returns 400: Invalid input
 * @returns 401: Unauthorized (not logged in)
 * @returns 403: Forbidden (tier restriction or limit reached)
 * @returns 500: Internal server error
 */

Re-validating...
✓ All issues resolved
✓ 0 Critical, 0 High, 0 Medium, 0 Low

Decision: APPROVE

Committing...
git add app/api/alerts/route.ts
git commit -m "feat(alerts): add GET/POST /api/alerts endpoints

- Validation: 0 Critical, 0 High, 0 Medium, 0 Low issues
- All approval conditions met: yes (after auto-fix)
- Pattern used: API Route Pattern (Pattern 1)
- Model: MiniMax M2

Implements alert fetching and creation with tier validation.
GET returns user's alerts ordered by creation date.
POST validates tier access to symbol/timeframe, checks alert limits,
creates alert matching AlertResponse schema."

✓ Committed: a3f7c2d

STEP 7: Updating progress...
Updated PROGRESS.md:
- Part 11: Alerts - 1/7 files complete (14%)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ File complete: app/api/alerts/route.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Proceeding to next file: app/api/alerts/[id]/route.ts
```

---

## 12. BUILDING PART 17: AFFILIATE MARKETING PLATFORM

**Special considerations for the 2-sided marketplace (67 files)**

Part 17 introduces affiliate marketing functionality with unique requirements that differ from the core user-facing features.

---

### 12.1 Affiliate Marketing File Structure

**Part 17 contains 3 distinct modules:**

1. **Affiliate Portal (Frontend + API)** - 19 files
   - Registration, login, verification
   - Dashboard (stats, codes, commissions)
   - Profile & payment method management

2. **Admin Management (Frontend + API)** - 19 files
   - Affiliate list, details, suspension
   - Code distribution, cancellation
   - Commission payment processing
   - 4 BI reports (P&L, Sales, Commission, Code Inventory)

3. **Business Logic & Automation** - 29 files
   - Authentication (separate JWT)
   - Code generation (crypto-secure)
   - Commission calculation (webhook-only)
   - Cron jobs (distribution, expiry, reports)
   - Email notifications (8 types)

---

### 12.2 Critical Patterns for Part 17

**When building Part 17 files, ALWAYS reference:**

- **Pattern 7** (Affiliate Authentication): All affiliate routes MUST use separate JWT
- **Pattern 8** (Code Generation): All code generation MUST use crypto.randomBytes
- **Pattern 9** (Commission Calculation): Commissions ONLY created via Stripe webhook
- **Pattern 10** (Accounting Reports): All reports MUST reconcile balances

**Example - Affiliate Route:**

```typescript
// ✅ Good - Uses Pattern 7
import { getAffiliateFromToken } from '@/lib/auth/affiliate-auth';

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  const affiliate = await getAffiliateFromToken(token); // ✅ Separate auth

  if (!affiliate || affiliate.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Business logic
}

// ❌ Bad - Uses user authentication
import { getServerSession } from 'next-auth';

export async function GET(req: NextRequest) {
  const session = await getServerSession(); // ❌ Wrong auth system
  // ...
}
```

---

### 12.3 Affiliate-Specific Validation Rules

**When validating Part 17 files, check:**

1. **Authentication (Critical)**
   - ✅ Uses AFFILIATE_JWT_SECRET (not JWT_SECRET)
   - ✅ Token includes type: 'AFFILIATE' discriminator
   - ✅ No shared sessions with users

2. **Code Generation (Critical)**
   - ✅ Uses crypto.randomBytes(16).toString('hex')
   - ✅ Code length ≥12 characters
   - ✅ Uniqueness check before creation
   - ❌ NEVER Math.random() or sequential

3. **Commission Creation (Critical)**
   - ✅ ONLY in Stripe webhook handler
   - ✅ Uses exact formula: netRevenue × commissionPercent
   - ✅ Stores all intermediate values
   - ✅ Status starts as 'PENDING'
   - ❌ NEVER manual creation via API

4. **Accounting Reports (High)**
   - ✅ Opening balance = previous closing balance
   - ✅ Balance reconciles: opening + earned - paid = closing
   - ✅ Drill-down capability present

**If ANY Critical rule violated → ESCALATE immediately**

---

### 12.4 Building Order for Part 17

**Follow this sequence to minimize dependencies:**

**Phase A: Foundation (10 files, ~6 hours)**

1. lib/auth/affiliate-auth.ts (Pattern 7)
2. lib/affiliates/code-generator.ts (Pattern 8)
3. Database models (Affiliate, AffiliateCode, Commission)
4. Database migrations

**Phase B: Affiliate Portal (25 files, ~15 hours)**

1. Affiliate registration & login
2. Email verification
3. Dashboard (stats, codes, commissions)
4. Profile & payment method management
5. All affiliate API routes

**Phase C: Integration (12 files, ~8 hours)**

1. Stripe webhook updates (Pattern 9)
2. User checkout discount code flow
3. Commission calculation
4. Code validation

**Phase D: Admin Portal (20 files, ~12 hours)**

1. Affiliate list & details
2. Code distribution & cancellation
3. Commission payment processing
4. 4 BI reports

**Phase E: Automation (10 files, ~6 hours)**

1. Monthly code distribution cron
2. Code expiry cron
3. Monthly report cron
4. Email notifications

**Total: 67 files, ~47 hours**

---

### 12.5 Common Affiliate Escalation Scenarios

**Expect escalations in these areas:**

1. **Code Distribution Timing**
   - When to distribute (1st of month? Registration?)
   - Mid-month registration handling
   - Code expiry policy clarification

2. **Payment Processing Security**
   - Manual vs automated payment approval
   - Payment method validation
   - Cryptocurrency volatility handling

3. **Report Performance**
   - Opening balance calculation optimization
   - Pagination for large datasets
   - Caching strategies

4. **Commission Fraud Prevention**
   - Duplicate commission detection
   - Code usage validation
   - Manual commission adjustments

**See 04-escalation-triggers.md Section 11 for detailed escalation formats.**

---

### 12.6 Testing Part 17 Features

**Suggested testing approach:**

**Affiliate Registration Flow:**

```
1. POST /api/affiliate/auth/register
   - Body: { email, password, fullName, country, paymentMethod: "BANK_TRANSFER", ... }
   - Expected: 201 Created with affiliate object
   - Verify: Email verification sent

2. GET /api/affiliate/verify-email?token=[token]
   - Expected: Affiliate status changes to ACTIVE
   - Verify: 15 codes distributed
   - Verify: Welcome email sent
```

**Commission Creation Flow:**

```
1. User upgrades with affiliate code
2. Stripe webhook triggered
3. Commission created (status: PENDING)
4. Code marked as USED
5. Affiliate totalEarnings updated
6. Email notification sent

Verify:
- Commission record created with correct calculation
- No duplicate commissions
- Affiliate notified
```

**Admin Payment Flow:**

```
1. Admin views commission owings report
2. Admin selects commissions to pay
3. Admin approves payment batch
4. System marks commissions as PAID
5. Affiliate receives payment confirmation email

Verify:
- Commissions marked as PAID
- paidAt timestamp set
- paymentReference stored
```

---

### 12.7 Environment Variables for Part 17

**Required environment variables:**

```bash
# Affiliate authentication (CRITICAL - different from user JWT)
AFFILIATE_JWT_SECRET=your_separate_affiliate_jwt_secret_here

# Stripe (for commission creation)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Vercel Cron (for code distribution)
CRON_SECRET=your_cron_secret_here

# Email (for notifications)
RESEND_API_KEY=re_...
```

**Validation:**

- AFFILIATE_JWT_SECRET MUST be different from JWT_SECRET
- CRON_SECRET MUST be checked in cron route handlers
- STRIPE_WEBHOOK_SECRET MUST be used to verify webhooks

---

### 12.8 Part 17 Progress Tracking

**Update PROGRESS.md after each module:**

```markdown
### Part 17: Affiliate Marketing Platform - ⏳ In Progress

- Started: 2024-XX-XX
- Files: 25/67 (37%)
- Escalations: 2 (code distribution timing, payment processing)
- Status: Building affiliate dashboard

**Phase A: Foundation** ✅ COMPLETE (10/10 files)

- ✅ lib/auth/affiliate-auth.ts
- ✅ lib/affiliates/code-generator.ts
- ✅ Database models migrated
- ✅ Environment variables configured

**Phase B: Affiliate Portal** ⏳ IN PROGRESS (15/25 files)

- ✅ app/api/affiliate/auth/register/route.ts
- ✅ app/api/affiliate/auth/login/route.ts
- ✅ app/api/affiliate/auth/verify-email/route.ts
- ⏳ app/api/affiliate/dashboard/stats/route.ts (IN PROGRESS)
- ⏳ app/api/affiliate/dashboard/commission-report/route.ts (PENDING)
- ... (20 more files)

**Phase C: Integration** ⏳ PENDING (0/12 files)
**Phase D: Admin Portal** ⏳ PENDING (0/20 files)
**Phase E: Automation** ⏳ PENDING (0/10 files)
```

---

### 12.9 Example: Building Affiliate Registration Endpoint

**Complete workflow demonstrating affiliate-specific patterns:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Aider - Building app/api/affiliate/auth/register/route.ts]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1: Reading requirements...
✓ v5-structure-division.md Part 17: Affiliate Marketing
  Location: app/api/affiliate/auth/register/route.ts

✓ trading_alerts_openapi.yaml
  POST /api/affiliate/auth/register
  Request: { email, password, fullName, country, paymentMethod, ... }
  Response: 201 Created with affiliate object

✓ 05-coding-patterns.md
  Using: Pattern 7 (Affiliate Authentication)

✓ 01-approval-policies.md Section 7
  Validation criteria: Separate JWT, crypto password hash, payment method validation

STEP 2: Planning implementation...
- Zod schema for input validation
- Payment method validation (BANK_TRANSFER, CRYPTO, GLOBAL_WALLET, LOCAL_WALLET)
- Required field combinations per payment method
- Password hashing with bcrypt
- Affiliate creation with status: PENDING_VERIFICATION
- Generate email verification token
- Send verification email
- Return affiliate object (exclude password hash)

STEP 3: Generating code...
[Generates full route handler based on Pattern 7 + requirements]

STEP 4: Validating...
Running: claude code "validate app/api/affiliate/auth/register/route.ts"

Validation results:
- Critical: 0
- High: 0
- Medium: 0
- Low: 0

STEP 5: Checking affiliate-specific approval conditions...
✓ Uses AFFILIATE_JWT_SECRET: N/A (registration, no token yet)
✓ Password hashing: bcrypt with 10 rounds
✓ Payment method validation: Zod schema with field combinations
✓ TypeScript types: All parameters typed
✓ Error handling: Comprehensive try/catch
✓ Input validation: Zod schema present
✓ OpenAPI compliance: Response matches spec

Decision: ✅ APPROVE

STEP 6: Committing...
git add app/api/affiliate/auth/register/route.ts
git commit -m "feat(affiliate): add affiliate registration endpoint

- Validation: 0 Critical, 0 High, 0 Medium, 0 Low issues
- All approval conditions met: yes
- Pattern used: Affiliate Authentication (Pattern 7)
- Model: MiniMax M2

Implements affiliate registration with payment method validation.
Supports 4 payment methods: BANK_TRANSFER, CRYPTO, GLOBAL_WALLET, LOCAL_WALLET.
Validates required fields per payment method per 01-approval-policies.md Section 7.4.
Creates affiliate with status PENDING_VERIFICATION, sends verification email."

✓ Committed: b7e3a2f

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ File complete: app/api/affiliate/auth/register/route.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Proceeding to next file: app/api/affiliate/auth/verify-email/route.ts
```

---

## 13. BUILDING PART 18: DLOCAL PAYMENT INTEGRATION

### 13.1 Overview of Part 18

Part 18 introduces dLocal payment provider as an alternative to Stripe for 8 emerging market countries, enabling local payment methods and currencies.

**Part 18 contains 52 files across 3 modules:**

1. **Backend Payment API** (14 files):
   - Payment provider selection
   - dLocal checkout/callback/renewal
   - Stripe checkout (updated for dual provider)
   - Subscription management (updated)
   - Fraud detection

2. **Frontend Components** (8 files):
   - Payment provider selector
   - Currency display
   - Subscription status card
   - Early renewal UI (dLocal)

3. **Database & Utilities** (30 files):
   - Updated Subscription model (paymentProvider field)
   - New Payment model (audit trail)
   - New FraudAlert model (abuse detection)
   - Currency converter
   - Fraud detector
   - Provider selector utilities

### 13.2 Critical Patterns for Part 18

**When building Part 18 files, ALWAYS reference:**

- **Pattern 11:** Payment Provider Strategy Pattern (lib/payments/subscription-manager.ts)
- **Pattern 12:** Payment Provider Conditional Rendering (components/payments/payment-provider-selector.tsx)
- **Section 14:** Payment Gateway Architecture from 03-architecture-rules.md
- **Section 8:** dLocal Payment Integration Approval Criteria from 01-approval-policies.md

### 13.3 Key Differences: Stripe vs dLocal

| Feature      | Stripe             | dLocal               |
| ------------ | ------------------ | -------------------- |
| Auto-Renewal | ✅ Yes             | ❌ No (manual)       |
| Trial Period | ✅ 7 days          | ❌ None              |
| Plan Types   | Monthly only       | 3-day + Monthly      |
| Currency     | USD only           | 8 local currencies   |
| Cancellation | ✅ User can cancel | ❌ Expires naturally |

### 13.4 Building Order for Part 18

Build in this order for logical dependencies:

1. **Database Models** (Update Prisma schema first):
   - Update User model (hasUsedThreeDayPlan, fraud fields)
   - Update Subscription model (paymentProvider, dLocal fields)
   - Add Payment model
   - Add FraudAlert model

2. **Utilities** (Core logic before API routes):
   - lib/payments/currency-converter.ts
   - lib/payments/fraud-detector.ts
   - lib/payments/provider-selector.ts
   - lib/payments/subscription-manager.ts (Pattern 11)

3. **dLocal API Routes**:
   - app/api/payments/dlocal/checkout/route.ts
   - app/api/payments/dlocal/callback/route.ts
   - app/api/payments/dlocal/renew/route.ts (early renewal)
   - app/api/payments/dlocal/webhook/route.ts

4. **Updated Stripe API Routes**:
   - app/api/payments/stripe/checkout/route.ts (updated for dual provider)
   - app/api/payments/stripe/webhook/route.ts (updated Subscription creation)

5. **Frontend Components**:
   - components/payments/payment-provider-selector.tsx (Pattern 12)
   - components/payments/subscription-status-card.tsx
   - components/payments/early-renewal-button.tsx

6. **Admin Dashboard**:
   - app/admin/fraud-alerts/page.tsx
   - app/admin/fraud-alerts/[id]/resolve/route.ts
   - app/admin/payments/page.tsx

7. **Cron Jobs**:
   - app/api/cron/check-expirations/route.ts (dLocal expiry check)

### 13.5 Critical Validation Checks for Part 18

**When validating Part 18 files, check:**

1. **Single Subscription Model:**
   - ✅ Uses ONE Subscription model with paymentProvider field
   - ❌ Does NOT create separate StripeSubscription/DLocalSubscription models

2. **Currency Conversion:**
   - ✅ Converts USD → local currency for dLocal (real-time rates)
   - ✅ Stores BOTH amount (local) and amountUsd (USD)
   - ❌ Does NOT use hardcoded exchange rates

3. **3-Day Plan Anti-Abuse:**
   - ✅ Checks hasUsedThreeDayPlan before allowing purchase
   - ✅ Creates FraudAlert if reuse attempt detected
   - ❌ Does NOT allow multiple 3-day purchases

4. **Early Renewal (dLocal Monthly):**
   - ✅ Allows early renewal ONLY for dLocal monthly
   - ✅ Stacks days: newExpiry = currentExpiry + 30 days
   - ❌ Does NOT allow Stripe renewal (auto-renews)

5. **Subscription Expiry:**
   - ✅ Checks expiry ONLY for dLocal subscriptions
   - ✅ Sends reminder 3 days before expiry
   - ❌ Does NOT check Stripe subscriptions (webhooks handle it)

6. **Fraud Detection:**
   - ✅ Creates FraudAlert for suspicious activity
   - ✅ Requires admin review before blocking users
   - ❌ Does NOT auto-block users

7. **Provider Selection:**
   - ✅ Shows dLocal ONLY for 8 countries (IN, NG, PK, VN, ID, TH, ZA, TR)
   - ✅ Displays prices in local currency with symbols
   - ❌ Does NOT show dLocal for unsupported countries

### 13.6 Part 18 Progress Tracking

**Update PROGRESS.md after each file:**

```markdown
### Part 18: dLocal Payment Integration - ⏳ In Progress

**Files:** 6 / 52 completed

**Completed:**

- ✅ lib/payments/currency-converter.ts (Pattern 11)
- ✅ lib/payments/fraud-detector.ts (Section 8.6)
- ✅ app/api/payments/dlocal/checkout/route.ts (Section 8.3)
- ✅ app/api/payments/dlocal/callback/route.ts (Section 8.5)
- ✅ components/payments/payment-provider-selector.tsx (Pattern 12)
- ✅ app/api/cron/check-expirations/route.ts (Section 14.8)

**In Progress:**

- ⏳ app/api/payments/dlocal/renew/route.ts (Early renewal with day stacking)

**Pending:** 45 files
```

---

## SUMMARY OF KEY PRINCIPLES

1. **Follow the 7.5-Step Workflow** (Read → Create Placeholders (LIFELINE) → Plan → Generate → Validate → Decide → Act → Update)
2. **Create Placeholder Files First** (LIFELINE STRATEGY - prevent TypeScript errors for missing imports)
3. **Reference Patterns** (05-coding-patterns.md is your cookbook)
4. **Validate Every File** (Claude Code validation before committing)
5. **Auto-Fix When Possible** (max 3 attempts, then escalate)
6. **Escalate Early** (don't guess - ask when unclear)
7. **Update Policies** (learn from escalations)
8. **Track Progress** (PROGRESS.md after each file)
9. **Use MiniMax M2 Efficiently** (batch operations, minimize redundant calls)
10. **Communicate Progress** (every 3 files, not every file)
11. **Test Suggestions** (provide testing instructions for human)
12. **Affiliate Marketing (Part 17):** Use Patterns 7-10, separate JWT, crypto-secure codes, webhook-only commissions
13. **dLocal Payment (Part 18):** Use Patterns 11-12, single Subscription model, real-time currency conversion, 3-day plan anti-abuse, country-based provider selection

**Remember:** You are Aider with MiniMax M2 - cost-effective, autonomous, policy-driven development. Your goal is to build quality code while minimizing human intervention for repetitive tasks. Escalate for exceptions, auto-fix for common issues, and always follow the policies.

**Model:** MiniMax M2 via OpenAI-compatible API

---

**End of Aider Instructions**

These instructions enable you to work autonomously while maintaining high quality and cost-effectiveness. Follow them precisely!
