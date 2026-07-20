# Migration Order — Model census + schema split (F4, F5)

> `TEMPLATE-PORT.md` variant (per `00-SKELETON-AND-RULES.md` §2's table — 2-2 is
> explicitly listed under PORT). Read `00-SKELETON-AND-RULES.md` §4 first.
> **Creativity dial: Low** — behavior preservation IS the deliverable; every existing
> model's fields/relations/indexes move to a new file byte-for-byte. The only genuinely
> new thing is the `RefreshToken` model the playbook calls for.
> **Status: PRE-DRAFT** — written by the Executor at Session 2-1's close (2026-07-20).
> Needs the Advisor to produce the DRAFT, then Davin's APPROVAL, before a future
> session CONFIRMs and executes it.

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
- **`prisma.config.ts` exists** (root-level, new this session) — currently points at a
  single `schema: 'prisma/schema.prisma'`. **Open question for this session's audit:**
  does Prisma 7's config format support multiple schema paths for a two-file layout, or
  does F5's "two schema files/two clients" recommendation require two separate
  `prisma.config.ts`-equivalent setups (e.g. via `--config` flag) or two separate
  `generate`/`migrate` invocations? Not researched this session — first thing to check
  against the official docs before committing to a file-split mechanism.
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

**`RefreshToken` (new model, per the playbook):** no shape specified anywhere this
session found. Likely coupled to F6/F7 (auth strategy, HS256 vs JWKS — both OPEN, due
Session 3-1, Davin's call). Worth the Advisor/Davin deciding whether this session
should add a minimal stub (`id`, `token`, `userId`, `expiresAt` — guessable from the
name alone) now, or whether it should wait for F6/F7 to land first so it isn't built
twice. Flagging rather than deciding.

## Entry criteria

- [ ] Session 2-1 fully closed, production confirmed on Prisma 7.8.0 (this order's own
      predecessor) — re-verify at CONFIRM, don't assume from this PRE-DRAFT's context.
- [ ] Prisma 7's multi-schema/multi-config support researched and confirmed (see
      "Open question" above) — this determines the entire mechanism of this session,
      needs to be settled before Ordered steps can be trusted as written.
- [ ] File inventory re-verified against live `prisma/schema.prisma` (paths + line
      counts) — the census above is a snapshot, not ground truth by CONFIRM time.
- [ ] F4/F5 candidate classification (above) reviewed — Advisor/Davin confirm or amend
      before this session executes it.

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

### File 1/2

- **SOURCE:** `prisma/schema.prisma` (`model MarketDataV6`, ~line 925, no relations
  in/out) → **TARGET:** `prisma/market-data/schema.prisma`
- **Kind:** pure port (standalone model, byte-for-byte)
- **Invariants:** every field, index, `@@unique`, `@@map` unchanged.

### File 2/2

- **SOURCE:** `prisma/schema.prisma` (all other 26 models) → **TARGET:**
  `prisma/non-market-data/schema.prisma`
- **Kind:** pure port + one addition (`RefreshToken`, shape TBD — see above)
- **Invariants:** every field, relation, index, `@@map` unchanged for the 26 ported
  models.

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

- [ ] Both new schema files exist; `prisma validate` passes on both (mechanism per the
      "Open question" above).
- [ ] Full `npm run test:ci` still green, parity vs Session 2-1's baseline (111/111
      suites, 2046/2046 tests) — any drift is a finding.
- [ ] `npm run type-check` clean with both new clients wired in.

## Cutover & rollback (next session's order — reference only)

- **Mechanism:** TBD by the Advisor — likely no flag needed (no shadow-run possible
  the way cross-stack PORTs do it; this is closer to an atomic in-place rewrite).
  Rollback = revert the commit, single old schema file restored.

## Retire (after this session, if cutover is folded in)

- [ ] Delete old `prisma/schema.prisma` once both new files are proven; update
      `migration-cutover-table.md` if applicable; update
      `migration-stack-analysis.md`'s `prisma/` entries (files moved, not just added).

## Deviations

_(filled during execution)_

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

_(DRAFT order for Session 2-3 — Baseline migration + FK audit — once this session
closes; needs this session's actual F5 mechanism decision folded in, since baselining
two schema files against one unbaselined database (F20) is materially different from
baselining one)_
