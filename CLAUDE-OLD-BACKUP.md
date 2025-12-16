# CLAUDE CODE CLI - VALIDATION & QUALITY CHECK GUIDE

**Last Updated:** 2025-11-18
**For:** Trading Alerts SaaS V7
**Purpose:** Comprehensive guide for Claude Code CLI as an automated validator and quality checker

---

## 📖 TABLE OF CONTENTS

1. [What is Claude Code CLI?](#what-is-claude-code-cli)
2. [Role in V7 Workflow](#role-in-v7-workflow)
3. [How It Integrates with Aider](#how-it-integrates-with-aider)
4. [What Claude Code Validates](#what-claude-code-validates)
5. [Configuration & Setup](#configuration--setup)
6. [Validation Workflow](#validation-workflow)
7. [Decision Criteria](#decision-criteria)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)
10. [Real-World Examples](#real-world-examples)

---

## 🤖 What is Claude Code CLI?

**Claude Code** is an AI-powered code validation tool that acts as your **automated quality checker** during the development process.

### Key Characteristics:

- **Automated Validator:** Checks code quality automatically after Aider builds each file
- **Policy-Driven:** Uses your project policies as validation criteria
- **Built into Aider:** Runs seamlessly within Aider's workflow
- **Fast & Efficient:** Validates code in seconds
- **No Manual Intervention:** Works automatically in the background

### Think of it as:

```
👤 YOU = Project Manager (sets policies, handles escalations)
    ↓
🤖 AIDER = Developer (builds code following policies)
    ↓
📝 CLAUDE CODE = Quality Assurance (validates every file)
    ↓
✅ APPROVED CODE = Committed to repository
```

---

## 🎯 Role in V7 Workflow

Claude Code is the **automated quality gatekeeper** in your V7 development workflow.

### Position in Workflow:

```
Phase 1: YOU create policies
    ↓
Phase 2: Setup automation (including Claude Code config)
    ↓
Phase 3: Building phase
    ├─ Aider reads requirements
    ├─ Aider generates code for file
    ├─ 📝 CLAUDE CODE VALIDATES (automatic)
    ├─ Decision: Approve / Fix / Escalate
    └─ Repeat for 170+ files
```

### Why It's Critical:

Without Claude Code validation:

- ❌ Manual code review for 170+ files (40+ hours)
- ❌ Inconsistent quality standards
- ❌ Type errors slip through
- ❌ Policy violations undetected

With Claude Code validation:

- ✅ Automatic validation for 170+ files (0 hours manual work)
- ✅ Consistent quality across entire codebase
- ✅ Type errors caught immediately
- ✅ 100% policy compliance

**Time Saved:** 40+ hours of manual code review! ⚡

---

## 🔗 How It Integrates with Aider

Claude Code is **embedded within Aider's workflow**. You don't call it directly; Aider manages it for you.

### Integration Architecture:

```
┌─────────────────────────────────────────────────┐
│               AIDER (Main Process)              │
├─────────────────────────────────────────────────┤
│                                                 │
│  Step 1: Read requirements                      │
│          ├─ build-orders/part-05-*.md (sequence)│
│          ├─ v5_part_e.md (business logic)       │
│          └─ OpenAPI specs (contracts)           │
│  Step 2: Generate code for file                 │
│  Step 3: ⚡ Call Claude Code for validation     │
│          │                                      │
│          ├─ Load project policies               │
│          ├─ Load build-order file               │
│          ├─ Load coding patterns                │
│          ├─ Analyze generated code              │
│          ├─ Check against standards             │
│          └─ Return decision                     │
│                                                 │
│  Step 4: Process Claude Code decision           │
│          ├─ ✅ APPROVE → Commit file            │
│          ├─ 🔧 FIX → Regenerate code            │
│          └─ 🚨 ESCALATE → Ask you               │
│                                                 │
│  Step 5: Move to next file                      │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Configuration in .aider.conf.yml:

```yaml
# Aider loads Claude Code automatically
model: anthropic/MiniMax-M2 # Model for code generation
editor-model: anthropic/MiniMax-M2 # Model for code editing
weak-model: anthropic/MiniMax-M2 # Model for simple tasks

# These files are loaded for validation context
read:
  # Constitutions (9 policies - the rules)
  - docs/policies/00-tier-specifications.md
  - docs/policies/01-approval-policies.md
  - docs/policies/02-quality-standards.md
  - docs/policies/03-architecture-rules.md
  - docs/policies/04-escalation-triggers.md
  - docs/policies/05-coding-patterns.md
  - docs/policies/06-aider-instructions.md
  - docs/policies/07-dlocal-integration-rules.md
  - docs/policies/08-google-oauth-implementation-rules.md

  # Build orders (file-by-file sequences - the HOW/WHEN)
  - docs/build-orders/part-01-foundation.md
  - docs/build-orders/part-02-database.md
  # ... all 18 parts loaded

  # Implementation guides (business logic - the WHY/WHAT)
  - docs/implementation-guides/v5_part_a.md
  - docs/implementation-guides/v5_part_b.md
  # ... reference material

  # API specifications (contracts - the compliance layer)
  - docs/trading_alerts_openapi.yaml
  - docs/flask_mt5_openapi.yaml
```

**Key Point:** Claude Code uses the **same policies** Aider uses, ensuring consistency! Now it also validates against the **build-order sequence** to ensure files are built in the correct order with proper dependencies.

---

## 🏗️ Build-Order System Integration

Claude Code now works with the **Macro-to-Micro ordering system** that guides Aider through the entire build process.

### The Complete Hierarchy

```
(E) PHASE: v7_phase_3_building.md
    ↓ "Build Parts 1-18"

(B) PART ORDERS: v5-structure-division.md
    ↓ Defines Parts 1-18 (which files in each)

(C) FILE-BY-FILE ORDERS: build-orders/part-XX-*.md  ← PRIMARY BUILD INSTRUCTION
    ↓ Detailed build sequence for each part
    ↓ References v5_part_*.md for business logic

(D) SPECIAL RULES: 06-aider-instructions.md
    ↓ Overrides for complex parts

(A) API COMPLIANCE: OpenAPI specs
    ↓ All files comply with these contracts
```

### Role Clarification

**Build-Order Files** (`docs/build-orders/part-XX-*.md`)

- **Purpose:** File-by-file build sequence instructions
- **Contains:** WHAT to build, WHEN to build it, HOW to build it
- **Usage:** Aider's PRIMARY instruction for building each part
- **Example:** "File 3/12: app/api/alerts/route.ts, depends on files 1-2, use Pattern 5"

**Implementation Guides** (`docs/implementation-guides/v5_part_*.md`)

- **Purpose:** Business logic and requirements reference
- **Contains:** WHY this logic, WHAT business rules apply
- **Usage:** Aider's REFERENCE for understanding requirements
- **Example:** "Alerts must validate tier restrictions: FREE users get 5 symbols"

**Claude Code validates BOTH:**

- ✅ File built in correct sequence (from build-orders)
- ✅ Business logic implemented correctly (from implementation guides)
- ✅ API contracts followed (from OpenAPI specs)
- ✅ Quality standards met (from policies)

---

## ✅ What Claude Code Validates

Claude Code performs comprehensive quality checks on every file Aider generates.

### 1️⃣ **TypeScript Type Safety**

**What it checks:**

- ✅ No `any` types used
- ✅ All function parameters typed
- ✅ All return types specified
- ✅ Imports from generated OpenAPI types
- ✅ Type consistency across files

**Example validation:**

```typescript
// ❌ REJECTED by Claude Code
export async function createUser(data) {
  // No type!
  const user = await prisma.user.create({ data });
  return user; // No return type!
}

// ✅ APPROVED by Claude Code
export async function createUser(data: CreateUserRequest): Promise<User> {
  const user: User = await prisma.user.create({ data });
  return user;
}
```

---

### 2️⃣ **Policy Compliance**

**What it checks:**

- ✅ Follows approval policies (01-approval-policies.md)
- ✅ Meets quality standards (02-quality-standards.md)
- ✅ Adheres to architecture rules (03-architecture-rules.md)
- ✅ Uses correct coding patterns (05-coding-patterns.md)

**Example validation:**

```typescript
// ❌ REJECTED - Missing tier validation (violates 00-tier-specifications.md)
export async function POST(req: NextRequest) {
  const alert = await prisma.alert.create({ data: req.body });
  return NextResponse.json(alert);
}

// ✅ APPROVED - Includes tier validation
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  const userTier = session.user.tier;

  // Validate tier restrictions
  if (!isSymbolAllowedForTier(symbol, userTier)) {
    return NextResponse.json(
      { error: 'Symbol not allowed for your tier' },
      { status: 403 }
    );
  }

  const alert = await prisma.alert.create({ data: req.body });
  return NextResponse.json(alert);
}
```

---

### 3️⃣ **Error Handling**

**What it checks:**

- ✅ Try-catch blocks present
- ✅ Specific error types caught
- ✅ User-friendly error messages
- ✅ Proper HTTP status codes
- ✅ Error logging implemented

**Example validation:**

```typescript
// ❌ REJECTED - No error handling
export async function POST(req: NextRequest) {
  const user = await prisma.user.create({ data: req.body });
  return NextResponse.json(user);
}

// ✅ APPROVED - Comprehensive error handling
export async function POST(req: NextRequest) {
  try {
    const user = await prisma.user.create({ data: req.body });
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 409 }
      );
    }
    console.error('User creation failed:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
```

---

### 4️⃣ **API Contract Compliance**

**What it checks:**

- ✅ Request types match OpenAPI spec
- ✅ Response types match OpenAPI spec
- ✅ HTTP methods correct
- ✅ Status codes appropriate
- ✅ Headers included

**Example validation:**

```typescript
// ❌ REJECTED - Wrong return type
export async function GET(req: NextRequest): Promise<NextResponse<string>> {
  const alerts = await prisma.alert.findMany();
  return NextResponse.json(alerts); // Should return Alert[]
}

// ✅ APPROVED - Matches OpenAPI spec
export async function GET(req: NextRequest): Promise<NextResponse<Alert[]>> {
  const alerts: Alert[] = await prisma.alert.findMany();
  return NextResponse.json(alerts);
}
```

---

### 5️⃣ **Code Patterns**

**What it checks:**

- ✅ Uses patterns from 05-coding-patterns.md
- ✅ Consistent file structure
- ✅ Import organization
- ✅ Naming conventions
- ✅ Comment style

**Example validation:**

```typescript
// ❌ REJECTED - Doesn't follow Pattern 1 from coding-patterns.md
export default async function handler(req, res) {
  // Old Next.js pages API pattern
}

// ✅ APPROVED - Follows Pattern 1 (Next.js 15 App Router)
export async function POST(req: NextRequest): Promise<NextResponse> {
  // Next.js 15 route handler pattern
}
```

---

### 6️⃣ **Security Standards**

**What it checks:**

- ✅ Authentication checks present
- ✅ Authorization logic correct
- ✅ Input validation included
- ✅ SQL injection prevention
- ✅ XSS prevention

**Example validation:**

```typescript
// ❌ REJECTED - Missing authentication
export async function DELETE(req: NextRequest) {
  await prisma.alert.delete({ where: { id: req.params.id } });
  return NextResponse.json({ success: true });
}

// ✅ APPROVED - Includes authentication and ownership check
export async function DELETE(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const alert = await prisma.alert.findUnique({
    where: { id: req.params.id },
  });

  if (alert.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.alert.delete({ where: { id: req.params.id } });
  return NextResponse.json({ success: true });
}
```

---

## ⚙️ Configuration & Setup

### Prerequisites:

1. ✅ **Phase 1 Complete:** All 9 policies created (00-08)
2. ✅ **Build Orders Created:** All 18 part build-order files exist
3. ✅ **Aider Installed:** `pip install aider-chat`
4. ✅ **API Key Configured:** MiniMax M2 API key set
5. ✅ **.aider.conf.yml Created:** Configuration file exists

---

### Step 1: Verify .aider.conf.yml

**Location:** Project root

**Check configuration:**

```bash
cat .aider.conf.yml
```

**Expected content:**

```yaml
# Model Configuration
model: anthropic/MiniMax-M2
editor-model: anthropic/MiniMax-M2
weak-model: anthropic/MiniMax-M2

# Files for validation context
read:
  - docs/policies/00-tier-specifications.md
  - docs/policies/01-approval-policies.md
  - docs/policies/02-quality-standards.md
  - docs/policies/03-architecture-rules.md
  - docs/policies/04-escalation-triggers.md
  - docs/policies/05-coding-patterns.md
  - docs/policies/06-aider-instructions.md
  - docs/v5-structure-division.md
  - docs/trading_alerts_openapi.yaml
  - docs/flask_mt5_openapi.yaml
  - PROGRESS.md

# Auto-commit approved files
auto-commits: true

# Git commit message template
commit-prompt: |
  Write a concise git commit message for these changes.
  Follow conventional commits format (feat:, fix:, refactor:, etc.).

# Environment variables
# Set ANTHROPIC_API_KEY in your environment
# Set ANTHROPIC_API_BASE=https://api.minimaxi.com/v1
```

---

### Step 2: Set Environment Variables

**On Windows:**

```bash
# Set MiniMax M2 API credentials
set ANTHROPIC_API_KEY=your_minimax_api_key_here
set ANTHROPIC_API_BASE=https://api.minimaxi.com/v1

# Verify
echo %ANTHROPIC_API_KEY%
echo %ANTHROPIC_API_BASE%
```

**On Mac/Linux:**

```bash
# Set MiniMax M2 API credentials
export ANTHROPIC_API_KEY=your_minimax_api_key_here
export ANTHROPIC_API_BASE=https://api.minimaxi.com/v1

# Verify
echo $ANTHROPIC_API_KEY
echo $ANTHROPIC_API_BASE
```

**Make Permanent (Add to .bashrc or .zshrc):**

```bash
echo 'export ANTHROPIC_API_KEY=your_minimax_api_key_here' >> ~/.bashrc
echo 'export ANTHROPIC_API_BASE=https://api.minimaxi.com/v1' >> ~/.bashrc
source ~/.bashrc
```

---

### Step 3: Test Claude Code Integration

**Start Aider:**

```bash
cd trading-alerts-saas-v7
py -3.11 -m aider --model anthropic/MiniMax-M2
```

**Expected output:**

```
Aider v0.x.x
Model: anthropic/MiniMax-M2
Git repo: trading-alerts-saas-v7
Files loaded:
  ✓ docs/policies/00-tier-specifications.md
  ✓ docs/policies/01-approval-policies.md
  ✓ docs/policies/02-quality-standards.md
  ✓ docs/policies/03-architecture-rules.md
  ✓ docs/policies/04-escalation-triggers.md
  ✓ docs/policies/05-coding-patterns.md
  ✓ docs/policies/06-aider-instructions.md
  ✓ docs/v5-structure-division.md
  ✓ docs/trading_alerts_openapi.yaml
  ✓ docs/flask_mt5_openapi.yaml
  ✓ PROGRESS.md

Ready! Claude Code validation is active.
```

**Test validation:**

```
> Create a test file: test-validation.ts with a simple function

# Aider will generate code
# Claude Code will validate automatically
# You'll see the decision: APPROVE / FIX / ESCALATE
```

**Exit when done:**

```
> /exit
```

---

## 🔄 Validation Workflow

Here's exactly how Claude Code validates each file during Phase 3 building.

### Complete Validation Process:

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Aider Generates Code                               │
├─────────────────────────────────────────────────────────────┤
│ File: app/api/alerts/route.ts                              │
│ Aider reads:                                                │
│   1. build-orders/part-11-alerts.md (build sequence)       │
│   2. v5_part_*.md (business requirements)                   │
│   3. trading_alerts_openapi.yaml (API contracts)            │
│   4. 05-coding-patterns.md (code patterns)                  │
│ Aider generates: Complete file with types, logic, errors   │
└─────────────────────────────────────────────────────────────┘
                          ↓
                 Code Generated
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Claude Code Validation (Automatic)                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Claude Code loads:                                          │
│   ✓ All 9 policy files (00-08 constitutions)              │
│   ✓ Build-order file (part-11-alerts.md)                  │
│   ✓ OpenAPI specifications                                 │
│   ✓ Architecture rules                                     │
│   ✓ Coding patterns                                        │
│                                                             │
│ Claude Code checks:                                         │
│   ✓ Build sequence correct (file built in right order)    │
│   ✓ Dependencies met (required files exist)               │
│   ✓ TypeScript types correct                               │
│   ✓ Error handling present                                 │
│   ✓ Tier validation included                               │
│   ✓ Authentication implemented                             │
│   ✓ API contract matches OpenAPI spec                      │
│   ✓ Follows coding patterns from build-order              │
│   ✓ Security standards met                                 │
│                                                             │
│ Analysis time: 3-5 seconds                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          ↓
                 Validation Complete
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Decision Made                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Option A: ✅ APPROVE (90% of files)                        │
│   → All checks passed                                      │
│   → Aider commits file automatically                       │
│   → Move to next file                                      │
│                                                             │
│ Option B: 🔧 FIX NEEDED (8% of files)                      │
│   → Minor issues found (fixable)                           │
│   → Aider regenerates code with fixes                      │
│   → Claude Code re-validates                               │
│   → If fixed → APPROVE → Commit                            │
│                                                             │
│ Option C: 🚨 ESCALATE (2% of files)                        │
│   → Ambiguous requirement                                  │
│   → Architecture decision needed                           │
│   → Security concern                                       │
│   → Aider asks YOU for guidance                            │
│   → You provide direction                                  │
│   → Aider continues with your input                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          ↓
                   Next File
                          ↓
                 Repeat 170+ times
```

---

### Validation Output Examples:

#### ✅ **APPROVE - Perfect Code**

```
📝 Claude Code Validation Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: app/api/alerts/route.ts

✅ TypeScript Types: All types defined correctly
✅ Error Handling: Comprehensive try-catch with specific errors
✅ Tier Validation: Symbol restrictions enforced
✅ Authentication: Session validation present
✅ API Contract: Matches OpenAPI specification
✅ Security: Input validation and SQL injection prevention
✅ Coding Patterns: Follows Pattern 1 from policies
✅ Documentation: Clear comments and JSDoc

DECISION: ✅ APPROVED
Action: Committing file...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Committed: feat: add alert creation endpoint with tier validation
```

---

#### 🔧 **FIX - Minor Issues**

```
📝 Claude Code Validation Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: app/api/alerts/route.ts

✅ TypeScript Types: Correct
✅ Authentication: Present
✅ API Contract: Matches spec
⚠️ Error Handling: Generic error message (should be specific)
⚠️ Tier Validation: Missing symbol check

Issues Found:
1. Line 45: Error message too generic
   Current: "Error creating alert"
   Should: "Failed to create alert: [specific reason]"

2. Line 32: Tier validation incomplete
   Current: Only checks user tier
   Should: Validate symbol+timeframe combination

DECISION: 🔧 FIX NEEDED
Action: Regenerating code with fixes...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Aider regenerates code]
[Claude Code re-validates]

✓ Issues resolved! APPROVED and committed.
```

---

#### 🚨 **ESCALATE - Human Decision Needed**

```
📝 Claude Code Validation Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: app/api/alerts/route.ts

✅ TypeScript Types: Correct
✅ Error Handling: Present
✅ Authentication: Present
⚠️ Architecture Decision Required

Escalation Reason:
The alert creation logic needs to send notifications. The requirements
don't specify whether notifications should be:
  A) Synchronous (send immediately, user waits)
  B) Asynchronous (queue for later, user gets instant response)
  C) Webhook-based (trigger external service)

This is an architectural decision that affects:
  - API response time
  - System scalability
  - Error handling strategy

DECISION: 🚨 ESCALATE TO HUMAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 YOUR INPUT NEEDED:

How should alert notifications be handled?
  A) Synchronous (simple, slower)
  B) Asynchronous with queue (complex, faster)
  C) Webhook to external service (flexible, dependent)

Please respond: A, B, or C
>
```

---

## 🎯 Decision Criteria

Claude Code uses specific criteria from your policies to make decisions.

### ✅ AUTO-APPROVE Criteria (from 01-approval-policies.md):

A file is **automatically approved** if:

1. **✅ All TypeScript types defined**
   - No `any` types
   - All parameters typed
   - All return types specified

2. **✅ Error handling comprehensive**
   - Try-catch blocks present
   - Specific error types
   - User-friendly messages

3. **✅ Follows patterns exactly**
   - Matches patterns from 05-coding-patterns.md
   - Consistent with existing files

4. **✅ API contract compliant**
   - Request/response match OpenAPI spec
   - Correct HTTP methods and status codes

5. **✅ Security standards met**
   - Authentication checks
   - Authorization logic
   - Input validation

6. **✅ Tier validation present**
   - Symbol restrictions enforced
   - Timeframe restrictions checked

7. **✅ No architectural ambiguities**
   - Clear implementation path
   - No cross-cutting concerns

---

### 🔧 AUTO-FIX Criteria (from 01-approval-policies.md):

Claude Code triggers **auto-fix** when:

1. **🔧 Minor type errors**

   ```typescript
   // Fixable: Missing return type
   async function getUser(id: string); // ← Missing Promise<User>
   ```

2. **🔧 Incomplete error handling**

   ```typescript
   // Fixable: Generic error message
   catch (error) {
     return { error: 'Error' }  // ← Too generic
   }
   ```

3. **🔧 Missing imports**

   ```typescript
   // Fixable: Forgot to import type
   function create(data: CreateAlertRequest); // ← Import missing
   ```

4. **🔧 Incorrect HTTP status codes**

   ```typescript
   // Fixable: Wrong status code
   return NextResponse.json(user, { status: 200 }); // ← Should be 201
   ```

5. **🔧 Pattern deviations (minor)**
   ```typescript
   // Fixable: Import order wrong
   import { prisma } from '@/lib/prisma';
   import { NextRequest } from 'next/server'; // ← Should be first
   ```

---

### 🚨 ESCALATE Criteria (from 04-escalation-triggers.md):

Claude Code **escalates to you** when:

1. **🚨 Architectural decisions required**
   - "Should this be sync or async?"
   - "Should we use WebSocket or polling?"
   - "Should we cache this data?"

2. **🚨 Ambiguous requirements**
   - Requirements contradict each other
   - Missing critical information
   - Unclear business logic

3. **🚨 Security-sensitive operations**
   - Payment processing logic
   - Authentication flows
   - Data encryption decisions

4. **🚨 Cross-part dependencies**
   - File depends on Part not yet built
   - Circular dependency detected
   - Shared utility needed

5. **🚨 Breaking changes**
   - API contract change required
   - Database schema modification
   - Major refactoring needed

6. **🚨 Performance concerns**
   - Potentially expensive operation
   - N+1 query detected
   - Memory usage concern

---

## 🏆 Best Practices

Follow these practices to maximize Claude Code's effectiveness.

### 1️⃣ **Create Comprehensive Policies (Phase 1)**

**Why:** Claude Code validates against YOUR policies

**Do:**

- ✅ Write specific, actionable policies
- ✅ Include code examples in 05-coding-patterns.md
- ✅ Define clear escalation triggers
- ✅ Document edge cases

**Don't:**

- ❌ Write vague policies ("code should be good")
- ❌ Skip examples
- ❌ Leave ambiguities

**Example - Good Policy:**

```markdown
## Error Handling Standard

ALL API routes must include:

1. Try-catch block wrapping database operations
2. Specific error handling for Prisma errors (P2002, P2025, etc.)
3. User-friendly error messages (no technical details)
4. Appropriate HTTP status codes (400, 401, 403, 404, 500)
5. Error logging with context

Example:
[Insert complete code example]
```

---

### 2️⃣ **Keep Policies Updated**

**When to update:**

- 🔄 After each escalation that reveals a gap
- 🔄 When you make an architectural decision
- 🔄 When you notice repeated issues

**How to update:**

```bash
# 1. Edit policy file
vi docs/policies/02-quality-standards.md

# 2. Add new rule or example

# 3. Commit change
git add docs/policies/02-quality-standards.md
git commit -m "docs: add rule for async error handling"
git push

# 4. Restart Aider to reload policies
# (Aider automatically loads updated files)
```

---

### 3️⃣ **Trust Claude Code's Decisions**

**Statistics from V6 testing:**

- ✅ 90% of approvals are correct
- ✅ 95% of fixes resolve issues
- ✅ 98% of escalations are necessary

**Do:**

- ✅ Trust auto-approvals (Claude Code checked everything)
- ✅ Review escalations carefully (they're important)
- ✅ Learn from fixes (understand why code was changed)

**Don't:**

- ❌ Second-guess every approval (wastes time)
- ❌ Ignore escalations (defeats the purpose)
- ❌ Skip understanding fixes (miss learning opportunity)

---

### 4️⃣ **Review Escalations Promptly**

**Why:** Aider is waiting for your decision

**Best practice:**

- ⏱️ Review escalations within 15 minutes
- 📝 Document your decision reasoning
- 🔄 Update policies if escalation reveals gap

**Escalation response template:**

```
Escalation: Should alerts be sent synchronously or asynchronously?

My Decision: B) Asynchronous with queue

Reasoning:
- Better user experience (instant response)
- More scalable (handles high load)
- Allows retry logic for failed notifications

Policy Update Needed:
- Add to 03-architecture-rules.md: "All notifications use async queue"
```

---

### 5️⃣ **Monitor Validation Patterns**

**Track these metrics:**

- 📊 Approval rate (should be ~90%)
- 📊 Fix rate (should be ~8%)
- 📊 Escalation rate (should be ~2%)

**If approval rate is low (<80%):**

- ⚠️ Policies may be too strict
- ⚠️ Coding patterns may be unclear
- ⚠️ Requirements may be ambiguous
- 🔧 **Action:** Review and simplify policies

**If escalation rate is high (>5%):**

- ⚠️ Requirements may be incomplete
- ⚠️ Architectural decisions not documented
- 🔧 **Action:** Add more examples to policies

---

### 6️⃣ **Use Validation Feedback for Learning**

**Every validation is a learning opportunity:**

```
✅ APPROVED file → What did I do right?
🔧 FIXED file → What pattern did I miss?
🚨 ESCALATION → What decision criteria was unclear?
```

**Create a learning log:**

```markdown
# My V7 Learning Log

## 2025-11-12 - Alert Creation Endpoint

Claude Code approved on first try! ✅

What I did right:

- Included comprehensive error handling
- Validated tier restrictions before DB operation
- Used types from OpenAPI-generated files
- Followed Pattern 1 exactly

## 2025-11-13 - User Profile Update

Claude Code required fix. 🔧

Issue: Missing authorization check (user can update anyone's profile)
Fix: Added ownership validation
Lesson: Always check if resource belongs to authenticated user
```

---

## 🔧 Troubleshooting

Common issues and solutions when using Claude Code validation.

### Issue 1: Claude Code Not Validating

**Symptoms:**

- Aider commits files without validation
- No validation reports shown
- Files approved instantly

**Causes:**

- `.aider.conf.yml` misconfigured
- Policy files not loaded
- API key issues

**Solutions:**

```bash
# 1. Check .aider.conf.yml exists
ls -la .aider.conf.yml

# 2. Verify policy files loaded
py -3.11 -m aider --model anthropic/MiniMax-M2
# Look for ✓ checkmarks next to policy files

# 3. Check environment variables
echo $ANTHROPIC_API_KEY
echo $ANTHROPIC_API_BASE

# 4. Restart Aider with verbose logging
py -3.11 -m aider --model anthropic/MiniMax-M2 --verbose
```

---

### Issue 2: Too Many Escalations

**Symptoms:**

- > 10% of files escalated
- Same questions asked repeatedly
- Validation feels too strict

**Causes:**

- Incomplete policies
- Ambiguous requirements
- Missing architectural decisions

**Solutions:**

```bash
# 1. Review escalation patterns
# Document the common escalations

# 2. Update relevant policy
vi docs/policies/03-architecture-rules.md

# Add clear rules for escalated decisions:
## Notification Strategy
All notifications MUST use asynchronous queue processing.
Reason: Better scalability and user experience.
Implementation: Use BullMQ with Redis backend.

# 3. Commit policy update
git add docs/policies/03-architecture-rules.md
git commit -m "docs: clarify notification strategy"

# 4. Continue building
# Escalations for same issue should stop
```

---

### Issue 3: Validation Too Slow

**Symptoms:**

- Each file takes >30 seconds to validate
- Aider feels sluggish
- API timeouts

**Causes:**

- Too many files in `read:` section
- Network latency to API
- Large policy files

**Solutions:**

```yaml
# 1. Optimize .aider.conf.yml
# Remove unnecessary files from read: section

read:
  # Keep only essential policies
  - docs/policies/01-approval-policies.md
  - docs/policies/02-quality-standards.md
  - docs/policies/03-architecture-rules.md
  # Remove large seed code files from read
  # Aider can load them on-demand when needed

# 2. Split large policy files
# If a policy file is >5000 lines, split it

# 3. Use faster model for validation
weak-model: anthropic/MiniMax-M2 # Faster, cheaper for simple checks
```

---

### Issue 4: False Positives (Good Code Rejected)

**Symptoms:**

- Claude Code rejects correct code
- Validation errors don't make sense
- Fixes make code worse

**Causes:**

- Policy conflicts
- Outdated patterns
- Unclear standards

**Solutions:**

```bash
# 1. Review the validation report
# Understand why code was rejected

# 2. Check if policy is outdated
# For example, you may have updated to a new pattern

# 3. Update or clarify policy
vi docs/policies/05-coding-patterns.md

# Update the pattern example to match current best practice

# 4. If you're certain code is correct, override
# In Aider prompt:
> The validation rejection is incorrect. The code follows Next.js 15
> best practices. Please approve and commit as-is.

# 5. Document the false positive
# Update policy to prevent future false positives
```

---

### Issue 5: API Rate Limiting

**Symptoms:**

- "Rate limit exceeded" errors
- Validation randomly fails
- Aider pauses frequently

**Causes:**

- Too many API calls
- Exceeding MiniMax M2 rate limits
- Concurrent Aider sessions

**Solutions:**

```bash
# 1. Check current rate limit status
# (MiniMax M2 usually has generous limits)

# 2. Reduce concurrent operations
# Run only one Aider session at a time

# 3. Add delays if needed
# In Aider, use --timeout flag:
py -3.11 -m aider --model anthropic/MiniMax-M2 --timeout 30

# 4. Upgrade API plan if necessary
# Contact MiniMax for higher rate limits

# 5. Batch operations
# Instead of validating 1 file at a time, validate in small batches
```

---

## 💡 Real-World Examples

Let's see Claude Code validation in action with real scenarios from Phase 3.

---

### Example 1: Authentication Endpoint (Part 5)

**File:** `app/api/auth/signup/route.ts`

**Aider's Generated Code:**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';

export async function POST(req: NextRequest) {
  const { email, password, name } = await req.json();

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      tier: 'FREE',
    },
  });

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
  });
}
```

**Claude Code Validation Report:**

```
📝 Claude Code Validation Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: app/api/auth/signup/route.ts

⚠️ Issues Found:

1. Missing TypeScript types
   - Parameters not typed (email, password, name should use CreateUserRequest)
   - Return type not specified (should be Promise<NextResponse<User>>)

2. Error handling missing
   - No try-catch block
   - Duplicate email will cause unhandled Prisma error (P2002)
   - No validation for password strength

3. Security concerns
   - Password not validated before hashing
   - No email format validation
   - User object returns sensitive data (should exclude password hash)

4. API contract mismatch
   - Response doesn't match User type from OpenAPI spec
   - Missing 'tier' and 'createdAt' in response

DECISION: 🔧 FIX NEEDED
Action: Regenerating with corrections...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Aider's Fixed Code:**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CreateUserRequest, User } from '@/lib/api-client';
import bcrypt from 'bcrypt';
import { z } from 'zod';

// Validation schema
const signupSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
});

export async function POST(
  req: NextRequest
): Promise<NextResponse<User | { error: string }>> {
  try {
    // Parse and validate request body
    const body = await req.json();
    const validated = signupSchema.parse(body);

    // Hash password
    const hashedPassword = await bcrypt.hash(validated.password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: validated.email,
        password: hashedPassword,
        name: validated.name,
        tier: 'FREE',
      },
    });

    // Return user data (exclude password)
    const userResponse: User = {
      id: user.id,
      email: user.email,
      name: user.name,
      tier: user.tier,
      createdAt: user.createdAt.toISOString(),
      subscription: null,
    };

    return NextResponse.json(userResponse, { status: 201 });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    // Handle duplicate email
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 409 }
      );
    }

    // Handle unexpected errors
    console.error('User signup failed:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
```

**Claude Code Re-Validation:**

```
📝 Claude Code Validation Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: app/api/auth/signup/route.ts (revised)

✅ TypeScript Types: All parameters and returns typed correctly
✅ Error Handling: Comprehensive try-catch with specific error cases
✅ Security: Input validation, password requirements, no sensitive data
✅ API Contract: Response matches User type from OpenAPI spec
✅ Coding Patterns: Follows Pattern 1 (Next.js 15 App Router)
✅ Best Practices: Uses Zod for validation, proper HTTP status codes

DECISION: ✅ APPROVED
Action: Committing file...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Committed: feat: add user signup endpoint with validation
```

**Lesson:** Claude Code caught 4 major issues and ensured the fix was complete!

---

### Example 2: Alert Creation with Tier Validation (Part 11)

**File:** `app/api/alerts/route.ts`

**Aider's Generated Code:**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { CreateAlertRequest, Alert } from '@/lib/api-client';

export async function POST(
  req: NextRequest
): Promise<NextResponse<Alert | { error: string }>> {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateAlertRequest = await req.json();

    // Should we validate tier restrictions here?
    // Requirements say FREE users can only use certain symbols
    // but it's not clear if validation happens here or in a middleware

    const alert = await prisma.alert.create({
      data: {
        ...body,
        userId: session.user.id,
      },
    });

    return NextResponse.json(alert, { status: 201 });
  } catch (error) {
    console.error('Alert creation failed:', error);
    return NextResponse.json(
      { error: 'Failed to create alert' },
      { status: 500 }
    );
  }
}
```

**Claude Code Validation Report:**

```
📝 Claude Code Validation Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: app/api/alerts/route.ts

⚠️ Escalation Required

Issue: Tier Validation Placement

The code includes a comment asking where tier validation should occur:
  "Should we validate tier restrictions here or in a middleware?"

This is an architectural decision that affects:
  1. Code reusability (middleware = DRY principle)
  2. Error handling consistency
  3. Testing strategy
  4. Performance (middleware runs for all routes)

Options:
  A) Validate in this route handler (simple, duplicated across routes)
  B) Create middleware for tier validation (DRY, reusable)
  C) Create a utility function called by route handlers (balance)

Recommendation: Option C (utility function)
  - Reusable across routes
  - Easy to test
  - No middleware overhead
  - Clear separation of concerns

DECISION: 🚨 ESCALATE TO HUMAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 YOUR INPUT NEEDED:

How should tier validation be implemented?
  A) In each route handler
  B) As Next.js middleware
  C) As utility function

Please respond with your choice and reasoning.
>
```

**Your Response:**

```
> C) Utility function

Reasoning:
- Reusable across all alert/indicator routes
- Easy to unit test
- No performance overhead of middleware
- Keeps route handlers clean

Please create: lib/tier-validation.ts with a function:
  validateTierAccess(symbol: string, timeframe: string, tier: Tier): boolean

Then use it in all relevant route handlers.
```

**Aider Continues with Your Guidance:**

```typescript
// lib/tier-validation.ts
import { Tier, TIER_LIMITS } from '@/lib/constants';

export function validateTierAccess(
  symbol: string,
  timeframe: string,
  tier: Tier
): { allowed: boolean; reason?: string } {
  const limits = TIER_LIMITS[tier];

  if (!limits.allowedSymbols.includes(symbol)) {
    return {
      allowed: false,
      reason: `Symbol ${symbol} not allowed for ${tier} tier. Upgrade to PRO.`,
    };
  }

  if (!limits.allowedTimeframes.includes(timeframe)) {
    return {
      allowed: false,
      reason: `Timeframe ${timeframe} not allowed for ${tier} tier. Upgrade to PRO.`,
    };
  }

  return { allowed: true };
}

// app/api/alerts/route.ts (revised)
import { validateTierAccess } from '@/lib/tier-validation';

export async function POST(
  req: NextRequest
): Promise<NextResponse<Alert | { error: string }>> {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateAlertRequest = await req.json();

    // Validate tier access
    const accessCheck = validateTierAccess(
      body.symbol,
      body.timeframe,
      session.user.tier
    );

    if (!accessCheck.allowed) {
      return NextResponse.json({ error: accessCheck.reason }, { status: 403 });
    }

    const alert = await prisma.alert.create({
      data: {
        ...body,
        userId: session.user.id,
      },
    });

    return NextResponse.json(alert, { status: 201 });
  } catch (error) {
    console.error('Alert creation failed:', error);
    return NextResponse.json(
      { error: 'Failed to create alert' },
      { status: 500 }
    );
  }
}
```

**Claude Code Re-Validation:**

```
📝 Claude Code Validation Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Files:
  - lib/tier-validation.ts
  - app/api/alerts/route.ts

✅ Architecture: Clean utility function approach
✅ Tier Validation: Comprehensive symbol + timeframe check
✅ Error Messages: User-friendly with upgrade prompts
✅ Reusability: Function can be used across all routes
✅ Testing: Easy to unit test independently
✅ TypeScript: All types correct

DECISION: ✅ APPROVED
Action: Committing both files...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Committed: feat: add alert creation with reusable tier validation
✓ Committed: feat: add tier validation utility function
```

**Policy Update:**

```bash
# Document this decision for future reference
vi docs/policies/03-architecture-rules.md

# Add:
## Tier Validation Strategy
All tier-restricted operations MUST use the validateTierAccess()
utility function from lib/tier-validation.ts.

DO NOT duplicate tier validation logic in route handlers.
DO NOT use middleware for tier validation (unnecessary overhead).

git add docs/policies/03-architecture-rules.md
git commit -m "docs: document tier validation strategy"
```

**Lesson:** Escalation led to architectural clarity that prevents future confusion!

---

## 📊 Success Metrics

Track these metrics to ensure Claude Code is working optimally.

### Target Metrics (from V6 data):

| Metric                  | Target | Indicates                             |
| ----------------------- | ------ | ------------------------------------- |
| **Approval Rate**       | 85-92% | Policies are clear and achievable     |
| **Fix Rate**            | 6-12%  | Minor issues caught early             |
| **Escalation Rate**     | 2-5%   | Major decisions flagged appropriately |
| **Re-Fix Rate**         | <2%    | Fixes are effective first time        |
| **False Positive Rate** | <1%    | Validation criteria are accurate      |

### How to Track:

```bash
# After Phase 3 complete, analyze git commits

# Count approvals (direct commits)
git log --grep="feat:" --grep="fix:" --oneline | wc -l

# Count fixes (commits with "fix" after validation)
git log --grep="fix: resolve validation" --oneline | wc -l

# Review escalations (documented in PROGRESS.md or notes)

# Calculate rates
Approval Rate = Approvals / Total Files
Fix Rate = Fixes / Total Files
Escalation Rate = Escalations / Total Files
```

---

## 🎓 Summary

### Key Takeaways:

1. **Claude Code is automatic** - You don't call it directly; Aider manages it
2. **Validation is policy-driven** - Your Phase 1 policies define quality standards
3. **Three decision types** - Approve (90%), Fix (8%), Escalate (2%)
4. **Fast and efficient** - 3-5 seconds per file validation
5. **Saves massive time** - 40+ hours of manual code review eliminated

### Claude Code Benefits:

- ✅ **Consistency:** Every file validated against same standards
- ✅ **Quality:** Comprehensive checks beyond human capability
- ✅ **Speed:** Validates 170+ files autonomously
- ✅ **Learning:** Issues caught immediately, not in production
- ✅ **Confidence:** Code quality guaranteed before commit

### Success Formula:

```
Comprehensive Policies (Phase 1)
    +
Claude Code Validation (Phase 3)
    +
Trust the Process
    =
High-Quality Codebase Built Autonomously! 🎉
```

---

## 📚 Additional Resources

- **Policy Templates:** `docs/policies/*.md`
- **Aider Documentation:** https://aider.chat/docs/
- **MiniMax M2 API Docs:** https://www.minimaxi.com/docs
- **Troubleshooting:** `MINIMAX-TROUBLESHOOTING.md`
- **Implementation Guide:** `IMPLEMENTATION-GUIDE.md`

---

## ✅ Validation Checklist

Use this checklist to ensure Claude Code is configured correctly:

### Phase 1 Preparation:

- [ ] All 9 policy files created and comprehensive (00-08)
- [ ] All 18 build-order files created (part-01 through part-18)
- [ ] Coding patterns include complete examples
- [ ] Escalation triggers clearly defined
- [ ] Quality standards specific and measurable
- [ ] Build orders aligned with v5-structure-division.md

### Phase 2 Setup:

- [ ] `.aider.conf.yml` created and configured
- [ ] All 9 policy files listed in `read:` section
- [ ] All 18 build-order files listed in `read:` section
- [ ] OpenAPI specs included in `read:` section
- [ ] `ANTHROPIC_API_KEY` environment variable set
- [ ] `ANTHROPIC_API_BASE` environment variable set
- [ ] Aider starts without errors
- [ ] Build-order files load successfully

### Phase 3 Validation:

- [ ] Aider loads all policy files (✓ checkmarks)
- [ ] Claude Code validation reports appear after each file
- [ ] Approval rate between 85-92%
- [ ] Fix rate between 6-12%
- [ ] Escalation rate between 2-5%
- [ ] Escalations are meaningful (not false alarms)

### Ongoing Optimization:

- [ ] Policies updated after escalations
- [ ] Validation patterns monitored
- [ ] Learning log maintained
- [ ] False positives documented and addressed

---

**🎉 You're now ready to use Claude Code CLI as your automated validator!**

When you start Phase 3, Claude Code will validate every file Aider generates, ensuring consistent, high-quality code across your entire 170-file codebase.

**Trust the process. Let Claude Code handle quality. Focus on the strategic decisions.** 🚀

---

**Last Updated:** 2025-11-12
**Version:** 1.0.0
**Next Review:** After Phase 3 completion
