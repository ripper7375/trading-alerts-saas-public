MISSION: Implement Shift-Left Testing Infrastructure for Trading Alerts SaaS V7

CONTEXT:
You have access to the complete repository including:

- New document: `docs/principles/shift-left-testing.md` (explains the "why")
- Existing: `.github/workflows/README.md` (comprehensive Two-Track CI/CD system)
- Existing: `.github/workflows/tests.yml` (BLOCKING deployment gate with 102 tests, 92% coverage)

IMPORTANT: Your GitHub Actions infrastructure is already excellent with a Two-Track CI/CD system. The gap is LOCAL validation before code reaches CI/CD. This implementation adds LOCAL pre-commit/pre-push hooks to catch issues in 5-10 seconds on your machine, BEFORE they consume GitHub Actions minutes.

OBJECTIVE:
Implement shift-left testing to complement existing CI/CD:
A. Policy Updates (Aider guidance)
B. Aider Context Enhancement (quality rules awareness)
C. Local Automation Layer (pre-commit/pre-push hooks) - NEW
D. Critical Success Factors (checklists, monitoring)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPLEMENTATION PLAN:

═══════════════════════════════════════════════════════════════════════
PART A: POLICY UPDATES
═══════════════════════════════════════════════════════════════════════

[Keep Part A exactly as provided in the original prompt - no changes needed]

═══════════════════════════════════════════════════════════════════════
PART B: AIDER CONTEXT ENHANCEMENT
═══════════════════════════════════════════════════════════════════════

[Keep Part B exactly as provided in the original prompt - no changes needed]

═══════════════════════════════════════════════════════════════════════
PART C: LOCAL AUTOMATION LAYER (COMPLEMENTS EXISTING CI/CD)
═══════════════════════════════════════════════════════════════════════

CONTEXT: You already have comprehensive GitHub Actions:

- Track 1 (Development CI): 5 non-blocking workflows providing feedback
- Track 2 (Deployment Gate): tests.yml BLOCKS deployments on failure

GAP: No local validation before code reaches GitHub Actions.

SOLUTION: Add local pre-commit and pre-push hooks to catch issues BEFORE CI/CD.

─────────────────────────────────────────────────────────────────────

C1. INSTALL: Husky and lint-staged

Add to package.json scripts:

```json
"scripts": {
  "prepare": "husky install",
  "lint-staged": "lint-staged"
}
```

Add to package.json:

```json
"lint-staged": {
  "*.{ts,tsx}": [
    "eslint --fix",
    "prettier --write"
  ],
  "*.{json,md}": [
    "prettier --write"
  ]
}
```

Add to devDependencies:

```json
"husky": "^8.0.3",
"lint-staged": "^15.2.0"
```

─────────────────────────────────────────────────────────────────────

C2. CREATE: .husky/pre-commit

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🔍 Running pre-commit checks..."
echo "   (Catching issues BEFORE they reach GitHub Actions)"
npm run lint-staged

echo "✅ Pre-commit checks passed!"
echo "   Code is ready for Track 1 CI (Development CI)"
```

Make executable: chmod +x .husky/pre-commit

─────────────────────────────────────────────────────────────────────

C3. CREATE: .husky/pre-push

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🔍 Running pre-push checks..."
echo "   (Final validation before GitHub Actions)"

echo "📝 TypeScript type checking..."
npm run type-check || exit 1

echo "🧪 Running quick tests..."
npm run test:quick || exit 1

echo "✅ Pre-push checks passed!"
echo "   Ready for Track 1 CI → Track 2 Deployment Gate"
```

Make executable: chmod +x .husky/pre-push

─────────────────────────────────────────────────────────────────────

C4. UPDATE: package.json scripts

Add/update these scripts:

```json
"scripts": {
  "type-check": "tsc --noEmit",
  "test:quick": "jest --bail --findRelatedTests --passWithNoTests",
  "lint": "eslint . --ext .ts,.tsx",
  "lint:fix": "eslint . --ext .ts,.tsx --fix"
}
```

─────────────────────────────────────────────────────────────────────

C5. UPDATE: .github/workflows/README.md

Add this section AFTER the "Two-Track CI/CD System" section:

```markdown
## 🔧 Local Validation Layer (Shift-Left Testing)

### Pre-GitHub Actions Validation

**NEW:** Local pre-commit and pre-push hooks catch issues BEFORE they reach CI/CD.

**Three-Layer Protection:**
```

