## PHASE 1: DOCUMENTATION & POLICY CREATION

### Timeline: Week 1, Days 3-7 (14 hours)

### Goal: Create policies that guide Aider

💡 BEGINNER TIP: This is the MOST IMPORTANT phase! You're creating the "AI constitution" - the rules Aider follows. Quality here = quality later!

---

### MILESTONE 1.0: Setup Project Repository (1.5 hours)

**CRITICAL UNDERSTANDING:** There are **TWO different folder structures** in V7:

1. **📦 V7 RESOURCES Structure** (what you create NOW in Phase 1)
   - Purpose: Store documentation, policies, seed code
   - Location: `trading-alerts-saas-v7/` (your GitHub repo root)
   - Contains: docs/, seed-code/, policies/, scripts/, postman/
   - **This is your "instruction manual" for AI**

2. **🏗️ CODE BUILDING Structure** (what you create LATER in Phase 3)
   - Purpose: The actual Next.js application code
   - Location: `trading-alerts-saas-v7/trading-alerts-saas/` (subfolder)
   - Contains: app/, components/, lib/, prisma/ (per v5-structure-division.md)
   - **This is your actual SaaS application**

**Think of it like this:**

- 📦 Resources = The blueprint, tools, and reference materials
- 🏗️ Code = The actual house you build using the blueprint

💡 **Don't worry!** Phase 3 will guide you to create the code structure. For now, focus on organizing resources!

---☐ STEP 1: Create GitHub Repository (15 minutes)
What: Online home for your project
Why: Store code, enable deployment
How:

1.  Go to GitHub.com
2.  Click "+ New repository"
3.  Name: trading-alerts-saas-v7
4.  Description: "Trading Alerts SaaS with MiniMax M2 AI Development"
5.  Public or Private (your choice)
6.  ✅ Initialize with README
7.  Click "Create repository"

Verify: Can see repo on GitHub ✓

☐ STEP 2: Clone Repository Locally (5 minutes)
What: Download to your computer
Why: Work on it locally
How:

```
git clone https://github.com/YOUR-USERNAME/trading-alerts-saas-v7.git
cd trading-alerts-saas-v7
```

Verify: Folder exists with README.md ✓

☐ STEP 3: Create Folder Structure (10 minutes)
What: Organize documentation and seed code
Why: Keep everything organized
How:

```
mkdir -p docs
mkdir -p docs/diagrams
mkdir -p docs/policies
mkdir -p docs/architecture
mkdir -p postman
mkdir -p scripts/openapi
mkdir -p seed-code
```

Verify: Run `ls -la` and see all folders ✓

☐ STEP 4: REMOVED

☐ STEP 5: Copy Essential Documents (20 minutes)
What: Add your existing docs
Why: Aider needs these to build
How: Copy these files to docs/:

- v5_part_a.md through v5_part_j.md
- v5-structure-division.md
- trading_alerts_openapi.yaml
- flask_mt5_openapi.yaml
- phase_milestones_v7_minimax_m2.txt (this file!)
- All 12 mermaid diagrams to docs/diagrams/

Verify: Run `ls docs/` and see all files ✓

☐ STEP 6: Initial Commit (10 minutes)
What: Save everything to GitHub
Why: Backup + share with AI tools
How:

```
git add docs/ seed-code/
git commit -m "Add project documentation and 3 seed code repositories"
git push
```

Verify: See files on GitHub ✓

✅ CHECKPOINT: Repository ready

💡 BEGINNER TIP: Committing often is good! It's like saving your game progress.

---

### MILESTONE 1.1: Create Policy Documents (8 hours)

THIS IS THE HEART OF V7! 💖

You'll create 6 policy documents with Claude Chat (me!). These become Aider's "instruction manual" - they tell Aider when to approve code, when to fix issues, and when to ask you.

💡 BEGINNER TIP: Take your time here! These policies will save you 100+ hours later!

---

### 📦 UNDERSTANDING YOUR SEED CODE (Important!)

Before creating policies, understand what seed code you have and when to use each:

**1. market_ai_engine.py (Flask/MT5 Service)**

- **What:** Python Flask server that connects to MetaTrader 5
- **When Aider uses it:** Building Part 6 (Flask MT5 Service)
- **Reference for:** Flask routes, MT5 connection, indicator fetching
- **Location:** seed-code/market_ai_engine.py

**2. nextjs/saas-starter (Backend/API Foundation)**

- **What:** Next.js SaaS template with auth, database, payments
- **When Aider uses it:** Parts 5 (Auth), 7 (API Routes), 12 (E-commerce), **Part 17 (Affiliate Marketing)**
- **Reference for:**
  - NextAuth.js configuration
  - Prisma database patterns
  - Stripe payment integration
  - API route structure
  - Middleware patterns
  - **Stripe webhook handling (critical for commission calculation)**
- **Location:** seed-code/saas-starter/

**3. next-shadcn-dashboard-starter (Frontend/UI Foundation)**

- **What:** Next.js dashboard with shadcn/ui components
- **When Aider uses it:** Parts 8-14 (All UI components), **Part 17 (Affiliate Portal & Admin Dashboard)**
- **Reference for:**
  - Dashboard layouts
  - shadcn/ui component usage
  - Chart components
  - Form patterns
  - Navigation structure
  - Responsive design
  - **Analytics dashboards (for affiliate earnings tracking)**
  - **Admin management interfaces (for affiliate approval)**
- **Location:** seed-code/next-shadcn-dashboard-starter/

💡 **How Aider Uses Seed Code:**
When you tell Aider "Build Part 8: Dashboard", it will:

1. Read the part requirements from v5_part_h.md
2. Check coding patterns from policy 05-coding-patterns.md
3. **Look at seed-code/next-shadcn-dashboard-starter/ for reference**
4. Adapt the patterns to your specific requirements
5. Build your custom dashboard

Seed code = inspiration and patterns, NOT copy/paste!

---

#### POLICY 1: Approval Policies (1 hour)

**What it does:** Tells Aider when to auto-approve, auto-fix, or escalate

**How to create it:**

