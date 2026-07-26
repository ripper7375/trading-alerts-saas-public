# Migration Order — PORT variant (backend module)

> For sessions that build new backend surfaces guided by a frozen contract (PORT rules — the
> OpenAPI spec is the law, not a redesign target). Read `00-SKELETON-AND-RULES.md` first — §4
> applies with the dial at **Low** for all service, controller, and client files (§7 endpoints
> below are fixed by `part19.5-wise-disbursement-openapi.yaml`, frozen at 4A-W1). Worked example
> depth per `4B-2`. Split from 4A-W3 to keep session time under ~2.5h.

**Session:** 4A-W3a · **Variant:** PORT · **Status:** CONFIRMED
**Supersedes:** Unsplit `4A-W3` draft (split into `4A-W3a` backend + `4A-W3b` UI per `00-SKELETON-AND-RULES.md` §3 & §5)
**Generated:** 2026-07-26 (Advisor) · **Estimated time:** ~2.5h
**Flags touched:** **F39** (resolve — who fills the recipient form: affiliate self-service vs admin-entered), **F41** (resolve — Wise recipient PII retention/deletion, interacts with F21 account deletion)
**Phase / plan section:** Phase 4A — money-service · Part 19.5 (RiseWorks → Wise), session 3a of 9
**Target service:** money-service (`src/wise/*`, new module)
**Contract:** `part19.5-wise-disbursement-openapi.yaml` (frozen at 4A-W1) + `01-part-19.5-wise-disbursement-architecture-design.md` §6.1, §7
**Seeded from:** `docs/migration-orders/replace-rise-with-wise/04-rise-to-wise-migration-plan.md` §4 "4A-W3 — BUILD recipient onboarding" and `02-wise-platform-api-integration-reference.md` §4.2–4.3

---

## Why this session, why now

4A-W2 (APPROVED / CONFIRMED, executed 2026-07-26) applied the additive Prisma schema migration (creating the 5 new Wise tables and enums in production) and proved `money_svc` can read and write all 5 tables cleanly. This session (`4A-W3a`) builds the backend recipient onboarding module in `money-service` — the essential prerequisite for all downstream payout sessions (W5/W6) to have valid beneficiaries (`targetAccount`) to transfer funds to. F39 and F41 resolve here because the authorization guards and PII storage boundaries depend on their answers.

---

## Hard Invariants for this Session

1. **Dynamic Schema Requirements (NEVER Hard-Code Bank Fields)**: Account requirements MUST be fetched dynamically from Wise's `account-requirements` schema endpoint (`GET /v1/quotes/{quoteId}/account-requirements` or `GET /v1/account-requirements`). **NEVER hard-code Thai bank fields** (or any currency's bank fields) in the service or controller logic.
2. **Zero Raw Bank Details Persisted or Logged**: PII-minimising design (`01-…` §7.4). Store ONLY `accountTail` (last 4 digits for display) and `detailsFingerprint` (irreversible SHA-256 hash). Full bank account details live at Wise (`wiseRecipientId`), NEVER locally in PostgreSQL or application logs.
3. **No New npm Dependencies**: Use Node ≥ 20 native `fetch` for all HTTP requests and Node built-in `crypto` module (`crypto.createHash`, `crypto.verify`) for RSA signature verification and fingerprint hashing. No `axios`, `undici`, or external crypto packages.

---

## Entry criteria

_(verified at CONFIRM time, not assumed — `EXECUTOR-PROTOCOL.md` §1.3)_

