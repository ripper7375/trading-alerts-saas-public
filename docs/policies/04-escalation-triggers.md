# Escalation Triggers for Aider with MiniMax M2

## Purpose

This document defines EXACTLY when Aider (using MiniMax M2) should stop autonomous work and notify you (the human developer). Escalations are exceptions that require human judgment - they're learning opportunities that improve the system over time.

**Key Principle:** Check all available resources (policies, seed code, implementation guides, technical docs) BEFORE escalating. Only escalate if none of these resources provide an answer.

---

## 0. PRE-ESCALATION CHECKLIST ⚠️ **MANDATORY - CHECK BEFORE ESCALATING!**

**CRITICAL:** Before escalating ANY issue to the human, Aider and Claude Code MUST complete ALL steps in this checklist. This checklist dramatically reduces unnecessary escalations by ensuring you've consulted all available resources.

### The 5-Step Research Protocol

```
Issue Encountered
    ↓
Step 1: Check Policies (01-08) ✅
    ↓
Has policy answer? → YES → Follow policy, NO ESCALATION
    ↓ NO
Step 2: Check OpenAPI Specs ✅
    ↓
Has API contract answer? → YES → Follow spec, NO ESCALATION
    ↓ NO
Step 3: Check Seed Code (by category) ✅ **NEW!**
    ↓
Has pattern/example? → YES → Adapt pattern, NO ESCALATION
    ↓ NO
Step 4: Check Implementation Guide ✅ **NEW!**
    ↓
Has specific guidance? → YES → Follow guide, NO ESCALATION
    ↓ NO
Step 5: Check Technical Documentation ✅ **NEW!**
    ↓
Has specialized info? → YES → Follow docs, NO ESCALATION
    ↓ NO
Step 6: NOW escalate with full research documented ⚠️
```

---

### Handling Document Conflicts and Version Precedence

**IMPORTANT:** Due to the large number of documents in this repository, some documents may share the same development context but differ in details. This occurs because:

- Documents are not always updated synchronously
- Different documents may describe the same feature from different perspectives
- Earlier documents may not reflect latest architectural decisions

**When you encounter conflicting information between documents:**

1. **Check Git commit dates** to determine which is most recent:

   ```bash
   git log --oneline -- path/to/document.md
   ```

2. **Precedence rules** (highest to lowest priority):
   - ✅ **Most recent commit date** = Source of truth
   - ✅ **Policy documents** (docs/policies/\*) = Always current
   - ✅ **Implementation guides** (docs/implementation-guides/\*) = Part-specific details
   - ✅ **Technical docs** (docs/\*) = Specialized features
   - ✅ **Seed code** = Reference patterns only

3. **Examples of common conflicts:**

   **Conflict Type 1: API endpoint definitions**
   - Document A (older): Says use `/api/alerts/create`
   - Document B (newer): Says use `/api/alerts` with POST
   - **Resolution:** Use Document B (newer commit date)

   **Conflict Type 2: Tier specifications**
   - Document A (older): FREE tier has 3 symbols
   - Document B (newer): FREE tier has 5 symbols
   - **Resolution:** Use Document B (newer commit date)

   **Conflict Type 3: Authentication method**
   - Document A (older): Use Clerk for auth
   - Document B (newer): Use NextAuth with Google OAuth
   - **Resolution:** Use Document B (newer commit date)

4. **When in doubt:**
   - Check `docs/policies/00-tier-specifications.md` (always current)
   - Check `trading_alerts_openapi.yaml` (source of truth for APIs)
   - Check most recent commits: `git log --since="1 week ago" -- docs/`

5. **Document in escalation** if conflicts prevent progress:

   ```markdown
   ⚠️ Document Conflict Detected:

   - Document A: docs/old-guide.md (commit: abc123, date: 2025-01-15)
   - Document B: docs/new-guide.md (commit: def456, date: 2025-11-18)

   Conflict: Authentication method

   - Document A says: Use Clerk
   - Document B says: Use NextAuth + Google OAuth

   Resolution: Using Document B (more recent: 2025-11-18)
   ```

**This approach helps you make autonomous decisions when documents conflict, reducing unnecessary escalations.**

---

### Step 3: Seed Code Reference Table

Based on your issue type, check these seed code files **BEFORE** escalating:

| Issue Type               | Check These Seed Files First                                                                                                                                                                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Authentication**       | `seed-code/saas-starter/app/(login)/actions.ts`<br>`seed-code/saas-starter/app/(login)/sign-in/page.tsx`<br>`seed-code/saas-starter/app/(login)/sign-up/page.tsx`<br>`seed-code/next-shadcn-dashboard-starter/src/app/auth/sign-in/[[...sign-in]]/page.tsx` |
| **Dashboard Layout**     | `seed-code/saas-starter/app/(dashboard)/layout.tsx`<br>`seed-code/next-shadcn-dashboard-starter/src/app/dashboard/layout.tsx`<br>`seed-code/v0-components/layouts/dashboard-layout.tsx`                                                                     |
| **API Routes**           | `seed-code/saas-starter/app/api/user/route.ts`<br>`seed-code/saas-starter/app/api/team/route.ts`<br>`seed-code/saas-starter/app/api/stripe/checkout/route.ts`<br>`seed-code/saas-starter/app/api/stripe/webhook/route.ts`                                   |
| **Billing/Subscription** | `seed-code/saas-starter/app/(dashboard)/pricing/page.tsx`<br>`seed-code/saas-starter/app/api/stripe/checkout/route.ts`<br>`seed-code/saas-starter/app/api/stripe/webhook/route.ts`<br>`docs/SUBSCRIPTION-MODEL-CLARIFICATION.md`                            |
| **Forms**                | `seed-code/next-shadcn-dashboard-starter/src/components/forms/demo-form.tsx`<br>`seed-code/next-shadcn-dashboard-starter/src/components/forms/form-input.tsx`<br>`seed-code/next-shadcn-dashboard-starter/src/components/forms/form-select.tsx`             |
| **UI Components**        | `seed-code/v0-components/README.md`<br>`seed-code/v0-components/charts/trading-chart.tsx`<br>`seed-code/v0-components/alerts/alert-card.tsx`<br>`seed-code/next-shadcn-dashboard-starter/src/components/layout/*`                                           |
| **Flask/MT5**            | `seed-code/market_ai_engine.py`<br>`docs/flask-multi-mt5-implementation.md`<br>`docs/admin-mt5-dashboard-implementation.md`                                                                                                                                 |
| **Affiliate System**     | `docs/AFFILIATE-MARKETING-DESIGN.md`<br>`docs/implementation-guides/v5_part_r.md`                                                                                                                                                                           |

---

### Step 4: Implementation Guide Reference

For each part you're implementing, check the corresponding guide:

| Part   | Implementation Guide                                                 |
| ------ | -------------------------------------------------------------------- |
| Part A | `docs/implementation-guides/v5_part_a.md` (Foundation & Root Config) |
| Part B | `docs/implementation-guides/v5_part_b.md` (Database Schema)          |
| Part C | `docs/implementation-guides/v5_part_c.md` (Type Definitions)         |
| Part D | `docs/implementation-guides/v5_part_d.md` (Utilities & Helpers)      |
| Part E | `docs/implementation-guides/v5_part_e.md` (Authentication)           |
| Part F | `docs/implementation-guides/v5_part_f.md` (Flask MT5 Service)        |
| Part G | `docs/implementation-guides/v5_part_g.md` (API Routes - User)        |
| Part H | `docs/implementation-guides/v5_part_h.md` (API Routes - Charts)      |
| Part I | `docs/implementation-guides/v5_part_i.md` (API Routes - Indicators)  |
| Part J | `docs/implementation-guides/v5_part_j.md` (API Routes - Watchlist)   |
| Part R | `docs/implementation-guides/v5_part_r.md` (Affiliate Marketing)      |

---

### Step 5: Technical Documentation Reference

For complex features, check specialized documentation:

| Feature Area          | Technical Documentation                                                            |
| --------------------- | ---------------------------------------------------------------------------------- |
| **UI Components**     | `docs/ui-components-map.md`                                                        |
| **Affiliate System**  | `docs/AFFILIATE-MARKETING-DESIGN.md`<br>`docs/AFFILIATE-SYSTEM-SETTINGS-DESIGN.md` |
| **System Config**     | `docs/SYSTEMCONFIG-USAGE-GUIDE.md`                                                 |
| **Subscriptions**     | `docs/SUBSCRIPTION-MODEL-CLARIFICATION.md`                                         |
| **Admin Dashboard**   | `docs/admin-mt5-dashboard-implementation.md`                                       |
| **Multi-MT5**         | `docs/flask-multi-mt5-implementation.md`                                           |
| **OAuth Integration** | `docs/google-oauth-integration-summary.md`<br>`docs/OAUTH_IMPLEMENTATION_READY.md` |

---

### Required Escalation Documentation

**If you must escalate after completing all 5 steps**, include this in your escalation message:

```markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ ESCALATION: [CATEGORY] ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Pre-Escalation Research Completed:
✅ Step 1 - Checked policies:

- [List specific policy files checked]
- Why policies didn't resolve: [Explanation]

✅ Step 2 - Checked OpenAPI specs:

- [Which spec files checked]
- Why specs didn't resolve: [Explanation]

✅ Step 3 - Checked seed code:

- [List specific seed files checked]
- Why seed code didn't resolve: [Explanation]

✅ Step 4 - Checked implementation guide:

- [Which guide checked]
- Why guide didn't resolve: [Explanation]

✅ Step 5 - Checked technical docs:

- [Which docs checked]
- Why docs didn't resolve: [Explanation]

Specific Gap or Ambiguity:
[What specific information is missing that none of the resources provide]

[Rest of escalation message with options, recommendations, etc.]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### Example: ✅ GOOD Escalation (Full Research Documented)

```markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ ESCALATION: Architectural Decision ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue Type: Payment Provider Routing
File: app/api/checkout/route.ts
Severity: High

