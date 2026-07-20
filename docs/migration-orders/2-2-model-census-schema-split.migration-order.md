# Migration Order — Model census + schema split (F4, F5)

> `TEMPLATE-PORT.md` variant (per `00-SKELETON-AND-RULES.md` §2's table — 2-2 is
> explicitly listed under PORT). Read `00-SKELETON-AND-RULES.md` §4 first.
> **Creativity dial: Low** — behavior preservation IS the deliverable; every existing
> model's fields/relations/indexes move to a new file byte-for-byte. The only genuinely
> new thing is the `RefreshToken` model the playbook calls for.
> **Status: EXECUTED** — both new schema files created, validated, generating clean
> clients; F4/F5 closed; all 3 Done-when items checked (test:ci 111/111 · 2046/2046,
> exact parity). Cutover (repoint 16 consumer imports, retire old schema) deferred
> per the playbook's own numbering to **Session 2-4** (not "2-2b" — see Deviations'
> session-numbering correction) — old `prisma/schema.prisma` untouched, no app code
> changed. Session 2-3 (Baseline migration + FK audit) runs before 2-4. 2026-07-20.

**Session:** 2-2 · **Phase:** Phase 2 (`non_market_data` Prisma Schema, Workstream 6) ·
**Variant:** PORT · **Generated:** 2026-07-20 · **Flags touched:** F4 (full model
census), F5 (file-layout strategy) — both currently OPEN, this session closes them ·
**Estimated time:** unestimated (F12 open).
**Target service:** monolith-internal (this is a same-repo, same-database file
reorganization — no cross-stack move, no new service).
**Contract:** none (internal Prisma schema/client structure; no external API shape
changes).

## Context carried over from Session 2-1 (Prisma 7.8.0 upgrade)

