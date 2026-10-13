---
type: Concept/Handoff
status: completed
updated_at: 2026-10-13
task_id: 2026-10-13-checkout-provider-choice
---

# Handoff: checkout provider choice

Date: 2026-10-13, Asia/Bangkok
From / to: Codex root / Davin and the shared-state owner
Task / authorization: [task contract](../codex/tasks/2026-10-13-checkout-provider-choice.md), Davin's direct request
Phase/session: unchanged; ad-hoc
Source: D:/SaaS Project/trading-alerts-saas-public, main, base/HEAD f7d7368650179a0a4958133c451cc3f1ba6f2702
Status: implemented, independently reviewed and locally verified at this checkpoint;
publication now authorized in the [publication task](../codex/tasks/2026-10-13-checkout-provider-choice-publish.md).

## Needs from Davin

None. Davin subsequently authorized commit and push; see the
[publication handoff](2026-10-13-checkout-provider-choice-codex-publish.md).
Real hosted payment processing remains a separate owner smoke test.

## Changed and verified

- `/checkout` opens a modal with two equally presented choices and explicit
  guidance that only one is needed. Stripe guidance explains cards/wallets and
  USD charging; dLocal explains local-currency methods, varying availability
  and the ten supported countries from live constants.
- Selection navigates to `/checkout/stripe` or `/checkout/dlocal`. Only the
  selected form mounts. Existing API endpoints, request bodies, price sources,
  grants and payment-return destinations are unchanged.
- `components/payments/provider-checkout.tsx` contains the existing forms;
  `checkout-access.tsx` shares their sign-in/active-PRO boundaries.
  `checkout-navigation.ts` preserves locale prefix/query intent.
  `payment-provider-choice.tsx` owns the modal.
- Billing, plan, country and referral context survives choice and provider
  switching, including user changes on the form. Sign-in callbacks retain the
  selected route and query. Stripe and the chooser do not wait for dLocal
  three-day eligibility.
- The modal supports Escape/X, a visible reopen control, trapped focus and
  explicit focus return after dismissal. Mobile content scrolls within the
  viewport; the dLocal action was reached and used on mobile.
- Added 12 real translated keys to each of 19 dictionaries (228 entries), with
  zero existing dictionary value changes. Dynamic country names reuse the
  existing translated keys.
- Added `__tests__/pages/checkout/provider-choice.test.tsx` (14 tests).
  No owned deletions, backend changes, generated clients or dependency edits.

