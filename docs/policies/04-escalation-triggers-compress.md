# Escalation Triggers for Aider with MiniMax M2

## Purpose

Defines when Aider (using MiniMax M2) should stop autonomous work and notify the human developer. Check all resources (policies, seed code, implementation guides, technical docs) BEFORE escalating.

---

## 0. PRE-ESCALATION CHECKLIST ⚠️ MANDATORY

### The 5-Step Research Protocol

```
Issue Encountered
    ↓
Step 1: Check Policies (01-08) ✅
    ↓ Has answer? → YES → Follow policy, NO ESCALATION
    ↓ NO
Step 2: Check OpenAPI Specs ✅
    ↓ Has answer? → YES → Follow spec, NO ESCALATION
    ↓ NO
Step 3: Check Seed Code ✅
    ↓ Has pattern? → YES → Adapt pattern, NO ESCALATION
    ↓ NO
Step 4: Check Implementation Guide ✅
    ↓ Has guidance? → YES → Follow guide, NO ESCALATION
    ↓ NO
Step 5: Check Technical Documentation ✅
    ↓ Has info? → YES → Follow docs, NO ESCALATION
    ↓ NO
Step 6: NOW escalate with full research documented ⚠️
```

### Document Conflicts & Version Precedence

**When documents conflict:**

1. **Check Git commit dates:** `git log --oneline -- path/to/document.md`
2. **Precedence** (highest first):
   - Most recent commit date = Source of truth
   - Policy documents (docs/policies/\*)
   - Implementation guides (docs/implementation-guides/\*)
   - Technical docs (docs/\*)
   - Seed code (reference only)

3. **Common conflicts:**
   - API endpoints: Use newer commit
   - Tier specs: Use newer commit
   - Auth method: Use newer commit

4. **When in doubt:**
   - Check `docs/policies/00-tier-specifications.md`
   - Check `trading_alerts_openapi.yaml`
   - Check recent commits: `git log --since="1 week ago" -- docs/`

### Step 3: Seed Code Reference

| Issue Type           | Check These Files                                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Authentication**   | `seed-code/saas-starter/app/(login)/*`<br>`seed-code/next-shadcn-dashboard-starter/src/app/auth/sign-in/[[...sign-in]]/page.tsx`              |
| **Dashboard Layout** | `seed-code/saas-starter/app/(dashboard)/layout.tsx`<br>`seed-code/next-shadcn-dashboard-starter/src/app/dashboard/layout.tsx`                 |
| **API Routes**       | `seed-code/saas-starter/app/api/user/route.ts`<br>`seed-code/saas-starter/app/api/team/route.ts`<br>`seed-code/saas-starter/app/api/stripe/*` |
| **Billing**          | `seed-code/saas-starter/app/(dashboard)/pricing/page.tsx`<br>`docs/SUBSCRIPTION-MODEL-CLARIFICATION.md`                                       |
| **Forms**            | `seed-code/next-shadcn-dashboard-starter/src/components/forms/*`                                                                              |
| **UI Components**    | `seed-code/v0-components/*`                                                                                                                   |
| **Flask/MT5**        | `seed-code/market_ai_engine.py`<br>`docs/flask-multi-mt5-implementation.md`                                                                   |
| **Affiliate**        | `docs/AFFILIATE-MARKETING-DESIGN.md`<br>`docs/implementation-guides/v5_part_r.md`                                                             |

### Step 4: Implementation Guide Reference

| Part   | Guide                                           |
| ------ | ----------------------------------------------- |
| A-J, R | `docs/implementation-guides/v5_part_[a-j,r].md` |

### Step 5: Technical Documentation

| Feature             | Docs                                                                               |
| ------------------- | ---------------------------------------------------------------------------------- |
| **UI Components**   | `docs/ui-components-map.md`                                                        |
| **Affiliate**       | `docs/AFFILIATE-MARKETING-DESIGN.md`<br>`docs/AFFILIATE-SYSTEM-SETTINGS-DESIGN.md` |
| **System Config**   | `docs/SYSTEMCONFIG-USAGE-GUIDE.md`                                                 |
| **Subscriptions**   | `docs/SUBSCRIPTION-MODEL-CLARIFICATION.md`                                         |
| **Admin Dashboard** | `docs/admin-mt5-dashboard-implementation.md`                                       |
| **Multi-MT5**       | `docs/flask-multi-mt5-implementation.md`                                           |
| **OAuth**           | `docs/google-oauth-integration-summary.md`<br>`docs/OAUTH_IMPLEMENTATION_READY.md` |