- [x] **4A-W2 closed CONFIRMED**; the 5 new tables live in production and proven writable by `money_svc` (confirmed at 4A-W2's close).
- [x] Sandbox Wise token works (to be exercised live in Step "Done when" — token presence confirmed value-blind on Railway; `curl.exe -s https://api.wise-sandbox.com/v1/profiles` returning business `profileId` `29617748` to be run as part of this session's execution).
- [x] **F39 resolved** by Davin (Option A — Affiliate self-service form at `/affiliate/settings/payout`, admin views summary).
- [x] **F41 resolved** by Davin (Option A — Wise-managed PII; store only `accountTail` last 4 digits and `detailsFingerprint` SHA-256 hash).
- [x] `WISE_API_TOKEN` set on money-service — confirmed value-blind on Railway production (`WISE_API_TOKEN`, `WISE_PROFILE_ID`, `WISE_ENVIRONMENT` all present as keys; L17 — no value ever printed).
- [x] Codebase line counts verified against live tree before Step 1:
      `prisma/non-market-data/schema.prisma` (1236 lines),
      `money-service/prisma/schema.prisma` (801 lines),
      `money-service/src/app.module.ts` (75 lines).

**A failed entry criterion means do not start** — propose the fix or the session swap.

---

## Integration points

- **In:** Next.js Frontend (or API clients) → `wise-recipients.controller.ts`
- **Out:** Wise Platform API (`https://api.wise-sandbox.com` sandbox / `https://api.wise.com` production)
- **Owns:** `AffiliateWiseRecipient` table (money-service writes; monolith never writes this table directly)

---

## Ordered File Breakdown (4B-2 Worked Example Depth — Backend Module)

Dependency order: pure/leaf configuration & types → API client & verifier → domain service → controller & module → THB fixture → unit test suites.

### File 1/10 — Module Configuration

- **TARGET:** `money-service/src/wise/wise.config.ts`
- **Kind:** New configuration glue
- **Description:** NestJS configuration provider exposing typed Wise settings read from `ConfigService`.
  - Properties: `profileId` (`WISE_PROFILE_ID`), `apiToken` (`WISE_API_TOKEN`), `environment` (`WISE_ENVIRONMENT`, default `sandbox`), `baseUrl` (derives `https://api.wise-sandbox.com` if sandbox, `https://api.wise.com` if production).
  - Validation: Assert `WISE_PROFILE_ID` and `WISE_API_TOKEN` are defined when `wise.module.ts` initializes.
- **Verification:** `npx tsc --noEmit` clean in `money-service`.
- **Commit:** `build(wise): add wise.config.ts configuration provider`

### File 2/10 — Constants & Endpoints

- **TARGET:** `money-service/src/wise/wise.constants.ts`
- **Kind:** Pure constants
- **Description:** Centralized string constants for Wise API communication.
  - Endpoints: `PROFILES_URL = '/v1/profiles'`, `ACCOUNTS_URL = '/v1/accounts'`, `ACCOUNT_REQUIREMENTS_URL = '/v1/account-requirements'`, `QUOTE_REQUIREMENTS_URL = '/v1/quotes'`, `WEBHOOK_SUBSCRIPTIONS_URL = '/v3/profiles'`.
  - Headers: `CORRELATION_HEADER = 'X-External-Correlation-Id'`, `ACCEPT_MINOR_VERSION_HEADER = 'Accept-Minor-Version'`, `MINOR_VERSION_1 = '1'`.
  - Timeout & Retry defaults: `DEFAULT_TIMEOUT_MS = 10000`, `MAX_RETRIES = 3`, `INITIAL_RETRY_DELAY_MS = 500`.
- **Verification:** `npx tsc --noEmit` clean in `money-service`.
- **Commit:** `build(wise): add wise.constants.ts for API paths and headers`

### File 3/10 — TypeScript Types & Interfaces

- **TARGET:** `money-service/src/wise/wise.types.ts`
- **Kind:** Pure types definition
- **Description:** Complete TypeScript interfaces for Wise API payloads and responses.
  - `WiseProfile`: `{ id: number; type: 'PERSONAL' | 'BUSINESS'; details: Record<string, unknown> }`
  - `AccountRequirementFieldGroup`: `{ key: string; name: string; type: string; required: boolean; example?: string; minLength?: number; maxLength?: number; validationRegexp?: string; valuesAllowed?: Array<{ key: string; name: string }>; refreshRequirementsOnChange?: boolean }`
  - `AccountRequirementGroup`: `{ type: string; title: string; usageInfo?: string; fields: Array<{ group: AccountRequirementFieldGroup[] }> }`
  - `CreateRecipientDto`: `{ currency: string; type: string; profile: number; accountHolderName: string; details: Record<string, unknown> }`
  - `WiseRecipientResponse`: `{ id: number; profile: number; accountHolderName: string; currency: string; type: string; details: Record<string, unknown>; active: boolean }`
  - `RecipientSummaryDto`: `{ id: string; affiliateProfileId: string; wiseRecipientId: string | null; accountHolderName: string; targetCurrency: string; recipientCountry: string; legalType: string; accountTail: string | null; status: string; createdAt: Date }`
- **Verification:** `npx tsc --noEmit` clean in `money-service`.
- **Commit:** `build(wise): add wise.types.ts API contract interfaces`

### File 4/10 — Wise HTTP Client (Native `fetch` + Redaction)

- **TARGET:** `money-service/src/wise/wise-api.client.ts`
- **Kind:** `@Injectable()` HTTP Client (Low dial — strict contract)
- **Description:** Central HTTP service wrapping Node native `fetch` for all Wise API calls.
  - Injects `WiseConfig`.
  - Injects `X-External-Correlation-Id: money-service-<uuid>` and `Authorization: Bearer <WISE_API_TOKEN>` on every outbound request.
  - Rate-limit & Retry logic: Detects HTTP `429` status; respects `Retry-After` header if present; performs exponential back-off (500ms, 1000ms, 2000ms) up to 3 retries for 5xx/429 errors.
  - **CRITICAL SECURITY INVARIANT (Body Redaction)**: Log sanitized request metadata ONLY. **Explicitly redact the `details` object** in `POST /v1/accounts` payloads so raw bank account numbers, IBANs, and dates of birth NEVER reach application logs or exception traces (`design §7.4`).
- **Verification:** Unit test asserting retry back-off behavior and asserting `details` object is stripped from log statements.
- **Commit:** `build(wise): add wise-api.client.ts with retry backoff and PII redaction`

### File 5/10 — RSA Signature Public Key Constants

- **TARGET:** `money-service/src/wise/wise-signature.constants.ts`
- **Kind:** Pure constants
- **Description:** Export Wise's published RSA public keys (PEM format) for verifying inbound webhook signatures.
  - `WISE_SANDBOX_PUBLIC_KEY_PEM`: Published Wise sandbox RSA public key.
  - `WISE_PRODUCTION_PUBLIC_KEY_PEM`: Published Wise production RSA public key.
  - (Built in this session so session 4A-W5 inherits a fully-tested verifier ready-made).
- **Verification:** `npx tsc --noEmit` clean in `money-service`.
- **Commit:** `build(wise): add wise-signature.constants.ts with Wise RSA public keys`

### File 6/10 — RSA-SHA256 Signature Verifier

- **TARGET:** `money-service/src/wise/wise-signature.verifier.ts`
- **Kind:** `@Injectable()` Security Service (Low dial — cryptographic precision)
- **Description:** Verifies Wise `X-Signature-SHA256` header against raw request body using Node built-in `crypto.verify`.
  - Method: `verifySignature(rawBody: string | Buffer, signatureBase64: string, env: 'sandbox' | 'production'): boolean`.
  - Decodes `signatureBase64` from Base64 into Buffer.
  - Uses `crypto.verify('SHA256', Buffer.from(rawBody), publicKeyPem, signatureBuffer)`.
  - Handles malformed Base64, missing header, or empty body gracefully without throwing unhandled exceptions.
- **Verification:** Unit tests verifying valid signed payload, tampered payload, wrong key, malformed Base64, and empty body.
- **Commit:** `build(wise): add wise-signature.verifier.ts with RSA-SHA256 verification`

### File 7/10 — Recipient Management Service

- **TARGET:** `money-service/src/wise/wise-recipient.service.ts`
- **Kind:** `@Injectable()` Domain Service (Low dial — strict DB & API rules)
- **Description:** Service managing recipient requirements, recipient creation, details fingerprinting, and DB persistence.
  - Injects `PrismaService` and `WiseApiClient`.
  - `getAccountRequirements(quoteId?: string, sourceCurrency?: string, targetCurrency?: string)`: Calls Wise `/v1/quotes/{quoteId}/account-requirements` (or `/v1/account-requirements`) with `Accept-Minor-Version: 1`. Returns dynamic requirement groups.
  - `refreshRequirementsOnChange(quoteId: string, currentDetails: Record<string, unknown>)`: Performs `POST /v1/quotes/{quoteId}/account-requirements` to fetch updated field requirements when a trigger field (`refreshRequirementsOnChange: true`) changes.
  - `createRecipient(affiliateProfileId: string, payload: CreateRecipientDto)`:
    1. Computes `detailsFingerprint = crypto.createHash('sha256').update(JSON.stringify(canonicalDetails)).digest('hex')`.
    2. Extracts `accountTail` (last 4 digits of `accountNumber`, `iban`, `clabe`, etc.) for admin display.
    3. Calls Wise `POST /v1/accounts?refund=false`.
    4. Upserts `AffiliateWiseRecipient` row in Postgres with `status = 'ACTIVE'`, `wiseRecipientId = String(response.id)`, `accountHolderName`, `targetCurrency`, `recipientCountry`, `legalType`, `requirementsType`, `accountTail`, `detailsFingerprint`.
    5. **NEVER stores raw bank account details** in `details` or `metadata`.
  - `getRecipientByAffiliateProfileId(affiliateProfileId: string)`: Returns summary DTO for recipient.
  - `deactivateRecipient(affiliateProfileId: string)`: Marks recipient `status = 'ARCHIVED'` locally and calls Wise `POST /v1/accounts/{id}/deactivate` if active.
- **Verification:** Unit tests for fingerprint calculation, account tail extraction, and recipient creation against mocked Wise client.
- **Commit:** `build(wise): add wise-recipient.service.ts with PII-minimizing storage`

### File 8/10 — Recipient REST Controller & Module Wiring

- **TARGET:** `money-service/src/wise/wise-recipients.controller.ts` & `money-service/src/wise/wise.module.ts`
- **Kind:** NestJS Controller & Module (Low dial — OpenAPI spec compliance)
- **Description:** Exposes REST API endpoints per frozen OpenAPI contract (`part19.5-wise-disbursement-openapi.yaml`).
  - Route Prefix: `/v1/wise/recipients`
  - Endpoints:
    - `GET /v1/wise/recipients/requirements` — Fetch dynamic requirements schema.
    - `POST /v1/wise/recipients/requirements/refresh` — Refresh requirements on field change.
    - `POST /v1/wise/recipients` — Create new recipient.
    - `GET /v1/wise/recipients/me` — Get current logged-in affiliate's recipient summary.
    - `GET /v1/wise/recipients` — Admin list recipients (paginated).
    - `POST /v1/wise/recipients/:id/revalidate` — Re-trigger validation check.
  - Guards applied based on **F39 resolution**:
    - If F39 = Affiliate Self-Service: `JwtAuthGuard` + `AffiliateGuard` on `/me` and POST endpoints; `AdminGuard` on `/v1/wise/recipients` list.
    - If F39 = Admin-Entered: `JwtAuthGuard` + `AdminGuard` on all recipient mutation endpoints.
  - Wire `WiseModule` into `money-service/src/app.module.ts` (76 lines → 77 lines).
- **Verification:** `npm run build` in `money-service`; unauthenticated GET `/v1/wise/recipients` returns HTTP 401.
- **Commit:** `build(wise): add wise-recipients.controller.ts and register WiseModule in app.module`

### File 9/10 — THB Account Requirements Fixture

- **TARGET:** `money-service/src/wise/__tests__/fixtures/thb-requirements.json`
- **Kind:** Test Fixture (Committed schema definition)
- **Description:** Fetch and commit the real THB account-requirements schema response from Wise production (read-only call).
  - Sandbox is UK-region (stable for GBP/USD/EUR only) and cannot generate Thai THB bank requirement schemas.
  - This committed JSON fixture serves as the authoritative offline test fixture for THB account requirements normalization.
- **Verification:** Valid JSON file containing `type: "thailand"`, fields array with `bankCode`, `accountNumber`, `accountType`, etc.
- **Commit:** `test(wise): commit production THB account-requirements fixture`

### File 10/10 — Backend Unit & Integration Test Suite

- **TARGET:** `money-service/src/wise/__tests__/wise-signature.verifier.spec.ts` & `money-service/src/wise/__tests__/wise-recipient.service.spec.ts`
- **Kind:** Test Suite
- **Description:** Complete test suite for RSA signature verification and recipient management.
  - Test Cases:
    1. Signature verifier valid/tampered/wrong-key tests pass 100%.
    2. `createRecipient` correctly calculates SHA-256 `detailsFingerprint` and extracts 4-digit `accountTail`.
    3. `createRecipient` asserts no raw `details` object is stored in DB `metadata`.
    4. THB requirement fixture normalization test using `thb-requirements.json`.
    5. Sandbox GBP recipient creation integration test against `https://api.wise-sandbox.com`.
- **Verification:** `npx jest` in `money-service` passes 100%.
- **Commit:** `test(wise): add signature verifier and recipient service test suites`

---

## Rules specific to this variant

- **PORT Dial (Backend = Low)**: The OpenAPI spec (`part19.5-wise-disbursement-openapi.yaml`, frozen at 4A-W1) is law. Follow the exact endpoint paths, request DTOs, and response shapes defined in the spec.
- **Zero Raw PII Storage**: Never log or persist raw bank account numbers, IBANs, or tax IDs. Store only `accountTail` (last 4 digits) and `detailsFingerprint` (SHA-256 hash).
- **Native Node Capabilities**: Use Node native `fetch` and `crypto` only. **No new npm packages.**

---

## Done when

- [x] All 10 backend files created and committed in dependency order (`10faa233`..`9b7526f2`,
      plus a mid-session correction `2d954e12` and a live bug fix `f100296a`).
- [ ] **NOT ACHIEVED** — A real sandbox recipient is created end-to-end (GBP) and stored with
      `status=ACTIVE` and valid `wiseRecipientId`. Confirmed live: `POST /v1/accounts` 403s
      "unauthorized" with the current `WISE_API_TOKEN` (read-only scope) — isolated via a
      direct call to Wise sandbox, not a code bug. Davin's call: accept as a confirmed
      external blocker, carry forward (needs a write-scoped sandbox token).
- [x] `detailsFingerprint` (SHA-256) and `accountTail` (last 4 digits) are correctly generated;
      zero raw bank details appear in DB or logs — proven by 6 unit tests (redaction +
      fingerprint/tail extraction) and confirmed again in the live 403 response body (no raw
      account number/DOB present).
- [ ] **NOT PROVEN LIVE** — `refreshRequirementsOnChange` (quote-scoped, needs a real
      `quoteId`; this session's `GET requirements` deliberately uses the non-quote-scoped
      fallback — quote creation is out of this order's 10-file scope, see Deviations).
- [x] Signature verifier test suite passes all cases (6, not 5 — added a 6th for
      missing-signature-header on top of the 5 named in File 6/10).
- [ ] **DEFERRED (Davin's call)** — THB account requirement schema fixture from production.
      Configured token is sandbox-only; confirmed live via a 401 "invalid_token" against
      `api.wise.com`. Carried forward as a Waiting-on item.
- [x] Test suites pass 100% in `money-service` (27/27 suites, 285/285 tests — 260 baseline +
      25 new). Monolith `test:ci` also re-verified via the pre-push hook: 117/117, 2082/2082.
- [x] Deployed to Railway (via `git push origin main` auto-deploy — `railway up` CLI proved
      unreliable for this service, see Deviations/`LESSONS-LEARNED.md` L23); unauthenticated
      `GET /v1/wise/recipients` confirmed live → 401 (also spot-checked `/requirements` and
      `/me` → 401).
- [x] Flags **F39** and **F41** resolved with formal entries in `DECISION-LOG.md`.
- [x] `CLAUDE.md`, `DECISION-LOG.md`, and `migration-stack-analysis.md` updated.
- [x] Session `4A-W3b` (UI Surface) order exists at status `PRE-DRAFT`.

---

## Rollback

- Revert the git commits and redeploy `money-service`.
- No money has been moved (read-only token used), and no production Wise account data is mutated.

---

## Deviations

_(filled DURING execution — what / why / impact.)_

**Carried forward from 4A-W2:**

- THB cannot be tested end-to-end in Wise's sandbox (UK-region sandbox only stably supports GBP/USD/EUR). Handled by fetching real THB requirements from production (read-only call, File 9) and testing E2E in sandbox using GBP (File 10).
- `WISE_API_TOKEN` is read-only for this session (full money-moving access deferred to 4A-W6).

**New this session (full detail also in `DECISION-LOG.md`'s "Session 4A-W3a — Backend build
findings" entry):**

1. **`CreateRecipientDto` (File 3/10) vs the frozen OpenAPI's `POST /wise/recipients` body
   are different shapes**, found while building the controller (File 8/10).
   `CreateRecipientDto` mirrors Wise's own `POST /v1/accounts` request; the OpenAPI's request
   (`targetCurrency`/`recipientCountry`/`legalType`/`accountHolderName`/`requirementsType`/
   `details`) is what the frontend actually sends. `wise-recipients.controller.ts` is the
   translation layer. `createRecipient` corrected mid-session (`2d954e12`) to take
   `recipientCountry`/`legalType` as explicit caller-supplied fields instead of guessing them
   from `details`.
2. **`revalidateRecipient`** added to `WiseRecipientService` — required by the frozen
   OpenAPI's `/revalidate` endpoint but absent from File 7/10's own method list.
3. **`DELETE /wise/recipients/{id}`** (deactivate) was in the OpenAPI spec but missing from
   the order's own File 8/10 endpoint prose — implemented anyway (frozen contract requires
   it).
4. **Unresolved schema/contract conflict, flagged for Davin/Advisor:** the OpenAPI's create
   description says replacing a recipient should archive the old row, not mutate it —
   `AffiliateWiseRecipient.affiliateProfileId` is `@unique` in the 4A-W2 schema (out of scope
   to change here), so `createRecipient` upserts in place instead. Needs a decision: accept
   upsert semantics (fix the OpenAPI text) or schema-change to support archive-and-recreate.
5. **`GET requirements` uses the discouraged non-quote-scoped Wise endpoint**, not the
   quote-scoped path the OpenAPI's own description implies. Creating a throwaway Wise quote
   is not in this order's 10-file breakdown; building it would have been undeclared scope
   expansion. `WISE_SOURCE_CURRENCY` hardcoded to `'USD'` in the controller (fixed platform
   decision, not a bank field — Hard Invariant #1 unaffected).
6. **Live bug found and fixed** (`f100296a`): the discouraged fallback 422s without
   `sourceAmount` (`validation.failure.only.source.or.target.amount`) — the reference doc's
   own example for this path already showed `sourceAmount=1000`; missed on the first pass.
   Fixed, redeployed, re-verified live: `GET requirements?targetCurrency=GBP` → real `200`,
   3 requirement groups from Wise sandbox.
7. **`WISE_API_TOKEN` scope confirmed live:** reads work (`GET /v1/profiles` → 200,
   `GET /v1/account-requirements` → 200 post-fix); `POST /v1/accounts` → `403 unauthorized`,
   confirmed via a direct call to Wise sandbox isolated from money-service's own code. The
   entry criterion "read-only is sufficient for this session" holds for reads, not for
   recipient creation. Davin's call: accept as a confirmed external blocker (see Done-when).
8. **`railway up` CLI deploy path found unreliable for this service** (413 without
   `--path-as-root`, "Failed to read app source directory" with it). Working path found:
   `git push origin main` — money-service has a connected GitHub source and auto-deployed
   cleanly twice this session. New `LESSONS-LEARNED.md` L23.

---

## Known wrinkles / do-not-touch

- **`lib/api/index.ts`** — known-broken by design until Phase 7. Do not touch.
- **RiseWorks source, schema, and rows** — Archived (F42), never deleted, never renamed.
- **`DISBURSEMENT_PROVIDER` stays `MOCK` in production** — 4A-W3a creates recipient endpoints but does NOT flip the active provider or execute payouts.
- **Do not install `axios`, `undici`, or `crypto-js`** — Node ≥ 20 native `fetch` and `crypto` are required.

---

## Next-session handoff

_(PRE-DRAFT `4a-w3b-wise-recipient-ui.migration-order.md` at this session's close — variant `UI-BUILD` for the dynamic recipient form component and admin recipient list page, seeded from `04-rise-to-wise-migration-plan.md` §4 "4A-W3b":_

- _Consumes `4A-W3a`'s `/v1/wise/recipients/*` endpoints._
- _Dynamic form rendering from Wise `account-requirements` schema with `refreshRequirementsOnChange` triggers._
- _Admin recipient management list displaying `accountTail`, currency, and recipient status badges.)_