| Command / check                                                                                                         | Cwd         | Exit | Pass/fail/skip                  | Evidence / limitation                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------- | ----------- | ---- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit --incremental false`                                                                                  | Repo root   | 0    | Pass                            | Full root source types                                                                                               |
| Scoped `tsc --noEmit -p tsconfig.checkout-tests.json`                                                                   | Repo root   | 0    | Pass                            | New test and import closure; NextAuth augmentation and jest-dom ambient declarations included                        |
| Scoped ESLint, seven runtime files and new test, `--max-warnings 0`                                                     | Repo root   | 0    | Pass                            | No warnings                                                                                                          |
| Jest: i18n compulsory coverage, SystemConfig guard, payment components, checkout-return; `--runInBand --coverage=false` | Repo root   | 0    | 9 suites / 124 tests pass       | Existing offline-fallback and act warnings in unchanged payment widget tests                                         |
| Jest: new provider-choice suite; `--runInBand --coverage=false --silent`                                                | Repo root   | 0    | 1 suite / 14 tests pass         | Modal, focus, access boundaries, context, provider isolation and switching                                           |
| Targeted Prettier `--check --end-of-line auto`                                                                          | Repo root   | 0    | Pass                            | Runtime, test, 19 dictionaries and task record                                                                       |
| `git diff --check`                                                                                                      | Repo root   | 0    | Pass                            | Existing LF/CRLF advisory only                                                                                       |
| Playwright local preview, first pass                                                                                    | Local :3014 | 0    | 10 checks pass                  | Desktop/mobile, Thai prefix, Arabic RTL, provider routes, annual/referral/country, no payment POST; zero page errors |
| Playwright final pass                                                                                                   | Local :3014 | 0    | 6 checks pass                   | Dark theme, X/Escape focus return, mobile dLocal action/route, Arabic title/close bounds; zero page errors           |
| Dictionary parity check                                                                                                 | Repo root   | 0    | Pass                            | Reviewer independently compared all 19 files with HEAD                                                               |
| `node scripts/agents/check-operating-docs.mjs`                                                                          | Repo root   | 1    | 29 existing issues              | Missing frontmatter/broken links in unchanged operating docs                                                         |
| HEAD/current operating-doc baseline comparison                                                                          | Repo root   | 0    | 29 baseline / 29 current; 0 new | Reproduced via read-only Git adapter against HEAD                                                                    |

The first single-suite test run by the test agent omitted `--coverage=false`:
all 14 tests passed, but exit 1 came from global coverage thresholds and EPERM
writing an existing coverage report. The final runs used the documented scoped
recipe and passed. An initial scoped type harness lacked existing ambient
declarations; its setup was corrected, and the complete harness passed without
runtime or test source changes.

## Review findings

Fresh read-only review compared the extracted provider forms against the original
checkout at HEAD and inspected route/context/access/dictionary behavior.
One introduced defect was found and fixed: a programmatically opened Radix
dialog had no trigger to receive focus after dismissal. An explicit reopen
button ref and close-auto-focus handler now return focus; both X and Escape are
tested in Jest and the browser.

Visual inspection also found Arabic heading overlap with the physical-right
close control. Physical-right header padding resolves it, and final browser
bounding boxes verify separation. No outstanding actionable findings remain.
Pre-existing Stripe radio keyboard navigation, payment-error announcement and
submit-pending behavior were preserved.

## Unconfirmed / found

- Browser uses intercepted fixture session/config/eligibility/method/quote
  responses. No credentials entered, checkout POST issued, payment completed
  or production mutation performed. Production availability of hosted wallets
  and real payment processing were not verified.
- The preview compiled all three affected routes and returned HTTP 200.
  Google Fonts and live FX providers were unreachable in the sandbox, so
  existing fallback fonts/rates were used. Prices in screenshots are fixture
  examples, not production-price assertions.
- Full repository tests and production build were not required/run for this
  presentation change. A root build has destructive prebuild/client-generation
  side effects; no shared generated resources were regenerated.
- Existing dirty mobile-app deletions, recent-works.md, next-env.d.ts and
  untracked projects/research/task artifacts were preserved. Next dev keeps
  the already-dirty next-env.d.ts development references; it is excluded.
- At this implementation checkpoint no commit, push, deployment, migration or
  flag change had occurred. Subsequent publication is recorded separately.
- Shared Claude/Codex state was not edited. Publication is pending its named
  state owner; the individual task and this handoff contain the completed work.

Browser evidence and the runnable final browser script are outside Git under
`C:/Users/WiN/.codex/visualizations/2026/10/13/01a134d4-b89a-7011-b8a8-03694cd09bee/`:
`checkout-choice-desktop.png`, `checkout-choice-desktop-dark.png`,
`checkout-choice-mobile.png`, `checkout-choice-mobile-dlocal.png`,
`checkout-choice-thai.png`, `checkout-choice-arabic.png`,
`checkout-stripe-desktop.png`, `checkout-dlocal-desktop.png`,
`checkout-browser-results.json`, `checkout-browser-final-results.json`,
`checkout-browser-final.cjs`, `tsconfig.checkout-tests.json` and
`checkout-source-hashes.json`.

## Next action and ownership

The local implementation is complete. Davin has now authorized a scoped commit
and push; follow the linked publication record. Shared-state owner may publish
a link to this record. Subagent test/translation ownership was released to root;
root has integrated and verified the final source. No automatic ownership
transfer or production action is implied.