### Required Escalation Documentation

```markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ ESCALATION: [CATEGORY] ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Pre-Escalation Research:
✅ Step 1 - Checked policies: [files] - Why didn't resolve: [...]
✅ Step 2 - Checked OpenAPI: [files] - Why didn't resolve: [...]
✅ Step 3 - Checked seed code: [files] - Why didn't resolve: [...]
✅ Step 4 - Checked guide: [file] - Why didn't resolve: [...]
✅ Step 5 - Checked docs: [files] - Why didn't resolve: [...]

Specific Gap: [What information is missing]

[Rest of escalation with options, recommendations]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## ESCALATION CATEGORIES

1. Critical Security Issues
2. API Contract Violations (Can't Auto-Fix)
3. Policy Conflicts or Gaps
4. Architectural Design Decisions
5. Dependency Additions
6. Database Migrations
7. Breaking Changes
8. Automated Validation Failures
9. Unclear Requirements
10. Test Failures
11. Affiliate Marketing Specific

---

## 1. CRITICAL SECURITY ISSUES

### When to Escalate

**Immediate escalation:**

- SQL injection, XSS, auth bypass, exposed secrets
- Missing authentication on protected routes
- Tier validation bypass
- Insecure password storage, CSRF
- Insecure direct object references

### Example

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ESCALATION: Critical Security Issue ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue Type: Missing Authentication Check
File: app/api/alerts/route.ts
Severity: Critical

Problem:
POST /api/alerts creates alerts without authentication. Any unauthenticated
user can create unlimited alerts for any userId.

Vulnerable Code:
export async function POST(req: Request) {
  const body = await req.json();
  const alert = await prisma.alert.create({
    data: {
      userId: body.userId,  // ❌ Accepting userId from client
      symbol: body.symbol,
    }
  });
  return Response.json(alert);
}

Impact:
- Affected: All users
- Risk: Alert spam, unwanted notifications, database fill
- Exploit: Direct API call without auth

Suggested Fix:
export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  const alert = await prisma.alert.create({
    data: {
      userId: session.user.id,  // ✅ From session
      symbol: body.symbol,
    }
  });
  return Response.json(alert);
}

Policy Violated: 01-approval-policies.md Section 1.2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 2. API CONTRACT VIOLATIONS

### When to Escalate

- OpenAPI requires field missing in database schema
- Response doesn't match spec after 3 auto-fix attempts
- Type mismatches between OpenAPI and Prisma
- Status codes don't match spec

### Example

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ESCALATION: API Contract Violation ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue: OpenAPI defines "triggeredAt" field but Prisma Alert model lacks it

OpenAPI Spec:
AlertResponse:
  required: [id, userId, symbol, triggeredAt]
  properties:
    triggeredAt:
      type: string
      format: date-time
      nullable: true

Current Prisma:
model Alert {
  id        String   @id
  symbol    String
  createdAt DateTime
  // ❌ No triggeredAt
}

Auto-Fix Failed (3 attempts):
- Attempt 1: Return null → OpenAPI validation fails
- Attempt 2: Transform createdAt → semantically wrong
- Attempt 3: Can't auto-add DB fields

Options:
1. Add "triggeredAt DateTime?" to schema + migration
   Pros: Matches spec, useful feature, null-safe
   Cons: Requires Railway migration

2. Remove from OpenAPI spec
   Pros: No DB changes
   Cons: Loses planned feature

3. Return computed value
   Pros: No DB changes
   Cons: Misleading data

Recommendation: Option 1 (Add to schema)
- Semantically correct
- OpenAPI-first design
- Safe nullable migration

Migration Impact: Existing alerts get NULL (safe)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 3. POLICY CONFLICTS OR GAPS

### When to Escalate

- Two policies contradict
- Scenario not covered by policies
- Unclear policy precedence
- Multiple valid interpretations
- Edge case unaddressed

### Example

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ESCALATION: Policy Gap ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue: Inactive user (isActive=false) tries to access their data
File: app/api/users/[id]/route.ts

Problem: Policies don't specify how to handle inactive accounts

Options:
1. Return 401 Unauthorized (treat as not authenticated)
2. Return 403 Forbidden (authenticated but restricted)
3. Return 200 OK with data (allow read access)
4. Return 200 OK with warning

Impact: Same question for all protected endpoints

Suggested Policy:
"Inactive Account Handling (isActive=false):
- GET own data: Allow (200) + warning
- POST/PATCH/DELETE: Deny (403)
- Response: { error: 'Account inactive', message: 'Contact support' }
- All endpoints check isActive for write operations"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 4. ARCHITECTURAL DESIGN DECISIONS

### When to Escalate

- Multiple valid approaches exist
- Server Component vs Client Component choice
- New folder structure not in v5-structure-division.md
- State management approach (local/context/URL)
- Data fetching strategy
- Performance trade-offs

### Example

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ESCALATION: Architectural Decision ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue: Data fetching strategy for dashboard alerts
File: app/dashboard/alerts/page.tsx

Context: Need real-time-ish updates (~30s), loading states, good UX

Options:

1. Server Component (DB direct)
   Pros: Fast initial load, SEO, zero client JS
   Cons: Full page reload for updates, no optimistic updates
   Performance: Excellent (initial), Poor (updates)

2. Hybrid (Server + Client polling)
   Pros: Fast initial + auto-updates, no dependencies
   Cons: More code, polling API calls
   Performance: Excellent (initial), Good (updates)

3. Client-only with SWR
   Pros: Built-in caching/revalidation
   Cons: Requires SWR, slower initial load, no SSR
   Performance: Poor (initial), Excellent (updates)

Recommendation: Option 2 (Hybrid)
- Fast initial load + updates
- No new dependencies
- SEO friendly
- 60s polling with visibility pause

FREE tier impact: 60s polling = 1 req/min = acceptable
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 5. DEPENDENCY ADDITIONS

### When to Escalate

- New npm/pip package needed (not pre-approved)
- Alternative libraries exist
- Dependency >100KB bundle size
- Security vulnerabilities reported
- Not actively maintained

### Example

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ESCALATION: New Dependency Required ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Package: date-fns (npm)
File: lib/utils/date-helpers.ts

Need: Date formatting, time calculations, timezone handling

Options:

1. date-fns
   - Size: ~20KB (tree-shakeable → 5KB actual)
   - Downloads: 46M weekly
   - Updated: 2 weeks ago
   - Pros: Popular, TypeScript, functional, tree-shakeable
   - Cons: No built-in timezone (needs date-fns-tz)

2. dayjs
   - Size: ~7KB
   - Downloads: 18M weekly
   - Pros: Smaller, moment.js-like API
   - Cons: Less popular, mutable API

3. Luxon
   - Size: ~70KB
   - Pros: Built-in timezone
   - Cons: Large bundle

4. Native Date + Intl
   - Size: 0KB
   - Effort: ~4 hours
   - Cons: Verbose, error-prone

Recommendation: date-fns + date-fns-tz
- Most popular (battle-tested)
- Tree-shakeable (5KB actual)
- TypeScript support
- Functional/immutable

Security: No vulnerabilities
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 6. DATABASE MIGRATIONS

### When to Escalate

- Adding/removing tables or fields
- Changing field types (data migration needed)
- Changing relations, constraints, indexes
- Any production data affected

### Example

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ESCALATION: Database Schema Change ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Migration: Add "triggeredAt" field to Alert model

BEFORE:
model Alert {
  id        String   @id
  createdAt DateTime
}

AFTER:
model Alert {
  id          String    @id
  createdAt   DateTime
  triggeredAt DateTime?  // ← NEW (nullable)
}

Migration SQL:
ALTER TABLE "Alert" ADD COLUMN "triggeredAt" TIMESTAMP(3);

Impact:
- Existing data: All alerts get triggeredAt = NULL (safe)
- Downtime: None (nullable field, non-blocking)
- Reversibility: Easy (DROP COLUMN)
- Breaking: None

Risk: LOW (no data loss, nullable, no constraints)

Plan:
1. Local: `npx prisma migrate dev --name add_triggered_at`
2. Verify: Check existing alerts have NULL
3. Railway: `DATABASE_URL=... npx prisma migrate deploy`
4. Verify: Query Railway DB
5. Rollback: `ALTER TABLE "Alert" DROP COLUMN "triggeredAt";`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 7. BREAKING CHANGES

### When to Escalate

- Changing API response structure
- Removing endpoints
- Changing required fields
- Modifying auth requirements
- Changing URL structure
- Renaming database fields affecting queries

### Example

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ESCALATION: Breaking Change ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue: Add pagination, breaking GET /api/alerts response structure

Current:
GET /api/alerts → Alert[]

Proposed:
GET /api/alerts → { data: Alert[], pagination: {...} }

Breaking Impact:
- Frontend: All components fetching /api/alerts break
- API contract: Violates current OpenAPI spec

Options:

1. Immediate Breaking Change
   Pros: Clean break
   Cons: Must update all frontend before deploy

2. Versioned API (/api/v2/alerts)
   Pros: No breakage, gradual migration
   Cons: Maintain two endpoints

3. Query Parameter Opt-In (?paginated=true)
   Pros: Backward compatible, no duplicate endpoints
   Cons: Temporary complexity

Recommendation: Option 3 (Query param)

Implementation:
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const paginated = searchParams.get('paginated') === 'true';

  if (paginated) {
    return Response.json({
      data: alerts.slice(...),
      pagination: {...}
    });
  } else {
    return Response.json(alerts);  // Old structure
  }
}

Migration: Gradual frontend update, then deprecate old mode
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 8. CLAUDE CODE VALIDATION FAILURES

### When to Escalate

- > 3 High severity issues after auto-fix
- Any Critical issues
- 3 fix attempts exhausted for same issue
- Unclear how to fix
- Validation contradicts policy
- False positives

### Example

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ESCALATION: Automated Validation Failure ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: app/api/indicators/[symbol]/[timeframe]/route.ts
Attempts: 3 (exhausted)

Validation: 4 High, 2 Medium issues

High Issues:
1. Missing tier validation for timeframe
2. MT5 call not in try/catch
3. Response missing "metadata" field
4. No rate limiting check

Auto-Fix Attempts:
- Attempt 1: Fixed #2, forgot timeframe (#1 remains)
- Attempt 2: Fixed #1, #3, but metadata structure wrong
- Attempt 3: Fixed structure, but still schema mismatch

Root Cause:
Manually constructing response instead of using OpenAPI-generated types

Current:
return Response.json({
  metadata: {  // ← Validation says wrong, matches spec?
    fetchedAt: new Date().toISOString(),
    source: 'MT5'
  }
});

Options:
1. Generate types from OpenAPI (ensures exact match)
2. Make metadata optional
3. Ask human to review spec

Recommendation: Option 1 (Use generated types)
- Should use generated types anyway (policy)
- Guarantees OpenAPI match
- Type-safe at compile time
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 9. UNCLEAR REQUIREMENTS

### When to Escalate

- Specs ambiguous or contradictory
- Missing implementation information
- Conflicting requirements from different docs
- Edge cases not covered
- Business logic unclear

### Example

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ESCALATION: Unclear Requirement ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue: Alert condition syntax/evaluation unclear
File: lib/alerts/condition-evaluator.ts

Specs Say:
"Users set conditions: 'RSI > 70', 'price crosses 1.1000'"
Condition type: string, 1-500 chars, example: "RSI > 70"

Ambiguities:
1. Free-form text or structured format?
2. How to parse/evaluate?
3. Supported indicators? (RSI, MACD, price, etc.)
4. Supported operators? (>, <, crosses, etc.)
5. Can combine conditions? (AND/OR)
6. Who evaluates? (Frontend? Backend? Service?)

Options:

A. Free-Form Text
   - Store as-is, no parsing
   - Manual interpretation
   Pros: Simple, flexible
   Cons: Can't auto-trigger, no validation

B. Predefined Templates
   - Dropdown: "RSI above", "Price below"
   - User fills values
   - Backend evaluates
   Pros: Parseable, validatable, auto-trigger
   Cons: Limited flexibility

C. Expression Parser
   - Parse "RSI > 70" with regex/library
   - Evaluate against MT5
   Pros: Flexible + parseable
   Cons: Complex, security risk

Impact:
- Option A: Can't auto-trigger (major loss)
- Option B: Limited but functional
- Option C: Security risk

Questions:
1. Should alerts auto-trigger?
2. Who evaluates conditions?
3. Which indicators must support?
4. Support complex (AND/OR)?

Recommendation: Option B (Templates for MVP)
- Phase 1: 4 simple conditions (RSI/Price >/< value)
- Fast, secure, validatable, auto-triggerable
- Phase 2: Add more indicators
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 10. TEST FAILURES

### When to Escalate

- TypeScript compilation errors after generation
- Jest unit tests fail
- Integration tests fail unexpectedly
- Build failures (pnpm build)
- E2E tests fail
- Tests pass locally but fail in CI/CD

### Example

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ESCALATION: Test Failure ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue: TypeScript compilation error
File: app/api/alerts/route.ts

Error:
app/api/alerts/route.ts:42:18 - error TS2345
Argument of type 'string | undefined' not assignable to 'string'

Code:
export async function POST(req: Request) {
  const session = await getServerSession();
  const userId = session?.user?.id;  // string | undefined

  await createAlert(userId, symbol, timeframe);  // ❌ Expects string
}

Function signature:
async function createAlert(userId: string, ...): Promise<Alert>

Why Failing:
TypeScript detects potential bug: if session null, userId undefined,
but createAlert requires string → runtime error

Options:

1. Non-null assertion (UNSAFE)
   await createAlert(userId!, ...);  // ❌ Bypasses safety

2. Null check (CORRECT)
   if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
   await createAlert(userId, ...);  // ✅ userId now string

3. Accept undefined (WRONG)
   async function createAlert(userId: string | undefined, ...)

Recommendation: Option 2
- Check auth BEFORE business logic
- After check, TypeScript knows userId is string
- Follows 01-approval-policies.md Section 1.2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 11. AFFILIATE MARKETING SPECIFIC

### 11.1 Commission Fraud Detection

**Escalate when:**

- Manual commission creation (bypassing Stripe webhook)
- Commission calculation doesn't match formula
- Duplicate commissions for same subscription
- Commission for non-existent affiliate code
- Manual amount modification after creation

**Example:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ESCALATION: Commission Fraud Detection ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue: Manual commission creation bypassing validation
File: app/api/admin/commissions/create/route.ts
Severity: Critical

Problem: Direct commission creation without Stripe webhook validation

Vulnerable Code:
export async function POST(req: NextRequest) {
  const { affiliateId, amount } = await req.json();
  await prisma.commission.create({
    data: { affiliateId, commissionAmount: amount, status: 'PENDING' }
  });
}

Security Concerns:
- No Stripe payment proof
- No affiliate code verification
- No amount validation
- Arbitrary commission creation
- No audit trail

Policy Violated: 01-approval-policies.md Section 7.3

Recommendation: REMOVE endpoint
Commissions ONLY via Stripe webhook: POST /api/webhooks/stripe

For manual adjustments:
- Separate endpoint: POST /api/admin/commissions/adjust
- Require reason (string, min 20 chars)
- Store in CommissionAdjustment table
- Notify affiliate
- Audit trail
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 11.2 Code Distribution Timing

**Escalate when:**

- Unclear when codes distributed (registration? verification?)
- Code expiry policy unclear
- Expired unused code handling unclear
- Distribution frequency not specified

### 11.3 Payment Processing Security

**Escalate when:**

- Bulk payment functionality implementation
- Large commission payments
- Manual intervention needed
- Payment method change after earning
- Cryptocurrency price volatility

**Example:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ESCALATION: Architectural Decision ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue: Commission payment processing architecture
File: app/api/admin/commissions/pay/route.ts

Problem: Should payments be automated or manual approval?

Options:

1. Fully Manual
   Pros: Maximum fraud prevention
   Cons: Not scalable, slow

2. Semi-Automated with Approval
   - System generates batch
   - Admin reviews/approves
   - System executes via API
   Pros: Scalable, admin oversight, audit trail
   Cons: Requires API integration

3. Fully Automated
   - Cron auto-processes
   - No approval
   Pros: Fast, scalable
   Cons: High fraud risk

Recommendation: Option 2 (Semi-Automated)
- Payment limits:
  * <$50: Auto-approved
  * $50-$200: Admin approval
  * >$200: Manual review
- Phased rollout capability
- Audit trail: who approved, when, why

Implementation:
- CommissionPaymentBatch table
- Admin creates/reviews batch
- System processes payments
- Mark as PAID with reference
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 11.4 Report Performance

**Escalate when:**

- Report queries >5 seconds
- Large commission sets causing pagination issues
- Complex accounting calculations timeout
- Report aggregations cause DB load

**Options:**

1. Materialized monthly balance table
2. Cached calculations with TTL
3. Database view with aggregates
4. Hybrid: monthly balance + current month live (RECOMMENDED)

### 11.5 Email Notification Strategy

**Escalate when:**

- Unclear frequency (immediate? daily? weekly?)
- Unclear which events trigger emails
- Rate limits (Resend, SendGrid)
- Spam complaint concerns

### 11.6 Affiliate Verification

**Escalate when:**

- Unclear what verification means
- Unclear who can verify
- Unclear verification criteria
- Unclear suspended affiliate code handling

---

## ESCALATION QUICK REFERENCE

| Category            | Trigger                               | Severity | Can Wait? |
| ------------------- | ------------------------------------- | -------- | --------- |
| 1. Security         | SQL injection, auth bypass, secrets   | Critical | ❌ No     |
| 2. API Contract     | Mismatch after 3 fixes                | High     | ✅ Yes    |
| 3. Policy Gaps      | Contradiction, uncovered scenario     | Medium   | ✅ Yes    |
| 4. Architecture     | Multiple approaches, long-term impact | Medium   | ✅ Yes    |
| 5. Dependencies     | New package needed                    | Low      | ✅ Yes    |
| 6. Migrations       | Schema changes                        | High     | ❌ No     |
| 7. Breaking Changes | API breaks frontend                   | High     | ❌ No     |
| 8. Validation       | >3 High issues or Critical            | High     | ✅ Yes    |
| 9. Unclear Reqs     | Ambiguous specs, missing info         | Medium   | ✅ Yes    |
| 10. Test Failures   | TypeScript errors, failed tests       | High     | ❌ No     |
| 11. Affiliate       | Fraud, payments, performance          | Varies   | Varies    |

---

## WORKFLOW

```
1. Detect escalation condition
2. STOP autonomous work
3. Format escalation message
4. Present: problem, context, options, recommendation
5. WAIT for human response
6. Receive decision
7. Update relevant policy
8. Resume autonomous work
```

**Never:**

- ❌ Continue while waiting
- ❌ Assume decision
- ❌ Skip to save time
- ❌ Escalate trivial issues

**Always:**

- ✅ Complete context
- ✅ Thorough options analysis
- ✅ Make recommendation
- ✅ Wait patiently
- ✅ Update policies after

---

## POLICY IMPROVEMENT

After escalation resolution:

1. **Identify Gap:** What policy was missing/unclear?
2. **Update Policy:** Add rule to prevent future escalations
3. **Document:** Add example to relevant policy
4. **Test:** Verify policy now covers scenario
5. **Commit:** Clear message explaining learning

**Example:**

```bash
git add docs/policies/01-approval-policies.md
git commit -m "Add policy: Check auth before userId usage

Learned from escalation: session?.user?.id might be undefined.
Added rule to check authentication FIRST, then use userId.
Prevents similar escalations for all protected routes."
```

**Result:** Future similar scenarios auto-approve (no escalation).

---

## LEARNING LOOP

```
Escalation → Human Decision → Policy Update → Fewer Future Escalations → More Autonomous Work
```

**Goal:** Each escalation makes system smarter. Escalations decrease as policies become comprehensive.

---

**End of Escalation Triggers**
