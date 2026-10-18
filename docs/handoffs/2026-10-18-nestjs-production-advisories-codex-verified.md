---
type: Concept/Handoff
status: ready_for_review
updated_at: 2026-10-18
---

# NestJS production advisories: implementation and verification

From/to: Codex / Davin and the shared-state owner.
Task: [authorization, scope and checklist](../codex/tasks/2026-10-18-nestjs-production-advisories.md).
Phase/session unchanged. Branch: codex/nestjs-security-audit.
HEAD/base: 5dab316c79c13abd42d024f9291dda667cff755e.
Worktree: D:/SaaS Project/trading-alerts-saas-codex-nestjs.
Status: final checks passed; ready for review within authorized scope. Davin authorized commit, push and a combined PR on 2026-10-18 after the verified checkpoint.

## Needs from Davin

The compatible lockfile pass removes all three critical package findings. High
findings remain behind the reference prompt's parent-upgrade/manifest and major
upgrade approval gates; their IDs and reasons are below. No major upgrade,
NestJS/Prisma/OpenTelemetry family bump or npm override was applied.

Davin approved the one-line test-only `(v: unknown)` annotation separately and
selected one combined PR and subsequently authorized commit/push. The shared
state owner must publish the session and waiting-on update; proposed text is below.

## Changed and verified

Three npm lockfiles changed, plus the approved annotation at
[stripe-checkout.controller.spec.ts](../../money-service/src/stripe/stripe-checkout.controller.spec.ts).
No test assertion, payment/auth behavior, manifest, root lockfile, workflow,
migration or production setting was edited. At the verification checkpoint,
nothing was committed or pushed. Publication is now authorized; no deployment
or migration is authorized, and no credentials were entered.

The saved patch was generated with targeted npm update, without --force, using
temporary manifest/lock copies. It was applied only after all raw baselines were
measured. Installed packages were then synchronized with npm install --no-save
--ignore-scripts. All three final installs exit 0.

| Service   | Changed/added lock entries | High: before → after | Critical: before → after | Final production audit exit |
| --------- | -------------------------- | -------------------- | ------------------------ | --------------------------- |
| Money     | 19                         | 18 → 13              | 1 → 0                    | 1                           |
| Operation | 23                         | 19 → 13              | 1 → 0                    | 1                           |
| Gateway   | 14                         | 10 → 6               | 1 → 0                    | 1                           |

Audits use npm audit --omit=dev --audit-level=high. Money/operation each retain
46 moderate findings (59 total); gateway retains 3 moderate (9 total). Counts are
affected packages including inherited parent findings, not distinct advisory IDs.

Updates include proxy-addr 2.0.8, compression 1.8.2, fast-uri 3.1.8, compatible
brace-expansion/browser metadata/YAML/qs fixes, gRPC 1.14.6 in money/operation and
engine.io 6.6.11 in operation. No existing dependency crosses a major version;
root lock metadata stays identical. Every changed resolved package has a registry
HTTPS source and integrity, and its installed version matches the updated lock.

The real proxy-addr regression case was reproduced before and after: all three
2.0.7 installs trusted 203.0.113.42 under the malformed ::ffff:10.0.0.0/8 subnet;
all three 2.0.8 installs reject it. This verifies the library fix, without claiming
the application uses that malformed configuration.

### Required checks and baseline comparison

Jest ran serially using npm.cmd test -- --runInBand; npm.ps1 had consumed the
argument separator in the earlier interrupted checkpoint. Local Node is 24.12.0,
npm 11.15.0. Root tsc was not substituted for service checks.