- **Prisma is now 7.8.0 on root** (`railway-gateway/package.json` stays on `6.19.2`,
  decoupled — irrelevant to this session, which only touches the root app's schema).
- **`prisma.config.ts` exists** (root-level, new this session).
  **F5 Recommendation (Prisma 7 Evidence):** Because `prisma.config.ts` uses `defineConfig({ schema: '...' })` pointing to a single file path, and F5 requires generating _two separate clients_ pointing to two different outputs (e.g. `node_modules/.prisma/market-client`), this requires invoking the CLI twice. We recommend keeping `prisma.config.ts` for the shared DB connection config, but explicitly passing `--schema=prisma/market-data/schema.prisma` and `--schema=prisma/non-market-data/schema.prisma` respectively during `prisma generate` and `prisma migrate` to bypass the single default schema path.
- **Driver adapters are now mandatory** (`@prisma/adapter-pg`'s `PrismaPg`) — every
  `PrismaClient` instantiation for either new schema/client needs one. Established
  pattern to reuse: `new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: {
rejectUnauthorized: false } })`, `rejectUnauthorized: false` preserving pre-v7 cert
  behavior against Railway's proxy TLS. See `lib/db/prisma.ts` for the reference
  implementation.
- **`schema.prisma`'s `datasource` block no longer carries `url`/`directUrl`** — those
  moved to `prisma.config.ts` (hard error in 7.8.0 if left in the schema file,
  confirmed empirically, not just a lint warning). Both new schema files' `datasource`
  blocks should follow the same minimal `provider = "postgresql"`-only shape.
- **Generator provider stays `prisma-client-js`** (confirmed still functional under
  7.8.0) — for two separate clients, this almost certainly means two `generator client`
  blocks with two different `output` paths (e.g. `node_modules/.prisma/market-client`,
  `node_modules/.prisma/non-market-client`) — needs verifying, not yet tested.
- **F20 is still OPEN** (production migration history unbaselined; destructive pending
  `drop_watchlists` migration). This session's own scope (create two schema files,
  `prisma validate` passes on both) should NOT require touching migration history —
  that's Session 2-3's explicit job (baseline + FK audit). But flagging the interaction:
  splitting one schema into two against a database whose migration history doesn't
  match its live state is exactly the kind of thing that could tempt a shortcut through
  F20 mid-session. Don't. Re-read `LESSONS-LEARNED.md` L16 before touching the
  migration CLI at all.
- **Two new lessons from Session 2-1, both plausibly relevant here:** L21 (a
  hand-maintained ambient `declare module` stub — `types/prisma-stubs.d.ts` — can
  shadow real generated Prisma types; if this session touches that stub for the new
  models, check it doesn't silently diverge again) and L22 (WebFetch/WebSearch may
  still be down; `curl` + scratchpad-path HTML-to-text extraction is the fallback,
  established and working).

## Candidate model census (F4) — derived from `prisma/schema.prisma` as of Session 2-1's close

27 models currently in the single schema file. Candidate split below is about as
unambiguous as this gets (only one model is genuinely market/trading-data shaped) —
still needs Advisor/Davin sign-off per F4, not a unilateral call by this PRE-DRAFT.

**Market-data (1 model):**

- `MarketDataV6` — the only trading-data table (OHLCV + centroid-regression variants);
  everything else is user/business/auth data.

**Non-market-data (26 models) — candidate `prisma/non-market-data/schema.prisma`:**
`User`, `Account`, `Session`, `UserSession`, `LoginHistory`, `SecurityAlert`,
`VerificationToken`, `UserPreferences`, `AccountDeletionRequest`, `Subscription`,
`Alert`, `Payment`, `FraudAlert`, `AffiliateProfile`, `AffiliateCode`, `Commission`,
`Notification`, `AffiliateRiseAccount`, `PaymentBatch`, `DisbursementTransaction`,
`RiseWorksWebhookEvent`, `DisbursementAuditLog`, `SystemConfig`,
`SystemConfigHistory`, `Drawing`, `DrawingAlert`.

**Cross-schema relations to watch:** none of `MarketDataV6`'s fields reference any
other model via a Prisma relation (`@relation`) and vice versa — it's a standalone
table with no FK into the non-market-data set. This is good news for the split (no
cross-schema foreign keys to work around), but re-verify at CONFIRM against the live
schema file, not this snapshot.

**`RefreshToken` (new model, per the playbook):**
Recommendation: Add a minimal stub (`id`, `token`, `userId`, `expiresAt`) in `prisma/non-market-data/schema.prisma` now to fulfill the model census goal. We can refine it later when F6/F7 (auth strategy) lands.

## Entry criteria

- [x] Session 2-1 fully closed, production confirmed on Prisma 7.8.0 (this order's own
      predecessor) — re-verified at CONFIRM: root `package.json` has `prisma`/
      `@prisma/client` pinned to exactly `7.8.0`, `prisma.config.ts` present and
      matching the described shape, `npm run type-check` clean. Production runtime
      confirmation itself remains Davin's word only (no Vercel access in this
      environment — unchanged carried-over gap, not new).
- [x] Prisma 7 multiple-schema mechanism confirmed (CLI invocations with explicit `--schema` flags) —
      confirmed empirically, not just asserted: `@prisma/config@7.8.0`'s type declares
      `schema?: string` (singular, no array support), and `prisma generate --help` /
      `prisma migrate dev --help` both expose a per-invocation `--schema=<path>` flag
      that overrides the config's default. Executed successfully against both new
      files this session (see Deviations).
- [x] File inventory re-verified against live `prisma/schema.prisma` (paths + line
      counts) — 27 models confirmed live (1 `MarketDataV6` + 26 others), model list
      matches the PRE-DRAFT census name-for-name, `MarketDataV6` at line 923 (was
      "~925" at PRE-DRAFT — normal drift), zero `@relation` involving it (22
      `@relation` lines total in the file, all among the other 26 models).
- [x] F4/F5 candidate classification (above) reviewed — Advisor/Davin confirm or amend
      before this session executes it — held on the order's own header attestation
      ("approved by Davin"). Note: `DECISION-LOG.md`'s flag register still lists F4/F5
      as OPEN at CONFIRM time — expected, not a discrepancy, since this order's own
      text states this session is what closes them.

## Integration points