Layer 1: Aider Generation (Policy-Driven)
↓ (90% of issues prevented)
Layer 2: Local Hooks (Pre-Commit/Pre-Push)
↓ (9% of issues caught, 5-10 seconds)
Layer 3: GitHub Actions (Existing Two-Track CI/CD)
↓ (1% of issues caught, 2-5 minutes)
├─ Track 1: Development CI (non-blocking feedback)
└─ Track 2: Deployment Gate (BLOCKS bad deployments)

Pre-Commit Hook (runs on every commit):

✅ ESLint with auto-fix
✅ Prettier formatting
⚡ Takes: 5-10 seconds
💰 Cost: Free (local execution)

Pre-Push Hook (runs before push to GitHub):

✅ TypeScript type checking
✅ Quick test run
⚡ Takes: 30-60 seconds
💰 Cost: Free (local execution)

Benefits:

⚡ 95% faster feedback (seconds vs minutes)
💰 Reduced GitHub Actions cost (fewer failed runs)
🎯 Catch 99% of issues locally (before CI/CD)
🚀 Faster iteration (no waiting for CI/CD)

Integration with Existing CI/CD:

Local hooks are FIRST line of defense
Track 1 (Development CI) provides SECOND layer (comprehensive checks)
Track 2 (Deployment Gate) provides FINAL layer (production protection)

How to Bypass (when needed):

# Skip pre-commit (use sparingly)

git commit --no-verify -m "message"

# Skip pre-push (use sparingly)

git push --no-verify

```

**Installation:**
Hooks are automatically installed when you run `npm install` (via `prepare` script).
```

═══════════════════════════════════════════════════════════════════════
PART D: CRITICAL SUCCESS FACTORS
═══════════════════════════════════════════════════════════════════════

[Keep Part D exactly as provided in the original prompt - no changes needed]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VALIDATION STEPS:

After completing all implementations, verify:

1. **Policy Completeness**
   - [ ] All 3 policy files updated/created
   - [ ] Cross-references between policies work
   - [ ] Examples are clear and actionable

2. **Automation Functionality**
   - [ ] Run: npm run prepare (initializes Husky)
   - [ ] Test pre-commit: Make a test change with linting error
   - [ ] Test pre-push: Run npm run type-check && npm run test:quick
   - [ ] Verify hooks execute and catch issues

3. **Documentation Accessibility**
   - [ ] All new docs in correct directories
   - [ ] .github/workflows/README.md updated with local validation section
   - [ ] Checklists are usable by humans and AI

4. **Integration with Existing CI/CD**
   - [ ] Local hooks DO NOT conflict with GitHub Actions
   - [ ] README explains three-layer protection model
   - [ ] Track 1 and Track 2 continue working as designed

5. **Aider Context Readiness**
   - [ ] quality-rules-summary.md is concise (<5KB)
   - [ ] Comments in config files are clear
   - [ ] All required files are in expected locations

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMMIT STRATEGY:

Create 4 separate commits for atomic changes:

1. Commit: "feat(policies): add shift-left testing policies"
   - All Part A policy files
   - docs/principles/shift-left-testing.md

2. Commit: "feat(aider): enhance context with quality rules"
   - All Part B context enhancement files
   - Comments in config files

3. Commit: "feat(automation): add local validation hooks (pre-commit/pre-push)"
   - All Part C automation files (Husky setup)
   - package.json updates
   - .github/workflows/README.md update (local validation section)

4. Commit: "feat(monitoring): add KPI tracking and checklists"
   - All Part D success factor files
   - PR template
   - Monitoring dashboard

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXPECTED OUTCOMES:

After implementation:
✅ Aider has clear quality requirements in policies
✅ Aider can read ESLint/Jest config during generation
✅ Local hooks catch issues in 5-10 seconds (BEFORE GitHub Actions)
✅ Three-layer protection: Generation → Local → CI/CD
✅ Track 1 (Development CI) continues providing comprehensive feedback
✅ Track 2 (Deployment Gate) continues BLOCKING bad deployments
✅ 99% of issues caught before reaching GitHub Actions
✅ Faster iteration, lower GitHub Actions costs
✅ Checklists guide Phase 3 completion
✅ Metrics track improvement over time

CRITICAL: This implementation COMPLEMENTS your existing Two-Track CI/CD system.
It does NOT replace or modify your GitHub Actions workflows. It adds LOCAL
validation as Layer 2 between Aider (Layer 1) and GitHub Actions (Layer 3).

Execute all parts systematically and validate each step.