| Check / cwd                                           | Baseline                                                                                                                                                                                  | Final                                                                             |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| npx.cmd tsc --noEmit / money-service                  | Raw exit 2; approved annotation recheck exit 0                                                                                                                                            | Exit 0                                                                            |
| npm.cmd test -- --runInBand / money-service           | Raw exit 1: 73 suites passed, 1 failed to compile, 823 tests collected/passed; approved correction exit 0: 74 suites / 838 tests passed                                                   | Exit 0: 74 suites / 838 tests passed                                              |
| npx.cmd tsc --noEmit / operation-service              | Exit 0                                                                                                                                                                                    | Exit 0                                                                            |
| npm.cmd test -- --runInBand / operation-service       | Exit 0: 53 suites / 506 tests passed                                                                                                                                                      | Exit 0: 53 suites / 506 tests passed                                              |
| npx.cmd tsc --noEmit / railway-gateway                | Exit 0                                                                                                                                                                                    | Exit 0                                                                            |
| npm.cmd test -- --runInBand / railway-gateway         | Raw exit 1: 64 passed / 3 failed / 10 skipped suites; 2759 passed / 5 failed / 376 skipped tests (3140 total); repaired checkout recheck exit 0: all 3 affected suites / 328 tests passed | Exit 0: 67 suites passed, 10 skipped; 2764 tests passed, 376 skipped (3140 total) |
| npm.cmd run test:e2e -- --runInBand / railway-gateway | Exit 0: 8 suites / 156 tests passed                                                                                                                                                       | Exit 0: 8 suites / 156 tests passed                                               |

No tests were added or removed. The annotation restores 15 previously uncollected
Stripe cases. Five gateway assertions depended on LF bytes but the Windows
checkout had CRLF. replay-cycle.js, sensors.module.ts and both copies of
zone_params.yaml were normalized only after proving the normalized bytes exactly
equal HEAD; git diff is empty for all four. No parameter or source logic changed.
The first post-update full run exposed three kit-sync failures because the
vendored YAML twin had initially been missed. That checkout mismatch was repaired
and the complete gateway suite was repeated and passed; the mismatch was unrelated to the dependency updates.

Gateway's database-gated suites require the explicit CYCLE_PG_URL and
CYCLE_PG_ALLOW_WIPE opt-ins; these were not enabled. Existing skips are retained.
Baseline prerequisite checks also passed: three local Prisma client generations
and operation's private shared-types build. These did not access a database.

## Remaining advisories and reasons

Compatible npm updates cannot replace an exact parent pin or cross these ranges.
Fixed releases exist; the restrictions below are scope/sign-off gates, not claims
that these vulnerabilities have no fix. The full current reports and all 15
unique direct IDs are in [remaining-advisories.json](../codex/tasks/evidence/2026-10-18-nestjs-production-advisories/remaining-advisories.json).