- **In:** every `app/api/**` route and `lib/**` module currently importing
  `@prisma/client` (16 files, per Session 2-1's blast-radius count) — each will need
  its import repointed to whichever of the two new clients owns the models it uses.
- **Out:** none new — no new external caller.
- **Owns:** `prisma/market-data/schema.prisma` (1 model), `prisma/non-market-data/schema.prisma`
  (26 models + `RefreshToken`).

## File Port Order

_(dependency order: leaf/standalone models first, then the rest — detailed per-file
line numbers are a DRAFT-level task; this PRE-DRAFT gives the shape, not the full
manifest)_

### File 1/2 — DONE

- **SOURCE:** `prisma/schema.prisma` (`model MarketDataV6`, ~line 925, no relations
  in/out) → **TARGET:** `prisma/market-data/schema.prisma`
- **Kind:** pure port (standalone model, byte-for-byte)
- **Invariants:** every field, index, `@@unique`, `@@map` unchanged. **Verified:**
  diffed field-for-field against the live source at execution time; `prisma validate`
  passes; `prisma generate` produces a working client at
  `node_modules/.prisma/market-client`.

### File 2/2 — DONE

- **SOURCE:** `prisma/schema.prisma` (all other 26 models) → **TARGET:**
  `prisma/non-market-data/schema.prisma`
- **Kind:** pure port + one addition (`RefreshToken`, shape TBD — see above)
- **Invariants:** every field, relation, index, `@@map` unchanged for the 26 ported
  models. **Verified:** all 26 models + all 18 enums ported byte-for-byte (including
  section comments/doc comments); `RefreshToken` added as its own trailing section
  with exactly the 4 approved fields (`id`, `token`, `userId`, `expiresAt`), no extra
  fields/relations/indexes; `prisma validate` passes; `prisma generate` produces a
  working client at `node_modules/.prisma/non-market-client` with `RefreshToken`
  present in the generated types.

## Rules specific to this variant

- Changing a ported test's assertion requires a written justification in Deviations.
- Wrong Prisma client = boundary violation (market vs non-market) — this is the whole
  point of F5; get the import-repointing right in all 16 consumer files, not just the
  schema files themselves.
- SOURCE (`prisma/schema.prisma`) becomes **change-frozen (CC-F)** once this session's
  shadow/parity work starts — don't edit the old file and the new ones in the same
  window without a clear single-source-of-truth moment.
- This session ends with the split committed and validated — cutover (deleting the old
  single schema file, repointing all 16 consumer imports for real) is arguably part of
  THIS session given there's no separate service to shadow-run against (unlike a
  cross-stack PORT) — Advisor should decide whether 2-2 does the full cutover itself or
  splits it into 2-2 (create + validate) / 2-2b (repoint + retire old file).

## Slice-level verification (done when)

- [x] Both new schema files exist; `prisma validate` passes on both (mechanism per the
      "Open question" above).
- [x] Full `npm run test:ci` still green, parity vs Session 2-1's baseline (111/111
      suites, 2046/2046 tests) — any drift is a finding. **Result: 111/111 suites,
      2046/2046 tests, exact parity, exit 0, 89.9s.** No drift.
- [x] `npm run type-check` clean with both new clients wired in — `type-check` script
      updated to generate all three clients (old + market + non-market) before `tsc
  --noEmit`; ran clean, exit 0.

## Cutover & rollback (next session's order — reference only)

- **Mechanism:** Split into 2-2 (create schemas, generate separate clients) and 2-2b (cutover: repoint all 16 consumer imports to the new clients and delete old schema).
- **Precondition:** 2-2 passes validation.
- **Rollback:** Revert the commits; restore single `prisma/schema.prisma` and reverse all import updates.

## Retire (after this session, if cutover is folded in)

- **N/A for this session** — per "Cutover & rollback" above, cutover is explicitly
  split out to 2-2b. The old `prisma/schema.prisma` is untouched and remains the
  single source of truth for all 16 existing consumers; it is now change-frozen
  (CC-F) per "Rules specific to this variant" until 2-2b repoints imports and retires
  it.
- [ ] Delete old `prisma/schema.prisma` once both new files are proven; update
      `migration-cutover-table.md` if applicable; update
      `migration-stack-analysis.md`'s `prisma/` entries (files moved, not just added).
      _(2-2b's job, not this session's.)_

## Deviations

