# Approval Policies for Aider with MiniMax M2

## Purpose

This document defines when Aider (using MiniMax M2 API) should **auto-approve**, **auto-fix**, or **escalate** during autonomous development. These policies ensure quality code while minimizing human intervention for repetitive decisions.

---

## 1. AUTO-APPROVE CONDITIONS

Aider should **automatically commit** code when ALL of the following conditions are met:

### 1.1 Code Quality Requirements

✅ **TypeScript Types:**

- All functions have explicit return types
- All parameters have type annotations
- No `any` types (except in rare, justified cases with JSDoc explanation)
- Interfaces/types defined for complex objects

**Why this matters:** TypeScript catches bugs before runtime. Without proper types, you lose type safety benefits and may ship bugs to production.

**Example - Good:**

```typescript
function createAlert(
  userId: string,
  symbol: string,
  timeframe: string
): Promise<Alert> {
  // Implementation
}
```

**Example - Bad:**

```typescript
function createAlert(userId, symbol, timeframe) {
  // ❌ No types
  // Implementation
}
```

---

✅ **Error Handling:**

- All API routes wrapped in try/catch
- All Prisma queries wrapped in try/catch
- All external API calls (MT5, Stripe) wrapped in try/catch
- User-friendly error messages returned (no raw error objects)
- Errors logged with context (user ID, action attempted)

**Why this matters:** Unhandled errors crash the app. Proper error handling keeps the app running and helps you debug issues.

**Example - Good:**

```typescript
export async function GET(req: Request) {
  try {
    const data = await prisma.alert.findMany();
    return Response.json(data);
  } catch (error) {
    console.error('Failed to fetch alerts:', error);
    return Response.json(
      { error: 'Failed to fetch alerts. Please try again.' },
      { status: 500 }
    );
  }
}
```

---

✅ **JSDoc Comments:**

- All public functions have JSDoc comments
- JSDoc includes: description, @param for each parameter, @returns
- Complex logic has inline comments explaining "why", not "what"

**Why this matters:** JSDoc helps other developers (and future you) understand code. IDEs show JSDoc in autocomplete, making the API self-documenting.

**Example - Good:**

```typescript
/**
 * Creates a new alert for a user with tier validation
 * @param userId - User's unique identifier
 * @param symbol - Trading symbol (e.g., "EURUSD")
 * @param timeframe - Chart timeframe (e.g., "H1")
 * @returns Promise resolving to created alert
 * @throws ForbiddenError if user's tier cannot access symbol/timeframe
 */
async function createAlert(
  userId: string,
  symbol: string,
  timeframe: string
): Promise<Alert> {
  // Implementation
}
```

---

### 1.2 Security Requirements

✅ **No Secrets in Code:**

- No API keys, passwords, tokens in code
- All secrets in .env files (gitignored)
- .env.example provided with placeholder values
- No secrets in error messages or logs

**Why this matters:** Committing secrets to GitHub exposes them publicly. Attackers scan GitHub for exposed keys and exploit them within minutes.

**Example - Good:**

```typescript
const apiKey = process.env.MT5_API_KEY; // ✅ From environment
```

**Example - Bad:**

```typescript
const apiKey = 'sk_live_abc123xyz'; // ❌ Hardcoded secret
```

---

✅ **Input Validation:**

- All user inputs validated with Zod schemas
- SQL injection prevented (Prisma handles this, but validate inputs)
- XSS prevention (sanitize user-generated content)
- All API route inputs validated before use

**Why this matters:** User inputs are the #1 attack vector. Validation prevents malicious data from reaching your database or being executed as code.

**Example - Good:**

```typescript
import { z } from 'zod';

const createAlertSchema = z.object({
  symbol: z.string().min(1).max(20),
  timeframe: z.enum(['M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'H12', 'D1']),
  condition: z.string().min(1).max(500),
});

export async function POST(req: Request) {
  const body = await req.json();
  const validated = createAlertSchema.parse(body); // ✅ Throws if invalid
  // Use validated data
}
```

---

✅ **Tier Validation:**

- All endpoints that serve symbol/timeframe data validate tier access
- FREE tier users cannot access PRO-only symbols (AUDJPY, GBPJPY, etc.)
- FREE tier users cannot access PRO-only timeframes (M5, M15, M30, H2, H8, H12)
- Validation happens on BOTH Next.js API routes AND Flask MT5 service

**Why this matters:** Tier validation is your business model. Without it, users get PRO features for free, and you lose revenue.

**Example - Good:**

```typescript
import { validateChartAccess } from '@/lib/tier/validation';

export async function GET(
  req: Request,
  { params }: { params: { symbol: string; timeframe: string } }
) {
  const session = await getServerSession();
  const userTier = session?.user?.tier || 'FREE';

  // Validate tier access - throws ForbiddenError if unauthorized
  validateChartAccess(userTier, params.symbol, params.timeframe); // ✅

  // Proceed with data fetching...
}
```

---

### 1.3 API Contract Compliance

✅ **Matches OpenAPI Specification:**

- Response structure matches trading_alerts_openapi.yaml or flask_mt5_openapi.yaml exactly
- All required fields present
- Correct HTTP status codes (200, 400, 401, 403, 404, 500)
- Response types match auto-generated TypeScript types in lib/api-client/

**Why this matters:** OpenAPI spec is your contract with the frontend. Violating it breaks the frontend and causes runtime errors.

**Example - From OpenAPI:**

```yaml
# trading_alerts_openapi.yaml
AlertResponse:
  type: object
  required: [id, userId, symbol, timeframe, condition, isActive, createdAt]
  properties:
    id: { type: string }
    userId: { type: string }
    symbol: { type: string }
    timeframe: { type: string }
    condition: { type: string }
    isActive: { type: boolean }
    createdAt: { type: string, format: date-time }
```

**Corresponding API route - Good:**

```typescript
export async function GET(req: Request) {
  const alerts = await prisma.alert.findMany();

  return Response.json({
    id: alert.id,
    userId: alert.userId,
    symbol: alert.symbol,
    timeframe: alert.timeframe,
    condition: alert.condition,
    isActive: alert.isActive,
    createdAt: alert.createdAt.toISOString(), // ✅ All required fields, correct format
  });
}
```

---

### 1.4 Architecture Compliance

✅ **Files in Correct Locations:**

- Files placed according to v5-structure-division.md
- API routes in `app/api/`
- Components in `components/`
- Business logic in `lib/`
- Database utilities in `lib/db/`
- Tier logic in `lib/tier/`

**Why this matters:** Consistent structure makes the codebase navigable. Future developers (or AI assistants) can find files easily.

**Example - Correct locations:**

```
app/api/alerts/route.ts                    ✅ API route
components/alerts/alert-form.tsx           ✅ React component
lib/db/alerts.ts                           ✅ Database utilities
lib/tier/validation.ts                     ✅ Tier validation logic
```

---

### 1.5 Claude Code Validation Results

✅ **Validation Thresholds:**

- **0 Critical issues** (security, contract violations)
- **≤2 High issues** (missing error handling, wrong types, tier validation missing)
- Medium/Low issues acceptable (will be auto-fixed if possible)

**Why this matters:** Claude Code validation catches issues before commit. These thresholds balance quality with autonomous progress.

**Validation Severity Levels:**

- **Critical:** Security vulnerabilities, API contract violations, exposed secrets
- **High:** Missing error handling, incorrect types, missing tier validation
- **Medium:** Missing JSDoc, suboptimal patterns
- **Low:** Formatting, style preferences

---

### 1.6 Complete AUTO-APPROVE Checklist

Aider auto-approves and commits when:

- [ ] All functions have TypeScript types
- [ ] All API routes have try/catch error handling
- [ ] All public functions have JSDoc comments
- [ ] No secrets hardcoded
- [ ] All inputs validated with Zod
- [ ] Tier validation present on protected endpoints
- [ ] Response matches OpenAPI schema exactly
- [ ] File in correct location per v5-structure-division.md
- [ ] Claude Code validation: 0 Critical, ≤2 High issues
- [ ] All High issues are auto-fixable

**If ALL conditions met → AUTO-APPROVE → COMMIT**

---

## 2. AUTO-FIX CONDITIONS

Aider should **automatically fix and retry** (max 3 attempts) when issues are **fixable**:

### 2.1 Fixable Issues

✅ **Missing TypeScript Types:**

- Add explicit return types to functions
- Add type annotations to parameters
- Define interfaces for complex objects

**Auto-fix strategy:**

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

---

✅ **Missing Error Handling:**

- Wrap API routes in try/catch
- Wrap Prisma queries in try/catch
- Add error logging

