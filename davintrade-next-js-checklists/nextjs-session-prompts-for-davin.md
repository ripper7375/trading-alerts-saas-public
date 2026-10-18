# Ready-to-Paste Session Prompts for Davin (Sessions 1 to 8)

- **Document Role:** Operator Playbook for Davin (Copy & paste one prompt per new Claude Code session)
- **Target Implementation Plan:** [`davintrade-next-js-checklists/nextjs-remediation-handoff-for-claude-code.md`](./nextjs-remediation-handoff-for-claude-code.md)
- **Cross-Session Continuity Log:** [`davintrade-next-js-checklists/nextjs-remediation-session-log.md`](./nextjs-remediation-session-log.md)

---

## How Cross-Session Continuity Works

1. **Before Session `N` finishes:** Claude Code writes its completed units (`[x]`), modified files, verification exit codes, and handoff notes into [`davintrade-next-js-checklists/nextjs-remediation-session-log.md`](./nextjs-remediation-session-log.md).
2. **When Session `N+1` starts:** The prompt you paste instructs the new Claude Code session to read `nextjs-remediation-session-log.md` first (specifically the `Session N Handoff Report`) together with only the relevant section of `nextjs-remediation-handoff-for-claude-code.md`.
3. **No Prompt Confusion:** Because these prompts live in this separate file, Claude Code never sees prompts for other sessions when reading `nextjs-remediation-handoff-for-claude-code.md`.

---

## Session 1 Prompt — Phase 1, Part 1A (P0 Hotfixes: `P0-a`, `P0-b`, `P0-c`, `P0-d`)

```text
Read the following sections in order:
1. `davintrade-next-js-checklists/nextjs-remediation-session-log.md` (Section 1 & Session 1 Handoff Report template)
2. `davintrade-next-js-checklists/nextjs-remediation-handoff-for-claude-code.md` (Sections 1, 2, 3, and 7)
3. `davintrade-next-js-checklists/nextjs-production-remediation-master-plan.md` (Section 3)

Execute ONLY **Phase 1 — Part 1A (Session 1)**: Units `P0-a`, `P0-b`, `P0-c`, and `P0-d` in order.
I explicitly authorize the `⚠ NEEDS EXPLICIT SIGN-OFF` gates for:
- `P0-a`: Deleting `app/api/test/seed/route.ts` and removing its entry in `__tests__/lib/systemconfig-figures-guard.test.ts:124`.
- `P0-c`: Updating the `redirect` callback in `lib/auth/auth-options.ts:643-666` and adding unit tests.
- `P0-d`: Updating `validateOrigin(request?: Request)` in `lib/csrf.ts` and adding `__tests__/lib/csrf.test.ts`.

Verify each unit with `npx tsc --noEmit`, `npx eslint <touched-files> --max-warnings 0`, and targeted `npx jest` before moving to the next unit.
When all 4 units pass verification, update `davintrade-next-js-checklists/nextjs-remediation-session-log.md` (mark `P0-a`..`P0-d` as `[x]` and complete the **Session 1 Handoff Report** for Session 2). Do not commit unless I ask.
```

---

## Session 2 Prompt — Phase 2, Part 2A (`T1-a`, `T1-a-writes`, `T1-b`, `T1-d`)