Pre-Escalation Research Completed:
✅ Step 1 - Checked policies:

- docs/policies/07-dlocal-integration-rules.md
- Why policies didn't resolve: Policy shows dLocal for emerging markets
  but doesn't specify routing logic (IP-based vs user preference)

✅ Step 2 - Checked OpenAPI specs:

- trading_alerts_openapi.yaml (checkout endpoint)
- docs/dlocal-openapi-endpoints.yaml
- Why specs didn't resolve: Specs define both Stripe and dLocal endpoints
  but don't specify routing decision criteria

✅ Step 3 - Checked seed code:

- seed-code/saas-starter/app/api/stripe/checkout/route.ts
- Why seed code didn't resolve: Only shows Stripe integration, not
  dual-provider routing logic

✅ Step 4 - Checked implementation guide:

- docs/implementation-guides/v5_part_r.md (billing section)
- Why guide didn't resolve: Mentions both providers but doesn't specify
  routing mechanism

✅ Step 5 - Checked technical docs:

- docs/SUBSCRIPTION-MODEL-CLARIFICATION.md
- docs/DLOCAL-INTEGRATION-SUMMARY.md
- Why docs didn't resolve: Explains what dLocal does but not HOW to route
  users between Stripe and dLocal

Specific Gap or Ambiguity:
Need to decide routing mechanism for dual payment providers:

- Option A: IP-based geo-detection (auto-route by country)
- Option B: User preference (let user choose payment method)
- Option C: Hybrid (default IP-based, allow override)

This is an architectural decision affecting checkout flow UX.

[Options analysis, recommendations...]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### Example: ❌ BAD Escalation (No Research Documented)

