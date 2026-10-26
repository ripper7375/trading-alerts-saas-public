---
paths:
  - 'package.json'
  - '**/package.json'
  - 'pnpm-lock.yaml'
  - '.claude/protocols/dependency-hygiene.md'
type: Protocol/Operational
authority: binding
tags: [dependencies, security, pnpm, hygiene, automated-protocol]
---

# Dependency Hygiene Protocol (Claude Code & Codex)

This protocol governs how Claude Code and Codex inspect, update, and patch dependencies safely without breaking lockfiles, builds, or runtime contracts.

## 1. Trigger & Scope Authorization

- **Davin's Trigger:** When Davin instructs:
  > _"Run dependency hygiene"_ or _"ตรวจเช็คและอัปเดต dependency ตาม Protocol"_
- **Branch Scope:** Dedicated security/dependency branch branched strictly from `origin/main` in an **isolated worktree**. Never execute dependency lifts directly in a dirty working tree or on `main`.

---

## 2. Execution Procedure

### Step 1: Isolated Worktree Setup

```bash
git fetch origin main
git worktree add -b claude/dep-hygiene-<YYYYMMDD> .claude/worktrees/dep-hygiene-<YYYYMMDD> origin/main
cd .claude/worktrees/dep-hygiene-<YYYYMMDD>
```

### Step 2: Audit & Candidate Discovery

1. **Production Audit Gate:**
   ```bash
   pnpm audit --prod --audit-level=high
   ```
2. **Outdated Check (Minor/Patch Only):**
   ```bash
   pnpm outdated
   ```
3. **Upgrade Constraints:**
   - **Allowed:** Patch and minor version lifts that preserve backwards compatibility.
   - **Forbidden without Davin's approval:** Major version bumps, Next.js major migrations, React core changes, Prisma engine upgrades, or any modification to `seed-code/**`.
   - **NestJS & Python Services:** Handled separately under their respective microservice subdirectories (`services/**`, `operation-service`, `money-service`, `railway-gateway`).

### Step 3: Safe Lift Strategy

1. **Lockfile-Only Lifts First:**
   Attempt lifting the transitive dependency inside `pnpm-lock.yaml` without changing top-level `package.json` constraints:
   ```bash
   pnpm update --depth 999 <package-name>
   ```
2. **Override Rules (When Parent Pins Exact Version):**
   - If and only if a transitive child dependency is pinned by a parent package (e.g. `newman`), add a minimal targeted override under `pnpm.overrides` in `package.json`.
   - Immediately document the override reason and unblocking criteria in [`.claude/rules/security-overrides.md`](../rules/security-overrides.md).
   - If an existing override is no longer required because the parent package moved, remove the stale override.

### Step 4: Verification Suite (Zero-Regression Gate)

All five checks must exit 0 before any commit:

1. **Lockfile Integrity:** `pnpm install --frozen-lockfile` (must exit 0 with 0 mismatch).
2. **TypeScript:** `npx tsc --noEmit` (must exit 0).
3. **Lint:** `npm run lint` (0 errors).
4. **Jest Test Suite:** `npm run test:ci` (must run full ~18,900+ tests across 560+ suites; 0 failures).
5. **Production Build:** `npm run build` (must compile all 180+ pages exit 0).

_If any check fails due to breaking changes in a lifted package, revert that package lift and record it in the PR notes._

---

## 3. Commit, Push & PR Protocol

1. **Commit Convention:**
   `fix(security): resolve production advisories and lift compatible dependencies`
2. **Push Branch:**
   `git push -u origin claude/dep-hygiene-<YYYYMMDD>`
3. **Open Pull Request:**
   Open PR against `main` via `gh pr create`:
   - Title: `fix(security): dependency hygiene & security updates (<YYYYMMDD>)`
   - Label: Add `security-override` if `pnpm.overrides` was touched.
   - Body must include:
     - Exact advisories cleared (CVE / GHSA IDs).
     - Still unresolved / accepted dev-only advisories.
     - Verification test numbers (Jest suites/tests count, build exit code).
4. **Worktree Cleanup:**
   ```bash
   cd <repo-root>
   git worktree remove .claude/worktrees/dep-hygiene-<YYYYMMDD>
   ```

---

## 4. Reporting to Davin

Present Davin with:

1. Pull Request link on GitHub.
2. Summary of packages updated (patch/minor).
3. Any accepted / postponed advisories (e.g. unpatched upstream or major-bump blocked).
4. Confirmation that all checks are 100% green and ready for Davin's review and merge.
