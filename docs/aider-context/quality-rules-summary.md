# Quality Rules Summary - Quick Reference for Code Generation

**Purpose:** Fast-scan reference for quality gate compliance during code generation
**Size:** <5KB for minimal context window impact
**Usage:** Load this file into Aider context for every code generation session

---

## 🚨 CRITICAL RULES (Violations = CI/CD Failure)

### ESLint - MANDATORY Rules

| Rule                                                 | Requirement                            | Example                                                            |
| ---------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------ |
| **@typescript-eslint/no-explicit-any**               | ERROR - Never use `any`                | ❌ `const data: any` → ✅ `const data: User`                       |
| **@typescript-eslint/explicit-function-return-type** | WARN - All functions need return types | ❌ `function getData()` → ✅ `function getData(): Promise<User[]>` |
| **@typescript-eslint/no-unused-vars**                | ERROR - No unused variables            | ❌ `const unused = 5` → ✅ Delete or prefix with `_unused`         |
| **no-console**                                       | WARN - Only console.warn/error allowed | ❌ `console.log('debug')` → ✅ Remove or use logger                |
| **prefer-const**                                     | ERROR - Use const when not reassigned  | ❌ `let x = 5` (never changes) → ✅ `const x = 5`                  |
| **eqeqeq**                                           | ERROR - Always use ===                 | ❌ `if (x == 5)` → ✅ `if (x === 5)`                               |
| **react-hooks/rules-of-hooks**                       | ERROR - Follow React hooks rules       | ❌ Hook inside condition → ✅ Hook at top level                    |
| **import/order**                                     | WARN - Organize imports                | ❌ Mixed order → ✅ builtin, external, internal groups             |

### Jest - MANDATORY Requirements

| Requirement              | Rule                                                       | Validation                                          |
| ------------------------ | ---------------------------------------------------------- | --------------------------------------------------- |
| **Unique Package Names** | Each package.json must have unique name                    | ❌ "my-v0-project" → ✅ "alert-card-component"      |
| **Test Files**           | Follow naming pattern                                      | ✅ `Component.test.tsx` in `__tests__/` folder      |
| **Coverage Thresholds**  | branches: 50%, functions: 60%, lines: 45%, statements: 45% | Write testable, modular code                        |
| **No Haste Collisions**  | Avoid duplicate module names                               | Each component gets unique directory + package name |

### TypeScript - STRICT MODE Rules

| Setting                      | Requirement               | Impact                                          |
| ---------------------------- | ------------------------- | ----------------------------------------------- |
| **strict: true**             | All strict checks enabled | No implicit any, null checks enforced           |
| **noImplicitAny**            | Must declare all types    | ❌ `function(x)` → ✅ `function(x: string)`     |
| **strictNullChecks**         | Handle null/undefined     | ❌ `user.name` → ✅ `user?.name ?? 'Unknown'`   |
| **noUnusedLocals**           | No unused variables       | Clean up all unused declarations                |
| **noUnusedParameters**       | No unused function params | Prefix with `_` if intentionally unused: `_req` |
| **noImplicitReturns**        | All code paths return     | Every branch must return or throw               |
| **noUncheckedIndexedAccess** | Check array/object access | ❌ `arr[0]` → ✅ `arr[0] ?? defaultValue`       |

---

## 📋 PRE-GENERATION CHECKLIST

Before generating ANY file, verify these requirements:

### ✅ TypeScript Types

- [ ] All function parameters have explicit types
- [ ] All functions have explicit return types (including `Promise<T>`)
- [ ] No `any` types used (use `unknown` with type guards if needed)
- [ ] All interfaces imported from proper sources (@prisma/client, openapi types)
- [ ] Nullable types handled with optional chaining (`?.`) or nullish coalescing (`??`)

### ✅ ESLint Compliance

- [ ] No `console.log()` statements (use console.error for errors only)
- [ ] Use `const` instead of `let` when not reassigning
- [ ] Use `===` instead of `==`
- [ ] Imports organized: builtin → external → internal → relative
- [ ] No unused variables or imports

### ✅ Error Handling

- [ ] Try-catch blocks present in async functions
- [ ] Specific error types caught (Prisma errors, validation errors)
- [ ] User-friendly error messages returned
- [ ] Proper HTTP status codes (400, 401, 403, 404, 409, 500)
- [ ] Errors logged with console.error

### ✅ Authentication & Authorization

- [ ] Protected routes check session with `getServerSession()`
- [ ] Return 401 if no session
- [ ] Verify resource ownership (userId matches)
- [ ] Return 403 if forbidden

