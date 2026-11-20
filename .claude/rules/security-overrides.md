---
paths:
  - 'package.json'
  - '**/package.json'
  - 'pnpm-lock.yaml'
  - 'pnpm-workspace.yaml'
  - '**/package-lock.json'
type: Concept/StandingRules
authority: binding
source: "CLAUDE.md '## Security Override Policy' (pre-OKF L5361-L5366), verbatim + precedents from session history"
tags: [dependencies, security, pnpm, package-json]
---

<!-- `paths:` makes Claude Code load this rule only when a package manifest or lockfile is read. -->

# Security override policy (retained from the legacy guide — still binding)

Do **NOT** modify `overrides`/`pnpm.overrides` in `package.json` on feature branches, even
if `pnpm audit` complains. Security overrides are managed centrally on `main` via dedicated
PRs (`check-overrides.yml` enforces this; 7+ documented merge-conflict incidents caused the
rule — see `errors/continuous-pr-errors/`).

## Precedents worth knowing

- **2026-09-11 React 19.2.3 → 19.3.0:** `overrides` pinned `react`/`react-dom` to `^19.2.1`, so
  bumping `dependencies` alone would have been silently forced back. It was escalated with
  `AskUserQuestion`; Davin chose to bump the override in lockstep. Ask first, every time.
- **2026-10-18 advisories below the gate:** `handlebars@<4.7.10`, `underscore@<1.13.8` and
  `flatted@3.2.6` are overrides only because `newman`'s tree pins them exactly (`postman-runtime`
  `handlebars 4.7.8`, `newman-reporter-htmlextra` `4.7.7`, `httpntlm` `underscore ~1.12.1`, `uvm`
  `flatted 3.2.6`); every other fix was a lockfile-only lift. Drop each when its parent ships a
  fixed pin. `@faker-js/faker` GHSA-qxc2-j82w-r537 (patched in 10.5.0) is deliberately NOT
  overridden: `postman-collection` pins 5.5.3 and calls `faker.name.*` / `faker.random.*`, which
  10.x removed, so the override would break newman's `{{$random…}}` variables.
- This is a **pnpm workspace**: add root dependencies with `pnpm add -w <pkg>`. Plain
  `npm install` fails on the `workspace:*` protocol. The NestJS services (`money-service/`,
  `operation-service/`, `railway-gateway/`) use their own npm `package-lock.json`.
- An ESM-only release can break this repo's CJS `ts-jest` setup (`@nestjs/schedule` ≥ 7 did;
  pinned to `6.1.3`). Check `"type": "module"` in a new package before adopting it.
- **2026-10-18 production audit sweep (28 high/critical advisories, `pnpm audit --prod --audit-level=high`):**
  find WHICH parent keeps a package vulnerable before choosing. A parent whose range allows the patched
  release (caret ranges) needs only a lockfile re-resolution, no override (see the `pnpm update` gotcha in
  [environment-gotchas](../architecture/environment-gotchas.md)); an override is for a parent that pins the
  child exactly. `prisma@7.9.1` pins `mysql2` 3.15.3 and `@prisma/config@7.9.1` pins `deepmerge-ts` 7.1.5
  (the fix is a major, 8.x; the API Prisma uses, `deepmerge` as c12's `merger`, is unchanged), so
  `mysql2@<3.22.0` and `deepmerge-ts@<8.0.0` are the two NEW overrides; Prisma 7.10.1 pins the fixed
  versions itself, so both can go when Prisma is bumped (an ORM minor bump was judged a bigger change than
  two Prisma-CLI-only overrides). `lodash` was raised to `^4.18.0` (a floor). Direct bumps: `next-auth`
  `^4.24.15` (Davin's sign-off in the chat, 2026-10-18: auth), `undici` `^6.28.1`, `postcss` `^8.5.18`.
  The PR needs the GitHub label `security-override` (`check-overrides.yml`). The CI step "Production audit
  gate (high and critical)" is blocking from this PR on: a new advisory means a new dedicated PR.
- **2026-10-31 one advisory accepted until the zod 4 migration (Davin and Antigravity):** `pnpm.auditConfig.ignoreGhsas`
  holds `GHSA-mrhx-c7xc-m3w5`, and `zod@>=4.0.0 <4.6.6` is overridden to `^4.6.7` (that moves only the v4 copy inside
  `@vercel/cli-config`; the app's own `zod` stays on 3.x). The ignore is a risk acceptance, not a fix: the fix exists
  only in zod 4's own code, which the app's 3.x schemas do not run. `lib/validations/bounded.ts` puts a size check in
  front of the array and record schemas that take request bodies. Remove the ignore when the zod 4 migration lands
  (planned after launch). The reasoning and the benchmark are in the gitignored security folder, not here.
- **2026-11-01 three more advisories accepted until `resend` is bumped (Davin, Stage 2 of the Cloudflare hardening
  audit):** `pnpm.auditConfig.ignoreGhsas` also holds `GHSA-g3hv-75wg-m249` (`minimatch`, moderate),
  `GHSA-3g3m-2fjr-6pw4` (`glob`, moderate; availability only) and `GHSA-gcqx-w48m-w2h4` (`deepmerge`, low; no patch
  exists). **2026-11-21:** `GHSA-gcqx-w48m-w2h4` was withdrawn by GitHub on 2026-11-16, so its entry was removed from
  `ignoreGhsas` (two of the three remain). None of them fails the blocking `--audit-level=high` gate; the ignores keep `pnpm audit --prod` at exit 0 so a
  NEW advisory stays visible. They are risk acceptances, not fixes, and none is reachable in production:
  - `minimatch@9.0.7` and `glob@10.5.0` arrive only through `resend@2.1.0 -> @react-email/render -> pretty ->
js-beautify`. `pretty` calls `beautify.html()` and never loads js-beautify's CLI, the only code that loads `glob`
    and `editorconfig` (which pulls `minimatch`), and no request data reaches either package.
  - `deepmerge@4.3.1` arrives through `html-to-text` (under `@react-email/render`), which merges its own internal,
    static option objects only. (Kept for the record: the advisory is withdrawn and no longer ignored.)

  Overrides were rejected as the fix: the advisory lists no patched 9.x or 10.x `minimatch` (fixed only in 11.0.1), so
  a range override would leave versions the audit still reports; `minimatch` 3 and 5 export a callable function while 9
  and 10 export an object, so a blanket override breaks `require('minimatch')(...)` callers; and `@jest/reporters` 29.7.0
  calls `glob().default.sync`, which `glob` 10 does not export. Remove the two remaining entries when `resend` is bumped past
  the `@react-email/render@0.0.9 -> pretty -> js-beautify` chain (current `resend` depends only on `postal-mime` and
  `standardwebhooks`) and the `html-to-text` parent no longer resolves `deepmerge@4.3.1`. The review is in the
  gitignored security audit notes, not here.