**Auto-fix strategy:**

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
    console.error('Failed to fetch alerts:', error);
    return Response.json(
      { error: 'Failed to fetch alerts. Please try again.' },
      { status: 500 }
    );
  }
}
```

---

✅ **Missing JSDoc Comments:**

- Add JSDoc to all public functions
- Include @param, @returns, description

**Auto-fix strategy:**

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

---

✅ **ESLint/Prettier Errors:**

- Run `pnpm lint --fix`
- Run `pnpm format`

---

### 2.2 Auto-Fix Process

```
1. Generate code
2. Run Claude Code validation
3. If fixable issues found (and <3 retry attempts):
   a. Apply auto-fix
   b. Re-run Claude Code validation
   c. If validation passes → AUTO-APPROVE → COMMIT
   d. If still has issues → Retry (up to 3 total attempts)
4. If 3 attempts exhausted → ESCALATE
```

---

### 2.3 Maximum Retry Attempts

**Limit:** 3 retry attempts per file

**Why this matters:** Prevents infinite loops. If Aider can't fix issues in 3 tries, it needs human help.

**After 3 failed attempts → ESCALATE**

---

## 3. ESCALATE CONDITIONS

Aider should **STOP and notify you** when encountering:

### 3.1 Critical Security Vulnerabilities

**Escalate immediately when detecting:**

- SQL injection vulnerabilities
- XSS vulnerabilities
- Authentication bypass attempts
- Exposed secrets/API keys in code
- Missing authentication checks on protected routes
- Tier validation bypasses

**Why escalate:** Security issues require human review. Auto-fixing security bugs can introduce new vulnerabilities.

**Example escalation:**

```
⚠️ ESCALATION: Critical Security Issue

Issue: Missing authentication check on /api/alerts route
File: app/api/alerts/route.ts
Severity: Critical

Problem:
The POST /api/alerts endpoint creates alerts without verifying the user is authenticated.
Any unauthenticated user can create unlimited alerts for any userId.

Policy Violation:
- 01-approval-policies.md section 1.2: "All protected routes must verify authentication"

Suggested Fix:
Add authentication check at route start:

const session = await getServerSession();
if (!session?.user?.id) {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

Awaiting human approval before proceeding.
```

---

### 3.2 API Contract Violations (Can't Auto-Fix)

**Escalate when:**

- OpenAPI spec requires a field that doesn't exist in database schema
- Response structure doesn't match OpenAPI schema after 3 fix attempts
- Missing required fields that require schema changes
- Type mismatches between OpenAPI and database that require migration

**Why escalate:** Contract violations often require schema changes or spec updates, which are architectural decisions.

**Example escalation:**

```
⚠️ ESCALATION: API Contract Violation

Issue: OpenAPI spec mismatch with database schema
File: app/api/alerts/route.ts
Severity: High

Problem:
OpenAPI spec (trading_alerts_openapi.yaml) requires field "triggeredAt: string | null"
but Prisma schema doesn't have a "triggeredAt" field on Alert model.

Options:
1. Add "triggeredAt" field to Prisma schema + migration
2. Update OpenAPI spec to remove "triggeredAt" requirement
3. Use a computed field/transform in API response

Which approach should I take?
```

---

### 3.3 Policy Conflicts or Gaps

**Escalate when:**

- Two policies contradict each other
- Scenario not covered by any policy
- Unclear requirements in specs
- Multiple valid approaches, unsure which to choose

**Why escalate:** Policy gaps need human clarification to improve the system.

**Example escalation:**

```
⚠️ ESCALATION: Policy Gap

Issue: Unclear policy on handling inactive users
File: app/api/alerts/route.ts
Severity: Medium

Problem:
User is authenticated but their account isActive=false.
Policies don't specify whether to:
1. Return 403 Forbidden
2. Return 401 Unauthorized
3. Allow access but show warning

Which approach aligns with business requirements?

Recommended policy update:
Add section to 01-approval-policies.md: "Inactive Account Handling"
```

---

### 3.4 Architectural Design Decisions

**Escalate when:**

- Multiple valid architectural approaches exist
- Need to choose a pattern (e.g., server component vs client component)
- New folder structure needed not covered by v5-structure-division.md
- Introducing new abstraction layers

**Why escalate:** Architectural decisions have long-term impacts and should involve human judgment.

**Example escalation:**

```
⚠️ ESCALATION: Architectural Decision

Issue: Alert notification delivery mechanism
File: lib/notifications/alert-notifier.ts
Severity: Medium

Problem:
When an alert triggers, how should we notify the user?

Options:
1. Email immediately (via Resend API)
2. In-app notification only (stored in database)
3. Both email + in-app notification
4. User preference (requires preferences schema)

Decision impacts:
- Cost (email API charges)
- User experience
- Database schema (if option 4)
- Infrastructure (email delivery monitoring)

Which approach should I implement?
```

---

### 3.5 New Dependency Additions

**Escalate when:**

- New npm package needed (not in package.json)
- New pip package needed (for Flask service)
- Dependency adds significant bundle size
- Alternative dependencies available with trade-offs

**Why escalate:** Dependencies add attack surface, bundle size, and maintenance burden. Human approval ensures necessity.

**Example escalation:**

```
⚠️ ESCALATION: New Dependency Required

Issue: Date manipulation library needed
File: lib/utils/date-helpers.ts
Severity: Low

Problem:
Need to format dates, calculate time differences, handle timezones.
JavaScript Date API is verbose and error-prone.

Options:
1. date-fns (functional, tree-shakeable, ~20KB)
2. dayjs (lightweight, ~7KB)
3. Luxon (powerful, timezone support, ~70KB)
4. Native Date (no dependency, but verbose)

Recommendation: date-fns
- Most popular (46M weekly downloads)
- Tree-shakeable (only import what you use)
- Well-typed for TypeScript

Approve adding date-fns?
```

---

### 3.6 Database Schema Changes (Prisma Migrations)

**Escalate when:**

- New table/model needed
- Adding/removing fields from existing models
- Changing field types (data migration required)
- Adding/removing relations

**Why escalate:** Schema changes are irreversible in production. Human review prevents data loss.

**Example escalation:**

```
⚠️ ESCALATION: Database Schema Change

Issue: Need to add "triggeredAt" field to Alert model
File: prisma/schema.prisma
Severity: High

Problem:
To track when alerts are triggered, need new field.

Proposed change:
model Alert {
  id          String   @id @default(cuid())
  userId      String
  symbol      String
  timeframe   String
  condition   String
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  triggeredAt DateTime?  // ← NEW FIELD

  user User @relation(fields: [userId], references: [id])
}

Impact:
- Migration required on Railway PostgreSQL
- Existing alerts will have null triggeredAt (safe)
- OpenAPI spec already requires this field

Approve schema change + migration?
```

---

### 3.7 Breaking Changes to Existing APIs

**Escalate when:**

- Changing API response structure that breaks frontend
- Removing API endpoints
- Changing required fields
- Modifying authentication requirements

**Why escalate:** Breaking changes can crash the production app. Need coordination with frontend.

**Example escalation:**

```
⚠️ ESCALATION: Breaking API Change

Issue: Alert API response structure change
File: app/api/alerts/route.ts
Severity: High

Problem:
Current response returns Alert[] directly.
New requirement: Paginated response with metadata.

Current response:
[
  { id: "1", symbol: "EURUSD", ... },
  { id: "2", symbol: "BTCUSD", ... }
]

Proposed response:
{
  data: [
    { id: "1", symbol: "EURUSD", ... },
    { id: "2", symbol: "BTCUSD", ... }
  ],
  pagination: {
    page: 1,
    pageSize: 20,
    total: 45
  }
}

Breaking change: Frontend expects Alert[] directly.

Options:
1. Version API (create /api/v2/alerts with new structure)
2. Add query param (?paginated=true) for opt-in
3. Update frontend first, then backend

Which approach?
```

---

### 3.8 Claude Code Validation Failures (>3 High Issues)

**Escalate when:**

- > 3 High severity issues after auto-fix attempts
- Any Critical issues
- Repeated auto-fix failures (3 attempts exhausted)
- Unclear how to fix validation errors

**Why escalate:** Persistent validation failures indicate misunderstanding of requirements or complex issues needing human review.

**Example escalation:**

```
⚠️ ESCALATION: Validation Failure After 3 Attempts

Issue: Persistent High severity issues
File: app/api/indicators/[symbol]/[timeframe]/route.ts
Severity: High

Problem:
After 3 auto-fix attempts, still have 4 High issues:

1. Missing tier validation for timeframe access
2. MT5 API call not wrapped in try/catch
3. Response doesn't match OpenAPI schema (missing "metadata" field)
4. No rate limiting check

Attempted fixes:
- Attempt 1: Added try/catch, missing tier validation
- Attempt 2: Added tier validation, response still incorrect
- Attempt 3: Fixed response, forgot rate limiting

Root cause: Complex endpoint with multiple requirements.

Need human guidance:
- Should rate limiting be middleware or per-route?
- Should MT5 errors be retried automatically?
- What should "metadata" field contain?
```

---

### 3.9 Unclear Requirements from Specs

**Escalate when:**

- Specs are ambiguous or contradictory
- Missing information needed for implementation
- Conflicting requirements from different docs
- Edge cases not covered by specs

**Why escalate:** Implementing based on wrong assumptions wastes time. Better to clarify upfront.

**Example escalation:**

```
⚠️ ESCALATION: Unclear Requirement

Issue: Alert condition syntax not specified
File: lib/alerts/condition-parser.ts
Severity: Medium

Problem:
Specs say users can create "conditions" for alerts, but don't specify format.

Examples from specs:
- "RSI > 70"
- "price crosses above 1.1000"
- "MACD crosses signal line"

Questions:
1. What's the exact syntax? (Free-form text? Structured format?)
2. How do we parse conditions? (Regex? Parser library? Predefined templates?)
3. What operators are supported? (>, <, =, crosses, etc?)
4. How complex can conditions be? (AND/OR logic?)

Need clarification on alert condition specification before implementing parser.
```

---

### 3.10 Test Failures

**Escalate when:**

- TypeScript compilation errors after code generation
- Jest tests fail after changes
- Build failures (pnpm build)
- Integration test failures

**Why escalate:** Test failures indicate broken functionality. Need to fix before proceeding.

**Example escalation:**

```
⚠️ ESCALATION: TypeScript Compilation Error

Issue: Type error in generated code
File: app/api/alerts/route.ts
Severity: High

Error:
app/api/alerts/route.ts:42:18 - error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.

Code:
const userId = session?.user?.id;  // Type: string | undefined
await createAlert(userId, symbol, timeframe);  // Expects string

Problem:
TypeScript correctly identifies that userId might be undefined if session is null.

Options:
1. Add null check before calling createAlert
2. Add non-null assertion (userId!)
3. Make createAlert accept string | undefined

Recommended fix:
if (!userId) {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
await createAlert(userId, symbol, timeframe);  // Now userId is definitely string

Approve this fix?
```

---

## 4. ESCALATION MESSAGE FORMAT

When escalating, Aider should format messages as:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ESCALATION REQUIRED ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue Type: [Category from sections 3.1-3.10]
File: [filename with path]
Feature: [what you're building]
Severity: [Critical/High/Medium/Low]

Problem:
[Clear explanation of the issue in 2-3 sentences]

Policy Violation/Gap:
[Which policy is unclear or violated, if applicable]

Context:
[Relevant code snippet, error message, or spec excerpt]

Suggested Solutions:
1. [Option 1 with pros/cons]
2. [Option 2 with pros/cons]
3. [Option 3 with pros/cons]

Recommendation:
[Your best judgment with reasoning]

Awaiting human decision...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 5. HUMAN RESPONSE TO ESCALATIONS

When you (human) receive an escalation:

1. **Read the escalation carefully**
2. **Consider Aider's suggestions**
3. **Make a decision:**
   - Choose an option (1, 2, or 3)
   - Provide alternative solution
   - Ask clarifying questions
4. **Update relevant policy if needed** (so future similar situations auto-approve)
5. **Tell Aider your decision and reasoning**

**Example response:**

```
Decision: Option 1 - Add "triggeredAt" field to Prisma schema

Reasoning:
- OpenAPI spec already requires it (contract-first design)
- Null values safe for existing alerts
- Enables feature: showing alert history with trigger times

Actions:
1. Update prisma/schema.prisma to add triggeredAt field
2. Run migration locally: npx prisma migrate dev
3. Deploy migration to Railway: DATABASE_URL=[Railway] npx prisma migrate deploy
4. Update 03-architecture-rules.md to note: "Schema changes require local + Railway migration"

Proceed with implementing this change.
```

---

## 6. POLICY IMPROVEMENT WORKFLOW

After each escalation resolution:

1. **Identify the policy gap** (what caused the escalation)
2. **Update the relevant policy document:**
   - Add new rule
   - Clarify ambiguous rule
   - Add example
3. **Commit policy update** with clear message
4. **Restart Aider** so it loads updated policies (if needed)

**This creates a learning loop:** Fewer escalations over time as policies become more comprehensive.

---

## Summary Decision Tree

```
Generate code
     ↓
Validate with Claude Code
     ↓
╔════════════════════════════════════════════╗
║ Check ALL approval conditions (Section 1)   ║
╚════════════════════════════════════════════╝
     ↓
     ├─ All conditions met?
     │  └─ YES → AUTO-APPROVE → COMMIT ✅
     │
     ├─ Fixable issues? (Section 2)
     │  └─ YES → AUTO-FIX → Re-validate
     │           ↓
     │           ├─ Fixed? → AUTO-APPROVE → COMMIT ✅
     │           └─ Not fixed after 3 tries? → ESCALATE ⚠️
     │
     └─ Critical issue or unclear? (Section 3)
        └─ YES → ESCALATE ⚠️
```

---

## Approval Conditions Quick Reference

| Condition               | Check                           | Severity if Missing |
| ----------------------- | ------------------------------- | ------------------- |
| TypeScript types        | All functions typed             | High                |
| Error handling          | try/catch on all API routes     | High                |
| JSDoc comments          | All public functions            | Medium              |
| No secrets              | No hardcoded keys               | Critical            |
| Input validation        | Zod validation on all inputs    | High                |
| Tier validation         | Symbol/timeframe access checked | Critical            |
| OpenAPI compliance      | Response matches spec           | Critical            |
| Architecture compliance | File in correct location        | Medium              |
| Claude Code validation  | 0 Critical, ≤2 High             | -                   |

**If ANY Critical → ESCALATE**
**If >2 High → ESCALATE**
**Otherwise → AUTO-FIX or AUTO-APPROVE**

---

## Example: Full Workflow

**Scenario:** Aider builds `app/api/alerts/route.ts`

```
1. Generate code based on:
   - v5-structure-division.md (Part 11: Alerts)
   - trading_alerts_openapi.yaml (AlertResponse schema)
   - 05-coding-patterns.md (API route pattern)

2. Validate with Claude Code:
   Results:
   - 0 Critical
   - 1 High (missing JSDoc on handler function)
   - 0 Medium
   - 2 Low (formatting)

3. Check approval conditions:
   ✅ TypeScript types: Present
   ✅ Error handling: try/catch present
   ❌ JSDoc comments: MISSING (1 High issue)
   ✅ No secrets: Clean
   ✅ Input validation: Zod validation present
   ✅ Tier validation: Present
   ✅ OpenAPI compliance: Response matches spec
   ✅ Architecture: File in correct location
   ✅ Validation: 0 Critical, 1 High (≤2 threshold)

4. Decision: AUTO-FIX (High issue is fixable)

5. Auto-fix: Add JSDoc comment
   /**
    * GET /api/alerts - Fetch all alerts for authenticated user
    * @returns JSON array of alerts matching AlertResponse schema
    */

6. Re-validate:
   - 0 Critical
   - 0 High
   - 0 Medium
   - 0 Low

7. All conditions met → AUTO-APPROVE

8. Commit:
   feat(alerts): add GET /api/alerts endpoint

   - Validation: 0 Critical, 0 High, 0 Medium issues
   - All approval conditions met: yes
   - Pattern used: API Route Pattern from 05-coding-patterns.md
   - Model: MiniMax M2

   Implements alert fetching with tier validation and
   error handling per OpenAPI specification.
```

---

## 7. AFFILIATE MARKETING SPECIFIC POLICIES

**Applies to:** Part 17 (Affiliate Marketing Platform) - 67 files

The affiliate marketing 2-sided marketplace introduces unique validation requirements beyond the core user-facing features.

---

### 7.1 Affiliate Authentication Requirements

✅ **Separate JWT Secret:**

- Affiliate routes MUST use `AFFILIATE_JWT_SECRET` (NOT user JWT secret)
- Token payload MUST include `type: 'AFFILIATE'` discriminator
- Token validation MUST check type field
- No shared authentication between affiliates and users

**Why this matters:** Affiliate and user authentication must be completely separate to prevent privilege escalation and maintain clear security boundaries.

**Example - Good:**

```typescript
// lib/auth/affiliate-auth.ts
export function generateAffiliateToken(affiliate: Affiliate): string {
  return jwt.sign(
    {
      id: affiliate.id,
      email: affiliate.email,
      type: 'AFFILIATE', // ✅ Type discriminator
      status: affiliate.status,
    },
    process.env.AFFILIATE_JWT_SECRET!, // ✅ Separate secret
    { expiresIn: '7d' }
  );
}

// Middleware validates token type
export function validateAffiliateToken(token: string) {
  const decoded = jwt.verify(token, process.env.AFFILIATE_JWT_SECRET!);
  if (decoded.type !== 'AFFILIATE') {
    throw new Error('Invalid token type');
  }
  return decoded;
}
```

**Example - Bad:**

```typescript
// ❌ Using same secret as users
const token = jwt.sign(affiliate, process.env.JWT_SECRET);

// ❌ No type discriminator
const token = jwt.sign({ id: affiliate.id }, process.env.JWT_SECRET);
```

---

### 7.2 Affiliate Code Generation

✅ **Cryptographically Secure Code Generation:**

- MUST use `crypto.randomBytes(16).toString('hex')` or equivalent
- Code length MUST be ≥12 characters
- MUST check uniqueness before saving
- NEVER use predictable patterns (sequential numbers, affiliate name, etc.)

**Why this matters:** Predictable codes allow attackers to guess valid codes and abuse discounts.

**Example - Good:**

```typescript
import crypto from 'crypto';

function generateAffiliateCode(affiliateName: string): string {
  // Random component (cryptographically secure)
  const random = crypto.randomBytes(16).toString('hex');

  // Optional: Prefix with sanitized affiliate name (first 4 chars, uppercase)
  const prefix = affiliateName
    .slice(0, 4)
    .toUpperCase()
    .replace(/[^A-Z]/g, '');

  // Combine: SMIT-a7f3e9d1c2b4a1f6 (total length >12)
  return `${prefix}-${random.slice(0, 12)}`;
}

// Ensure uniqueness
async function createUniqueCode(affiliateName: string): Promise<string> {
  let attempts = 0;
  while (attempts < 10) {
    const code = generateAffiliateCode(affiliateName);
    const existing = await prisma.affiliateCode.findUnique({ where: { code } });
    if (!existing) return code;
    attempts++;
  }
  throw new Error('Failed to generate unique code after 10 attempts');
}
```

**Example - Bad:**

```typescript
// ❌ Predictable pattern
function generateCode(affiliate: Affiliate) {
  return `${affiliate.name}-${affiliate.id}`; // Easy to guess
}

// ❌ Sequential
let codeCounter = 1000;
function generateCode() {
  return `CODE-${codeCounter++}`; // Attacker can enumerate
}

// ❌ Not cryptographically secure
function generateCode() {
  return Math.random().toString(36).substring(7); // Math.random() is NOT secure
}
```

---

### 7.3 Commission Calculation Validation

✅ **Commission Calculation Requirements:**

- MUST create commissions ONLY via Stripe webhook (not manual creation)
- MUST validate affiliate code before creating commission
- MUST use exact formula: `netRevenue × (commissionPercent / 100)`
- MUST store all intermediate values (regularPrice, discountAmount, netRevenue)
- MUST set status to 'PENDING' initially (NOT 'PAID')

**Why this matters:** Commission calculations involve money. Incorrect calculations or manual commission creation enables fraud.

**Example - Good:**

```typescript
// app/api/webhooks/stripe/route.ts
export async function POST(req: NextRequest) {
  const event = await stripe.webhooks.constructEvent(/* ... */);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const affiliateCodeValue = session.metadata?.affiliateCode;

    if (affiliateCodeValue) {
      // 1. Validate code exists and is ACTIVE
      const code = await prisma.affiliateCode.findUnique({
        where: { code: affiliateCodeValue },
      });

      if (!code || code.status !== 'ACTIVE') {
        console.error('Invalid affiliate code:', affiliateCodeValue);
        return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
      }

      // 2. Extract values from Stripe session
      const regularPrice = parseFloat(session.metadata.regularPrice); // 29.00
      const discountPercent = code.discountPercent; // 20.0
      const commissionPercent = code.commissionPercent; // 20.0

      // 3. Calculate (with exact formula)
      const discountAmount = regularPrice * (discountPercent / 100); // 5.80
      const netRevenue = regularPrice - discountAmount; // 23.20
      const commissionAmount = netRevenue * (commissionPercent / 100); // 4.64

      // 4. Create commission record (status: PENDING)
      await prisma.commission.create({
        data: {
          affiliateId: code.affiliateId,
          affiliateCodeId: code.id,
          userId: session.metadata.userId,
          subscriptionId: session.subscription,
          regularPrice,
          discountAmount,
          netRevenue,
          commissionPercent,
          commissionAmount,
          status: 'PENDING', // ✅ Awaits admin payment
        },
      });

      // 5. Mark code as USED
      await prisma.affiliateCode.update({
        where: { id: code.id },
        data: {
          status: 'USED',
          usedAt: new Date(),
          usedByUserId: session.metadata.userId,
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}
```

**Example - Bad:**

```typescript
// ❌ Manual commission creation (bypasses Stripe)
export async function POST(req: NextRequest) {
  const { affiliateId, amount } = await req.json();

  // NO VALIDATION - FRAUD RISK!
  await prisma.commission.create({
    data: {
      affiliateId,
      commissionAmount: amount,
      status: 'PENDING',
    },
  });
}

// ❌ Wrong calculation
const commission = regularPrice * 0.3; // Should be netRevenue × 0.30

// ❌ Creating as PAID immediately
status: 'PAID'; // Should start as PENDING
```

---

### 7.4 Affiliate Payment Method Validation

✅ **Payment Method Field Validation:**

- MUST validate payment method is one of: `BANK_TRANSFER | CRYPTO | GLOBAL_WALLET | LOCAL_WALLET`
- MUST validate required fields based on payment method
- MUST validate optional fields are null when not applicable

**Required field combinations:**

```typescript
// BANK_TRANSFER requires:
- bankName (string, min 1)
- bankAccountNumber (string, min 5)
- bankAccountHolderName (string, min 1)

// CRYPTO requires:
- cryptoWalletAddress (string, min 20, max 100)
- preferredCryptocurrency (enum: BTC, ETH, USDT)

// GLOBAL_WALLET requires:
- globalWalletType (enum: PayPal, Payoneer, Wise)
- globalWalletIdentifier (string, email format)

// LOCAL_WALLET requires:
- localWalletType (enum: GCash, Maya, TrueMoney)
- localWalletIdentifier (string, min 10)
```

**Example - Good:**

```typescript
const paymentMethodSchemas = {
  BANK_TRANSFER: z.object({
    paymentMethod: z.literal('BANK_TRANSFER'),
    bankName: z.string().min(1),
    bankAccountNumber: z.string().min(5),
    bankAccountHolderName: z.string().min(1),
    // Other fields must be null
    cryptoWalletAddress: z.null(),
    preferredCryptocurrency: z.null(),
    globalWalletType: z.null(),
    globalWalletIdentifier: z.null(),
    localWalletType: z.null(),
    localWalletIdentifier: z.null(),
  }),
  CRYPTO: z.object({
    paymentMethod: z.literal('CRYPTO'),
    cryptoWalletAddress: z.string().min(20).max(100),
    preferredCryptocurrency: z.enum(['BTC', 'ETH', 'USDT']),
    // Other fields must be null
    bankName: z.null(),
    bankAccountNumber: z.null(),
    bankAccountHolderName: z.null(),
    globalWalletType: z.null(),
    globalWalletIdentifier: z.null(),
    localWalletType: z.null(),
    localWalletIdentifier: z.null(),
  }),
  // ... GLOBAL_WALLET and LOCAL_WALLET schemas
};

// Validate based on payment method
const schema = paymentMethodSchemas[data.paymentMethod];
const validated = schema.parse(data);
```

---

### 7.5 Accounting-Style Report Validation

✅ **Report Structure Requirements:**

- MUST follow accounting format: Opening Balance → Activity → Closing Balance
- MUST match opening balance = previous closing balance
- MUST include drill-down capability (summary → detail)
- MUST aggregate correctly

**Example - Commission Report:**

```typescript
// Good structure
{
  reportMonth: "2024-01",
  openingBalance: 0.00,     // From previous month's closing
  earned: 9.28,             // Sum of commissions this month
  paid: 4.64,               // Sum of payments this month
  closingBalance: 4.64,     // openingBalance + earned - paid
  commissions: [
    {
      id: "comm_1",
      userId: "user_1",
      subscriptionId: "sub_1",
      affiliateCode: "SMITH-A7K9P2M5",
      createdAt: "2024-01-05T10:30:00Z",
      regularPrice: 29.00,
      discountAmount: 5.80,
      netRevenue: 23.20,
      commissionPercent: 20.0,
      commissionAmount: 4.64,
      status: "PAID",
      paidAt: "2024-01-10T14:20:00Z"
    },
    {
      id: "comm_2",
      userId: "user_2",
      subscriptionId: "sub_2",
      affiliateCode: "SMITH-B1C2D3E4",
      createdAt: "2024-01-15T16:45:00Z",
      regularPrice: 29.00,
      discountAmount: 5.80,
      netRevenue: 23.20,
      commissionPercent: 20.0,
      commissionAmount: 4.64,
      status: "PENDING",
      paidAt: null
    }
  ]
}
```

**Validation:**

```typescript
// Validate accounting balance
const calculated = openingBalance + earned - paid;
if (Math.abs(calculated - closingBalance) > 0.01) {
  throw new Error('Accounting mismatch: balance does not reconcile');
}

// Validate earned matches sum of commissions
const totalEarned = commissions.reduce((sum, c) => sum + c.commissionAmount, 0);
if (Math.abs(totalEarned - earned) > 0.01) {
  throw new Error('Commission total mismatch');
}
```

---

### 7.6 Affiliate-Specific Approval Checklist

When validating affiliate marketing files, ensure:

- [ ] Affiliate authentication uses AFFILIATE_JWT_SECRET
- [ ] Token includes type: 'AFFILIATE' discriminator
- [ ] Code generation uses crypto.randomBytes() (NOT Math.random)
- [ ] Code length ≥12 characters
- [ ] Code uniqueness checked before creation
- [ ] Commissions created ONLY via Stripe webhook
- [ ] Commission calculation uses correct formula
- [ ] All commission intermediate values stored
- [ ] Commission status starts as PENDING
- [ ] Payment method validation matches required fields
- [ ] Accounting reports include opening/closing balances
- [ ] Report balances reconcile (opening + earned - paid = closing)
- [ ] No privilege escalation between affiliate/user auth

**If ANY of these conditions violated → ESCALATE**

---

### 7.7 Affiliate-Specific Quick Reference

| Requirement                       | Check                             | Severity if Violated |
| --------------------------------- | --------------------------------- | -------------------- |
| Separate JWT secret               | Uses AFFILIATE_JWT_SECRET         | Critical             |
| Token type discriminator          | Includes type: 'AFFILIATE'        | Critical             |
| Crypto-secure code generation     | Uses crypto.randomBytes()         | Critical             |
| Commission via webhook only       | Created in Stripe webhook handler | Critical             |
| Correct commission formula        | netRevenue × commissionPercent    | High                 |
| Payment method validation         | Required fields present           | High                 |
| Accounting balance reconciliation | opening + earned - paid = closing | High                 |
| Code uniqueness check             | Checks existing before creating   | Medium               |

**If ANY Critical violated → ESCALATE immediately**

---

### 7.8 Dynamic Configuration System (SystemConfig)

✅ **Centralized Settings Management:**

- Frontend MUST use `useAffiliateConfig()` hook to fetch current percentages
- NEVER hardcode discount or commission percentages (20%, 20%, etc.)
- Code generation MUST read from SystemConfig table for default values
- Admin UI MUST use SystemConfig for displaying and updating settings

**Why this matters:** Admin can change affiliate discount and commission percentages from dashboard. All pages must reflect these changes automatically without code deployment.

**Example - Good (Frontend):**

```typescript
// components/PricingCard.tsx
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';

export function PricingCard() {
  const { discountPercent, calculateDiscountedPrice } = useAffiliateConfig();
  const regularPrice = 29.00;
  const discountedPrice = calculateDiscountedPrice(regularPrice);

  return (
    <div>
      <p>Regular: ${regularPrice}/month</p>
      <p>With code: ${discountedPrice}/month (Save {discountPercent}%!)</p>
    </div>
  );
}
```

**Example - Good (Backend - Code Generation):**

```typescript
// app/api/admin/affiliates/[id]/distribute-codes/route.ts
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // 1. Fetch current config from SystemConfig table
  const discountConfig = await prisma.systemConfig.findUnique({
    where: { key: 'affiliate_discount_percent' },
  });
  const commissionConfig = await prisma.systemConfig.findUnique({
    where: { key: 'affiliate_commission_percent' },
  });

  const discountPercent = parseFloat(discountConfig?.value || '20.0');
  const commissionPercent = parseFloat(commissionConfig?.value || '20.0');

  // 2. Generate codes with current config values
  const codes = await Promise.all(
    Array(15)
      .fill(null)
      .map(() =>
        prisma.affiliateCode.create({
          data: {
            code: generateSecureCode(),
            affiliateId: params.id,
            discountPercent, // ✅ From SystemConfig
            commissionPercent, // ✅ From SystemConfig
            expiresAt: endOfMonth(),
            status: 'ACTIVE',
          },
        })
      )
  );

  return NextResponse.json({ codesDistributed: codes.length });
}
```

**Example - Bad:**

```typescript
// ❌ Hardcoded percentages
const discountPercent = 20.0;  // Will break if admin changes settings
const commissionPercent = 20.0;

// ❌ Not using useAffiliateConfig hook
export function PricingCard() {
  return <p>Save 20% with affiliate code!</p>;  // Hardcoded!
}
```

**Frontend Hook Pattern:**

```typescript
// lib/hooks/useAffiliateConfig.ts
import useSWR from 'swr';

export interface AffiliateConfig {
  discountPercent: number;
  commissionPercent: number;
  codesPerMonth: number;
  regularPrice: number;
  lastUpdated: string;
}

export function useAffiliateConfig() {
  const { data, error, isLoading } = useSWR<AffiliateConfig>(
    '/api/config/affiliate',
    {
      refreshInterval: 300000, // 5 minutes
      dedupingInterval: 60000, // 1 minute
      revalidateOnFocus: true,
    }
  );

  return {
    config: data,
    discountPercent: data?.discountPercent ?? 20,
    commissionPercent: data?.commissionPercent ?? 20,
    calculateDiscountedPrice: (regularPrice: number) => {
      const discount = data?.discountPercent ?? 20;
      return regularPrice * (1 - discount / 100);
    },
    isLoading,
    error,
  };
}
```

**API Endpoint Pattern:**

```typescript
// app/api/config/affiliate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Cache for 5 minutes
export const revalidate = 300;

export async function GET(req: NextRequest) {
  try {
    // Fetch all affiliate config keys
    const configs = await prisma.systemConfig.findMany({
      where: {
        key: {
          in: [
            'affiliate_discount_percent',
            'affiliate_commission_percent',
            'affiliate_codes_per_month',
          ],
        },
      },
    });

    // Parse and return
    const configMap = Object.fromEntries(configs.map((c) => [c.key, c.value]));

    return NextResponse.json({
      discountPercent: parseFloat(
        configMap.affiliate_discount_percent || '20.0'
      ),
      commissionPercent: parseFloat(
        configMap.affiliate_commission_percent || '20.0'
      ),
      codesPerMonth: parseInt(configMap.affiliate_codes_per_month || '15'),
      regularPrice: 29.0,
      lastUpdated: configs[0]?.updatedAt || new Date(),
    });
  } catch (error) {
    console.error('Failed to fetch affiliate config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch configuration' },
      { status: 500 }
    );
  }
}
```

**Critical Rules:**

1. ✅ ALWAYS use `useAffiliateConfig()` in frontend components
2. ✅ ALWAYS fetch from SystemConfig table in backend code generation
3. ✅ NEVER hardcode percentages (20%, 20%, 15 codes, etc.)
4. ✅ Cache config endpoint for 5 minutes to reduce DB load
5. ✅ Provide fallback values if SystemConfig query fails

**Pages that MUST use useAffiliateConfig():**

- Marketing homepage (pricing section)
- Pricing page
- Checkout page
- Billing page
- Affiliate dashboard (earnings calculator)
- Admin affiliate management (commission preview)
- All email templates (pricing references)

**Update Propagation:**

- Admin changes settings → SystemConfigHistory entry created
- Frontend pages refresh within 1-5 minutes (SWR revalidation)
- Existing codes keep original percentages (no retroactive changes)
- New codes use updated percentages from SystemConfig

---

## 8. DLOCAL PAYMENT INTEGRATION APPROVAL CRITERIA (Part 18)

### 8.1 Payment Provider Validation

✅ **Auto-Approve if:**

- MUST use single `Subscription` model with `paymentProvider` field ("STRIPE" or "DLOCAL")
- MUST make Stripe fields nullable for dLocal subscriptions
- MUST make dLocal fields nullable for Stripe subscriptions
- MUST store BOTH `amount` (local currency) AND `amountUsd` for all payments
- MUST check `paymentProvider` field before applying provider-specific logic

```typescript
// ✅ Auto-approve: Single Subscription model
model Subscription {
  paymentProvider String // "STRIPE" or "DLOCAL"

  // Stripe fields (nullable)
  stripeCustomerId String? @unique
  stripePriceId String?

  // dLocal fields (nullable)
  dLocalPaymentId String? @unique
  dLocalCurrency String?

  // Shared fields
  planType String // "MONTHLY" or "THREE_DAY"
  amountUsd Float // Both providers
  expiresAt DateTime // Both providers
}

// ❌ Reject: Separate models
model StripeSubscription { ... }  // Don't create separate models
model DLocalSubscription { ... }
```

---

### 8.2 Currency Conversion

✅ **Auto-Approve if:**

- MUST convert USD → local currency ONLY for dLocal payments
- MUST fetch real-time exchange rates (NEVER use hardcoded rates)
- MUST store exchange rate used in Payment record for audit trail
- MUST round converted amount to 2 decimal places
- Stripe payments MUST remain in USD (no conversion)

```typescript
// ✅ Auto-approve: Real-time currency conversion
const { amount, rate } = await convertUsdToLocal(29.0, 'INR');
await prisma.payment.create({
  data: {
    amount: 2407.0, // Local currency
    currency: 'INR',
    amountUsd: 29.0, // USD equivalent
    exchangeRate: 83.0, // Rate used
  },
});

// ❌ Reject: Hardcoded exchange rates
const amount = 29.0 * 83; // Don't hardcode rate
```

---

### 8.3 3-Day Plan Anti-Abuse

✅ **Auto-Approve if:**

- MUST check `hasUsedThreeDayPlan === false` before allowing purchase
- MUST create `FraudAlert` if reuse attempt detected
- MUST block 3-day purchase if active subscription exists
- MUST mark `hasUsedThreeDayPlan = true` after successful payment
- MUST include ipAddress and deviceFingerprint in fraud detection

```typescript
// ✅ Auto-approve: Complete 3-day plan validation
if (planType === 'THREE_DAY') {
  if (user.hasUsedThreeDayPlan) {
    await prisma.fraudAlert.create({
      data: {
        userId: user.id,
        alertType: '3DAY_PLAN_REUSE',
        severity: 'MEDIUM',
        ipAddress: req.headers.get('x-forwarded-for'),
        deviceFingerprint: req.headers.get('x-device-fingerprint'),
      },
    });
    return NextResponse.json(
      { error: '3-day plan already used' },
      { status: 403 }
    );
  }

  // After payment success
  await prisma.user.update({
    where: { id: user.id },
    data: { hasUsedThreeDayPlan: true, threeDayPlanUsedAt: new Date() },
  });
}

// ❌ Reject: Missing fraud alert or flag update
if (user.hasUsedThreeDayPlan) {
  return { error: '...' }; // Missing FraudAlert creation
}
```

---

### 8.4 Early Renewal Logic (dLocal Monthly Only)

✅ **Auto-Approve if:**

- MUST allow early renewal ONLY for dLocal monthly subscriptions
- MUST block renewal for dLocal 3-day plans
- MUST block renewal for Stripe subscriptions (auto-renews)
- MUST calculate new expiry as: `current expiresAt + 30 days` (stacking)
- MUST return clear message showing remaining days + new days

```typescript
// ✅ Auto-approve: Early renewal with day stacking
if (subscription.paymentProvider !== 'DLOCAL') {
  return NextResponse.json(
    { error: 'Stripe subscriptions auto-renew' },
    { status: 400 }
  );
}

if (subscription.planType === 'THREE_DAY') {
  return NextResponse.json(
    { error: 'Cannot renew 3-day plan' },
    { status: 400 }
  );
}

const newExpiresAt = new Date(subscription.expiresAt);
newExpiresAt.setDate(newExpiresAt.getDate() + 30); // Stack days

return NextResponse.json({
  message: `${remainingDays} remaining + 30 new = ${remainingDays + 30} total`,
  expiresAt: newExpiresAt,
});

// ❌ Reject: Allows Stripe renewal or doesn't stack days
if (subscription.planType === 'MONTHLY') {
  const newExpiresAt = addDays(new Date(), 30); // Wrong: doesn't stack
}
```

---

### 8.5 Subscription Expiry Handling

✅ **Auto-Approve if:**

- MUST check expiry ONLY for dLocal subscriptions (NOT Stripe)
- MUST run via cron job daily at midnight UTC
- MUST send reminder 3 days before expiry
- MUST downgrade to FREE tier when `expiresAt < now`
- MUST mark `renewalReminderSent = true` after sending reminder

```typescript
// ✅ Auto-approve: dLocal expiry check with reminders
const expiringSubscriptions = await prisma.subscription.findMany({
  where: {
    paymentProvider: 'DLOCAL',  // Only dLocal
    status: 'active',
    OR: [
      { expiresAt: { lt: now } },  // Expired
      { expiresAt: { lt: addDays(now, 3) }, renewalReminderSent: false }
    ]
  }
});

for (const sub of expiringSubscriptions) {
  if (daysUntilExpiry <= 0) {
    // Downgrade to FREE
    await prisma.$transaction([
      prisma.subscription.update({ where: { id: sub.id }, data: { status: 'expired' } }),
      prisma.user.update({ where: { id: sub.userId }, data: { tier: 'FREE' } })
    ]);
    await sendEmail(sub.user.email, 'Subscription Expired', {...});
  } else if (daysUntilExpiry <= 3 && !sub.renewalReminderSent) {
    await prisma.subscription.update({ data: { renewalReminderSent: true } });
    await sendEmail(sub.user.email, 'Expiring Soon', {...});
  }
}

// ❌ Reject: Checks Stripe subscriptions or missing reminder logic
const expiringSubscriptions = await prisma.subscription.findMany({
  where: { expiresAt: { lt: addDays(now, 3) } }  // Missing provider filter
});
```

---

### 8.6 Fraud Detection Integration

✅ **Auto-Approve if:**

- MUST call fraud detection on ALL payment operations
- MUST create `FraudAlert` for suspicious patterns
- MUST include severity: "LOW", "MEDIUM", or "HIGH"
- MUST require admin review before blocking users
- MUST keep fraud alerts for audit trail (NEVER delete)

```typescript
// ✅ Auto-approve: Comprehensive fraud detection
const fraudAlert = await detectFraud(userId, {
  ipAddress: req.headers.get('x-forwarded-for'),
  deviceFingerprint: req.headers.get('x-device-fingerprint'),
  paymentAmount: amount,
});

if (fraudAlert) {
  await prisma.fraudAlert.create({
    data: {
      userId,
      alertType: fraudAlert.type,
      severity: fraudAlert.severity, // LOW, MEDIUM, HIGH
      description: fraudAlert.description,
      ipAddress: fraudAlert.ipAddress,
      deviceFingerprint: fraudAlert.deviceFingerprint,
      additionalData: fraudAlert.context,
    },
  });

  // Send to admin for review
  await sendAdminNotification('New Fraud Alert', fraudAlert);
}

// ❌ Reject: Auto-blocks users or missing fraud alerts
if (detectedFraud) {
  await prisma.user.update({ data: { isActive: false } }); // Don't auto-block
}
```

---

### 8.7 Payment Provider Selection

✅ **Auto-Approve if:**

- MUST show dLocal option ONLY for supported countries: IN, NG, PK, VN, ID, TH, ZA, TR
- MUST show prices in local currency for dLocal countries
- MUST use correct currency symbols (₹, ₦, ₨, ₫, Rp, ฿, R, ₺)
- MUST allow user to change country if geolocation wrong

```typescript
// ✅ Auto-approve: Country-based provider selection
export const DLOCAL_COUNTRIES = [
  'IN',
  'NG',
  'PK',
  'VN',
  'ID',
  'TH',
  'ZA',
  'TR',
];

export function getAvailableProviders(countryCode: string): PaymentProvider[] {
  if (DLOCAL_COUNTRIES.includes(countryCode)) {
    return ['STRIPE', 'DLOCAL']; // Both options
  }
  return ['STRIPE']; // International only
}

// Display localized pricing
const { amount, currency, display } = getLocalizedPrice('MONTHLY', country);
// India: ₹2,407, Nigeria: ₦12,470, etc.

// ❌ Reject: Shows dLocal for all countries
return ['STRIPE', 'DLOCAL']; // Missing country check
```

---

### 8.8 Stripe Trial Abuse Detection

✅ **Auto-Approve if:**

- MUST check for fraud patterns BEFORE creating user account
- MUST capture `signupIP` and `deviceFingerprint` at registration
- MUST implement all 4 fraud detection patterns (IP, device, email, velocity)
- MUST block HIGH severity attempts immediately
- MUST create FraudAlert for all suspicious activity
- MUST allow MEDIUM severity but flag for admin review
- MUST check `hasUsedStripeTrial` before allowing trial start
- NO credit card required for trial start (maximizes conversion)

```typescript
// ✅ Auto-approve: Registration with multi-signal fraud detection
import { detectTrialAbuse } from '@/lib/fraud-detection';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { email, password, name } = await req.json();

  // Extract fraud signals
  const signupIP =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.ip || null;
  const deviceFingerprint = req.headers.get('x-device-fingerprint') || null;

  // ✅ Check fraud BEFORE creating account
  const fraudCheck = await detectTrialAbuse({
    email,
    signupIP,
    deviceFingerprint,
  });

  if (fraudCheck) {
    // Create FraudAlert for admin review
    await prisma.fraudAlert.create({
      data: {
        userId: null,
        alertType: fraudCheck.type,
        severity: fraudCheck.severity,
        description: fraudCheck.description,
        ipAddress: signupIP,
        deviceFingerprint,
        additionalData: {
          email,
          blockedAtRegistration: fraudCheck.severity === 'HIGH',
        },
      },
    });

    // Block HIGH severity
    if (fraudCheck.severity === 'HIGH') {
      return NextResponse.json(
        { error: 'Registration blocked' },
        { status: 403 }
      );
    }
  }

  // Create user with fraud tracking fields
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      tier: 'FREE',
      hasUsedStripeTrial: false,
      signupIP,
      lastLoginIP: signupIP,
      deviceFingerprint,
    },
  });

  return NextResponse.json(user, { status: 201 });
}
```

**Fraud Detection Implementation:**

```typescript
// ✅ Auto-approve: lib/fraud-detection.ts with all 4 patterns
export async function detectTrialAbuse(context: {
  email: string;
  signupIP: string | null;
  deviceFingerprint: string | null;
}): Promise<FraudCheckResult | null> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // Pattern 1: IP-based abuse (≥3 trials from same IP in 30 days)
  if (context.signupIP) {
    const recentTrialsFromIP = await prisma.user.count({
      where: {
        signupIP: context.signupIP,
        hasUsedStripeTrial: true,
        stripeTrialStartedAt: { gte: thirtyDaysAgo },
      },
    });

    if (recentTrialsFromIP >= 3) {
      return {
        type: 'STRIPE_TRIAL_IP_ABUSE',
        severity: 'HIGH',
        description: `IP ${context.signupIP} used for ${recentTrialsFromIP} trials in 30 days`,
      };
    }
  }

  // Pattern 2: Device fingerprint abuse (≥2 trials from same device in 30 days)
  if (context.deviceFingerprint) {
    const recentTrialsFromDevice = await prisma.user.count({
      where: {
        deviceFingerprint: context.deviceFingerprint,
        hasUsedStripeTrial: true,
        stripeTrialStartedAt: { gte: thirtyDaysAgo },
      },
    });

    if (recentTrialsFromDevice >= 2) {
      return {
        type: 'STRIPE_TRIAL_DEVICE_ABUSE',
        severity: 'HIGH',
        description: `Device used for ${recentTrialsFromDevice} trials in 30 days`,
      };
    }
  }

  // Pattern 3: Disposable email domain (MEDIUM severity)
  const emailDomain = context.email.split('@')[1].toLowerCase();
  const disposableDomains = [
    'mailinator.com',
    '10minutemail.com',
    'guerrillamail.com',
  ];

  if (disposableDomains.includes(emailDomain)) {
    return {
      type: 'DISPOSABLE_EMAIL_DETECTED',
      severity: 'MEDIUM',
      description: `Disposable email domain: ${emailDomain}`,
    };
  }

  // Pattern 4: Rapid signup velocity (≥5 accounts from same IP in 1 hour)
  if (context.signupIP) {
    const rapidSignups = await prisma.user.count({
      where: {
        signupIP: context.signupIP,
        createdAt: { gte: oneHourAgo },
      },
    });

    if (rapidSignups >= 5) {
      return {
        type: 'RAPID_SIGNUP_VELOCITY',
        severity: 'HIGH',
        description: `${rapidSignups} accounts from ${context.signupIP} in 1 hour (bot attack)`,
      };
    }
  }

  return null; // No fraud detected
}
```

**Trial Start Endpoint:**

```typescript
// ✅ Auto-approve: Trial start WITHOUT card requirement
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession();

  // Check if user already used trial
  if (session.user.hasUsedStripeTrial) {
    return NextResponse.json(
      {
        error: 'You have already used your free trial',
        errorCode: 'TRIAL_ALREADY_USED',
      },
      { status: 403 }
    );
  }

  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + 7);

  // Grant PRO for 7 days WITHOUT payment method
  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: {
        tier: 'PRO',
        hasUsedStripeTrial: true,
        stripeTrialStartedAt: new Date(),
      },
    }),
    prisma.subscription.create({
      data: {
        userId: session.user.id,
        paymentProvider: 'STRIPE',
        planType: 'MONTHLY',
        status: 'trialing',
        expiresAt: trialEndDate,
        amountUsd: 0,
      },
    }),
  ]);

  return NextResponse.json({
    message: 'Trial started',
    trialEndsAt: trialEndDate,
    tier: 'PRO',
  });
}
```

**Client-Side Device Fingerprinting:**

```typescript
// ✅ Auto-approve: Browser fingerprinting for fraud detection
// lib/fingerprint.ts (Client-side)
export async function generateDeviceFingerprint(): Promise<string> {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    !!window.sessionStorage,
    !!window.localStorage,
  ];

  const fingerprint = components.join('|');
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(fingerprint)
  );

  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Usage in registration form