```text
Read the following sections in order:
1. `davintrade-next-js-checklists/nextjs-remediation-session-log.md` (verify Session 1 is `[x]` and read the **Session 1 Handoff Report**)
2. `davintrade-next-js-checklists/nextjs-remediation-handoff-for-claude-code.md` (Sections 2, 4 — Part 2A, and 7)
3. `davintrade-next-js-checklists/nextjs-production-remediation-master-plan.md` (Sections 4.1, 4.2, and 4.4)

Execute ONLY **Phase 2 — Part 2A (Session 2)**: Units `T1-a`, `T1-a-writes`, `T1-b`, and `T1-d` in order.
I explicitly authorize the `⚠ NEEDS EXPLICIT SIGN-OFF` gates for:
- `T1-a-writes`: Adding 15,000ms write timeouts (no automatic retry) in `lib/operation-service/client.ts`, `lib/money-service/client.ts`, `lib/dlocal/dlocal-payment.service.ts:109`, and configuring `timeout: 15_000`, `maxNetworkRetries: 1`, and 1-hour `proPriceCache` TTL in `lib/stripe/stripe.ts`.
- `T1-b`: Amending ADR-099 D23 in `lib/reply/gateway/openrouter.ts` (no primary retry on `TIMEOUT`), `docs/adr/099-prompt-and-reply-as-built-in-step-7.md`, and `__tests__/lib/reply/gateway/{fallback,openrouter}.test.ts`.

Verify each unit with `npx tsc --noEmit`, `npx eslint <touched-files> --max-warnings 0`, and targeted `npx jest` before moving to the next unit.
When all 4 units pass verification, update `davintrade-next-js-checklists/nextjs-remediation-session-log.md` (mark `T1-a`, `T1-a-writes`, `T1-b`, `T1-d` as `[x]` and complete the **Session 2 Handoff Report** for Session 3). Do not commit unless I ask.
```

---

## Session 3 Prompt — Phase 2, Part 2B (`T1-c`: `import 'server-only'` & Guard Tests)

```text
Read the following sections in order:
1. `davintrade-next-js-checklists/nextjs-remediation-session-log.md` (verify Sessions 1–2 are `[x]` and read the **Session 2 Handoff Report**)
2. `davintrade-next-js-checklists/nextjs-remediation-handoff-for-claude-code.md` (Sections 2, 4 — Part 2B, and 7)
3. `davintrade-next-js-checklists/nextjs-production-remediation-master-plan.md` (Section 4.3)

Execute ONLY **Phase 2 — Part 2B (Session 3)**: Unit `T1-c` (`import 'server-only'` across server modules + Stack D boundary/exactness guard test updates).
Remember:
1. Do NOT add `server-only` to `package.json` (Next.js 16 and `next/jest` resolve it natively).
2. Update `__tests__/lib/engine4/exactness-guard.test.ts`, `__tests__/lib/intake/boundaries.test.ts`, and `__tests__/lib/reply/boundaries.test.ts` FIRST.
3. Never add `import 'server-only'` to `lib/dlocal/constants.ts` or pure Stack D modules, and verify via `grep` that no `'use client'` file imports a target module before adding `import 'server-only'`.

Verify with `npx tsc --noEmit`, `npx eslint <touched-files> --max-warnings 0`, `npx jest __tests__/lib/engine4 __tests__/lib/intake __tests__/lib/reply`, and `npm run build`.
When verification passes, update `davintrade-next-js-checklists/nextjs-remediation-session-log.md` (mark `T1-c` as `[x]` and complete the **Session 3 Handoff Report** for Session 4). Do not commit unless I ask.
```

---

## Session 4 Prompt — Phase 2, Part 2C (`T1-e`, `T1-f`: Admin RSC Guards, Disbursement Health & Central CSRF)