### ✅ Tier Validation

- [ ] Check tier access for symbols/timeframes
- [ ] Use `validateTierAccess()` helper
- [ ] Return 403 with clear message if tier insufficient

### ✅ Input Validation

- [ ] Zod schemas defined for POST/PATCH/PUT
- [ ] Input validated before database operations
- [ ] Return 400 with validation errors

---

## 🔧 COMMON VIOLATIONS & QUICK FIXES

### Violation 1: Missing Return Type

```typescript
// ❌ WRONG
export async function getUser(id: string) {
  return await prisma.user.findUnique({ where: { id } });
}

// ✅ CORRECT
export async function getUser(id: string): Promise<User | null> {
  return await prisma.user.findUnique({ where: { id } });
}
```

### Violation 2: Using `any` Type

```typescript
// ❌ WRONG
function processData(data: any) {
  return data.map((item: any) => item.value);
}

// ✅ CORRECT
interface DataItem {
  value: string;
}

function processData(data: DataItem[]): string[] {
  return data.map((item) => item.value);
}
```

### Violation 3: console.log in Code

```typescript
// ❌ WRONG
console.log('User created:', user);

// ✅ CORRECT - Remove or use proper logging
// For errors only:
console.error('User creation failed:', error);
```

### Violation 4: Missing Error Handling

```typescript
// ❌ WRONG
export async function POST(req: NextRequest) {
  const user = await prisma.user.create({ data: await req.json() });
  return NextResponse.json(user);
}

// ✅ CORRECT
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const data = await req.json();
    const user = await prisma.user.create({ data });
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

### Violation 5: Missing Authentication

```typescript
// ❌ WRONG
export async function DELETE(req: NextRequest) {
  await prisma.alert.delete({ where: { id: req.params.id } });
  return NextResponse.json({ success: true });
}

// ✅ CORRECT
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const alert = await prisma.alert.findUnique({ where: { id: req.params.id } });
  if (!alert || alert.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.alert.delete({ where: { id: req.params.id } });
  return NextResponse.json({ success: true });
}
```

### Violation 6: Missing Tier Validation

```typescript
// ❌ WRONG
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { symbol, timeframe } = await req.json();
  const alert = await prisma.alert.create({ data: { symbol, timeframe } });
  return NextResponse.json(alert);
}

// ✅ CORRECT
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession();
  const { symbol, timeframe } = await req.json();

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

  const alert = await prisma.alert.create({ data: { symbol, timeframe } });
  return NextResponse.json(alert, { status: 201 });
}
```

---

## 🎯 VALIDATION COMMANDS

Run these commands after generating code:

```bash
# Complete validation (runs all checks)
npm run validate

# Individual validators
npm run validate:types     # TypeScript type checking
npm run validate:lint      # ESLint code quality
npm run validate:format    # Prettier formatting
npm run validate:policies  # Custom policy checks
npm test                   # Jest tests

# Auto-fix (for minor issues)
npm run fix                # Runs lint:fix + format
npm run lint:fix           # Auto-fix ESLint issues
npm run format             # Auto-fix Prettier issues
```

---

## 📊 SUCCESS CRITERIA

Code is **APPROVED** when:

- ✅ TypeScript: 0 type errors
- ✅ ESLint: 0 errors, 0 warnings
- ✅ Prettier: All files formatted
- ✅ Policy validation: 0 critical issues
- ✅ Tests: All passing (if applicable)

Code **NEEDS AUTO-FIX** when:

- 🔧 Minor formatting issues
- 🔧 Auto-fixable ESLint warnings
- 🔧 Import organization

Code is **ESCALATED** when:

- 🚨 Critical security issues
- 🚨 Missing authentication/authorization
- 🚨 Multiple type errors
- 🚨 Architectural ambiguity

---

## 💡 QUICK TIPS

1. **Always type everything explicitly** - Let TypeScript catch errors early
2. **Think about errors first** - What can go wrong? Handle it.
3. **Validate at boundaries** - User input, external APIs, database queries
4. **Use type guards** - Instead of `any`, use `unknown` + type narrowing
5. **Leverage Prisma types** - Import from `@prisma/client`, don't redefine
6. **Test as you go** - Write test files alongside components
7. **Clean as you build** - No unused imports, variables, or console.logs
8. **Secure by default** - Authentication, authorization, input validation always

---

**File Size:** ~4.8KB
**Last Updated:** 2025-11-26
**Maintained By:** Trading Alerts SaaS V7 Project