```markdown
❌ BAD EXAMPLE - DO NOT DO THIS:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ ESCALATION: How to implement authentication? ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Problem: I don't know how to implement login/signup pages.

[No mention of checking seed code, implementation guide, or policies]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Why this is BAD:**

- Didn't check `seed-code/saas-starter/app/(login)/*` (has complete auth examples)
- Didn't check `docs/implementation-guides/v5_part_e.md` (has auth requirements)
- Didn't check `docs/policies/08-google-oauth-implementation-rules.md`
- Wasted human's time on something seed code could have solved

---

## ESCALATION CATEGORIES

**After completing the pre-escalation checklist above**, Aider should escalate in these 10 situations:

1. Critical Security Issues
2. API Contract Violations (Can't Auto-Fix)
3. Policy Conflicts or Gaps
4. Architectural Design Decisions
5. Dependency Additions
6. Database Migrations
7. Breaking Changes
8. Claude Code Validation Failures
9. Unclear Requirements
10. Test Failures

---

## 1. CRITICAL SECURITY ISSUES

### When to Escalate

**Escalate IMMEDIATELY when detecting:**

- SQL injection vulnerabilities
- XSS (Cross-Site Scripting) vulnerabilities
- Authentication bypass attempts
- Exposed secrets/API keys in code or logs
- Missing authentication checks on protected routes
- Tier validation bypass opportunities
- Insecure password storage
- CSRF (Cross-Site Request Forgery) vulnerabilities
- Insecure direct object references

### What Information to Include

```
Issue Type: Critical Security Issue
File: [filename]
Severity: Critical
Security Type: [SQL Injection | XSS | Auth Bypass | etc.]

Problem:
[Clear explanation of the vulnerability and how it could be exploited]

Vulnerable Code:
[Code snippet showing the issue]

Potential Impact:
- Who is affected: [All users | Admin users | etc.]
- Data at risk: [User passwords | Payment info | etc.]
- Attack scenario: [How attacker could exploit this]

Suggested Fix:
[Specific remediation steps]

Policy Violated:
[Which policy section addresses this]
```

### Example Escalation

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ESCALATION: Critical Security Issue ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue Type: Critical Security Issue
File: app/api/alerts/route.ts
Severity: Critical
Security Type: Missing Authentication Check

Problem:
The POST /api/alerts endpoint creates alerts without verifying that
the user is authenticated. Any unauthenticated user can create unlimited
alerts for any userId by directly calling this endpoint.

Vulnerable Code:
export async function POST(req: Request) {
  const body = await req.json();
  const alert = await prisma.alert.create({
    data: {
      userId: body.userId,  // ❌ Accepting userId from client!
      symbol: body.symbol,
      // ...
    }
  });
  return Response.json(alert);
}

Potential Impact:
- Who is affected: All users (any unauthenticated person can create alerts)
- Data at risk: Alert data, user privacy
- Attack scenario:
  1. Attacker discovers endpoint via OpenAPI spec
  2. Sends POST request without authentication
  3. Creates malicious alerts for real users
  4. Could fill database with spam alerts
  5. Could trigger unwanted notifications to users

Suggested Fix:
Add authentication check at the start of the handler:

export async function POST(req: Request) {
  // 1. Verify authentication
  const session = await getServerSession();
  if (!session?.user?.id) {
    return Response.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // 2. Use userId from session (trusted source)
  const body = await req.json();
  const alert = await prisma.alert.create({
    data: {
      userId: session.user.id,  // ✅ From session, not client
      symbol: body.symbol,
      // ...
    }
  });
  return Response.json(alert);
}

Policy Violated:
01-approval-policies.md Section 1.2: "All protected routes must verify authentication"

Awaiting human approval to implement the suggested fix.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### How Human Should Respond

```
Decision: Implement the suggested fix + add to policy

Actions:
1. Apply the authentication fix
2. Scan ALL API routes for similar missing auth checks
3. Add to 01-approval-policies.md:
   "CRITICAL CHECK: Every /api/* route MUST start with authentication check.
    Use userId from session, NEVER accept userId from request body."
4. Create test case to verify auth is checked

Proceed with implementation.
```

---

## 2. API CONTRACT VIOLATIONS (CAN'T AUTO-FIX)

### When to Escalate

**Escalate when:**

- OpenAPI spec requires a field that doesn't exist in database schema
- Response structure doesn't match OpenAPI after 3 auto-fix attempts
- Missing required fields that require schema changes
- Type mismatches between OpenAPI and Prisma schema
- Endpoint defined in OpenAPI but requirements unclear
- Status codes in implementation don't match spec

### What Information to Include

```
Issue Type: API Contract Violation
File: [filename]
Severity: High
Contract: [trading_alerts_openapi.yaml | flask_mt5_openapi.yaml]

Problem:
[Explain the mismatch between OpenAPI spec and implementation]

OpenAPI Spec Says:
[Relevant YAML excerpt]

Current Implementation:
[Code snippet]

Why Auto-Fix Failed:
[What you tried and why it didn't work]

Options:
1. [Change database schema to match OpenAPI]
   Pros: [...]
   Cons: [...]

2. [Change OpenAPI spec to match database]
   Pros: [...]
   Cons: [...]

3. [Add transformation layer]
   Pros: [...]
   Cons: [...]

Recommendation:
[Your suggested approach with reasoning]
```

### Example Escalation

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ESCALATION: API Contract Violation ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue Type: API Contract Violation
File: app/api/alerts/route.ts
Severity: High
Contract: trading_alerts_openapi.yaml

Problem:
OpenAPI spec defines AlertResponse with a "triggeredAt" field (string | null),
but the Prisma Alert model doesn't have this field. Can't return field that
doesn't exist in database.

OpenAPI Spec Says:
AlertResponse:
  type: object
  required: [id, userId, symbol, timeframe, condition, isActive, createdAt, triggeredAt]
  properties:
    # ...
    triggeredAt:
      type: string
      format: date-time
      nullable: true
      description: "When the alert was last triggered"

Current Prisma Schema:
model Alert {
  id          String   @id @default(cuid())
  userId      String
  symbol      String
  timeframe   String
  condition   String
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  // ❌ No triggeredAt field

  user User @relation(fields: [userId], references: [id])
}

Why Auto-Fix Failed:
- Attempt 1: Tried returning null for triggeredAt, but OpenAPI requires it to match DateTime format when present
- Attempt 2: Tried transforming createdAt to triggeredAt, but semantically incorrect
- Attempt 3: Can't auto-add database fields (requires schema migration)

Options:
1. Add "triggeredAt DateTime?" to Prisma schema + migration
   Pros:
   - Matches OpenAPI contract
   - Useful feature (track when alerts trigger)
   - Null-safe for existing alerts
   Cons:
   - Requires database migration on Railway
   - Adds complexity to alert triggering logic

2. Remove "triggeredAt" from OpenAPI spec
   Pros:
   - No database changes needed
   - Simpler implementation
   Cons:
   - Loses planned feature
   - May have been in spec for a reason

3. Return computed value (e.g., always null or always createdAt)
   Pros:
   - No database changes
   - Keeps OpenAPI contract
   Cons:
   - Misleading data
   - Not semantically correct

Recommendation: Option 1 (Add to database schema)

Reasoning:
- "triggeredAt" is semantically different from "createdAt"
- Feature makes sense: track when alert last triggered
- OpenAPI-first design: if it's in the spec, it was planned
- Migration is safe: nullable field, existing alerts get null

Migration Impact:
- Existing alerts: triggeredAt will be null (safe)
- New alerts: triggeredAt will be null until first trigger
- No data loss risk

Awaiting human decision on which option to pursue.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### How Human Should Respond

```
Decision: Option 1 - Add triggeredAt to database schema

Actions:
1. Update prisma/schema.prisma:
   model Alert {
     // ... existing fields ...
     triggeredAt DateTime?  // ← Add this
   }

2. Create migration:
   npx prisma migrate dev --name add_triggered_at_to_alerts

3. Deploy migration to Railway:
   DATABASE_URL=[Railway] npx prisma migrate deploy

4. Verify migration in Railway dashboard

5. Update 03-architecture-rules.md:
   "Schema changes must be tested locally, then deployed to Railway
    before continuing with implementation."

6. After migration complete, continue implementing API route

Proceed with schema change.
```

---

## 3. POLICY CONFLICTS OR GAPS

### When to Escalate

**Escalate when:**

- Two policies contradict each other
- Scenario not covered by any existing policy
- Unclear which policy takes precedence
- Multiple valid interpretations of a policy
- Edge case that policies don't address
- Ambiguous wording in policy documents

### What Information to Include

```
Issue Type: Policy Conflict / Policy Gap
File: [filename]
Severity: Medium
Policy Documents: [which policies are involved]

Problem:
[Explain the contradiction or gap]

Conflicting Policies:
Policy A (01-approval-policies.md): [excerpt]
Policy B (03-architecture-rules.md): [excerpt]

OR

Missing Policy:
Scenario: [describe the situation]
Current policies don't address: [what's unclear]

Impact on Current Task:
[How this blocks progress]

Suggested Policy Update:
[Proposed clarification or new policy]
```

### Example Escalation

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ESCALATION: Policy Gap ⚠━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue Type: Policy Gap
File: app/api/users/[id]/route.ts
Severity: Medium
Policy Documents: 01-approval-policies.md, 02-quality-standards.md

Problem:
Implementing GET /api/users/[id] endpoint. User requests their own profile
but their account has isActive=false. Policies don't specify how to handle
inactive accounts.

Missing Policy:
Scenario: Authenticated user with isActive=false tries to access their data

Options:
1. Return 401 Unauthorized (treat as not authenticated)
2. Return 403 Forbidden (treat as authenticated but restricted)
3. Return 200 OK with data (allow read access to inactive accounts)
4. Return 200 OK with warning message (allow access + notify)

Each approach is valid, but policy doesn't specify which to use.

Impact on Current Task:
Can't complete GET /api/users/[id] endpoint without knowing how to handle
inactive users. Same question will arise for other endpoints.

Similar Scenarios:
- POST /api/alerts with isActive=false user
- GET /api/dashboard with isActive=false user
- All protected routes need consistent behavior

Suggested Policy Update:
Add to 01-approval-policies.md Section 1.2 "Authentication Requirements":

"Inactive Account Handling:
- isActive=false users are authenticated but restricted
- GET requests to own data: Allow (200 OK) + include warning
- POST/PATCH/DELETE requests: Deny (403 Forbidden)
- Response for restricted actions:
  {
    error: 'Account inactive',
    message: 'Contact support to reactivate your account',
    supportEmail: 'support@example.com'
  }
- All endpoints must check isActive for write operations"

Awaiting human decision on inactive account handling.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### How Human Should Respond

```
Decision: Approve suggested policy with minor modification

Modification:
Allow inactive users to view their own data, but deny ALL modifications.
Also deny access to dashboard (force to account reactivation page).

Updated Policy:
"Inactive Account Handling (isActive=false):
- Authentication: User is authenticated (session valid)
- Authorization: Restricted to read-only of own data
- GET /api/users/{self}: Allow (200 OK) with { warning: 'Account inactive' }
- GET /api/dashboard: Redirect to /account/reactivate (or 403)
- POST/PATCH/DELETE: Deny (403 Forbidden) with reactivation message
- Other users accessing inactive user's data: Treated as not found (404)"

Actions:
1. Add this policy to 01-approval-policies.md Section 1.2
2. Create lib/auth/check-active.ts helper function:
   export function requireActiveAccount(user: User) {
     if (!user.isActive) {
       throw new ForbiddenError('Account inactive. Contact support.');
     }
   }
3. Use this helper in all write operations
4. Continue implementing endpoints with this pattern

Proceed with policy update and implementation.
```

---

## 4. ARCHITECTURAL DESIGN DECISIONS

### When to Escalate

**Escalate when:**

- Multiple valid architectural approaches exist
- Need to choose between patterns (Server Component vs Client Component)
- Introducing new folder structure not in v5-structure-division.md
- Choosing state management approach (local vs context vs URL)
- Deciding data fetching strategy (Server Component vs API route)
- Choosing component composition pattern
- Performance trade-offs with multiple valid solutions

### What Information to Include

```
Issue Type: Architectural Decision
File: [filename or feature]
Severity: Medium
Decision Area: [State Management | Component Pattern | Data Fetching | etc.]

Problem:
[Describe the architectural question]

Context:
[Why this decision is needed now]

Options:
1. [Approach 1]
   Pros: [...]
   Cons: [...]
   Performance: [...]
   Maintainability: [...]

2. [Approach 2]
   Pros: [...]
   Cons: [...]
   Performance: [...]
   Maintainability: [...]

3. [Approach 3]
   Pros: [...]
   Cons: [...]
   Performance: [...]
   Maintainability: [...]

Impact:
- Affects: [which parts of the codebase]
- Future implications: [what this locks in]
- Reversibility: [easy to change later? or permanent decision?]

Recommendation:
[Your suggested approach with detailed reasoning]
```

### Example Escalation

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ESCALATION: Architectural Decision ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue Type: Architectural Decision
File: app/dashboard/alerts/page.tsx (and related components)
Severity: Medium
Decision Area: Data Fetching Strategy

Problem:
Need to decide how to fetch and display alerts on the dashboard page.
Multiple valid approaches in Next.js 15 App Router.

Context:
- Dashboard needs to show user's alerts
- Alerts update when user creates/deletes via forms
- Need real-time-ish updates (within ~30 seconds)
- Good UX requires loading states

Options:

1. Server Component with Database Direct Fetch
export default async function AlertsPage() {
  const alerts = await prisma.alert.findMany({ where: { userId } });
  return <AlertList alerts={alerts} />;
}

Pros:
  - No API route needed (less code)
  - Fastest initial page load (no client fetch)
  - SEO friendly (fully rendered HTML)
  - Zero client JavaScript for data fetching

Cons:
  - Refresh requires full page reload
  - Can't easily poll for updates
  - Hard to show optimistic updates after creating alert
  - Database queries in page files (couples presentation to data layer)

Performance: Excellent (initial load), Poor (updates)
Maintainability: Medium (database logic in pages)

2. Server Component + Client Component with API Polling
// app/dashboard/alerts/page.tsx (Server Component)
export default async function AlertsPage() {
  const initialAlerts = await prisma.alert.findMany({ where: { userId } });
  return <AlertListClient initialAlerts={initialAlerts} />;
}

// components/alerts/alert-list-client.tsx (Client Component)
'use client';
export function AlertListClient({ initialAlerts }) {
  const [alerts, setAlerts] = useState(initialAlerts);

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch('/api/alerts');
      const data = await res.json();
      setAlerts(data);
    }, 30000);  // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  return <AlertList alerts={alerts} />;
}

Pros:
  - Fast initial load (Server Component)
  - Auto-updates every 30s (polling)
  - Can show optimistic updates
  - Separation of concerns (API route handles data)

Cons:
  - More code (Server Component + Client Component + API route)
  - Polling adds API requests (rate limit consideration)
  - Slight delay before updates appear

Performance: Excellent (initial), Good (updates every 30s)
Maintainability: High (clear separation)

3. Client Component Only with SWR/React Query
'use client';
export function AlertsPage() {
  const { data: alerts, mutate } = useSWR('/api/alerts', fetcher, {
    refreshInterval: 30000,
  });

  if (!alerts) return <Loading />;
  return <AlertList alerts={alerts} onUpdate={mutate} />;
}

Pros:
  - Built-in caching, revalidation, polling
  - Easy optimistic updates
  - Deduplicates requests
  - Well-tested library

Cons:
  - Requires SWR dependency
  - Client-side only (no SSR of alerts)
  - Slower initial page load (shows loading spinner)
  - SEO: no alert data in HTML

Performance: Poor (initial load), Excellent (updates)
Maintainability: High (library handles complexity)

Impact:
- Affects: All dashboard pages (alerts, watchlist, charts)
- Future implications: Sets pattern for all data fetching
- Reversibility: Medium (can change, but affects many components)

Recommendation: Option 2 (Hybrid Server + Client with Polling)

Reasoning:
1. Best of both worlds: Fast initial load + auto-updates
2. No new dependencies (uses built-in Next.js features)
3. SEO friendly (Server Component renders initial data)
4. Polling acceptable for FREE tier (60 req/h supports 2 req/min)
5. Can add WebSocket later without changing architecture
6. Maintains separation of concerns (API routes for data)
7. Easy to add optimistic updates when needed

FREE tier impact:
- 60 requests/hour limit
- 30s polling = 2 requests/min = ~120 requests/hour IF user stays on page
- Problem: Exceeds limit if user stays on dashboard for >30 minutes

Solution: Pause polling when tab not focused
window.addEventListener('visibilitychange', () => {
  if (document.hidden) clearInterval(interval);
  else startPolling();
});

Awaiting human decision on data fetching architecture.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### How Human Should Respond

```
Decision: Option 2 (Hybrid) with visibility-based polling

Modifications:
- Use 60s polling (not 30s) to reduce API calls
- Pause polling when tab hidden (save requests)
- For PRO tier: can use 30s polling (higher rate limit)

Additional Requirements:
- Show "Last updated: X seconds ago" timestamp
- Add manual refresh button
- Clear polling interval on unmount

Actions:
1. Add to 03-architecture-rules.md:
   "Data Fetching Pattern for Dashboard Pages:
    - Use Server Component for initial data fetch (SSR)
    - Pass to Client Component for polling/updates
    - Polling intervals: FREE 60s, PRO 30s
    - Pause polling when tab not visible
    - Always provide manual refresh button"

2. Create utility: lib/hooks/use-polling.ts for reusable polling logic
3. Implement pattern for alerts page
4. Use same pattern for watchlist, charts pages

Proceed with implementation.
```

---

## 5. DEPENDENCY ADDITIONS

### When to Escalate

**Escalate when:**

- New npm package needed (not in pre-approved list)
- New pip package needed for Flask
- Alternative library proposed (e.g., dayjs vs date-fns)
- Dependency adds significant bundle size (>100KB)
- Dependency has security vulnerabilities reported
- Dependency is not actively maintained
- Multiple dependencies solve same problem

### What Information to Include

```
Issue Type: New Dependency Required
File: [where you need it]
Severity: Low/Medium
Package: [npm package name] OR [pip package name]

Problem:
[Why you need this dependency]

Use Cases:
[Specific features you need from this package]

Options:
1. [Package A]
   - Bundle size: [size]
   - Weekly downloads: [number]
   - Last updated: [date]
   - Pros: [...]
   - Cons: [...]

2. [Package B]
   - Bundle size: [size]
   - Weekly downloads: [number]
   - Last updated: [date]
   - Pros: [...]
   - Cons: [...]

3. [No dependency - implement yourself]
   - Effort: [hours]
   - Pros: [...]
   - Cons: [...]

Security:
- Known vulnerabilities: [check npm audit or snyk]
- Maintainer reputation: [...]
- TypeScript support: [yes/no]

Recommendation:
[Your suggested approach with reasoning]
```

### Example Escalation

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ESCALATION: New Dependency Required ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue Type: New Dependency Required
File: lib/utils/date-helpers.ts
Severity: Low
Package: date-fns (npm)

Problem:
Need to format dates, calculate time differences, and handle timezones
for alert timestamps and chart data. JavaScript's native Date API is
verbose and error-prone for these operations.

Use Cases:
1. Format alert createdAt: "2 hours ago", "Yesterday", "Jan 5, 2024"
2. Calculate time until alert triggers
3. Convert MT5 timestamps to user's timezone
4. Parse ISO dates from API responses

Options:

1. date-fns
   - Bundle size: ~20KB (tree-shakeable, only import what you use)
   - Weekly downloads: 46 million
   - Last updated: 2 weeks ago
   - TypeScript: Full TypeScript support
   - Pros:
     * Functional, immutable approach
     * Tree-shakeable (small bundle impact)
     * Most popular (proven, well-tested)
     * Excellent TypeScript types
     * Large community, many examples
   - Cons:
     * No timezone support built-in (needs date-fns-tz)
     * Slightly verbose API

2. dayjs
   - Bundle size: ~7KB (smaller)
   - Weekly downloads: 18 million
   - Last updated: 6 months ago
   - TypeScript: TypeScript types available
   - Pros:
     * Smaller bundle size
     * API similar to moment.js (familiar)
     * Plugin system for features
   - Cons:
     * Less popular than date-fns
     * Mutable API (less functional)
     * Plugin system adds complexity

3. Luxon
   - Bundle size: ~70KB (much larger)
   - Weekly downloads: 8 million
   - Last updated: 3 months ago
   - TypeScript: Full TypeScript support
   - Pros:
     * Excellent timezone support built-in
     * Immutable
     * Modern API
   - Cons:
     * Large bundle size (70KB)
     * Less popular
     * Steeper learning curve

4. Native Date + Intl API (no dependency)
   - Bundle size: 0KB
   - Effort: ~4 hours to implement helpers
   - Pros:
     * No dependency
     * Zero bundle size
     * Built into browser
   - Cons:
     * Verbose, complex code
     * Easy to make timezone mistakes
     * Need to write and maintain custom helpers
     * No relative time formatting built-in

Security:
- date-fns: No known vulnerabilities
- dayjs: No known vulnerabilities
- Luxon: No known vulnerabilities
- All three are actively maintained by reputable developers

Recommendation: date-fns + date-fns-tz

Reasoning:
1. Most popular (46M weekly downloads = battle-tested)
2. Tree-shakeable (only import formatDistanceToNow, not entire library)
3. Actual bundle impact: ~5KB (only the functions we use)
4. Excellent TypeScript support (better DX)
5. date-fns-tz adds timezone support when needed
6. Functional, immutable API (aligns with React patterns)
7. Widely used in React/Next.js ecosystem

Usage estimate:
- Import only: formatDistanceToNow, format, parseISO, differenceInSeconds
- Estimated bundle impact: 5-7KB
- Used in: ~10 files (alert lists, dashboards, charts)

Approve adding date-fns + date-fns-tz?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### How Human Should Respond

```
Decision: Approved - Add date-fns + date-fns-tz

Actions:
1. Install: pnpm add date-fns date-fns-tz
2. Add to 03-architecture-rules.md pre-approved dependencies:
   - date-fns (date formatting and manipulation)
   - date-fns-tz (timezone support)
3. Create helper file: lib/utils/date-helpers.ts with common functions:
   - formatRelativeTime(date: Date): string
   - formatDateTime(date: Date): string
   - calculateTimeUntil(date: Date): string
4. Import only what you need (tree-shaking)
5. Document in 02-quality-standards.md:
   "Use date-fns for date operations, NOT native Date manipulation"

Proceed with installation and implementation.
```

---

## 6. DATABASE MIGRATIONS

### When to Escalate

**Escalate when:**

- Adding new table/model to Prisma schema
- Adding/removing fields from existing models
- Changing field types (data migration may be required)
- Adding/removing relations between models
- Changing unique constraints or indexes
- Any schema change that affects production data

### What Information to Include

```
Issue Type: Database Schema Change
File: prisma/schema.prisma
Severity: High
Migration Type: [Add Table | Add Field | Change Type | etc.]

Problem:
[Why this schema change is needed]

Proposed Schema Change:
[Before/after diff of schema.prisma]

Migration SQL (preview):
[Run: npx prisma migrate dev --create-only]
[Show SQL that Prisma will generate]

Impact Analysis:
- Existing data: [what happens to existing rows]
- Downtime: [is downtime required?]
- Reversibility: [can this be rolled back?]
- Affected queries: [what code needs updates]

Risk Assessment:
- Data loss risk: [Low/Medium/High]
- Performance impact: [adding indexes, large table scans, etc.]
- Breaking changes: [does existing code break?]

Migration Plan:
1. Local: [test migration locally]
2. Railway: [deploy migration to production]
3. Verification: [how to verify migration succeeded]
4. Rollback plan: [if migration fails]
```

### Example Escalation

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ESCALATION: Database Schema Change ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue Type: Database Schema Change
File: prisma/schema.prisma
Severity: High
Migration Type: Add Field (nullable)

Problem:
Need to add "triggeredAt" field to Alert model to track when alerts
were last triggered. Required to match OpenAPI spec and implement
alert triggering feature.

Proposed Schema Change:

BEFORE:
model Alert {
  id          String   @id @default(cuid())
  userId      String
  symbol      String
  timeframe   String
  condition   String
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([isActive])
}

AFTER:
model Alert {
  id          String   @id @default(cuid())
  userId      String
  symbol      String
  timeframe   String
  condition   String
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  triggeredAt DateTime?  // ← NEW FIELD (nullable)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([isActive])
}

Migration SQL (preview):
-- AlterTable
ALTER TABLE "Alert" ADD COLUMN "triggeredAt" TIMESTAMP(3);

Impact Analysis:
- Existing data: All existing alerts will have triggeredAt = NULL (safe)
- Downtime: No downtime (adding nullable field is non-blocking in PostgreSQL)
- Reversibility: Can rollback easily (just remove column)
- Affected queries:
  * No existing queries break (field is nullable)
  * New code needs to handle null vs date

Risk Assessment:
- Data loss risk: LOW (no data deleted)
- Performance impact: NONE (nullable field, no default value computation)
- Breaking changes: NONE (existing code unaffected)

Migration Plan:

1. Local Testing:
```

npx prisma migrate dev --name add_triggered_at_to_alert
npx prisma studio # Verify existing alerts have null triggeredAt

```

2. Railway Deployment:
```

DATABASE_URL="postgresql://..." npx prisma migrate deploy

````

3. Verification:
- Check Railway dashboard for migration success
- Run query: SELECT id, triggeredAt FROM "Alert" LIMIT 5;
- Verify existing alerts have NULL triggeredAt
- Create test alert, verify structure

4. Rollback Plan (if needed):
```sql
ALTER TABLE "Alert" DROP COLUMN "triggeredAt";
````

5. Code Updates After Migration:
   - Update API responses to include triggeredAt
   - Implement alert triggering logic to set this field
   - Update frontend to display "Last triggered: X ago"

Awaiting human approval to proceed with migration.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```

### How Human Should Respond

```

Decision: Approved - Proceed with migration

Pre-Migration Checklist:

- [ ] Backup Railway database (Railway dashboard → Database → Create backup)
- [ ] Migration tested locally successfully
- [ ] Migration SQL reviewed (just ADD COLUMN, no data changes)
- [ ] Low-risk migration (nullable field, no constraints)

Actions:

1. Test migration locally (DONE per your message)
2. Create Railway backup (I'll do this now)
3. Run migration on Railway:
   DATABASE_URL=[Railway URL] npx prisma migrate deploy
4. Verify in Railway:
   - Check migrations table
   - Query Alert table
   - Confirm triggeredAt column exists
5. Continue implementing alert triggering logic
6. Update PROGRESS.md: "Added triggeredAt field via migration"

Proceed after confirming Railway backup is complete.

```

---

## 7. BREAKING CHANGES

### When to Escalate

**Escalate when:**
- Changing API response structure that frontend depends on
- Removing API endpoints
- Changing required fields in request/response
- Modifying authentication requirements
- Changing URL structure
- Renaming database fields that affect queries
- Changing function signatures in shared utilities

### What Information to Include

```

Issue Type: Breaking Change
File: [filename]
Severity: High
Change Type: [API Response | Endpoint Removal | Schema Change | etc.]

Problem:
[Why this breaking change is needed]

Current Behavior:
[What currently exists]

Proposed Behavior:
[What you want to change to]

Breaking Impact:

- Frontend: [what breaks in UI]
- API contracts: [which endpoints affected]
- Database: [schema changes needed]
- External services: [integrations affected]

Migration Path:
[How to transition from old to new]

Options:

1. [Immediate breaking change]
2. [Versioned API approach]
3. [Gradual migration with deprecation]

```

### Example Escalation

```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ ESCALATION: Breaking Change ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue Type: Breaking Change
File: app/api/alerts/route.ts
Severity: High
Change Type: API Response Structure

Problem:
Current GET /api/alerts endpoint returns Alert[] directly (array).
To support pagination, sorting, and filtering, need to wrap response
in object with metadata. This changes response structure.

Current Behavior:
GET /api/alerts → Returns:
[
{ id: "1", symbol: "EURUSD", ... },
{ id: "2", symbol: "BTCUSD", ... }
]

Frontend code expects:
const res = await fetch('/api/alerts');
const alerts: Alert[] = await res.json();
setAlerts(alerts);

Proposed Behavior:
GET /api/alerts → Returns:
{
data: [
{ id: "1", symbol: "EURUSD", ... },
{ id: "2", symbol: "BTCUSD", ... }
],
pagination: {
page: 1,
pageSize: 20,
total: 45,
totalPages: 3
},
filters: {
isActive: true
}
}

Frontend code must change to:
const res = await fetch('/api/alerts?page=1');
const json = await res.json();
const alerts = json.data; // ← Changed
setAlerts(alerts);

Breaking Impact:

- Frontend: All components fetching /api/alerts will break
  - components/alerts/alert-list.tsx
  - app/dashboard/alerts/page.tsx
  - hooks/use-alerts.ts
- API contract: Violates current OpenAPI spec
- Database: No changes needed
- External services: None (internal API only)

Migration Path:

Option 1: Immediate Breaking Change (NOT RECOMMENDED)

1. Update API route to return new structure
2. Update frontend to expect new structure
3. Deploy both simultaneously
   Pros: Simple, clean break
   Cons: Must update all frontend code before deploying
   Risk of missing a component

Option 2: Versioned API (/api/v1/alerts vs /api/v2/alerts)

1. Create new endpoint: /api/v2/alerts with new structure
2. Keep /api/alerts unchanged (old structure)
3. Migrate frontend components one by one to /api/v2/alerts
4. Once all migrated, deprecate /api/alerts
   Pros: No breakage, gradual migration
   Cons: Maintains two endpoints temporarily
   More code to maintain

Option 3: Query Parameter Opt-In (RECOMMENDED)

1. Update API to check query param: ?paginated=true
2. If ?paginated=true → return new structure
3. If no param → return old structure (backward compatible)
4. Migrate frontend components to use ?paginated=true
5. After all migrated, make pagination default (remove param)
6. Eventually remove old structure support
   Pros: Backward compatible, gradual migration, no duplicate endpoints
   Cons: Slight complexity in API route logic temporarily

Recommended: Option 3 (Query Parameter Opt-In)

Implementation:
export async function GET(req: Request) {
const { searchParams } = new URL(req.url);
const paginated = searchParams.get('paginated') === 'true';
const page = parseInt(searchParams.get('page') || '1');
const pageSize = parseInt(searchParams.get('pageSize') || '20');

const alerts = await getUserAlerts(userId);

if (paginated) {
// New structure
return Response.json({
data: alerts.slice((page - 1) _ pageSize, page _ pageSize),
pagination: {
page,
pageSize,
total: alerts.length,
totalPages: Math.ceil(alerts.length / pageSize),
},
});
} else {
// Old structure (backward compatible)
return Response.json(alerts);
}
}

Migration Timeline:

- Week 1: Deploy API with opt-in pagination
- Week 2: Update frontend components to use ?paginated=true
- Week 3: Make pagination default, deprecate old structure
- Week 4: Remove old structure support

Awaiting human decision on breaking change approach.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```

### How Human Should Respond

```

Decision: Option 3 (Query Parameter Opt-In) - Approved

Actions:

1. Implement dual-mode API route as suggested
2. Update OpenAPI spec to document both modes
3. Add deprecation notice to old mode:
   WARNING header: "Deprecated - use ?paginated=true for new structure"
4. Update 03-architecture-rules.md:
   "Breaking API Changes: Use query param opt-in for gradual migration"
5. Create tracking issue: "Migrate all components to paginated API"
6. After ALL components migrated (verify via grep), remove old mode

Proceed with implementation. Create TODO in code:
// TODO: Remove backward compatibility (non-paginated mode) after 2024-02-01
// when all frontend components migrated

```

---

Due to character limits, I'll create a second file to continue with sections 8-10 and the summary.
## 8. CLAUDE CODE VALIDATION FAILURES

### When to Escalate

**Escalate when:**
- >3 High severity issues after auto-fix attempts
- Any Critical issues detected
- Repeated auto-fix failures (3 attempts exhausted for same issue)
- Unclear how to fix validation errors
- Validation errors contradict policy requirements
- False positives from validator

### What Information to Include

```

Issue Type: Claude Code Validation Failure
File: [filename]
Severity: Critical/High
Attempts: [number of fix attempts made]

Validation Results:

- Critical: [count]
- High: [count]
- Medium: [count]
- Low: [count]

Issue Details:
[List each High/Critical issue with line numbers]

Auto-Fix Attempts:
Attempt 1: [what you tried]
Result: [still failed - why?]

Attempt 2: [what you tried]
Result: [still failed - why?]

Attempt 3: [what you tried]
Result: [still failed - why?]

Root Cause Analysis:
[Why fixes aren't working - misunderstood requirement? conflicting policies?]

Options:

1. [Try different approach]
2. [Update policy that's causing conflict]
3. [Accept validation issue as false positive]

```

### Example Escalation

```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ ESCALATION: Claude Code Validation Failure ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue Type: Claude Code Validation Failure
File: app/api/indicators/[symbol]/[timeframe]/route.ts
Severity: High
Attempts: 3 (exhausted)

Validation Results:

- Critical: 0
- High: 4
- Medium: 2
- Low: 1

High Severity Issues:

1. Line 45: Missing tier validation for timeframe access
2. Line 67: MT5 API call not wrapped in try/catch
3. Line 89: Response doesn't match OpenAPI schema (missing "metadata" field)
4. Line 102: No rate limiting check before expensive operation

Auto-Fix Attempts:

Attempt 1:

- Added try/catch around MT5 call (fixed issue #2)
- Added tier validation for symbol (but forgot timeframe - issue #1 remains)
  Result: Still 3 High issues

Attempt 2:

- Added timeframe validation (fixed issue #1)
- Added "metadata" field to response (fixed issue #3)
  Result: Still 2 High issues (new issue appeared: metadata structure wrong)

Attempt 3:

- Fixed metadata structure
- Added rate limiting check (fixed issue #4)
  Result: 1 High issue remains (metadata now causes schema mismatch)

Root Cause Analysis:
The "metadata" field requirement is unclear:

- Claude Code validation requires it (based on OpenAPI)
- OpenAPI spec shows: metadata?: { fetchedAt: string; source: string }
- But when I add it, validation says structure doesn't match
- Possible issues:
  1. My understanding of metadata structure is wrong
  2. OpenAPI spec has error
  3. Claude Code validation has false positive
  4. Missing type definition somewhere

Current Code:
export async function GET(
req: Request,
{ params }: { params: { symbol: string; timeframe: string } }
) {
// 1. Authentication ✅
const session = await getServerSession();
if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

// 2. Rate limiting ✅
await checkRateLimit(session.user.id);

// 3. Tier validation ✅
const userTier = session.user.tier || 'FREE';
validateChartAccess(userTier, params.symbol, params.timeframe);

// 4. Fetch data ✅
try {
const data = await fetchFromMT5(params.symbol, params.timeframe);

    return Response.json({
      symbol: params.symbol,
      timeframe: params.timeframe,
      indicators: data.indicators,
      metadata: {  // ← Validation says this is wrong, but matches spec?
        fetchedAt: new Date().toISOString(),
        source: 'MT5'
      }
    });

} catch (error) {
console.error('MT5 fetch error:', error);
return Response.json({ error: 'Failed to fetch data' }, { status: 500 });
}
}

OpenAPI Spec (trading_alerts_openapi.yaml):
IndicatorResponse:
type: object
required: [symbol, timeframe, indicators]
properties:
symbol: { type: string }
timeframe: { type: string }
indicators: { $ref: '#/components/schemas/IndicatorData' }
metadata: # ← Optional field
type: object
properties:
fetchedAt: { type: string, format: date-time }
source: { type: string }

My metadata structure matches the spec exactly, but validation still flags it.

Options:

1. Generate types from OpenAPI and use them (ensures exact match)
   sh scripts/openapi/generate-nextjs-types.sh
   import { IndicatorResponse } from '@/lib/api-client'
   Pros: Type-safe, guaranteed to match
   Cons: Should have done this from start

2. Make metadata optional and omit if validation fails
   Pros: Unblocks progress
   Cons: Loses potentially useful field

3. Ask human to review OpenAPI spec for errors
   Pros: Might find actual spec issue
   Cons: Delays progress

Recommendation: Option 1 (Use auto-generated types)

Reasoning:

- Should be using generated types anyway (policy requirement)
- Guarantees match with OpenAPI spec
- Type-safe at compile time
- Solves root cause (not using contract-first types)

Awaiting human guidance on validation failure resolution.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```

### How Human Should Respond

```

Decision: Option 1 - Use auto-generated types

Root Cause:
You're manually constructing response instead of using generated types from OpenAPI.
This is exactly why we have type generation - to prevent these mismatches.

Actions:

1. Generate types (if not already done):
   sh scripts/openapi/generate-nextjs-types.sh

2. Import and use generated types:
   import type { IndicatorResponse } from '@/lib/api-client';

   export async function GET(...): Promise<Response> {
   // ...
   const response: IndicatorResponse = {
   symbol: params.symbol,
   timeframe: params.timeframe,
   indicators: data.indicators,
   metadata: {
   fetchedAt: new Date().toISOString(),
   source: 'MT5'
   }
   };

   return Response.json(response);
   }

3. TypeScript will now catch any mismatch at compile time

4. Update 01-approval-policies.md to emphasize:
   "CRITICAL: Always use auto-generated types from lib/api-client.
   Never manually define response shapes that exist in OpenAPI."

5. Add to 02-quality-standards.md:
   "Import response types from OpenAPI-generated lib/api-client, not manual interfaces."

Lesson Learned:
This validation failure happened because policy wasn't specific enough about
ALWAYS using generated types. Update policies to prevent future occurrences.

Proceed with using generated types.

```

---

## 9. UNCLEAR REQUIREMENTS

### When to Escalate

**Escalate when:**
- Specs are ambiguous or contradictory
- Missing information needed for implementation
- Conflicting requirements from different docs
- Edge cases not covered by specs
- Business logic unclear
- Multiple valid interpretations possible

### What Information to Include

```

Issue Type: Unclear Requirement
File: [filename]
Severity: Medium
Requirement Source: [which spec/doc]

Problem:
[Explain what's unclear or contradictory]

What the Specs Say:
[Excerpts from relevant specs]

Ambiguity:
[What's unclear about the requirement]

Interpretation Options:

1. [Interpretation A]
   - Assumes: [...]
   - Implementation: [...]
   - Edge cases: [...]

2. [Interpretation B]
   - Assumes: [...]
   - Implementation: [...]
   - Edge cases: [...]

Impact of Wrong Choice:
[What happens if we choose wrong interpretation]

Questions for Human:

1. [Specific question]
2. [Specific question]
3. [Specific question]

```

### Example Escalation

```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ ESCALATION: Unclear Requirement ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue Type: Unclear Requirement
File: lib/alerts/condition-evaluator.ts
Severity: Medium
Requirement Source: v5_part_k.md (Alert Conditions)

Problem:
The spec mentions users can create "conditions" for alerts (e.g., "RSI > 70"),
but doesn't specify the exact syntax, how to parse them, or what operators
are supported.

What the Specs Say:

From v5_part_k.md:
"Users can set conditions for alerts. When condition is met, alert triggers.
Examples: 'RSI > 70', 'price crosses above 1.1000', 'MACD crosses signal line'"

From trading_alerts_openapi.yaml:
condition:
type: string
minLength: 1
maxLength: 500
description: "Alert trigger condition"
example: "RSI > 70"

Ambiguity:

1. Is condition free-form text or structured format?
2. How do we parse and evaluate conditions?
3. What indicators are supported? (RSI, MACD, price, etc.)
4. What operators are supported? (>, <, =, crosses, etc.)
5. Can conditions be combined? (AND/OR logic)
6. Who evaluates conditions? (Frontend? Backend? External service?)

Interpretation Options:

Option A: Free-Form Text (Simple, No Validation)

- Condition stored as-is in database
- No parsing or validation
- Manual user interpretation
- No automatic triggering
  Pros: Simple to implement, flexible
  Cons: Can't auto-trigger alerts, no validation, unclear UX
  Implementation: Just store string, display it to user

Option B: Predefined Templates (Structured, Limited)

- Dropdown selection: "RSI above", "Price below", etc.
- User fills in values: threshold, symbol, timeframe
- Backend evaluates conditions against MT5 data
  Pros: Parseable, validatable, can auto-trigger
  Cons: Limited flexibility, more UI complexity
  Implementation:
  type ConditionType = 'RSI_ABOVE' | 'RSI_BELOW' | 'PRICE_ABOVE' | 'PRICE_BELOW'
  { type: 'RSI_ABOVE', value: 70, symbol: 'EURUSD', timeframe: 'H1' }

Option C: Simple Expression Parser (Flexible, Complex)

- Support syntax: "RSI > 70", "price < 1.2000"
- Parse with regex or parser library
- Evaluate against MT5 data
  Pros: Flexible like free-form, but parseable
  Cons: Complex parser, validation edge cases, security risk (code injection)
  Implementation: Use expression parser library (e.g., mathjs or custom regex)

Impact of Wrong Choice:

- Option A: Can't implement auto-triggering feature (major feature loss)
- Option B: Users complain about limited flexibility
- Option C: Security risk if parser allows code injection

Questions for Human:

1. Should alerts auto-trigger based on conditions? (If no → Option A ok)
2. If yes, who evaluates conditions? (Backend cron job? Real-time?)
3. What indicators must be supported? (Just RSI? MACD? All indicators?)
4. Should we support complex conditions (AND/OR)? Or simple single conditions?
5. Is there a budget for expression parser library? Or build custom?

Recommended Approach (for MVP):
Option B (Predefined Templates) - Start simple

- Phase 1 (MVP): Support 4 simple conditions:
  - RSI > [value]
  - RSI < [value]
  - Price > [value]
  - Price < [value]
- Phase 2 (Post-MVP): Add more indicators, complex conditions
- Pros: Fast to implement, secure, validatable, auto-triggerable
- Cons: Limited (but sufficient for MVP)

Awaiting human clarification on alert condition requirements.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```

### How Human Should Respond

```

Decision: Option B (Predefined Templates) for MVP

Clarifications:

1. Yes, alerts should auto-trigger (key feature)
2. Backend cron job evaluates every 5 minutes
3. MVP supports: RSI, MACD, Price (3 indicators)
4. Simple single conditions only (no AND/OR for MVP)
5. No external parser library - build simple regex matcher

MVP Condition Types:

- RSI > [value]
- RSI < [value]
- MACD_LINE > SIGNAL_LINE (MACD crosses above signal)
- MACD_LINE < SIGNAL_LINE (MACD crosses below signal)
- PRICE > [value]
- PRICE < [value]

Implementation:

1. Create lib/alerts/condition-types.ts with enum
2. Frontend: Dropdown to select type + input for value
3. Store as JSON in database:
   { type: 'RSI_ABOVE', threshold: 70 }
4. Backend cron: lib/alerts/evaluator.ts evaluates conditions
5. OpenAPI spec: Define ConditionInput schema with discriminated union

Post-MVP (Phase 2):

- Add more indicators (Bollinger Bands, Moving Averages)
- Add AND/OR logic for combining conditions
- Add "crosses above/below" operators

Actions:

1. Update v5_part_k.md with specific condition types for MVP
2. Create ConditionType enum in lib/alerts/condition-types.ts
3. Update OpenAPI spec with structured ConditionInput schema
4. Implement dropdown UI for condition selection
5. Implement backend evaluator (lib/alerts/evaluator.ts)

Proceed with Option B implementation.

```

---

## 10. TEST FAILURES

### When to Escalate

**Escalate when:**
- TypeScript compilation errors after code generation
- Jest unit tests fail after changes
- Integration tests fail unexpectedly
- Build failures (pnpm build)
- E2E tests fail
- Tests pass locally but fail in CI/CD

### What Information to Include

```

Issue Type: Test Failure
File: [test file or source file causing failure]
Severity: High
Test Type: [Unit | Integration | E2E | Compilation | Build]

Error Message:
[Full error message from test runner]

Code Causing Failure:
[Relevant code snippet]

What Changed:
[What you just implemented that triggered the failure]

Why Test is Failing:
[Your analysis of the root cause]

Attempted Fixes:
[What you tried to fix it]

Options:

1. [Fix code to pass test]
2. [Update test to match new behavior]
3. [Disable test temporarily (NOT RECOMMENDED)]

```

### Example Escalation

```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ ESCALATION: Test Failure ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue Type: Test Failure
File: app/api/alerts/route.ts
Severity: High
Test Type: TypeScript Compilation Error

Error Message:
app/api/alerts/route.ts:42:18 - error TS2345: Argument of type 'string | undefined'
is not assignable to parameter of type 'string'.

42 await createAlert(userId, symbol, timeframe);

`````

Type 'string | undefined' is not assignable to type 'string'.
Type 'undefined' is not assignable to type 'string'.

Code Causing Failure:
export async function POST(req: Request) {
const session = await getServerSession();
const userId = session?.user?.id; // Type: string | undefined

const body = await req.json();
const { symbol, timeframe, condition } = body;

// createAlert expects userId: string, but we have string | undefined
await createAlert(userId, symbol, timeframe); // ❌ Type error
}

Function signature:
async function createAlert(
userId: string, // Required, not optional
symbol: string,
timeframe: string
): Promise<Alert>

What Changed:
Just implemented POST /api/alerts endpoint. Added authentication check
which gets userId from session. TypeScript correctly identifies that
session might be null, making userId possibly undefined.

Why Test is Failing:
TypeScript's strict null checks are working as intended. The code has
a potential bug: if session is null/undefined, userId is undefined,
but createAlert requires a string. This would cause a runtime error.

Attempted Fixes:

Option 1: Non-null assertion (UNSAFE - don't do this)
await createAlert(userId!, symbol, timeframe); // ❌ Bypasses type safety

Option 2: Add null check (CORRECT)
if (!userId) {
return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
await createAlert(userId, symbol, timeframe); // ✅ userId is now definitely string

Option 3: Make createAlert accept undefined (WRONG - bad API design)
async function createAlert(userId: string | undefined, ...) {
// Creates alerts with undefined userId? Bad data model
}

Analysis:
Option 2 is correct. The code should check authentication BEFORE
calling createAlert. If userId is undefined, return 401 Unauthorized.
After the check, TypeScript's control flow analysis knows userId is string.

Recommended Fix:
export async function POST(req: Request) {
// 1. Get session
const session = await getServerSession();

// 2. Check authentication EARLY
if (!session?.user?.id) {
return Response.json(
{ error: 'Unauthorized. Please log in.' },
{ status: 401 }
);
}

// 3. After check, userId is guaranteed to be string
const userId = session.user.id; // Type: string (TypeScript knows it's defined)

// 4. Rest of logic
const body = await req.json();
const { symbol, timeframe, condition } = body;

await createAlert(userId, symbol, timeframe); // ✅ No type error
}

This follows 01-approval-policies.md Section 1.2: "All protected routes must
verify authentication BEFORE business logic."

Awaiting approval to implement Option 2 (null check).
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```

### How Human Should Respond

```

Decision: Approved - Implement Option 2 (null check)

This is exactly what TypeScript is supposed to catch! Good job on the
strict type checking.

Actions:

1. Implement the recommended fix (null check before createAlert)
2. Verify TypeScript compilation passes: pnpm type-check
3. Add to 02-quality-standards.md:
   "PATTERN: Always check session?.user?.id for null BEFORE using userId.
   Return 401 if null. After check, TypeScript knows it's defined."
4. This pattern applies to ALL protected API routes

Good example of:

- TypeScript catching bugs at compile time (not runtime)
- Following authentication-first pattern
- Using TypeScript's control flow analysis

Proceed with implementation.

```

---

## ESCALATION MESSAGE FORMAT (STANDARD)

All escalations should follow this format for consistency:

```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ ESCALATION: [CATEGORY] ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue Type: [One of 10 categories]
File: [filename with path]
Severity: [Critical/High/Medium/Low]

Problem:
[Clear 2-3 sentence explanation of the issue]

[Category-Specific Sections - see examples above]

Options:

1. [Option 1]
   Pros: [...]
   Cons: [...]

2. [Option 2]
   Pros: [...]
   Cons: [...]

3. [Option 3]
   Pros: [...]
   Cons: [...]

Recommendation:
[Your best judgment with detailed reasoning]

Awaiting human decision...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```

---

## SUMMARY: When to Escalate

| Category | Trigger | Severity | Can Wait? |
|----------|---------|----------|-----------|
| 1. Security Issues | SQL injection, XSS, auth bypass, exposed secrets | Critical | ❌ No - Escalate immediately |
| 2. API Contract Violations | Response doesn't match OpenAPI after 3 fixes | High | ✅ Yes - After exhausting auto-fixes |
| 3. Policy Conflicts/Gaps | Two policies contradict, scenario not covered | Medium | ✅ Yes - Document and ask |
| 4. Architectural Decisions | Multiple valid approaches, long-term impact | Medium | ✅ Yes - Present options |
| 5. Dependency Additions | New npm/pip package needed | Low | ✅ Yes - Provide analysis |
| 6. Database Migrations | Schema changes, adding/removing fields | High | ❌ No - Requires approval before execution |
| 7. Breaking Changes | API changes that break frontend | High | ❌ No - Coordinate before implementing |
| 8. Validation Failures | >3 High issues or any Critical after 3 attempts | High | ✅ Yes - After 3 attempts |
| 9. Unclear Requirements | Ambiguous specs, missing info | Medium | ✅ Yes - Clarify before implementing |
| 10. Test Failures | TypeScript errors, failed tests | High | ❌ No - Must fix before proceeding |

---

## ESCALATION WORKFLOW

```

1. Detect escalation condition
   ↓
2. STOP autonomous work
   ↓
3. Format escalation message
   ↓
4. Present to human with:
   - Clear problem statement
   - Relevant context/code
   - Options with pros/cons
   - Your recommendation
     ↓
5. WAIT for human response
   ↓
6. Receive decision
   ↓
7. Update relevant policy (if gap found)
   ↓
8. Resume autonomous work

````

**Never:**
- ❌ Continue working while waiting for escalation response
- ❌ Make assumptions about human's decision
- ❌ Skip escalation to "save time"
- ❌ Escalate trivial issues (use auto-fix first)

**Always:**
- ✅ Provide complete context
- ✅ Analyze options thoroughly
- ✅ Make a recommendation
- ✅ Wait patiently for response
- ✅ Update policies after resolution

---

## POLICY IMPROVEMENT AFTER ESCALATION

After every escalation resolution:

1. **Identify the Gap:** What policy was missing/unclear?
2. **Update Policy:** Add rule/clarification to prevent future escalations
3. **Document Decision:** Add example to relevant policy
4. **Test Understanding:** Verify policy now covers the scenario
5. **Commit Policy Update:** Clear commit message explaining what was learned

**Example:**

```bash
git add docs/policies/01-approval-policies.md
git commit -m "Add policy: Always check authentication before userId usage

Learned from escalation: TypeScript caught that session?.user?.id might be
undefined. Added explicit rule to check authentication FIRST, then use userId.

This prevents similar escalations for all protected routes."
git push
````

**Result:** Future similar scenarios auto-approve (no escalation needed).

---

## LEARNING LOOP

```
Escalation
    ↓
Human Decision
    ↓
Policy Update
    ↓
Fewer Future Escalations
    ↓
More Autonomous Work
```

**Goal:** Each escalation makes the system smarter. Over time, escalations decrease as policies become more comprehensive.

---

## 11. AFFILIATE MARKETING SPECIFIC ESCALATIONS

**Applies to:** Part 17 (Affiliate Marketing Platform) - 67 files

The affiliate marketing platform introduces unique escalation scenarios that don't fit cleanly into the above 10 categories but are critical for this feature.

---

### 11.1 Commission Fraud Detection

**Escalate when:**

- Manual commission creation attempted (bypassing Stripe webhook)
- Commission calculation doesn't match formula
- Duplicate commissions detected for same subscription
- Commission created for non-existent affiliate code
- Commission amount manually modified after creation

**Why escalate:** Commission fraud directly impacts business revenue. Human review required for any suspicious activity.

**Example escalation:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ESCALATION: Commission Fraud Detection ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue Type: Critical Security - Commission Fraud
File: app/api/admin/commissions/create/route.ts
Severity: Critical

Problem:
Code attempts to create commission manually via admin endpoint, bypassing
Stripe webhook validation. This enables commission fraud.

Vulnerable Code:
export async function POST(req: NextRequest) {
  const { affiliateId, amount } = await req.json();

  // ❌ NO VALIDATION - Direct commission creation
  await prisma.commission.create({
    data: {
      affiliateId,
      commissionAmount: amount,
      status: 'PENDING'
    }
  });
}

Security Concerns:
1. Bypasses Stripe webhook validation (no proof of payment)
2. No verification of affiliate code usage
3. No validation of amount calculation
4. Enables admin to create arbitrary commissions
5. No audit trail of why commission was created

Policy Violated:
01-approval-policies.md Section 7.3: "MUST create commissions ONLY via
Stripe webhook (not manual creation)"

Recommendation:
REMOVE this endpoint entirely. Commissions should ONLY be created via:
- Stripe webhook: POST /api/webhooks/stripe

If manual commission adjustment needed (for refunds, corrections):
- Create separate endpoint: POST /api/admin/commissions/adjust
- Require reason field (string, min 20 chars)
- Store adjustment in CommissionAdjustment table
- Send notification to affiliate explaining adjustment
- Log action in audit trail

Awaiting human decision on commission creation security policy.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### 11.2 Affiliate Code Distribution Timing

**Escalate when:**

- Unclear when codes should be distributed (registration? verification? approval?)
- Unclear code expiry policy (end of month? fixed duration?)
- Unclear what happens to expired unused codes
- Code distribution frequency not specified

**Why escalate:** Code distribution timing affects affiliate cash flow and business model.

**Example escalation:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ESCALATION: Unclear Requirement ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue Type: Unclear Requirement
File: app/api/cron/distribute-codes/route.ts
Severity: Medium
Requirement Source: AFFILIATE-MARKETING-DESIGN.md

Problem:
Requirements state affiliates get "15 codes per month" but don't specify:
1. When codes are distributed (1st of month? Registration anniversary?)
2. What happens if affiliate registers mid-month (15 codes or pro-rata?)
3. Whether codes expire at month-end or have fixed 30-day duration
4. What happens to unused codes (carry over? expire?)

What the Specs Say:
"Affiliates receive 15 discount codes per month. Codes are cryptographically
random and expire at end of month."

Ambiguities:
- "End of month" = Last day of calendar month OR 30 days from distribution?
- "15 codes per month" = Always 15, or pro-rata if registered mid-month?
- If affiliate registers January 20, do they get:
  - 15 codes valid for 11 days (Jan 20-31)?
  - 15 codes valid for 30 days (Jan 20 - Feb 18)?
  - Pro-rata codes (5 codes for remaining 11 days)?

Options:

1. Calendar Month Distribution (Simplest)
   - All affiliates get codes on 1st of month
   - Codes expire on last day of month
   - Mid-month registrations get full 15 codes (partial month)
   Pros: Simple to implement, predictable schedule
   Cons: Mid-month affiliates only have partial month to use codes

2. Rolling 30-Day Distribution
   - Affiliates get codes on registration + 1st of each month thereafter
   - Codes expire 30 days from creation
   - Mid-month registrations get full 30 days
   Pros: Fair for mid-month affiliates
   Cons: More complex tracking, staggered expirations

3. Pro-Rata Distribution
   - Mid-month affiliates get proportional codes (e.g., 5 codes for 10 days)
   - Codes expire end of calendar month
   - Next month they get full 15
   Pros: Fair allocation based on days available
   Cons: Complex calculation, may frustrate affiliates

Impact on Business:
- Option 1: Simplest, but may discourage mid-month sign-ups
- Option 2: Most fair, but complex code management
- Option 3: Fair but may seem stingy to new affiliates

Questions for Human:
1. Which option aligns with business goals?
2. Do we want to encourage sign-ups at any time (Option 2)?
3. Or prioritize simplicity (Option 1)?
4. Should unused codes carry over or expire?

Recommendation: Option 1 (Calendar Month)

Reasoning:
- Matches "end of month" language in specs
- Simple to implement and explain
- Vercel Cron runs on 1st of month
- Mid-month affiliates still get full 15 codes (slight bonus)
- Clear messaging: "Your 15 codes for [Month] expire on [Last Day]"

Awaiting human clarification on code distribution timing.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### 11.3 Affiliate Payment Processing Security

**Escalate when:**

- Implementing bulk payment functionality
- Processing large commission payments
- Payment method requires manual intervention
- Affiliate requests payment method change after commission earned
- Cryptocurrency payment price volatility during payment

**Why escalate:** Payment processing involves real money and potential fraud.

**Example escalation:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ESCALATION: Architectural Decision ⚠━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue Type: Architectural Decision
File: app/api/admin/commissions/pay/route.ts
Severity: High
Decision Area: Payment Processing Security

Problem:
Need to implement commission payment processing. Requirements don't specify:
1. Should payments be automated or manual approval?
2. What happens if payment fails (bank reject, crypto address invalid)?
3. Should there be payment limits requiring extra approval?
4. What audit trail is needed for payments?

Context:
- Commissions range from $4.64 to potentially hundreds per affiliate
- Payment methods vary (bank transfer, crypto, e-wallets)
- Multiple affiliates may request payment simultaneously
- Need to prevent double-payment or fraud

Options:

1. Fully Manual Payment (Highest Security, Slowest)
   - Admin reviews each commission
   - Admin initiates payment externally (bank portal, crypto wallet)
   - Admin marks as paid manually with reference number
   Pros:
     - Maximum fraud prevention
     - Manual verification of each payment
     - Admin can verify affiliate identity
   Cons:
     - Time-consuming (not scalable)
     - Affiliates wait for admin availability
     - Human error risk (wrong amount, wrong recipient)

2. Semi-Automated with Approval (Balanced)
   - System generates payment batch
   - Admin reviews batch (verify amounts, recipients)
   - Admin approves batch
   - System executes payments via API (if supported)
   - System marks as paid automatically
   Pros:
     - Scalable (batch processing)
     - Admin oversight (approval required)
     - Audit trail (who approved, when)
   Cons:
     - Requires payment API integration
     - Some payment methods (crypto) may still be manual

3. Fully Automated (Fastest, Highest Risk)
   - Cron job processes pending commissions automatically
   - Payments sent via API without approval
   - Only mark as paid after API confirms
   Pros:
     - Fast (affiliates get paid immediately)
     - No admin work required
     - Fully scalable
   Cons:
     - High fraud risk (no human verification)
     - API failures may cause issues
     - Harder to reverse if mistakes made

Security Considerations:
- Payment limits: Should payments >$100 require extra approval?
- Two-factor authentication for payment approval?
- Cooling-off period (commissions must be >7 days old)?
- Affiliate verification before first payment?

Recommendation: Option 2 (Semi-Automated with Approval)

Reasoning:
1. Balances security and efficiency
2. Admin approves but doesn't manually execute
3. Audit trail: who approved, when, why
4. Payment limits can be implemented:
   - <$50: Auto-approved
   - $50-$200: Admin approval required
   - >$200: Manual review + approval
5. Supports phased rollout:
   - Phase 1: All manual (Option 1)
   - Phase 2: Semi-automated (Option 2)
   - Phase 3: Increase auto-approval limits over time

Implementation:
- Create CommissionPaymentBatch table
- Admin creates batch (selects commissions to pay)
- System calculates total, validates payment methods
- Admin reviews and approves
- System processes payments (via API where possible)
- System marks commissions as PAID with paymentReference

Awaiting human decision on payment processing architecture.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### 11.4 Affiliate Dashboard BI Report Performance

**Escalate when:**

- Report queries taking >5 seconds
- Large number of commissions causing pagination issues
- Complex accounting calculations causing timeouts
- Report aggregations causing database load

**Why escalate:** Performance issues affect both affiliate UX and system stability.

**Example escalation:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ESCALATION: Architectural Decision ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue Type: Architectural Decision
File: app/api/affiliate/dashboard/commission-report/route.ts
Severity: Medium
Decision Area: Report Performance Optimization

Problem:
Commission report requires accounting-style aggregations:
- Opening balance (sum all previous months)
- Earned this month (sum commissions)
- Paid this month (sum payments)
- Closing balance (calculation)
- Drill-down to individual commissions

For affiliates with 100+ commissions, query takes 8 seconds.

Current Implementation:
- Calculate opening balance by summing ALL commissions before this month
- Fetch all commissions for this month (no pagination)
- Calculate aggregates in Node.js (not database)

Performance Issues:
- Opening balance requires scanning all historical commissions
- No caching (recalculated every request)
- No pagination (loads all month's commissions)
- Calculations in Node.js (not optimized)

Options:

1. Materialized Monthly Balance Table
   - Create AffiliateMonthlyBalance table
   - Store: affiliateId, month, openingBalance, earned, paid, closingBalance
   - Update via trigger/cron when commissions created/paid
   - Report reads from this table (instant)
   Pros: Fast (O(1) lookup), accurate, supports time-travel queries
   Cons: Additional table, data duplication, requires sync logic

2. Cached Calculations with TTL
   - Cache opening balance in Redis (1 hour TTL)
   - Calculate earned/paid from DB
   - Combine for report
   Pros: Simple, no schema changes
   Cons: May show stale data, cache invalidation complexity

3. Database View with Aggregates
   - Create PostgreSQL view with window functions
   - View calculates running balances
   - Report queries view directly
   Pros: No data duplication, always current
   Cons: View may still be slow, complex SQL

4. Hybrid: Monthly Balance + Current Month Live
   - Store monthly balances for closed months
   - Calculate current month live
   - Combine for report
   Pros: Fast for history, current for this month, simple
   Cons: Need to close months (cron job)

Recommendation: Option 4 (Hybrid)

Reasoning:
- Historical months don't change (safe to store)
- Current month changes frequently (calculate live)
- Cron job runs monthly to close previous month
- Simple to implement and understand
- Fast performance (only calculates current month)

Implementation:
1. Create AffiliateMonthlyBalance table
2. Cron job (1st of month):
   - Calculate last month's final balances
   - Store in AffiliateMonthlyBalance
   - Mark month as CLOSED
3. Report endpoint:
   - Fetch last closed month's closing balance (opening)
   - Calculate current month earned/paid (live query)
   - Combine and return

Performance:
- Historical: O(1) lookup
- Current month: O(n) where n = this month's commissions (<100)
- Total query time: <200ms (fast enough)

Awaiting human decision on report performance optimization.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### 11.5 Affiliate Email Notification Strategy

**Escalate when:**

- Unclear email frequency (immediate? daily digest? weekly?)
- Unclear which events trigger emails
- Email provider rate limits (Resend, SendGrid)
- Concern about email spam complaints

**Why escalate:** Email strategy affects affiliate engagement and system costs.

---

### 11.6 Affiliate Verification Process

**Escalate when:**

- Unclear what verification means (email only? identity? business license?)
- Unclear who can verify (any admin? specific role?)
- Unclear verification criteria (what makes affiliate legitimate?)
- Unclear what happens to codes if affiliate suspended

**Why escalate:** Verification affects platform trust and fraud prevention.

---

## SUMMARY: AFFILIATE ESCALATION QUICK REFERENCE

| Escalation Type           | Trigger                                        | Category         | Severity |
| ------------------------- | ---------------------------------------------- | ---------------- | -------- |
| Commission Fraud          | Manual commission creation, wrong calculation  | Security (1)     | Critical |
| Code Distribution Timing  | When/how often codes distributed               | Unclear Req (9)  | Medium   |
| Payment Processing        | Payment automation level, security             | Architecture (4) | High     |
| Report Performance        | Queries >5s, complex aggregations              | Architecture (4) | Medium   |
| Email Notifications       | Frequency, triggers, spam concerns             | Architecture (4) | Medium   |
| Affiliate Verification    | Verification criteria, who can verify          | Policy Gap (3)   | Medium   |
| Payment Method Change     | Affiliate changes payment method after earning | Architecture (4) | Medium   |
| Cryptocurrency Volatility | Price changes during payment                   | Architecture (4) | Medium   |
| Bulk Payment Errors       | Multiple payments fail simultaneously          | Architecture (4) | High     |
| Code Expiry Disputes      | Affiliate disputes code expiration             | Policy Gap (3)   | Low      |

**Affiliate-specific escalations should reference:**

- AFFILIATE-MARKETING-DESIGN.md (business requirements)
- 03-architecture-rules.md Section 13 (affiliate architecture)
- trading_alerts_openapi.yaml (affiliate/admin API contracts)

---

**Goal:** Each escalation makes the system smarter. Over time, escalations decrease as policies become more comprehensive.

---

**End of Escalation Triggers**

These triggers enable Aider with MiniMax M2 to work autonomously while seeking human guidance for exceptions. Update this document as you learn from escalations!
`````