- **`package.json` script changes (small, in-bounds, not in the original File Port
  Order).** Added `prisma:generate:market-data` and `prisma:generate:non-market-data`
  scripts (`prisma generate --schema=<path>` each), and updated `type-check` to run
  all three generates (old schema + both new ones) before `tsc --noEmit`. Why: the
  order's own "done when" gate is "`npm run type-check` clean with both new clients
  wired in" — without this change, running `type-check` would only regenerate the old
  default client and never touch the two new schema files, so a broken change to
  either new schema would silently pass type-check. This makes the gate a real,
  repeatable check instead of something only verified by a one-off manual command
  today. Did NOT touch `prebuild`/`postinstall` — no runtime code consumes the new
  clients yet (that's Session 2-4's job), so wiring them into the deploy-time build
  pipeline now isn't load-bearing; flagging for Session 2-4 to add once consumers
  actually depend on either new client at runtime.
- **`RefreshToken` implemented exactly as approved, nothing more.** Added to
  `prisma/non-market-data/schema.prisma` with exactly the 4 fields the APPROVED order
  specifies (`id`, `token`, `userId`, `expiresAt`) — no `@relation` to `User`, no extra
  indexes, no `createdAt`. Deliberately did not embellish beyond the approved stub,
  since its real shape is F6/F7's call (due Session 3-1), not this session's.
- **Old `prisma/schema.prisma` left fully untouched.** No edits — it remains the
  single source of truth for all existing consumers until Session 2-4's cutover. Per
  this variant's rules, it is now change-frozen (CC-F).
- **`npm run test:ci` run in full for parity verification** (order's own "done when"
  item) rather than assumed unchanged from Session 2-1's baseline, even though no
  existing source file was touched — results recorded below once the run completes.
  **Result: 111/111 suites, 2046/2046 tests, exit 0, 89.9s. No drift.**
- **Session-numbering correction (found at follow-up close, not during the session
  proper).** The follow-on order PRE-DRAFTed at this session's close was originally
  self-labeled "2-2b" (repoint 16 consumer imports, retire old schema) without first
  checking the playbook's own session list. Davin asked to PRE-DRAFT "session 2-3,"
  which surfaced the mismatch: `monolith-to-microservices-migration-session-
playbook.md` (lines 175–194) already scopes **Session 2-3 as "Baseline migration +
  FK audit"** (plan steps 2.3–2.4) and **Session 2-4 as "Rewire the monolith"** (plan
  steps 2.5–2.6, the import-repointing work) — in that order, with 2-3 BEFORE the
  import-repointing, not after. Corrected: renamed the "2-2b" file to
  `2-4-rewire-monolith-cutover.migration-order.md` (updated its entry criteria to
  depend on Session 2-3 closing, not Session 2-2, and added awareness of Session
  2-3's FK-audit changes), and separately PRE-DRAFTed the actual Session 2-3 order
  (`2-3-baseline-migration-fk-audit.migration-order.md`) per the playbook. Recorded
  as `LESSONS-LEARNED.md` L23 since an executed-as-invented "2-2b" would have skipped
  the migration-baseline/FK-audit step entirely.
- **Full model census table added to `DECISION-LOG.md`'s F4 entry** (found missing at
  follow-up close — the playbook's own Session 2-2 "done when" requires "census table
  in Decision Log," and the original F4 resolution entry only had prose lists). All
  28 rows (27 original models + `RefreshToken`) now shown with schema-file assignment,
  money-domain flag, and direct-`User`-relation flag — the latter two columns feed
  Session 2-3's FK-audit scope directly.

## Known wrinkles / do-not-touch

- `railway-gateway/prisma/schema.prisma` mirrors `MarketDataV6` for its own
  `prisma generate` only (per its own header comment) — if `MarketDataV6` moves to
  `prisma/market-data/schema.prisma`, that mirror's _field list_ must stay byte-for-byte
  identical, but `railway-gateway` itself is Session 2-1's decoupled/undeployed
  service — don't bump its Prisma version or touch its own file layout as part of this
  session; only keep the model definition in sync if the model's shape changes (it
  shouldn't, this is a pure move).
- `lib/api/index.ts` — known-broken by design, Phase 7's problem, not this session's.

## Next-session handoff

_Session 2-3 — Baseline migration + FK audit._
Once 2-2 and 2-2b close, Session 2-3 will baseline the migration history for both new schemas against the existing database (`prisma migrate resolve --applied`), resolving the unbaselined history (F20) before proceeding to phase 3.