| Scope / package                                                            | High IDs                                                                                                                                                                                                                     | Reason left / concrete follow-up                                                                                                                                        |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All: multer 2.2.0                                                          | [GHSA-wc9g-mqfw-jrwm](https://github.com/advisories/GHSA-wc9g-mqfw-jrwm), [GHSA-qfvm-cv95-jqjf](https://github.com/advisories/GHSA-qfvm-cv95-jqjf), [GHSA-535w-7cp7-47q4](https://github.com/advisories/GHSA-535w-7cp7-47q4) | Exact-pinned by platform-express 11.2.3. Parent 11.2.7 pins multer 2.4.0; parent/manifest change needs sign-off under the reference prompt.                             |
| All: deepmerge-ts 7.1.5                                                    | [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)                                                                                                                                                     | Exact-pinned by Prisma config. Fixed 8.x is a transitive major. Prisma 7.10.1/config 7.10.1 pins 8.0.2; requires sign-off.                                              |
| All: mysql2 3.15.3                                                         | [GHSA-3f6p-5ww8-9rcr](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr)                                                                                                                                                     | Exact-pinned by Prisma 7.9.1. Prisma 7.10.1 pins mysql2 3.24.4; a Prisma bump or manifest override is outside this lockfile pass.                                       |
| Money/operation: js-yaml 5.2.1                                             | [GHSA-pm4m-ph32-ghv5](https://github.com/advisories/GHSA-pm4m-ph32-ghv5)                                                                                                                                                     | Exact-pinned by Swagger. Fixed 5.4.2 requires a parent change or override; neither was authorized in this pass.                                                         |
| Money/operation: legacy OpenTelemetry SDK/auto-instrumentations and Jaeger | [GHSA-q7rr-3cgh-j5r3](https://github.com/advisories/GHSA-q7rr-3cgh-j5r3), [GHSA-45rx-2jwx-cxfr](https://github.com/advisories/GHSA-45rx-2jwx-cxfr)                                                                           | Fixed SDK/auto-instrumentation lines are outside existing ranges; Jaeger 1.30.1 is exact-pinned by sdk-trace-node. Requires coordinated breaking upgrades and sign-off. |

Other remaining direct IDs below the high gate:

- Multer: GHSA-qvfw-j98x-7q72 (low), GHSA-3pph-fpjx-jg34 (moderate), same parent pin.
- MySQL2: GHSA-rgwj-5xj2-c3m3 (moderate), same Prisma pin.
- Swagger's YAML: GHSA-r3ph-w7gj-g6xm (moderate), same exact pin.
- OpenTelemetry: GHSA-8988-4f7v-96qf and GHSA-qqmp-wf37-98f9 (moderate), same legacy ranges.
- UUID: GHSA-w5hq-g745-h8pq (moderate), all services. Fixed >=11.1.1 cannot satisfy gaxios ^9.0.1 in money/operation or Bull's ^8.3.0 in gateway; needs a parent/major change.

## Review findings and limitations

- TS7006 was pre-existing and is fixed only by the approved test annotation.
- CRLF failures were pre-existing checkout artifacts; committed source was already LF.
- Formatting and diff checks exit 0. Operating-doc checker exits 1 with exactly the same 29 pre-existing issues; zero new issues.
- No production deployment, external sign-in/payment flow or GitHub CI runner was used.
- Git's existing index.lock blocked a stat-cache refresh. It was preserved. LF-only
  files may appear modified in git status despite producing no content diff;
  git diff --cached confirms no staged changes.

Reviewable data: [verification-results.json](../codex/tasks/evidence/2026-10-18-nestjs-production-advisories/verification-results.json),
[checkout byte evidence](../codex/tasks/evidence/2026-10-18-nestjs-production-advisories/checkout-normalization.json),
[critical regression check](../codex/tasks/evidence/2026-10-18-nestjs-production-advisories/proxy-addr-smoke-after.json)
and the [evidence directory](../codex/tasks/evidence/2026-10-18-nestjs-production-advisories/).

## Next action and ownership

Recommend a blocking production audit step in each nestjs-services-ci.yml service
job after installation, once residual highs have an approved resolution. Do not
silently introduce a red blocking gate while those decisions remain pending.
No workflow change was made.

The shared-state writer owns publication to the latest Claude state and the
existing production-advisories waiting-on item (6). This checkout predates that
security session; its stale state was not overwritten or rotated. Proposed text:

> NestJS advisory follow-up on codex/nestjs-security-audit, base 5dab316c: compatible
> lockfile fixes applied locally; money high/critical 18/1 to 13/0, operation 19/1
> to 13/0, gateway 10/1 to 6/0. Audit gates remain exit 1 for the documented exact
> parent pins and breaking OpenTelemetry upgrades. Davin approved one test type
> annotation; root manifests, overrides and workflows unchanged. See this report
> for final checks, baseline corrections, residual IDs and required approvals.
> Verification preceded publication. Davin subsequently authorized commit, push
> and a combined PR; no deployment or migration is authorized.

Codex releases this verified local implementation for review;
no other agent has accepted write ownership. A receiving worktree needs the
scoped uncommitted diff/evidence or an explicitly authorized commit transfer.

Uncommitted review snapshot: [SHA-256 of the four payload files](../codex/tasks/evidence/2026-10-18-nestjs-production-advisories/final-file-hashes.json).

## Publication resume

Davin explicitly authorized a conventional commit, branch push and combined PR
on 2026-10-18. The task commit was rebased onto fetched remote main at
`0e7aaf99b6a4e56e8bfed6d518f4f83595e923ef`. All four saved payload hashes still
match exactly. Remote main has identical service trees to the verification base.
The nine inherited local Next.js commits are excluded from the PR and retained
with the original task commit on `codex/nestjs-security-audit-verification-backup`.
The stale index lock was preserved in a timestamped local temporary backup after
verifying no active index writer; the current working tree is clean.

Root dependencies and generated `.husky/_` hooks are absent in this isolated
checkout; no hook was bypassed. Service verification remains valid by exact file
hashes. Formatting passes; the operating-doc checker retains its pre-existing
issues. Raw log terminal blank lines are preserved, and staged whitespace checks
pass with those log-only blank lines excluded. Historical checkpoint files
retain their original authorization state. Shared-state publication and the
deferred dependency decisions remain with their existing owners.