```text
Read the following sections in order:
1. `davintrade-next-js-checklists/nextjs-remediation-session-log.md` (verify Sessions 1–3 are `[x]` and read the **Session 1 & Session 3 Handoff Reports**)
2. `davintrade-next-js-checklists/nextjs-remediation-handoff-for-claude-code.md` (Sections 2, 4 — Part 2C, and 7)
3. `davintrade-next-js-checklists/nextjs-production-remediation-master-plan.md` (Sections 4.5 and 4.6)

Execute ONLY **Phase 2 — Part 2C (Session 4)**: Units `T1-e` and `T1-f` in order.
I explicitly authorize the `⚠ NEEDS EXPLICIT SIGN-OFF` gates for:
- `T1-e`: Adding cached `requireAdminPage()` across all 8 `app/admin/**` Server Component pages, returning bare `{ status: 'healthy' | 'unhealthy' }` to unauthenticated callers in `app/api/disbursement/health/route.ts`, and adding `/terminal` and `/free` segment-boundary matching in `middleware.ts`.
- `T1-f`: Enforcing central `validateOrigin(request)` in `middleware.ts` (outside the fail-open `try` block) on non-GET/HEAD/OPTIONS `/api/**` routes with machine-caller exemptions, and updating `__tests__/middleware.test.ts`.

Verify each unit with `npx tsc --noEmit`, `npx eslint <touched-files> --max-warnings 0`, and targeted `npx jest`.
When both units pass verification, update `davintrade-next-js-checklists/nextjs-remediation-session-log.md` (mark `T1-e` and `T1-f` as `[x]` and complete the **Session 4 Handoff Report** for Session 5). Do not commit unless I ask.
```

---

## Session 5 Prompt — Phase 3, Part 3A (`T2-a`, `T2-b`: `React.cache()`, `after()` & Waterfall Elimination)

```text
Read the following sections in order:
1. `davintrade-next-js-checklists/nextjs-remediation-session-log.md` (verify Sessions 1–4 are `[x]` and read the **Session 4 Handoff Report**)
2. `davintrade-next-js-checklists/nextjs-remediation-handoff-for-claude-code.md` (Sections 2, 5 — Part 3A, and 7)
3. `davintrade-next-js-checklists/nextjs-production-remediation-master-plan.md` (Sections 5.1 and 5.2)

Execute ONLY **Phase 3 — Part 3A (Session 5)**: Units `T2-a` and `T2-b` in order.
Pay strict attention to the Stack D contract-ordering rules in `T2-b` (`lib/engine4/read/cycle.ts`, `lib/intake/read/snapshot.ts`, `lib/reply/orchestrator.ts`, `lib/reply/server/state-api.ts`) so that `problems` array ordering and `NO_PRIOR_HISTORY` short-circuit behavior remain 100% preserved.

Verify each unit with `npx tsc --noEmit`, `npx eslint <touched-files> --max-warnings 0`, and targeted `npx jest`.
When both units pass verification, update `davintrade-next-js-checklists/nextjs-remediation-session-log.md` (mark `T2-a` and `T2-b` as `[x]` and complete the **Session 5 Handoff Report** for Session 6). Do not commit unless I ask.
```

---

## Session 6 Prompt — Phase 3, Part 3B (`T2-c`, `T2-d`, `T2-e`: Prisma `select`, Error Sanitization & Security Headers)

```text
Read the following sections in order:
1. `davintrade-next-js-checklists/nextjs-remediation-session-log.md` (verify Sessions 1–5 are `[x]` and read the **Session 5 Handoff Report**)
2. `davintrade-next-js-checklists/nextjs-remediation-handoff-for-claude-code.md` (Sections 2, 5 — Part 3B, and 7)
3. `davintrade-next-js-checklists/nextjs-production-remediation-master-plan.md` (Sections 5.3, 5.4, and 5.5)

Execute ONLY **Phase 3 — Part 3B (Session 6)**: Units `T2-c`, `T2-d`, and `T2-e` in order.
I explicitly authorize the `⚠ NEEDS EXPLICIT SIGN-OFF` gates for:
- `T2-d`: Sanitizing raw `error.message` in `app/error.tsx` and the 5 remaining API routes (`dlocal/create`, `disbursement/pay`, `disbursement/batches/[batchId]/execute`, `webhooks/stripe`, `admin/active-indicator`), plus logging `error.digest` in `app/global-error.tsx`.
- `T2-e`: Updating security headers and production CSP in `next.config.js` (`X-XSS-Protection` removal, 2-year HSTS with `preload`, removing `'unsafe-eval'` and `localhost:3001` in production) and setting `contentDisposition: 'attachment'` in `lib/marketing-resources/storage.ts`.

Verify each unit with `npx tsc --noEmit`, `npx eslint <touched-files> --max-warnings 0`, targeted `npx jest`, and `npm run build`.
When all 3 units pass verification, update `davintrade-next-js-checklists/nextjs-remediation-session-log.md` (mark `T2-c`, `T2-d`, `T2-e` as `[x]` and complete the **Session 6 Handoff Report** for Session 7). Do not commit unless I ask.
```

---

## Session 7 Prompt — Phase 4, Part 4A (`T3-a`, `T3-b`: Dynamic Locale Chunks, `next/dynamic` Charts & RSC Marketing Pages)

```text
Read the following sections in order:
1. `davintrade-next-js-checklists/nextjs-remediation-session-log.md` (verify Sessions 1–6 are `[x]` and read the **Session 6 Handoff Report**)
2. `davintrade-next-js-checklists/nextjs-remediation-handoff-for-claude-code.md` (Sections 2, 6 — Part 4A, and 7)
3. `davintrade-next-js-checklists/nextjs-production-remediation-master-plan.md` (Sections 6.1 and 6.2)

Execute ONLY **Phase 4 — Part 4A (Session 7)**: Units `T3-a` and `T3-b` in order:
- `T3-a`: Split the 1.4 MB static locale dictionary imports in `lib/context/locale-context.tsx` into per-language dynamic chunks (`en-US` as overlay on `en-GB`) and wrap heavy chart/modal components in `next/dynamic(..., { ssr: false })` with fixed-height skeletons.
- `T3-b`: Convert the 8 static `'use client'` marketing pages to Server Components, narrow `<Suspense>` on `app/(marketing)/page.tsx` to `<LandingPricing />`, and extract interactive client leaves on the 6 remaining marketing pages.

Verify with `npx tsc --noEmit`, `npx eslint <touched-files> --max-warnings 0`, `npx jest`, and `npm run build`.
When both units pass verification, update `davintrade-next-js-checklists/nextjs-remediation-session-log.md` (mark `T3-a` and `T3-b` as `[x]` and complete the **Session 7 Handoff Report** for Session 8). Do not commit unless I ask.
```

---

## Session 8 Prompt — Phase 4, Part 4B (`T3-c`, `T3-d`, `T3-e`: Polling Race Fixes, Segment Boundaries & CI Gates)

```text
Read the following sections in order:
1. `davintrade-next-js-checklists/nextjs-remediation-session-log.md` (verify Sessions 1–7 are `[x]` and read the **Session 7 Handoff Report**)
2. `davintrade-next-js-checklists/nextjs-remediation-handoff-for-claude-code.md` (Sections 2, 6 — Part 4B, and 7)
3. `davintrade-next-js-checklists/nextjs-production-remediation-master-plan.md` (Sections 6.3, 6.4, and 6.5)

Execute ONLY **Phase 4 — Part 4B (Session 8)**: Units `T3-c`, `T3-d`, and `T3-e` in order:
- `T3-c`: Fix the abort race in `components/currency-index-pro/hooks/use-currency-index-chart.ts:87-90` and add `document.visibilityState === 'hidden'` pause + overlap guards across the polling hooks.
- `T3-d`: Add segment-level `error.tsx` and missing `loading.tsx` files across `app/admin/dashboards/`, `app/affiliate/dashboard/`, `app/terminal/`, `app/free/`, and `app/pro/currency-index/`.
- `T3-e`: Update `.github/workflows/dependencies-security.yml` (coordinating with `.claude/rules/security-overrides.md`), expand `.github/workflows/security-checks.yml` regexes, and create `.github/dependabot.yml`.

Run full verification (`npx tsc --noEmit`, `npx eslint`, `npm test`, `npm run build`), then update `davintrade-next-js-checklists/nextjs-remediation-session-log.md` (mark `T3-c`, `T3-d`, `T3-e` as `[x]`, set `Current Overall Status: COMPLETED (8 / 8 Sessions · 21 / 21 Units Completed)`, and complete the **Session 8 Handoff Report**). Do not commit unless I ask.
```
