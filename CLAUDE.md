# AIDER - AUTOMATED CODE BUILDER & VALIDATOR GUIDE

**Last Updated:** 2025-11-24
**For:** Trading Alerts SaaS V7
**Purpose:** Comprehensive guide for Aider as an automated code builder with integrated validation

---

## 📖 TABLE OF CONTENTS

1. [What is Aider?](#what-is-aider)
2. [Role in V7 Workflow](#role-in-v7-workflow)
3. [Automated Validation System](#automated-validation-system)
4. [What Aider Validates](#what-aider-validates)
5. [Configuration & Setup](#configuration--setup)
6. [Token Budget Management](#token-budget-management)
7. [Validation Workflow](#validation-workflow)
8. [Decision Criteria](#decision-criteria)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)
11. [Real-World Examples](#real-world-examples)
12. [Security Override Policy](#security-override-policy)

---

## 🔒 Security Override Policy

**CRITICAL RULE — All AI agents (Claude Code, Aider, etc.) MUST follow this.**

### DO NOT modify dependency overrides in feature branches

When working on a feature branch, you **MUST NOT** modify the `overrides` or `pnpm.overrides` sections of `package.json`. This applies even if `pnpm audit` reports security vulnerabilities.

**Why:** Every feature branch that independently adds overrides will conflict with `main` on merge, because `main` gets different overrides from other PRs. This has caused **7+ documented merge conflict incidents** — see `errors/continuous-pr-errors/` for the full history.

### What to do if `pnpm audit` reports vulnerabilities

1. **Ignore it.** The security audit is informative and non-blocking.
2. Continue working on your feature branch normally.
3. Security overrides are managed centrally on `main` via dedicated PRs.

### How security overrides are managed

1. A dedicated security PR is created from `main` (not from a feature branch)
2. The PR only modifies `overrides`/`pnpm.overrides` in `package.json`
3. It is merged to `main` before other feature PRs
4. The `lockfile-regen.yml` workflow automatically regenerates `pnpm-lock.yaml`

### CI enforcement

The `check-overrides.yml` workflow will **fail** any PR that modifies overrides from a feature branch. To bypass (for dedicated security PRs only), add the `security-override` label to the PR.

---

## 🤖 What is Aider?

**Aider** is an AI-powered autonomous code builder that generates code while following your project policies.

### Key Characteristics:

- **Autonomous Builder:** Generates code file-by-file following build orders
- **Policy-Driven:** Uses your project policies as generation guidelines
- **Automated Validation:** Runs validation tools after generating each file
- **Self-Correcting:** Fixes issues automatically when possible
- **Smart Escalation:** Asks you only when human decisions are needed

### Think of it as:

```
👤 YOU = Project Manager (sets policies, handles major decisions)
    ↓
🤖 AIDER = Autonomous Developer (builds code, runs validation, fixes issues)
    ↓
🔍 VALIDATION TOOLS = Quality Assurance (TypeScript, ESLint, Prettier, Policy Checker)
    ↓
✅ APPROVED CODE = Committed to repository
```

---

## 🎯 Role in V7 Workflow

Aider is the **autonomous code builder and validator** in your V7 development workflow.

### Position in Workflow:

```
Phase 1: YOU create policies
    ↓
Phase 2: Setup automation (Aider config + Validation tools)
    ↓
Phase 3: Building phase
    ├─ Aider reads requirements & policies
    ├─ Aider generates code for file
    ├─ 🔍 AUTOMATED VALIDATION RUNS
    │   ├─ TypeScript type checking
    │   ├─ ESLint code quality
    │   ├─ Prettier formatting
    │   ├─ Policy compliance checking
    │   └─ Jest tests
    ├─ Aider reviews results
    ├─ Decision: Approve / Auto-Fix / Escalate
    └─ Repeat for 170+ files
```

### Why It's Critical:

Without automated validation:

- ❌ Manual code review for 170+ files (40+ hours)
- ❌ Inconsistent quality standards
- ❌ Type errors slip through
- ❌ Policy violations undetected

With automated validation:

- ✅ Automatic validation for 170+ files (0 hours manual work)
- ✅ Consistent quality across entire codebase
- ✅ Type errors caught immediately
- ✅ 100% policy compliance

**Time Saved:** 40+ hours of manual code review! ⚡

---

## 🔍 Automated Validation System

Aider uses a multi-layered validation system that runs automatically after generating each file.

### Validation Layers:

```
┌─────────────────────────────────────────────────┐
│           AUTOMATED VALIDATION SYSTEM           │
├─────────────────────────────────────────────────┤
│                                                 │
│  Layer 1: TypeScript Compiler (tsc --noEmit)   │
│   ✓ Type safety                                 │
│   ✓ No 'any' types                             │
│   ✓ Return types specified                     │
│   ✓ Parameter types defined                    │
│                                                 │
│  Layer 2: ESLint (next lint)                    │
│   ✓ Code quality rules                         │
│   ✓ React hooks usage                          │
│   ✓ Import organization                        │
│   ✓ Unused variables                           │
│                                                 │
│  Layer 3: Prettier (prettier --check)           │
│   ✓ Code formatting                            │
│   ✓ Consistent style                           │
│   ✓ Proper indentation                         │
│   ✓ Quote style                                │
│                                                 │
│  Layer 4: Policy Validator (custom script)      │
│   ✓ Authentication checks                      │
│   ✓ Tier validation                            │
│   ✓ Error handling                             │
│   ✓ Security patterns                          │
│   ✓ Input validation                           │
│                                                 │
│  Layer 5: Jest Tests (npm test)                 │
│   ✓ Unit tests pass                            │
│   ✓ Integration tests pass                     │
│   ✓ No regressions                             │
│                                                 │
└─────────────────────────────────────────────────┘
```

### How to Run:

```bash
# After Aider generates code, run validation
npm run validate

# This runs all validation layers:
# ✓ TypeScript type checking
# ✓ ESLint code quality
# ✓ Prettier formatting
# ✓ Policy compliance
# ✓ Jest tests (if applicable)
```

---

## ✅ What Aider Validates

Aider's automated validation system performs comprehensive quality checks.

### 1️⃣ **TypeScript Type Safety**

**What it checks:**

- ✅ No `any` types used
- ✅ All function parameters typed
- ✅ All return types specified
- ✅ Imports from generated OpenAPI types
- ✅ Type consistency across files

**Example validation:**

```typescript
// ❌ REJECTED by validation
export async function createUser(data) {
  // No type!
  const user = await prisma.user.create({ data });
  return user; // No return type!
}

// ✅ APPROVED by validation
export async function createUser(data: CreateUserRequest): Promise<User> {
  const user: User = await prisma.user.create({ data });
  return user;
}
```

---

### 2️⃣ **Error Handling**

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

### 3️⃣ **Authentication & Authorization**

**What it checks:**

- ✅ Protected routes check session
- ✅ Session validated before use
- ✅ User ID ownership verified
- ✅ Proper 401/403 responses

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

### 4️⃣ **Tier Validation**

**What it checks:**

- ✅ Symbol restrictions enforced
- ✅ Timeframe restrictions checked
- ✅ Tier validation before operations
- ✅ Proper 403 responses for violations

**Example validation:**

```typescript
// ❌ REJECTED - Missing tier validation
export async function POST(req: NextRequest) {
  const alert = await prisma.alert.create({ data: req.body });
  return NextResponse.json(alert);
}

// ✅ APPROVED - Includes tier validation
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  const { symbol, timeframe } = await req.json();

  // Validate tier access
  const canAccess = await validateTierAccess(
    symbol,
    timeframe,
    session.user.tier
  );
  if (!canAccess) {
    return NextResponse.json(
      { error: 'Symbol/timeframe not allowed for your tier' },
      { status: 403 }
    );
  }

  const alert = await prisma.alert.create({ data: req.body });
  return NextResponse.json(alert);
}
```

---

### 5️⃣ **Input Validation**

**What it checks:**

- ✅ Zod schemas present for POST/PATCH/PUT
- ✅ Input validated before processing
- ✅ Proper 400 responses for invalid input
- ✅ Clear validation error messages

---

### 6️⃣ **Security Patterns**

**What it checks:**

- ✅ No hardcoded secrets
- ✅ No SQL injection risks
- ✅ No XSS vulnerabilities
- ✅ Environment variables used correctly

---

## ⚙️ Configuration & Setup

### Prerequisites:

1. ✅ **Phase 1 Complete:** All 9 policies created (00-08)
2. ✅ **Build Orders Created:** All 18 part build-order files exist
3. ✅ **Aider Installed:** `pip install aider-chat`
4. ✅ **API Key Configured:** MiniMax M2 API key set
5. ✅ **.aider.conf.yml Created:** Configuration file exists
6. ✅ **Validation Tools Configured:** TypeScript, ESLint, Prettier, Custom validator

---

### Step 1: Verify Validation Tools

**Check that all tools are configured:**

```bash
cd /home/user/trading-alerts-saas-v7

# Check TypeScript config
cat tsconfig.json

# Check ESLint config
cat .eslintrc.json

# Check Prettier config
cat .prettierrc

# Check custom validator script
cat scripts/validate-file.js

# Check package.json scripts
npm run | grep validate
```

**Expected output:**

```
validate
validate:types
validate:lint
validate:format
validate:policies
validate:file
```

---

### Step 2: Test Validation

**Run validation to ensure it works:**

```bash
# Run complete validation
npm run validate

# Or run individual validators
npm run validate:types     # TypeScript
npm run validate:lint      # ESLint
npm run validate:format    # Prettier
npm run validate:policies  # Custom policy checker
```

**Expected output:**

```
🔍 Checking TypeScript types...
✅ TypeScript validation passed

🔍 Checking code quality...
✅ ESLint validation passed

🔍 Checking code formatting...
✅ Prettier validation passed

🔍 Checking policy compliance...
✅ All policy checks passed!
```

---

### Step 3: Configure Aider

**Ensure Aider is configured to use policies:**

```bash
cat .aider.conf.yml
```

**Verify these sections exist:**

```yaml
# Model Configuration
model: openai/MiniMax-M2
editor-model: openai/MiniMax-M2
weak-model: openai/MiniMax-M2

# Policy files loaded
read:
  - docs/policies/00-tier-specifications.md
  - docs/policies/01-approval-policies.md
  - docs/policies/02-quality-standards.md
  - docs/policies/03-architecture-rules.md
  - docs/policies/04-escalation-triggers.md
  - docs/policies/05-coding-patterns.md
  - docs/policies/06-aider-instructions.md
  # ... all policy files
```

---

## 🔋 Token Budget Management

MiniMax M2 has a 204,800 token context window. Proper token budget management prevents system halts during large builds.

### Token Budget Breakdown:

```
Context Window:        204,800 tokens (MiniMax M2 limit)
Base Load (fixed):    -147,000 tokens
  ├─ Policies:          79,000 tokens
  ├─ Quality gates:      7,000 tokens
  ├─ OpenAPI spec:      22,000 tokens
  └─ Architecture:      39,000 tokens
                      ──────────
Available:              57,800 tokens

Dynamic Load:         -XX,XXX tokens (varies by part)
  ├─ Build order:        2-7k tokens
  ├─ Implementation:     4-19k tokens
  └─ Design docs:        0-5k tokens

Conversation/Code:     -20-30k tokens
  ├─ Chat history:       5-15k tokens
  ├─ Generated code:     5-10k tokens
  └─ Validation:         2-5k tokens
```

### Token Safety by Part:

| Part | Files | Docs Size | Total Usage | Margin | Status        |
| ---- | ----- | --------- | ----------- | ------ | ------------- |
| 1-16 | 5-25  | 6-13k     | 170-185k    | 20-35k | ✅ Safe       |
| 17A  | 32    | 14k       | ~186k       | 18.8k  | ⚠️ Tight      |
| 17B  | 35    | 12k       | ~184k       | 20.8k  | ⚠️ Tight      |
| 18   | 45    | 28k       | ~200k       | 4.8k   | 🚨 Very Tight |

---

### Part 17 Split Rationale:

**Original Part 17:**

- 67 files (all affiliate system)
- Documentation: 29k tokens (build-order 6k + implementation 18k + design 5k)
- **Risk:** 147k + 29k + 25k = 201k tokens (only 3.8k margin!)
- **Problem:** Extended discussions during build would cause overflow

**Solution: Split into 17A + 17B:**

**Part 17A (Affiliate Portal - Phases A-D):**

- 32 files (affiliate registration, auth, portal, Stripe integration)
- Documentation: 14k tokens
- Usage: 147k + 14k + 25k = 186k
- **Margin: 18.8k tokens** ✅ Safe for 5-8 escalations

**Part 17B (Admin & Automation - Phases E-H):**

- 35 files (admin portal, BI reports, cron jobs, components)
- Documentation: 12k tokens
- Usage: 147k + 12k + 25k = 184k
- **Margin: 20.8k tokens** ✅ Safe for 6-10 escalations

---

### When to Split Parts:

**Split if:**

- ✅ Part docs exceed 25k tokens
- ✅ Calculated margin < 10k tokens
- ✅ Part has >50 files
- ✅ Natural logical boundary exists (e.g., user portal vs admin portal)

**How to split:**

1. Identify natural phases or boundaries
2. Create two build-order files (part-Xa and part-Xb)
3. Update `.aider.conf.yml` with separate entries
4. Document token budgets for both parts
5. Build sequentially (A then B)

---

### Monitoring Token Usage:

**During build, watch for:**

```
⚠️ Warning signs of overflow:
- Conversation has >10 back-and-forth exchanges
- Multiple validation failures with verbose output
- Aider generating 5+ files before committing
- Complex refactoring across multiple files
```

**Prevention strategies:**

1. **Keep conversations concise** - Answer escalations briefly
2. **Commit frequently** - Don't batch multiple files
3. **Clear history** - Use `/clear` if conversation gets long
4. **Split sessions** - If needed, finish part in multiple Aider sessions

---

## 🔄 Validation Workflow

Here's exactly how Aider validates each file during Phase 3 building.

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
│ STEP 2: Automated Validation Runs                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Command: npm run validate                                   │
│                                                             │
│ Runs:                                                       │
│   ✓ TypeScript type checking (tsc --noEmit)               │
│   ✓ ESLint code quality (next lint)                        │
│   ✓ Prettier formatting (prettier --check)                 │
│   ✓ Policy compliance (scripts/validate-file.js)           │
│                                                             │
│ Checks:                                                     │
│   ✓ TypeScript types correct                               │
│   ✓ Error handling present                                 │
│   ✓ Authentication implemented                             │
│   ✓ Tier validation included                               │
│   ✓ Input validation present                               │
│   ✓ Security standards met                                 │
│   ✓ Code formatting correct                                │
│                                                             │
│ Time: 5-10 seconds                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          ↓
                 Validation Complete
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Aider Reviews Results & Decides                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Option A: ✅ ALL CHECKS PASSED (90% of files)             │
│   → Validation successful                                  │
│   → Aider commits file automatically                       │
│   → Move to next file                                      │
│                                                             │
│ Option B: 🔧 MINOR ISSUES FOUND (8% of files)             │
│   → Auto-fixable issues (formatting, missing types)       │
│   → Aider runs: npm run fix                                │
│   → Re-validates automatically                             │
│   → If fixed → APPROVE → Commit                            │
│                                                             │
│ Option C: 🚨 MAJOR ISSUES FOUND (2% of files)             │
│   → Critical issues (security, missing auth, etc.)        │
│   → Cannot auto-fix                                        │
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

## 🎯 Decision Criteria

Aider uses specific criteria from your policies to make decisions after validation.

### ✅ AUTO-APPROVE Criteria:

A file is **automatically approved** if:

1. **✅ TypeScript validation passes** (0 type errors)
2. **✅ ESLint validation passes** (0 errors, 0 warnings)
3. **✅ Prettier validation passes** (properly formatted)
4. **✅ Policy validation passes:**
   - 0 Critical issues
   - ≤2 High issues (all auto-fixable)
   - Authentication present (if needed)
   - Tier validation present (if needed)
   - Error handling comprehensive
   - Input validation present

---

### 🔧 AUTO-FIX Criteria:

Aider triggers **auto-fix** when:

1. **🔧 Formatting issues** (run `npm run format`)
2. **🔧 ESLint auto-fixable issues** (run `npm run lint:fix`)
3. **🔧 Minor type issues** (add missing return type)
4. **🔧 Import organization** (ESLint --fix)

**Auto-fix command:**

```bash
npm run fix  # Runs lint:fix + format
```

---

### 🚨 ESCALATE Criteria:

Aider **escalates to you** when:

1. **🚨 Critical issues found:**
   - Security vulnerabilities
   - Missing authentication
   - Missing tier validation
   - SQL injection risks
   - Hardcoded secrets

2. **🚨 High issues (>2):**
   - Multiple missing error handlers
   - Multiple type errors
   - Complex policy violations

3. **🚨 Architectural decisions needed:**
   - Ambiguous requirements
   - Missing specifications
   - Cross-part dependencies

---

## 🏆 Best Practices

### 1️⃣ **Run Validation After Every Change**

```bash
# After Aider generates code
npm run validate

# If issues found, review them
# Fix manually or let Aider auto-fix
npm run fix
```

---

### 2️⃣ **Trust the Automated Validation**

**Statistics:**

- ✅ 99% accurate in catching type errors
- ✅ 95% accurate in catching security issues
- ✅ 100% accurate in catching formatting issues

**Don't second-guess the validation** - if it passes, the code is good!

---

### 3️⃣ **Review Escalations Promptly**

When Aider escalates, review within 15 minutes:

```
🚨 ESCALATION: Missing Authentication

File: app/api/alerts/route.ts
Issue: Protected endpoint missing session check

Your decision needed:
1. Add authentication
2. Make endpoint public
3. Use different auth method

What should I do?
```

---

### 4️⃣ **Keep Policies Updated**

After each escalation, update policies:

```bash
# If new pattern emerges
vi docs/policies/05-coding-patterns.md

# Add new pattern or clarification
git add docs/policies/
git commit -m "docs: add pattern for X"
```

---

## 🔧 Troubleshooting

### Issue 1: Validation Fails with TypeScript Errors

**Symptoms:**

```
error TS2304: Cannot find name 'User'
error TS2345: Argument of type 'unknown' not assignable
```

**Solution:**

```bash
# Generate Prisma types
npm run db:generate

# Re-run validation
npm run validate:types
```

---

### Issue 2: ESLint Max Warnings Exceeded

**Symptoms:**

```
✖ Problems (0 errors, 5 warnings)
ESLint found too many warnings (maximum: 0)
```

**Solution:**

```bash
# Auto-fix warnings
npm run lint:fix

# Re-validate
npm run validate:lint
```

---

### Issue 3: Policy Validation Finds Critical Issues

**Symptoms:**

```
🔴 Critical Issues (2):
1. app/api/alerts/route.ts:1
   Missing authentication check
```

**Solution:**

Review the file and add required checks manually, or ask Aider to fix:

```
Aider prompt: "The validation found missing authentication in app/api/alerts/route.ts.
Please add getServerSession check with 401 response if not authenticated."
```

---

## 💡 Real-World Example

### Example: Building Alert Creation Endpoint

**File:** `app/api/alerts/route.ts`

```
[AIDER] Generating app/api/alerts/route.ts...
[AIDER] Reading policies and build order...
[AIDER] Generating code based on Pattern 1...
[AIDER] Code generated ✓

[AIDER] Running validation: npm run validate

🔍 Checking TypeScript types...
✅ 0 errors

🔍 Checking code quality...
⚠️ 1 warning: Missing JSDoc comment

🔍 Checking code formatting...
✅ All files formatted correctly

🔍 Checking policy compliance...
🟡 Medium Issues (1):
  - Missing JSDoc on POST handler

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 VALIDATION REPORT
Files Checked: 1
Total Issues: 1
  🔴 Critical: 0
  🟠 High: 0
  🟡 Medium: 1
  🟢 Low: 0

✅ DECISION: APPROVE (with auto-fix needed)
Next step: Run auto-fix
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[AIDER] Running auto-fix: npm run fix
[AIDER] Adding JSDoc comment...
[AIDER] Re-validating...

✅ All checks passed!

[AIDER] Committing: feat(alerts): add POST /api/alerts endpoint
[AIDER] ✓ Committed: a3f7c2d

[AIDER] Moving to next file...
```

---

## 📊 Success Metrics

### Target Metrics:

| Metric                | Target       | Indicates               |
| --------------------- | ------------ | ----------------------- |
| **Auto-Approve Rate** | 85-92%       | Validation working well |
| **Auto-Fix Rate**     | 6-12%        | Minor issues caught     |
| **Escalation Rate**   | 2-5%         | Major issues flagged    |
| **Validation Time**   | <10 sec/file | System is fast          |

---

## ✅ Summary

### Key Takeaways:

1. **Aider is autonomous** - Generates code AND runs validation automatically
2. **Multi-layer validation** - TypeScript, ESLint, Prettier, Policy checker
3. **Three outcomes** - Approve (90%), Auto-fix (8%), Escalate (2%)
4. **Fast and efficient** - 5-10 seconds per file validation
5. **Saves massive time** - 40+ hours of manual code review eliminated

### Success Formula:

```
Comprehensive Policies (Phase 1)
    +
Automated Validation Tools (Phase 2)
    +
Aider Autonomous Building (Phase 3)
    =
High-Quality Codebase Built Autonomously! 🎉
```

---

**🎉 Your automated validation system is now ready!**

When you start Phase 3, Aider will generate code and automatically validate it, ensuring consistent, high-quality code across your entire 170-file codebase.

**Trust the process. Let automation handle quality. Focus on the strategic decisions.** 🚀

---

**Last Updated:** 2025-11-24
**Version:** 2.0.0 (Automated Validation)
**Next Review:** After Phase 3 completion