const fingerprint = await generateDeviceFingerprint();

fetch('/api/auth/register', {
  headers: {
    'Content-Type': 'application/json',
    'X-Device-Fingerprint': fingerprint, // Send to server
  },
  body: JSON.stringify({ email, password, name }),
});
```

**Trial Expiry Cron Job:**

```typescript
// ✅ Auto-approve: Trial expiry check (every 6 hours)
// app/api/cron/stripe-trial-expiry/route.ts
export async function GET(req: NextRequest): Promise<NextResponse> {
  // Verify cron secret
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const expiredTrials = await prisma.subscription.findMany({
    where: {
      paymentProvider: 'STRIPE',
      status: 'trialing',
      expiresAt: { lt: new Date() }
    },
    include: { user: true }
  })

  for (const subscription of expiredTrials) {
    // Check if user converted to paid
    const paidSubscription = await prisma.subscription.findFirst({
      where: {
        userId: subscription.userId,
        paymentProvider: 'STRIPE',
        status: 'active',
        stripeSubscriptionId: { not: null }
      }
    })

    if (paidSubscription) {
      // Delete trial subscription (user converted)
      await prisma.subscription.delete({ where: { id: subscription.id } })
    } else {
      // Downgrade to FREE (user did NOT convert)
      await prisma.$transaction([
        prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'expired' }
        }),
        prisma.user.update({
          where: { id: subscription.userId },
          data: { tier: 'FREE' }
        })
      ])

      await sendEmail(subscription.user.email, 'Trial Expired', {
        message: 'Subscribe now to regain PRO features',
        ctaUrl: 'https://app.com/dashboard/billing'
      })
    }
  }

  return NextResponse.json({ checked: expiredTrials.length })
}

// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/stripe-trial-expiry",
      "schedule": "0 */6 * * *"  // Every 6 hours
    }
  ]
}
```

🚨 **ESCALATE if:**

- Fraud detection skipped at registration
- Single-signal detection used (e.g., email-only checks)
- Credit card required for trial start
- No FraudAlert created for suspicious activity
- User can start trial multiple times (missing hasUsedStripeTrial check)
- Trial expiry check missing or incorrect schedule
- Device fingerprint not captured
- HIGH severity attempts not blocked immediately

❌ **REJECT if:**

```typescript
// ❌ Reject: No fraud detection
const user = await prisma.user.create({ data: { email, password } });

// ❌ Reject: Requires card for trial
await stripe.checkout.sessions.create({
  mode: 'subscription',
  payment_method_types: ['card'], // Should NOT require card for trial
});

// ❌ Reject: Single-signal detection (insufficient)
const existingEmail = await prisma.user.findUnique({ where: { email } });
if (existingEmail?.hasUsedStripeTrial) {
  /* ... */
} // Only checks email

// ❌ Reject: Missing hasUsedStripeTrial check
const user = await prisma.user.update({
  data: { tier: 'PRO' }, // No check if trial already used
});

// ❌ Reject: No FraudAlert creation
if (fraudCheck?.severity === 'HIGH') {
  return NextResponse.json({ error: 'Blocked' }, { status: 403 });
  // Missing: FraudAlert creation for admin review
}
```

**Expected Metrics:**

- **Conversion Rate:** 40-60% (vs 5-10% with card requirement)
- **Fraud Detection:** 4 independent signals (IP, device, email, velocity)
- **False Positive Rate:** <5% (admin review workflow)
- **Admin Overhead:** 2-5 fraud alerts per day

---

### 8.9 Admin Fraud Management Actions

✅ **Auto-Approve if:**

- MUST verify admin role before ANY enforcement action (`session.user.role === 'ADMIN'`)
- MUST update FraudAlert.resolution field for ALL actions
- MUST log admin identity (reviewedBy + reviewedAt)
- MUST send email notification for warnings, blocks, and unblocks
- MUST require admin notes for audit trail (notes field)
- BLOCK_ACCOUNT must downgrade user to FREE tier
- BLOCK_ACCOUNT must cancel active subscriptions
- BLOCK_ACCOUNT requires confirmation dialog in UI

```typescript
// ✅ Auto-approve: Admin enforcement with role check + email + audit trail
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  // ✅ Verify admin role
  const session = await getServerSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { action, notes, blockDuration } = await req.json();

  const alert = await prisma.fraudAlert.findUnique({
    where: { id: params.id },
    include: { user: true },
  });

  switch (action) {
    case 'BLOCK_ACCOUNT':
      // ✅ Block user + downgrade + cancel subscriptions + email
      await prisma.$transaction([
        prisma.user.update({
          where: { id: alert.userId },
          data: { isActive: false, tier: 'FREE' },
        }),
        prisma.subscription.updateMany({
          where: { userId: alert.userId, status: 'active' },
          data: { status: 'canceled' },
        }),
        prisma.fraudAlert.update({
          where: { id: params.id },
          data: {
            resolution:
              blockDuration === 'PERMANENT'
                ? 'BLOCKED_PERMANENT'
                : 'BLOCKED_TEMPORARY',
            reviewedBy: session.user.id,
            reviewedAt: new Date(),
            notes: `${blockDuration} block. Reason: ${notes}`,
          },
        }),
      ]);

      // ✅ Send email notification
      await sendEmail(alert.user.email, 'Account Suspended', {
        subject: '🚫 Your account has been suspended',
        html: `<h2>Account Suspended</h2>
               <p>Reason: ${notes}</p>
               <p>Duration: ${blockDuration}</p>`,
      });

      return NextResponse.json({
        success: true,
        message: `Account blocked (${blockDuration})`,
      });

    case 'SEND_WARNING':
      // ✅ Email warning + update fraud alert
      await prisma.fraudAlert.update({
        where: { id: params.id },
        data: {
          resolution: 'WARNING_SENT',
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
          notes,
        },
      });

      await sendEmail(alert.user.email, 'Security Alert', {
        subject: '⚠️ Suspicious activity detected',
        html: `<p>${alert.description}</p><p>${notes}</p>`,
      });

      return NextResponse.json({ success: true });

    case 'DISMISS':
      await prisma.fraudAlert.update({
        where: { id: params.id },
        data: {
          resolution: 'FALSE_POSITIVE',
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
          notes,
        },
      });

      return NextResponse.json({ success: true });

    case 'UNBLOCK_ACCOUNT':
      await prisma.$transaction([
        prisma.user.update({
          where: { id: alert.userId },
          data: { isActive: true },
        }),
        prisma.fraudAlert.update({
          where: { id: params.id },
          data: {
            resolution: 'UNBLOCKED',
            reviewedBy: session.user.id,
            reviewedAt: new Date(),
            notes,
          },
        }),
      ]);

      await sendEmail(alert.user.email, 'Account Restored', {
        subject: '✅ Your account has been restored',
        html: `<p>Your account has been restored. ${notes}</p>`,
      });

      return NextResponse.json({ success: true });
  }
}
```

**Admin Dashboard UI:**

```typescript
// ✅ Auto-approve: Filters, action buttons, confirmation dialogs, notes required
export default function FraudAlertsDashboard() {
  const { data: session } = useSession();

  // ✅ Redirect if not admin
  if (session?.user?.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  const handleAction = async (alertId: string, action: string, blockDuration?: string) => {
    // ✅ Require notes for non-dismiss actions
    if (!actionNotes.trim() && action !== 'DISMISS') {
      alert('Please add notes explaining your decision');
      return;
    }

    // ✅ Confirmation for destructive actions
    if (action === 'BLOCK_ACCOUNT') {
      if (!confirm(`Are you sure you want to BLOCK this user's account?`)) {
        return;
      }
    }

    const response = await fetch(`/api/admin/fraud-alerts/${alertId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, notes: actionNotes, blockDuration })
    });

    if (response.ok) {
      alert('Action completed successfully');
      fetchAlerts();  // Refresh list
    }
  };

  return (
    <div>
      {/* Filters: status, severity, date */}
      {/* Alert list with details */}
      {/* Action modal with buttons and notes field */}
    </div>
  );
}
```

🚨 **ESCALATE if:**

- Admin role check missing or incorrect
- Email notification skipped for warnings/blocks/unblocks
- Admin notes not required for actions
- FraudAlert.resolution not updated
- Block action doesn't downgrade user to FREE
- Block action doesn't cancel subscriptions
- No confirmation dialog for BLOCK_ACCOUNT
- reviewedBy or reviewedAt not logged

❌ **REJECT if:**

```typescript
// ❌ Reject: Missing admin role check
export async function POST(req: NextRequest) {
  const { action } = await req.json();
  // No admin verification!
  await prisma.fraudAlert.update({ /* ... */ });
}

// ❌ Reject: No email notification for block
case 'BLOCK_ACCOUNT':
  await prisma.user.update({ data: { isActive: false } });
  // Missing: sendEmail()
  return NextResponse.json({ success: true });

// ❌ Reject: Block doesn't cancel subscriptions
case 'BLOCK_ACCOUNT':
  await prisma.user.update({
    where: { id: userId },
    data: { isActive: false }
  });
  // Missing: cancel subscriptions
  return NextResponse.json({ success: true });

// ❌ Reject: No notes required
const handleAction = async (alertId, action) => {
  // Missing: notes validation
  await fetch(`/api/admin/fraud-alerts/${alertId}/actions`, {
    body: JSON.stringify({ action })  // No notes!
  });
};

// ❌ Reject: No confirmation dialog for block
<button onClick={() => handleAction(alert.id, 'BLOCK_ACCOUNT')}>
  Block Account
</button>
// Missing: confirm() dialog before blocking
```

**Expected Admin Workflow:**

1. Admin sees fraud alert notification (email or dashboard badge)
2. Admin opens fraud alert dashboard
3. Admin filters by severity (HIGH priority first)
4. Admin clicks "Take Action" on alert
5. Admin reviews user details, IP data, trial usage history
6. Admin enters notes explaining decision
7. Admin selects action (Dismiss/Warning/Block/Unblock/Whitelist)
8. System shows confirmation dialog (for destructive actions)
9. System executes action (database updates + email notification)
10. Alert marked as resolved with admin identity logged

---

**Critical Rules for Payment Integration:**

**dLocal Integration:**

1. ✅ Single Subscription model (both providers)
2. ✅ Real-time currency conversion (no hardcoded rates)
3. ✅ 3-day plan one-time use (with fraud detection)
4. ✅ Early renewal with day stacking (dLocal monthly only)
5. ✅ Daily expiry check (dLocal only, via cron)
6. ✅ Fraud detection on all payment operations
7. ✅ Country-based provider selection (8 dLocal countries)
8. ✅ Store both local currency and USD for reporting

**Stripe Trial Anti-Abuse:** 9. ✅ NO card required for trial start (maximizes conversion ~40-60%) 10. ✅ Multi-signal fraud detection (IP, device, email, velocity) 11. ✅ Check fraud BEFORE creating user account 12. ✅ Block HIGH severity, flag MEDIUM for admin review 13. ✅ Trial expiry check every 6 hours (via cron) 14. ✅ One trial per user (hasUsedStripeTrial flag) 15. ✅ Capture signupIP + deviceFingerprint at registration 16. ✅ Create FraudAlert for all suspicious activity

**Admin Fraud Management:** 17. ✅ Verify admin role before enforcement actions 18. ✅ Block action = downgrade to FREE + cancel subscriptions + send email 19. ✅ Require admin notes for all actions (audit trail) 20. ✅ Send email notifications for warnings/blocks/unblocks 21. ✅ Confirmation dialog required for BLOCK_ACCOUNT 22. ✅ Log admin identity (reviewedBy + reviewedAt)

---

**If ANY Critical violated → ESCALATE immediately**

---

**End of Approval Policies**

These policies enable Aider with MiniMax M2 to work autonomously while maintaining high quality and security standards. Update this document as you learn from escalations!
