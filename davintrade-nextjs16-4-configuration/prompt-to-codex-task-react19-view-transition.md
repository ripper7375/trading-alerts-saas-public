# Task: Update React 19 Typings & Pilot React 19.3 View Transitions (Path A)

Davin has selected **Path A** from Antigravity's advisory recommendations: modernize React development typings and pilot React 19.3 `<ViewTransition>` on a clean React DOM component.

---

## 1. Context & Repository Guardrails

- **Reference Handoff:** `davintrade-nextjs16-4-configuration/2026-10-14-next164-opt-in-phase1-codex.md`
- **Current Runtime Versions:** `next@16.4.0`, `react@19.3.0`, `react-dom@19.3.0`.
- **Operating Rules:** Follow `AGENTS.md` and `.claude/rules/non-negotiables.md`.
- **Working Tree Preservation:** Preserve all existing untracked files and unstaged edits across the repository. Never run `git stash`, `git reset --hard`, or broad `git clean`.

---

## 2. Instructions & Implementation Steps

### Step 1: Modernize React Dev Typings

1. In `package.json`, update the devDependencies:
   ```json
   "@types/react": "^19.3.0",
   "@types/react-dom": "^19.3.0"
   ```
2. Run `pnpm install` to update the lockfile.
3. Run `node node_modules/typescript/bin/tsc --noEmit` to verify type resolution and confirm testing libraries have no blocking type conflicts.

### Step 2: Add Reduced-Motion Accessibility CSS Safeguard

In `app/globals.css`, append the standard accessibility safeguard for native view transitions:

```css
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}
```

### Step 3: Pilot React 19.3 `<ViewTransition>` on Settings Layout

1. In `app/settings/layout.tsx`, import `ViewTransition` from `'react'`:
   ```tsx
   import { ViewTransition } from 'react';
   ```
2. Wrap the `{children}` sub-page content container with `<ViewTransition>`:
   ```tsx
   <div className="flex-1">
     <ViewTransition>{children}</ViewTransition>
   </div>
   ```
   _(This gives a clean, native browser cross-fade lateral transition when navigating between Settings tabs such as Profile, Appearance, Account, and Security, without touching canvas charts or dynamic auth)._

---

## 3. Verification & Acceptance Checklist

Execute the full regression verification suite:

1. **TypeScript Check:**
   `node node_modules/typescript/bin/tsc --noEmit`
   _(Must exit with code 0)_

2. **Production Build:**
   `pnpm build`
   _(Must exit with code 0)_

3. **Regression Test Suite:**
   `pnpm test --ci --maxWorkers=2 --coverage=false`
   _(All 383 test suites / 11,732 tests must pass with 0 failures)_

4. **Dev Server Smoke Test:**
   `pnpm dev --hostname 127.0.0.1 --port 3104`
   _(Verify cold request to `/settings` or `/settings/profile` returns HTTP 200 with zero client/console errors)_

5. **Linting Check:**
   `pnpm lint`
   _(Must exit with code 0)_

---

## 4. Documentation & Handoff

1. Create a task record at `docs/codex/tasks/2026-10-14-react19-view-transition-pilot.md` following `docs/codex/templates/task.md`.
2. Deliver a handoff report documenting:
   - Changes applied to `package.json`, `pnpm-lock.yaml`, `app/globals.css`, and `app/settings/layout.tsx`.
   - Exit codes and evidence for type-checking, build, tests, and dev smoke check.
   - Leave changes uncommitted in the working tree as per repository protocol for Davin's review.