1. Open Claude Chat (you're here now!)
2. Copy and paste this prompt:

```
I'm creating approval-policies.md for my Aider AI system using MiniMax M2.
I'm a complete beginner building a Trading Alerts SaaS with Affiliate Marketing.

My project context:
- Trading Alerts SaaS with 2 tiers: FREE (5 symbols), PRO (15 symbols)
- FREE: 5 symbols (BTCUSD, EURUSD, USDJPY, US30, XAUUSD) × 3 timeframes (H1, H4, D1)
- PRO: 15 symbols × 9 timeframes (M5, M15, M30, H1, H2, H4, H8, H12, D1)
- **2-sided marketplace:** Affiliate marketing program (Part 17, 67 files)
  * Affiliates earn 20% commission on referred PRO subscriptions
  * Separate JWT authentication for affiliates (not NextAuth)
  * Admin approval workflow for affiliates and commissions
- Next.js 15 frontend + Flask backend + MT5 integration
- PostgreSQL database on Railway
- Using MiniMax M2 API for cost-effective autonomous development
- 3 seed code repositories for reference:
  * market_ai_engine.py (Flask/MT5)
  * nextjs/saas-starter (Backend/Auth/Payments/Affiliate)
  * next-shadcn-dashboard-starter (Frontend/UI/Affiliate Portal/Admin)

Create a comprehensive approval-policies.md that defines:

1. AUTO-APPROVE CONDITIONS (when Aider commits without asking me):
   - Code quality requirements (TypeScript types, error handling, JSDoc)
   - Security requirements (no secrets, input validation, tier validation)
   - API contract compliance (matches OpenAPI specs exactly)
   - Architecture compliance (files in correct locations)
   - Validation results (0 Critical issues, ≤2 High issues from Claude Code)

2. AUTO-FIX CONDITIONS (when Aider fixes and retries):
   - Missing TypeScript types
   - Missing error handling
   - Missing JSDoc comments
   - ESLint/Prettier errors
   - Maximum 3 retry attempts

3. ESCALATE CONDITIONS (when Aider stops and asks me):
   - Critical security vulnerabilities
   - OpenAPI contract violations that can't be auto-fixed
   - Policy conflicts or unclear rules
   - Architectural design decisions
   - New npm/pip dependencies
   - Database schema changes (Prisma migrations)
   - Breaking changes to existing APIs
   - >3 High severity issues from Claude Code validation
   - Unclear requirements from specs

Include specific examples for each condition. Write it for someone with little
coding experience - explain WHY each rule matters.

Format it clearly with sections and subsections.
```

3. Claude Chat (me) will generate a complete policy document
4. Review it (I'll explain anything unclear!)
5. Copy the content
6. Create file: `docs/policies/01-approval-policies.md`
7. Paste content
8. Save file

Commit:

```
git add docs/policies/01-approval-policies.md
git commit -m "Add approval policies for Aider with MiniMax M2"
git push
```

✅ DONE: Approval policies created

💡 BEGINNER TIP: If anything in the policy is confusing, ask me to explain!

---

#### POLICY 2: Quality Standards (1.5 hours)

**What it does:** Defines what "good code" looks like

**How to create it:**

Ask Claude Chat:

```
Create quality-standards.md for my Aider system using MiniMax M2.
I'm a beginner, so explain WHY each standard matters, not just WHAT it is.

Define standards for:

1. TYPESCRIPT
   - When to use types vs interfaces
   - Why no 'any' types
   - How to handle null/undefined safely
   - Include good vs bad examples

2. ERROR HANDLING
   - try/catch in all API routes
   - User-friendly error messages
   - Logging errors properly
   - Include example patterns

3. DOCUMENTATION
   - JSDoc on all public functions
   - What makes a good comment
   - What to document vs what's obvious
   - Include examples

4. REACT COMPONENTS
   - When to use Server vs Client components in Next.js 15
   - State management patterns
   - Loading and error states
   - Include component examples

5. API ROUTE STRUCTURE
   - Standard pattern: auth → validation → tier check → logic → response
   - How to structure endpoints
   - Include complete example

6. NAMING CONVENTIONS
   - Files: kebab-case (alert-form.tsx)
   - Functions: camelCase (createAlert)
   - Components: PascalCase (AlertForm)
   - Constants: UPPER_SNAKE_CASE (MAX_ALERTS)

7. PERFORMANCE
   - Database query optimization
   - React rendering optimization
   - When to use useMemo/useCallback

8. SECURITY CHECKLIST
   - Authentication checks
   - Input validation
   - SQL injection prevention
   - XSS prevention
   - Tier validation

Make it practical with lots of code examples showing right vs wrong way!
```

Follow same process:

1. Claude Chat generates
2. You review
3. Create `docs/policies/02-quality-standards.md`
4. Paste and save
5. Commit

✅ DONE: Quality standards created

---

#### POLICY 3: Architecture Rules (1.5 hours)

**What it does:** System design constraints - how pieces fit together

Ask Claude Chat:

```
Create architecture-rules.md for my Aider system using MiniMax M2.
Explain the architecture like I'm new to SaaS development.

Define:

1. DIRECTORY STRUCTURE
   - Must follow v5-structure-division.md exactly
   - Explain WHY this structure (separation of concerns)
   - Show visual diagram

2. LAYER ARCHITECTURE
   - Frontend (Next.js pages/components)
   - API Layer (Next.js API routes)
   - Business Logic (lib/)
   - Database (Prisma)
   - External Services (MT5)
   - Show data flow diagram

3. DATA FLOW
   - User clicks button → component → API route → business logic → database
   - Include visual flow for: creating an alert

4. TYPE SYSTEM
   - OpenAPI specs = source of truth
   - Auto-generated types in lib/api-client/
   - Never manually define types that exist in OpenAPI
   - Why this matters (contract-driven development)

5. AUTHENTICATION & AUTHORIZATION
   - NextAuth.js for user authentication
   - **Separate JWT authentication for affiliates (not NextAuth)**
   - Tier validation pattern: FREE → 5 symbols × 3 timeframes, PRO → 15 symbols × 9 timeframes
   - Where to check auth (middleware, API routes)
   - **Admin role checks for /admin/* routes**
   - Include code examples for both user and affiliate auth

6. DATABASE PATTERNS
   - Prisma only (no raw SQL unless absolutely necessary)
   - How to structure queries
   - Include CRUD example

7. API ROUTE STRUCTURE
   - Standard pattern all routes follow
   - Include complete example route

8. REACT COMPONENT STRUCTURE
   - Server components (default)
   - Client components ('use client' directive)
   - When to use each
   - Include examples

9. FLASK MT5 SERVICE
   - Separate microservice
   - Tier validation before MT5 calls
   - How Next.js calls Flask
   - Include diagram

10. DEPENDENCY RULES
    - Allowed dependencies (pre-approved)
    - Require approval for new dependencies
    - Why minimize dependencies

11. TESTING STRATEGY
    - Unit tests for business logic
    - Integration tests for API routes
    - E2E tests for critical flows

12. DEPLOYMENT ARCHITECTURE
    - Vercel (Next.js frontend)
    - Railway (PostgreSQL + Flask)
    - How they connect

Explain each concept simply with diagrams where helpful!
```

Same process: generate → review → create file → commit

✅ DONE: Architecture rules created

---

#### POLICY 4: Escalation Triggers (1 hour)

**What it does:** When Aider should stop and ask you

Ask Claude Chat:

```
Create escalation-triggers.md for my Aider system using MiniMax M2.
Define exactly when Aider should stop and notify me.

Define 10 escalation categories:

1. CRITICAL SECURITY ISSUES
   - SQL injection vulnerabilities
   - XSS vulnerabilities
   - Authentication bypass
   - Exposed secrets/API keys
   - Examples of each

2. API CONTRACT VIOLATIONS
   - Response doesn't match OpenAPI schema
   - Missing required fields
   - Wrong status codes
   - Can't auto-fix
   - Examples

3. POLICY CONFLICTS OR GAPS
   - Two policies contradict
   - Scenario not covered by policies
   - Unclear requirements
   - Examples

4. ARCHITECTURAL DECISIONS
   - Multiple valid approaches exist
   - Need to choose pattern
   - New component structure needed
   - Examples

5. DEPENDENCY ADDITIONS
   - New npm package needed
   - New pip package needed
   - Requires human approval
   - When it's okay vs when to ask

6. DATABASE MIGRATIONS
   - Prisma schema changes
   - Creating new migrations
   - Deploying to Railway
   - Examples

7. BREAKING CHANGES
   - Changes that affect existing code
   - API changes that break compatibility
   - Examples

8. CLAUDE CODE VALIDATION FAILURES
   - >3 High severity issues
   - Any Critical issues
   - Repeated auto-fix failures
   - Examples

9. UNCLEAR REQUIREMENTS
   - Specs are ambiguous
   - Missing information
   - Conflicting requirements
   - Examples

10. TEST FAILURES
    - TypeScript compilation errors
    - Failed tests
    - Build failures
    - Examples

For each category:
- When to escalate
- What information to include
- Example escalation message
- How human should respond

Write clearly for a beginner!
```

Same process ✓

✅ DONE: Escalation triggers created

---

#### POLICY 5: Coding Patterns (2 hours)

**What it does:** Copy-paste-ready code examples

💡 BEGINNER TIP: This is Aider's "recipe book" - complete code examples it can copy!

Ask Claude Chat:

```
Create coding-patterns.md for my Aider system using MiniMax M2.
Provide COMPLETE, working code examples that Aider can copy directly.

Provide these patterns:

PATTERN 1: NEXT.JS API ROUTE (Complete Example)
File: app/api/alerts/route.ts
Include:
- Full imports
- Authentication check with NextAuth
- Request validation with Zod
- Tier validation (FREE → 5 symbols × 3 timeframes, PRO → 15 symbols × 9 timeframes)
- Business logic with Prisma
- Response matching AlertResponse from OpenAPI
- Error handling (try/catch)
- Proper status codes (200, 400, 401, 403, 500)
Make it a real, complete 100-line example!

PATTERN 2: REACT CLIENT COMPONENT WITH FORM
File: components/alerts/alert-form.tsx
Include:
- 'use client' directive
- Form with shadcn/ui components
- Form validation
- Loading states (isLoading)
- Error states (error message display)
- API call with fetch
- Success handling
Make it a real, complete 150-line example!

PATTERN 3: TIER VALIDATION UTILITY
File: lib/tier/validation.ts
Include:
- canAccessSymbol(tier, symbol): boolean
- getAvailableSymbols(tier): string[]
- validateSymbolAccess(tier, symbol): void (throws if invalid)
Complete implementation with all tier rules!

PATTERN 4: PRISMA DATABASE UTILITY
File: lib/db/alerts.ts
Include:
- createAlert(userId, data)
- getAlerts(userId)
- getAlertById(alertId)
- updateAlert(alertId, data)
- deleteAlert(alertId)
With JSDoc, error handling, Prisma queries!

PATTERN 5: FLASK MT5 ENDPOINT
File: mt5-service/app/routes/indicators.py
Include:
- Tier validation from header
- MT5 connection check
- Fetch indicator data
- Error handling
- Response formatting
Complete 80-line Flask endpoint!

PATTERN 6: CONSTANTS FILE
File: lib/constants/tiers.ts
Include:
- Tier enum
- Symbol constants
- Timeframe constants
- Access control mapping
Complete with TypeScript types!

PATTERN 7: AFFILIATE JWT AUTHENTICATION (Part 17)
File: lib/auth/affiliate-jwt.ts
Include:
- Separate JWT secret (AFFILIATE_JWT_SECRET environment variable)
- generateAffiliateToken(affiliateId, email): string
- verifyAffiliateToken(token): AffiliateJWTPayload
- affiliateAuthMiddleware(req): Promise<AffiliateJWTPayload>
Complete implementation with error handling!

PATTERN 8: CRYPTO-SECURE AFFILIATE CODE GENERATION (Part 17)
File: lib/affiliate/code-generator.ts
Include:
- Use crypto.randomBytes (NOT Math.random)
- generateAffiliateCode(prefix = 'REF'): string
- Returns format: "REF-ABC123XYZ" (12 chars after prefix)
- Must be URL-safe and unique
Complete implementation with validation!

PATTERN 9: COMMISSION CALCULATION IN STRIPE WEBHOOK (Part 17)
File: app/api/webhooks/stripe/route.ts
Include:
- Extract affiliate_code from session.metadata
- Validate affiliate code exists and affiliate is APPROVED
- Calculate 20% commission on subscription amount
- Create Commission record (status: PENDING)
- Increment affiliateCode.usageCount
- Update affiliate.totalReferrals
- NEVER calculate commissions outside webhook (single source of truth!)
Complete Stripe webhook handler with commission logic!

PATTERN 10: ACCOUNTING-STYLE ADMIN REPORTS (Part 17)
File: app/api/admin/affiliates/reports/route.ts
Include:
- Aggregate commissions by status (PENDING, APPROVED, PAID)
- Total earnings per affiliate
- Monthly commission trends
- Fraud detection (unusual referral patterns)
- Export to CSV capability
Complete admin reporting endpoint!

Each pattern should be:
- Complete and working
- Well-commented
- Following our tier system (FREE: 5 symbols × 3 timeframes, PRO: 15 symbols × 9 timeframes)
- Patterns 7-10: Following affiliate marketing security best practices
- Ready to copy/paste
- Explained with WHY, not just WHAT

Make it comprehensive! This is Aider's cookbook.
```

This one takes longer because it's detailed. Review carefully!

✅ DONE: Coding patterns created

---

#### POLICY 6: Aider Instructions (1 hour)

**What it does:** How Aider should operate

Ask Claude Chat:

```
Create aider-instructions.md - this is Aider's "operating manual" for
working with MiniMax M2 API that tells it HOW to work.

Include:

1. INITIALIZATION
   Files to load on startup:
   - All 6 policy documents
   - v5-structure-division.md
   - OpenAPI specs
   - seed-code/market_ai_engine.py
   - PROGRESS.md

2. SEED CODE USAGE
   When to reference each seed code repository:

   **market_ai_engine.py:**
   - Use for: Part 6 (Flask MT5 Service)
   - Reference: Flask route patterns, MT5 API usage, indicator fetching
   - Adapt, don't copy: Use as pattern reference, customize for our OpenAPI spec

   **seed-code/saas-starter/:**
   - Use for: Parts 5 (Auth), 7 (API Routes), 12 (E-commerce), **Part 17 (Affiliate Marketing)**
   - Reference: NextAuth config, Prisma patterns, Stripe integration, middleware, **Stripe webhook handling**
   - Key files to check:
     * app/api/auth/[...nextauth]/route.ts
     * lib/stripe.ts
     * middleware.ts
     * prisma/schema.prisma
     * **app/api/webhooks/stripe/route.ts (critical for commission calculation)**

   **seed-code/next-shadcn-dashboard-starter/:**
   - Use for: Parts 8-14 (All UI/Frontend), **Part 17 (Affiliate Portal & Admin Dashboard)**
   - Reference: Dashboard layout, shadcn/ui components, charts, forms, **analytics dashboards, admin interfaces**
   - Key files to check:
     * app/dashboard/layout.tsx
     * components/ui/* (shadcn components)
     * components/charts/*
     * lib/utils.ts
     * **Dashboard analytics patterns (for affiliate earnings)**
     * **Admin management table patterns (for affiliate approval)**

   **Important:** Seed code is REFERENCE only. Always:
   - Adapt to our OpenAPI contracts
   - Follow our tier system (FREE: 5 symbols × 3 timeframes, PRO: 15 symbols × 9 timeframes)
   - Use our specific business logic
   - Match our quality standards

3. WORKFLOW FOR EACH FILE
   Step-by-step process:

   Step 1: READ REQUIREMENTS
   - Read v5-structure-division.md for file location
   - Read OpenAPI spec for API contract
   - Read v5_part_X.md for implementation details
   - Read 05-coding-patterns.md for code template
   - CHECK RELEVANT SEED CODE (see "Seed Code Usage" above)

   Step 2: PLAN IMPLEMENTATION
   - Choose appropriate pattern from seed code
   - Adapt for specific endpoint/component
   - Ensure matches OpenAPI contract
   - List all requirements

   Step 3: GENERATE CODE
   - Use seed code pattern as inspiration
   - Customize for our requirements
   - Include all required elements
   - Follow quality standards

   Step 4: VALIDATE
   - Run: claude code "validate [filename]"
   - Parse validation output
   - Categorize issues by severity

   Step 5: DECIDE
   - Check 01-approval-policies.md
   - If all conditions met → APPROVE
   - If fixable issues → AUTO-FIX (max 3 attempts)
   - If stuck/unclear → ESCALATE

   Step 6: ACT
   - APPROVE: Commit with detailed message
   - AUTO-FIX: Fix issues, re-validate, retry
   - ESCALATE: Format message, notify human, WAIT

   Step 7: UPDATE PROGRESS
   - Update PROGRESS.md
   - Report status every 3 files

3. COMMIT MESSAGE FORMAT
   Use conventional commits:
```

feat(scope): description

- Validation: X Critical, Y High, Z Medium issues
- All approval conditions met: yes/no
- Pattern used: [pattern name]
- Model: MiniMax M2

```

4. ERROR HANDLING
How to categorize Claude Code errors:
- Critical: Security, contract violations → ESCALATE
- High: Missing error handling, wrong types → AUTO-FIX
- Medium: Missing JSDoc, formatting → AUTO-FIX
- Low: Style issues → AUTO-FIX

Auto-fix strategies:
- Add missing types
- Add try/catch blocks
- Add JSDoc comments
- Run prettier

Decision logic:
- 0 Critical + ≤2 High → APPROVE
- Fixable issues + <3 tries → AUTO-FIX
- Otherwise → ESCALATE

5. INTERACTION WITH HUMAN
When to notify:
- Starting new part
- Every 3 files completed
- Escalations
- Part completed

Escalation message format:
```

⚠️ ESCALATION REQUIRED ⚠️

Issue Type: [category]
File: [filename]
Feature: [what you're building]

Problem:
[Clear explanation]

Policy Gap:
[Which policy is unclear]

Suggested Solutions:

1.  [Option 1]
2.  [Option 2]

Awaiting human decision...

```

6. PROGRESS TRACKING
Update PROGRESS.md after each file:
- Part name
- Files completed
- Issues found/fixed
- Escalations raised
- Time spent

7. TESTING PROTOCOL
After building files:
- Suggest manual testing steps
- List Postman requests to test
- Remind to test in browser

8. SELF-IMPROVEMENT
- Learn from escalation resolutions
- Note policy updates
- Apply learnings to future files

9. MINIMAX M2 OPTIMIZATION
- Use MiniMax M2 efficiently
- Batch related operations
- Minimize API calls where possible
- Cost-conscious coding patterns

10. EXAMPLE SESSION
 Show complete workflow for building one file from start to finish.

Write it like a detailed instruction manual for an AI assistant using MiniMax M2!
```

Same process ✓

✅ DONE: All 6 policies created!

---

### POLICY REVIEW (30 minutes)

**Final quality check with Claude Chat:**

Ask me:

```
Review all 6 policy documents for consistency:

1. Check for contradictions between policies
2. Ensure tier rules consistent (FREE: 5 symbols × 3 timeframes, PRO: 15 symbols × 9 timeframes)
3. Verify approval conditions align with quality standards
4. Confirm escalation triggers align with approval policies
5. Check coding patterns follow architecture rules
6. Verify MiniMax M2 references are consistent

Files to review:
- docs/policies/01-approval-policies.md
- docs/policies/02-quality-standards.md
- docs/policies/03-architecture-rules.md
- docs/policies/04-escalation-triggers.md
- docs/policies/05-coding-patterns.md
- docs/policies/06-aider-instructions.md

List any inconsistencies or gaps.
```

Fix any issues I identify, then final commit:

```
git add docs/policies/
git commit -m "Complete policy suite for MiniMax M2 - Aider ready!"
git push
```

✅ CHECKPOINT: All 6 policies created, reviewed, committed

💡 BEGINNER INSIGHT: You just created the "AI constitution"! These 6 documents
will guide 170 files of code. Quality here = quality everywhere!

---

### MILESTONE 1.2: OpenAPI Code Generation (1 hour)

**What:** Auto-generate TypeScript types from API specs
**Why:** Type safety - catch errors before runtime!

☐ STEP 1: Install OpenAPI Generator (10 minutes)

```
npm install -g @openapitools/openapi-generator-cli
openapi-generator-cli version
```

Verify: Shows version number ✓

☐ STEP 2: Create Next.js Type Generation Script (15 minutes)
Create: `scripts/openapi/generate-nextjs-types.sh`

```bash
#!/bin/bash
echo "📄 Generating TypeScript types from Next.js OpenAPI spec..."

openapi-generator-cli generate \
  -i docs/trading_alerts_openapi.yaml \
  -g typescript-axios \
  -o lib/api-client \
  --additional-properties=supportsES6=true,npmVersion=8.0.0

echo "✅ Next.js API types generated in lib/api-client/"
echo "📝 Import types: import { UserProfile, Alert } from '@/lib/api-client'"
```

Make executable:

```
chmod +x scripts/openapi/generate-nextjs-types.sh
```

☐ STEP 3: Create Flask Type Generation Script (15 minutes)
Create: `scripts/openapi/generate-flask-types.sh`

```bash
#!/bin/bash
echo "📄 Generating TypeScript types from Flask MT5 OpenAPI spec..."

openapi-generator-cli generate \
  -i docs/flask_mt5_openapi.yaml \
  -g typescript-axios \
  -o lib/mt5-client \
  --additional-properties=supportsES6=true,npmVersion=8.0.0

echo "✅ Flask MT5 types generated in lib/mt5-client/"
echo "📝 Import types: import { IndicatorData } from '@/lib/mt5-client'"
```

Make executable:

```
chmod +x scripts/openapi/generate-flask-types.sh
```

☐ STEP 4: Test (Will Fail - That's OK!) (5 minutes)

```
sh scripts/openapi/generate-nextjs-types.sh
```

Expected: Error (Next.js project doesn't exist yet)

💡 BEGINNER NOTE: This is normal! You'll run these in Phase 3.

☐ STEP 5: Commit (5 minutes)

```
git add scripts/
git commit -m "Add OpenAPI type generation scripts"
git push
```

✅ CHECKPOINT: Type generation ready for Phase 3

💡 BEGINNER TIP: These scripts turn your OpenAPI specs into TypeScript types
automatically. When you change the API spec, regenerate types - they stay in sync!

---

### MILESTONE 1.3: Postman Collections (45 minutes)

**What:** Auto-generate test collections from OpenAPI
**Why:** Test your API as you build it!

☐ STEP 1: Download Postman (10 minutes)

- Go to postman.com
- Download for your OS
- Install and launch
- Create account (free)

☐ STEP 2: Import Next.js API Collection (10 minutes)

1.  Click "Import" button (top-left)
2.  Click "files" tab
3.  Select: docs/trading_alerts_openapi.yaml
4.  Click "Import"

Result: Postman creates collection with ALL 38 endpoints! 🎉

💡 BEGINNER TIP: You didn't write any tests - OpenAPI did it for you!

☐ STEP 3: Configure Variables (5 minutes)

1.  Click the collection name
2.  Click "Variables" tab
3.  Add these:

| Variable  | Initial Value         | Current Value         |
| --------- | --------------------- | --------------------- |
| baseUrl   | http://localhost:3000 | http://localhost:3000 |
| authToken | (leave empty)         | (leave empty)         |

4.  Save

☐ STEP 4: Import Flask MT5 Collection (10 minutes)
Repeat import process for: docs/flask_mt5_openapi.yaml

Configure variables:
| Variable | Value |
|----------|-------|
| baseUrl | http://localhost:5001 |
| userTier | FREE |

☐ STEP 5: Export Collections (10 minutes)
For each collection:

1.  Right-click collection name
2.  Export
3.  Choose "Collection v2.1"
4.  Save to:
    - postman/nextjs-api.postman_collection.json
    - postman/flask-mt5.postman_collection.json

☐ STEP 6: Commit (5 minutes)

```
git add postman/
git commit -m "Add Postman test collections from OpenAPI specs"
git push
```

✅ CHECKPOINT: Testing ready!

💡 BEGINNER TIP: As you build endpoints in Phase 3, test them in Postman immediately!

---

### MILESTONE 1.4: Architecture Documentation (1.5 hours)

**What:** Document overall system design
**Why:** Reference guide for you and Aider

☐ STEP 1: Create ARCHITECTURE.md (30 minutes)

Ask Claude Chat:

```
Create ARCHITECTURE.md for my Trading Alerts SaaS project using MiniMax M2.

Include:
1. System Overview (what the project does)
2. Tech Stack (Next.js 15, Flask, PostgreSQL, MT5)
3. High-Level Architecture (diagram showing all services)
4. Component Breakdown
   - Frontend (Next.js)
   - Backend API (Next.js API routes)
   - Flask MT5 Service
   - Database (PostgreSQL)
   - MT5 Terminal
5. Data Flow (how data moves through system)
6. Authentication Flow
7. Tier System (FREE vs PRO)
8. Deployment Architecture (Vercel + Railway)
9. AI Development with MiniMax M2
10. Seed Code Foundation
   - market_ai_engine.py (Flask/MT5 reference)
   - nextjs/saas-starter (Backend/Auth reference)
   - next-shadcn-dashboard-starter (Frontend/UI reference)
   - How each is used as foundation

Write it clearly for someone new to SaaS development!
```

Save to: `ARCHITECTURE.md` (root folder)

☐ STEP 2: Create IMPLEMENTATION-GUIDE.md (30 minutes)

Ask Claude Chat:

```
Create IMPLEMENTATION-GUIDE.md for V7 workflow with MiniMax M2.

Include:

1. THE V7 DEVELOPMENT PROCESS
   - Week 1: Create policies
   - Week 2: Setup foundation
   - Weeks 3-10: Autonomous building with MiniMax M2
   - Week 11: Deploy

2. POLICY-DRIVEN DEVELOPMENT
   - How policies work
   - How they guide Aider with MiniMax M2
   - How they improve over time

3. WORKING WITH AIDER (MiniMax M2)
   - Starting Aider: py -3.11 -m aider --model anthropic/MiniMax-M2
   - Giving commands
   - Monitoring progress
   - Reading output
   - Cost considerations with MiniMax M2

4. HANDLING ESCALATIONS
   - What escalations are
   - How to handle them (with Claude Chat)
   - Updating policies
   - Continuing work
   - Example escalation workflow

5. FOR EACH PART
   Example: Building Part 11 (Alerts)
   - Command to give Aider
   - What Aider does autonomously
   - Typical escalations
   - Testing the part
   - Moving to next part

6. TESTING STRATEGY
   - Testing in Postman
   - Manual testing in browser
   - What to verify

7. TROUBLESHOOTING
   - Common issues
   - How to fix
   - When to ask Claude Chat

Write it for a complete beginner!
```

Save to: `IMPLEMENTATION-GUIDE.md` (root)

☐ STEP 3: Create PROGRESS.md (15 minutes)

Create: `PROGRESS.md`

```markdown
# Trading Alerts SaaS - Development Progress (MiniMax M2)

## Timeline

- Start Date: [TODAY]
- Target Completion: [11 weeks from today]

## Phase Status

### Phase 0: Local Environment Setup ✅

- Completed: [DATE]
- Time: 4 hours
- All tools installed and verified
- MiniMax M2 API configured

### Phase 1: Documentation & Policies ✅

- Completed: [DATE]
- Time: 14 hours
- All 6 policies created

### Phase 2: Foundation (In Progress)

- Started: [DATE]
- Target: 5 hours

### Phase 3: Implementation (Not Started)

- Target: 38 hours
- Using MiniMax M2 for autonomous building

### Phase 4: Deployment (Not Started)

- Target: 6 hours

## Part Completion

### Part 1: Foundation - ⏳ Not Started

- Files: 0/12
- Escalations: 0
- Status: Waiting

### Part 2: Database - ⏳ Not Started

- Files: 0/4
- Escalations: 0
- Status: Waiting

[... Parts 3-16 ...]

## Escalations Log

### Escalation #1

- Date:
- Part:
- Issue:
- Resolution:
- Policy Updated:

## Time Tracking

| Phase     | Estimated | Actual  | Notes                 |
| --------- | --------- | ------- | --------------------- |
| Phase 0   | 4h        | 4h      | ✅ Complete           |
| Phase 1   | 14h       | [?]     | In progress           |
| Phase 2   | 5h        | -       | -                     |
| Phase 3   | 38h       | -       | MiniMax M2 autonomous |
| Phase 4   | 6h        | -       | -                     |
| **Total** | **67h**   | **[?]** | -                     |

## MiniMax M2 Cost Tracking

| Phase   | Estimated API Calls | Estimated Cost | Actual Cost |
| ------- | ------------------- | -------------- | ----------- |
| Phase 3 | ~200 files          | $[estimate]    | $[actual]   |

## Learnings

### Week 1

- [Note what you learned]
- MiniMax M2 setup experience

### Week 2

- [Continue noting learnings]

---

Last Updated: [DATE]
```

☐ STEP 4: Create DOCKER.md (15 minutes)

Ask Claude Chat:

```
Create DOCKER.md explaining Docker setup for beginners.

Include:
1. What Docker is (in simple terms)
2. Why we use it (package Flask service)
3. Dockerfile structure (explain each line)
4. docker-compose.yml (what it does)
5. Common Docker commands
6. Troubleshooting

Keep it beginner-friendly!
```

Save to: `DOCKER.md`

☐ STEP 5: Commit All Documentation (10 minutes)

```
git add *.md
git commit -m "Add complete V7 architecture and implementation documentation for MiniMax M2"
git push
```

✅ CHECKPOINT: Documentation complete

---

### MILESTONE 1.5: Configure Aider (30 minutes)

**What:** Setup Aider to read your policies automatically
**Why:** Aider needs context to work autonomously

☐ STEP 1: Create Project Aider Configuration (20 minutes)

Create: `.aider.conf.yml` (in project root)

```yaml
# Aider V7 Configuration for Trading Alerts SaaS
# Using MiniMax M2 for cost-effective autonomous development

# Model to use (MiniMax M2)
model: anthropic/MiniMax-M2

# Files to read on startup (Aider's context)
read:
  # Policy documents (Aider's rules)
  - docs/policies/01-approval-policies.md
  - docs/policies/02-quality-standards.md
  - docs/policies/03-architecture-rules.md
  - docs/policies/04-escalation-triggers.md
  - docs/policies/05-coding-patterns.md
  - docs/policies/06-aider-instructions.md

  # V7 workflow guides
  - docs/v7/v7_overview.md
  - docs/v7/v7_phase_3_building.md # Building instructions

  # Project structure
  - docs/v5-structure-division.md

  # API contracts
  - docs/trading_alerts_openapi.yaml
  - docs/flask_mt5_openapi.yaml

  # Seed code references
  - seed-code/market_ai_engine.py

  # Progress tracking
  - PROGRESS.md

# Auto-commit when policies satisfied
auto-commits: true

# Run checks before commit
lint: true

# Git commit message template
commit-prompt: |
  Write a conventional commit message.
  Include Claude Code validation results.

  Format:
  <type>(<scope>): <description>

  - Validation: X Critical, Y High, Z Medium issues
  - All approval conditions met: [yes/no]
  - Pattern used: [which pattern from 05-coding-patterns.md]
  - Model: MiniMax M2
```

Commit:

```
git add .aider.conf.yml
git commit -m "Add Aider configuration for MiniMax M2 policy-driven development"
git push
```

💡 BEGINNER TIP: This file tells Aider what to load automatically!

☐ STEP 2: Create .gitignore (5 minutes)

Create: `.gitignore`

```
# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/
.nyc_output

# Next.js
.next/
out/
build

# Production
dist

# Misc
.DS_Store
*.pem

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Local env files
.env
.env*.local

# Python
__pycache__/
*.py[cod]
*$py.class
venv/
.venv

# IDEs
.vscode/
.idea/

# Aider
.aider*

# OS
Thumbs.db
```

Commit:

```
git add .gitignore
git commit -m "Add .gitignore"
git push
```

☐ STEP 3: Test Aider Setup (5 minutes)

```
py -3.11 -m aider --model anthropic/MiniMax-M2
```

You should see:

```
Aider v0.x.x
Model: anthropic/MiniMax-M2
Reading files...
✓ docs/policies/01-approval-policies.md
✓ docs/policies/02-quality-standards.md
✓ docs/policies/03-architecture-rules.md
✓ docs/policies/04-escalation-triggers.md
✓ docs/policies/05-coding-patterns.md
✓ docs/policies/06-aider-instructions.md
✓ docs/v5-structure-division.md
✓ docs/trading_alerts_openapi.yaml
✓ docs/flask_mt5_openapi.yaml
✓ docs/market_ai_engine.py
✓ PROGRESS.md

Ready! Type /help for commands.
```

If all files loaded ✅ → Success!

Exit: `/exit`

✅ CHECKPOINT: Aider configured and ready with MiniMax M2

---

### MILESTONE 1.6: Test Aider Understanding (30 minutes)

**What:** Verify Aider understands your project
**Why:** Catch issues before autonomous building

Launch Aider:

```
py -3.11 -m aider --model anthropic/MiniMax-M2
```

☐ TEST 1: Policy Understanding (5 minutes)

You: `Summarize the approval policies for this project.`

Expected: Aider explains when it auto-approves, auto-fixes, or escalates.

If accurate ✅ → Good!

☐ TEST 2: Tier System Understanding (5 minutes)

You: `What are the tier restrictions in this project?`

Expected: "FREE tier: 5 symbols (BTCUSD, EURUSD, USDJPY, US30, XAUUSD) × 3 timeframes (H1, H4, D1). PRO tier: 15 symbols × 9 timeframes (M5, M15, M30, H1, H2, H4, H8, H12, D1)"

If correct ✅ → Good!

☐ TEST 3: File Location Knowledge (5 minutes)

You: `Where should the POST /api/alerts endpoint file be located?`

Expected: "app/api/alerts/route.ts according to v5-structure-division.md Part 11"

If correct ✅ → Good!

☐ TEST 4: Architecture Understanding (5 minutes)

You: `Explain the data flow when a user creates an alert.`

Expected: Describes: User → Form → API route → Auth → Tier check → Prisma → Database

If correct ✅ → Good!

☐ TEST 5: Pattern Knowledge (5 minutes)

You: `What coding pattern should I use for a Next.js API route?`

Expected: References Pattern 1 from 05-coding-patterns.md

If correct ✅ → Good!

☐ TEST 6: Planning Ability (5 minutes)

You: `Plan the implementation for app/api/alerts/route.ts. Don't create it yet, just describe what it should contain.`

Expected: Aider outlines:

- Imports
- Authentication check
- Input validation
- Tier validation (FREE → 5 symbols × 3 timeframes only)
- Prisma database operation
- Response matching OpenAPI schema
- Error handling

If complete ✅ → Perfect!

Exit: `/exit`

✅ CHECKPOINT: All 6 tests passed!

💡 BEGINNER INSIGHT: Aider just demonstrated it understands your project!
This is why Phase 1 is so important - you built the foundation of knowledge.

---

## ✅ PHASE 1 COMPLETE! 🎉

### What You Accomplished:

☐ GitHub repository created and organized
☐ All baseline documentation copied
☐ 6 comprehensive policy documents created for MiniMax M2
☐ OpenAPI type generation scripts ready
☐ Postman test collections created
☐ Architecture documentation complete
☐ Aider configured with MiniMax M2 and policies
☐ Aider tested and verified

### What You Learned:

✓ How to structure a SaaS project
✓ How to define AI behavior through policies
✓ What makes "good code" (quality standards)
✓ How system architecture works
✓ How to guide autonomous AI systems
✓ OpenAPI-driven development
✓ Cost-effective AI development with MiniMax M2

### Time Invested: 14 hours

### Value Created:

These policies will guide 170 files. Your 14-hour investment will save
100+ hours in Phase 3!

### Readiness Check:

☐ All 6 policies in docs/policies/
☐ All policies committed to GitHub
☐ Aider configuration file created
☐ Aider loads all files successfully
☐ Aider passes all 6 understanding tests
☐ MiniMax M2 API configured and working

If all checked ✅ → **READY FOR PHASE 2!** 🚀

💡 BEGINNER VICTORY: You just built the "AI constitution" for your project!
Everything from here builds on this foundation.

---

---

## Phase 2: Validation System Setup (COMPLETE)

**Date:** 2025-11-24
**Status:** ✅ Fully Operational

### Overview

Phase 2 established a complete automated validation system that enables Aider to autonomously build and validate code with minimal human intervention.

### Validation Tools Configured

#### 1. TypeScript Configuration (tsconfig.json)

- **Purpose:** Type safety validation
- **Features:**
  - Strict mode enabled
  - No implicit any
  - Strict null checks
  - All function return types required
  - Parameter types required

#### 2. ESLint Configuration (.eslintrc.json)

- **Purpose:** Code quality validation
- **Features:**
  - Next.js + TypeScript rules
  - No explicit any (error level)
  - React hooks validation
  - Import organization
  - Unused variable detection

#### 3. Prettier Configuration (.prettierrc)

- **Purpose:** Code formatting validation
- **Features:**
  - Single quotes
  - Semicolons required
  - 80 character line length
  - Consistent indentation
  - Trailing commas (ES5)

#### 4. Custom Policy Validator (scripts/validate-file.js)

- **Purpose:** Project-specific policy validation
- **Checks:**
  - Authentication (protected routes check session)
  - Tier validation (symbol/timeframe restrictions)
  - Error handling (try-catch blocks present)
  - Security patterns:
    - No hardcoded secrets
    - SQL injection prevention
    - XSS protection
  - Input validation (Zod schemas for POST/PATCH/PUT)
  - API contract compliance

#### 5. Jest Test Framework

- **Purpose:** Unit and integration testing
- **Configuration:** jest.config.js
- **Features:**
  - TypeScript support
  - React Testing Library
  - DOM testing utilities
  - Coverage reporting

### Package Scripts

```json
{
  "validate": "npm run validate:types && npm run validate:lint && npm run validate:format && npm run validate:policies",
  "validate:types": "echo '🔍 Checking TypeScript types...' && tsc --noEmit",
  "validate:lint": "echo '🔍 Checking code quality...' && next lint --max-warnings 0",
  "validate:format": "echo '🔍 Checking code formatting...' && prettier --check .",
  "validate:policies": "echo '🔍 Checking policy compliance...' && node scripts/validate-file.js --all",
  "validate:file": "node scripts/validate-file.js",
  "fix": "npm run lint:fix && npm run format",
  "lint:fix": "next lint --fix",
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage"
}
```

### Aider Configuration Updates

#### .aider.conf.yml

- **Updated:** 2025-11-24
- **Role:** Autonomous Builder & Validator
- **Responsibilities:**
  - Code generation following policies
  - Automated validation execution
  - Approve/Fix/Escalate decision-making
  - Auto-fix minor issues
  - Escalation to human for major issues
  - Progress tracking
  - Git commits

#### Policies Loaded

All 9 policy files automatically loaded:

1. 00-tier-specifications.md
2. 01-approval-policies-compress.md
3. 02-quality-standards.md
4. 03-architecture-rules-compress.md
5. 04-escalation-triggers-compress.md
6. 05-coding-patterns-compress.md
7. 06-aider-instructions.md
8. 07-dlocal-integration-rules-compress.md
9. 08-google-oauth-implementation-rules.md

### Documentation Created

1. **VALIDATION-SETUP-GUIDE.md**
   - Complete usage guide
   - All commands explained
   - Troubleshooting section
   - Real-world examples

2. **docs/CLAUDE-CODE-VALIDATION-CHECKLIST.md**
   - Responsibility transfer checklist
   - Before/After comparison
   - Tool overview

3. **docs/CLAUDE-CODE-WORKFLOW-ANALYSIS.md**
   - Detailed workflow diagrams
   - Integration points
   - Decision flows
   - Success metrics

4. **CLAUDE.md** (Updated)
   - What is Aider
   - Validation system architecture
   - Decision criteria
   - Real-world examples

5. **docs/policies/06-aider-instructions.md** (Updated)
   - STEP 4 now uses npm run validate
   - STEP 6 AUTO-FIX uses npm run fix

### Success Metrics (Target)

| Metric            | Target       | Purpose                            |
| ----------------- | ------------ | ---------------------------------- |
| Auto-Approve Rate | 85-92%       | Files pass first time              |
| Auto-Fix Rate     | 6-12%        | Minor issues fixed automatically   |
| Escalation Rate   | 2-5%         | Major issues requiring human input |
| Validation Time   | <10 sec/file | Fast feedback loop                 |

### Ready for Phase 3

✅ All validation tools configured
✅ Aider updated with validator role
✅ Documentation complete
✅ Scripts tested
✅ Ready for autonomous building

---

## MiniMax M2 API Integration & Troubleshooting

**Date:** 2025-11-20  
**Status:** ✅ WORKING SOLUTION VERIFIED  
**Model:** MiniMax M2 via OpenAI-compatible API endpoint

### Executive Summary

This section documents the complete configuration for successfully integrating MiniMax M2 with Aider for autonomous code generation.

**Final Working Configuration:**

- ✅ Model string: `openai/MiniMax-M2`
- ✅ API endpoint: `https://api.minimax.io/v1`
- ✅ API variables: `OPENAI_API_KEY` and `OPENAI_API_BASE`
- ✅ Context management: 129k base load + 75k rotation budget

### Environment Variables (.env)

```bash
# MiniMax M2 API Configuration
OPENAI_API_KEY=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJHcm91cE5hbWUiOiJEaGFwYW5hcnQgS2V2YWxlZSIsIlVzZXJOYW1lIjoiRGhhcGFuYXJ0IEtldmFsZWUiLCJBY2NvdW50IjoiIiwiU3ViamVjdElEIjoiMTk4NDI2MzUzNDY1NzE1MTkwMiIsIlBob25lIjoiIiwiR3JvdXBJRCI6IjE5ODQyNjM1MzQ2NTI5NTM1MDIiLCJQYWdlTmFtZSI6IiIsIk1haWwiOiJyaXBwZXI3Mzc1QGdtYWlsLmNvbSIsIkNyZWF0ZVRpbWUiOiIyMDI1LTExLTA1IDE1OjQyOjU0IiwiVG9rZW5UeXBlIjoxLCJpc3MiOiJtaW5pbWF4In0.iDz-qldYGYrqfNg8xvgi0wa8QmL3jXDj7_uAodeqweZeSUm0pK7GYJ0lD6_107mOd73qVkqzsRc-Xfw5MGxP5-AfJf9aHv3ZGl1SBWT5vMXr4K3bulWWAwcfdgNEZ46uXAtNPwQBuPmoqAlarcXOjcPQ6QjCNfos0oa7GGU71xTSkJr3jlntr8_ExFaxuAMSd2D2CwV8r_uY5EBaRddACGbOPIc-GS67ejTqQTQnvgi0sYlIymr1aMmW_VmtBntYvD7xvSIqQzKgew3R2UXnihqJXbjtM0Mv_a-f_qzaD16cFIte2DfnlxP6MtwPqmXMCKp6eu0hBSh4_AaIDIBeVA

# MiniMax API endpoint (OpenAI-compatible)
OPENAI_API_BASE=https://api.minimax.io/v1
```

**Key Points:**

- ✅ Use `OPENAI_API_KEY` (NOT `ANTHROPIC_API_KEY`)
- ✅ Use `OPENAI_API_BASE` (NOT `ANTHROPIC_API_BASE`)
- ✅ Endpoint is `/v1` (OpenAI-compatible)

### Aider Configuration (.aider.conf.yml)

```yaml
# Model Configuration
model: openai/MiniMax-M2
editor-model: openai/MiniMax-M2
weak-model: openai/MiniMax-M2

# Reduce map tokens to save context
map-tokens: 512

# Environment file
env-file: .env.local

# Load compressed policy files (base load: ~129k tokens)
read:
  - docs/policies/01-approval-policies-compress.md
  - docs/policies/02-quality-standards.md
  - docs/policies/03-architecture-rules-compress.md
  - docs/policies/04-escalation-triggers-compress.md
  - docs/policies/05-coding-patterns-compress.md
  - docs/policies/06-aider-instructions.md
  - docs/policies/07-dlocal-integration-rules-compress.md
  - docs/policies/00-tier-specifications.md
  - docs/trading_alerts_openapi_compress.yaml
  - ARCHITECTURE.md
  - README.md
  - docs/v5-structure-division.md
  - docs/build-orders/README.md
  - PROGRESS.md
# Total base load: ~129,000 tokens
# Available for rotation: ~75,000 tokens
```

**Critical Settings:**

- ✅ Model prefix: `openai/` (NOT `anthropic/` or `minimax/`)
- ✅ Map tokens: `512` (reduced from 2048)
- ✅ Compressed files: Use `-compress.md` versions

### Context Window Management

#### MiniMax M2 Specifications

| Specification              | Value                 |
| -------------------------- | --------------------- |
| **Total Context Window**   | 204,800 tokens        |
| **Base Load**              | ~129,000 tokens (63%) |
| **Available for Rotation** | ~75,000 tokens (37%)  |
| **System Overhead**        | ~5,000 tokens         |
| **Repo-map**               | 512 tokens            |

#### Token Budget Breakdown

```
Total Context: 204,800 tokens
├── System Overhead: 5,000 tokens
├── Repo-map: 512 tokens
├── Compressed Policies: 79,000 tokens
├── Compressed OpenAPI: 22,000 tokens
├── Architecture Docs: 28,000 tokens
└── AVAILABLE FOR ROTATION: ~75,000 tokens
```

### File Compression Results

Conservative compression was performed on the 6 largest files to reduce token usage:

| File                           | Original    | Compressed | Saved      | Reduction |
| ------------------------------ | ----------- | ---------- | ---------- | --------- |
| 01-approval-policies.md        | 18,529      | 9,491      | 9,038      | 49%       |
| 03-architecture-rules.md       | 29,324      | 11,326     | 17,998     | 61%       |
| 04-escalation-triggers.md      | 22,484      | 7,430      | 15,054     | 67%       |
| 05-coding-patterns.md          | 26,686      | 20,999     | 5,687      | 21%       |
| 07-dlocal-integration-rules.md | 15,296      | 6,870      | 8,426      | 55%       |
| trading_alerts_openapi.yaml    | 24,060      | 21,690     | 2,370      | 10%       |
| **TOTAL**                      | **136,379** | **77,806** | **58,573** | **43%**   |

### Common Issues and Solutions

#### Issue 1: "LLM Provider NOT provided"

**Symptoms:**

```
litellm.BadRequestError: LLM Provider NOT provided.
You passed model=minimax/MiniMax-M2
```

**Solution:**  
Change model string from `minimax/MiniMax-M2` to `openai/MiniMax-M2`

**Why:** LiteLLM doesn't recognize `minimax/` as a provider. Use `openai/` prefix with `OPENAI_API_BASE` to redirect to MiniMax.

#### Issue 2: "Context window exceeds limit"

**Symptoms:**

```
OpenAIException - invalid params, context window exceeds limit
```

**Solution:**

1. Reduce `map-tokens` to 512
2. Use compressed policy files
3. Implement rotation strategy with `/read-only` and `/drop`
4. Load only necessary files

**Why:** Total tokens > 204k MiniMax M2 limit

#### Issue 3: Wrong API Variables

**Symptoms:**

```
Error: ANTHROPIC_API_KEY not found
```

**Solution:**  
Use `OPENAI_API_KEY` and `OPENAI_API_BASE`, NOT Anthropic variables.

**Correct:**

```bash
OPENAI_API_KEY=eyJhbGci...
OPENAI_API_BASE=https://api.minimax.io/v1
```

**Incorrect:**

```bash
ANTHROPIC_API_KEY=eyJhbGci...  ❌
```

### Rotation Strategy

With 75k tokens available for dynamic loading, you can load 1-2 build orders + implementation guides per session.

#### Example Workflow

```bash
# Start Aider (base load: 129k)
aider

# Load Part 1 files (~11k tokens)
> /read-only docs/build-orders/part-01-foundation.md
> /read-only docs/implementation-guides/v5_part_a.md

# Build Part 1
> "Build Part 1 following the build order file-by-file"

# When complete, rotate to Part 2
> /drop docs/build-orders/part-01-foundation.md
> /drop docs/implementation-guides/v5_part_a.md
> /read-only docs/build-orders/part-02-database.md
> /read-only docs/implementation-guides/v5_part_b.md

# Build Part 2
> "Build Part 2 following the build order"
```

### Verification Checklist

Before starting autonomous development, verify:

- [ ] `OPENAI_API_KEY` is set in `.env.local`
- [ ] `OPENAI_API_BASE=https://api.minimax.io/v1` is set
- [ ] Model string in `.aider.conf.yml` is `openai/MiniMax-M2`
- [ ] `map-tokens: 512` in `.aider.conf.yml`
- [ ] Compressed files exist: `*-compress.md` and `*_compress.yaml`
- [ ] Aider starts without errors
- [ ] Simple query test passes

### Key Learnings

#### What Works ✅

1. **Model String:** `openai/MiniMax-M2` (with OpenAI prefix)
2. **API Variables:** `OPENAI_API_KEY` + `OPENAI_API_BASE`
3. **Endpoint:** `https://api.minimax.io/v1` (OpenAI-compatible)
4. **Context Management:** Compression (43%) + Rotation strategy
5. **Map Tokens:** 512 (reduced from 2048)

#### What Doesn't Work ❌

1. `anthropic/MiniMax-M2` → 404 Error
2. `minimax/MiniMax-M2` → Provider not recognized
3. `MiniMax-M2` (no prefix) → Provider not recognized
4. `ANTHROPIC_API_KEY` → Wrong variable
5. Loading 60+ files → Context overflow
6. `map-tokens: 2048` → Too large

### Success Metrics

**Verified Working Configuration:**

- ✅ API connection successful
- ✅ Aider starts without errors
- ✅ Model responds to queries
- ✅ Context stays within 204k limit
- ✅ File rotation works smoothly
- ✅ Ready for autonomous code generation

---

**Phase 1 Complete!** ✅  
**Ready for Phase 3 autonomous building with Aider + MiniMax M2!** 🚀
