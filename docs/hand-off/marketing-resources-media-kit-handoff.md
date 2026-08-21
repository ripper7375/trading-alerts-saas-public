# Hand-off Report — Marketing Resources / Affiliate Media Kit

**Date:** 2026-08-20
**Type:** Ad-hoc feature session (per `EXECUTOR-PROTOCOL.md` §6 — no Advisor DRAFT; Davin scoped this directly in chat)
**Status:** Shipped, live-verified, committed and pushed to `origin/main`

---

## 1. What was asked

Davin pointed at 4 screenshots of 2 pages in the read-only UI prototype
`seed-code/trading-conversational-ai-ui-pages-increment/`:

- **Admin — Marketing Resources & Media Kit Manager** (`app/admin/resources/page.tsx` in the prototype): upload/list/delete brand logos, mascots, ad banners, swipe-copy text, and guideline docs; stats cards for published-asset count, partner downloads, category count, CDN status.
- **Affiliate — Media Kit** (`app/affiliate/resources/page.tsx` in the prototype): the affiliate's own referral codes with discount %, downloadable brand assets, copy-paste swipe files, FAQ.

Both were confirmed to be **pure client-side mocks** — hardcoded arrays, `setTimeout`-faked uploads, zero API calls. The ask was to build the real backend business logic behind them in the monolith (`trading-alerts-saas-public`).

## 2. What already existed vs. what was greenfield

| Piece                         | Status before this session                                                                                                                                                              |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Referral codes + discount %   | **Real** — `AffiliateCode.discountPercent`, `GET /api/affiliate/dashboard/codes`                                                                                                        |
| Brand asset files             | **None** — `public/` held only `manifest.json`; the live `app/affiliate/dashboard/resources/page.tsx` (Session 6-7) explicitly said "Logo files and banner assets aren't published yet" |
| Marketing asset data model    | **None** — no Prisma model resembling this anywhere                                                                                                                                     |
| File storage                  | **None** — zero storage SDK (S3/Cloudinary/Blob/multer) anywhere in the repo                                                                                                            |
| Admin resource management API | **None**                                                                                                                                                                                |

This was fully greenfield on the data model and storage side.

## 3. Decisions made (confirmed with Davin before building)

1. **File storage: Vercel Blob.** Matches the app's existing Vercel deployment, zero new account/IAM setup, simple SDK. Alternatives offered: Cloudinary, or an "admin pastes a URL" MVP that ships with zero new dependencies.
2. **`prisma db push` against the live database.** This repo has no versioned migrations folder — schema sync is via `db push` against `DATABASE_URL`, which resolved to a non-localhost (Railway) host. Davin approved running it directly; it was additive-only (one new table, two new enums, nothing altered/dropped).
3. **MIME-type allowlist (follow-up, same conversation).** After the initial build, Davin asked whether MP4 could be uploaded — surfacing that the upload endpoint validated file _size_ only, not _type_, so literally any file would have been accepted. Davin asked for the fix; it's included in this hand-off.

## 4. What was built

### Data model

`MarketingAsset` (`prisma/non-market-data/schema.prisma`) — additive only, no changes to existing models:

```
MarketingAssetCategory: BRAND_LOGOS | MASCOTS | AD_BANNERS | SWIPE_COPY | DOCS
MarketingAssetStatus:   ACTIVE | DRAFT | ARCHIVED

MarketingAsset: id, title, category, format, resolution, fileUrl?, fileSize?,
                copyText?, downloadCount, status, createdByUserId?, timestamps
```

`fileUrl`/`fileSize` are set for every category except `SWIPE_COPY`, which uses `copyText` instead.

### Backend library (`lib/marketing-resources/`)

- `validators.ts` — Zod schemas, `MAX_ASSET_FILE_BYTES` (50MB), `ACCEPTED_ASSET_MIME_TYPES` allowlist (`image/png`, `image/jpeg`, `image/svg+xml`, `video/mp4`, `application/pdf`) + `isAcceptedAssetMimeType()`
- `service.ts` — `listAssetsForAdmin`, `createAsset`, `deleteAsset`, `listPublishedAssets`, `recordAssetEngagement` (atomic download/copy counter)
- `storage.ts` — thin `@vercel/blob` `put()`/`del()` wrapper, scoped to only ever touch blobs under its own `marketing-resources/` path prefix

### Admin API

| Route                       | Method   | Purpose                                                                                                                                                    |
| --------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/admin/resources`      | `GET`    | List with search/category/status filters, pagination, aggregate stats (total downloads, category count)                                                    |
| `/api/admin/resources`      | `POST`   | Publish a new asset — multipart upload to Vercel Blob for file categories, plain text for `SWIPE_COPY`; rejects unsupported MIME types and oversized files |
| `/api/admin/resources/[id]` | `DELETE` | Remove an asset and its underlying blob (if file-backed)                                                                                                   |

### Affiliate API

| Route                                              | Method | Purpose                                                                                                            |
| -------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| `/api/affiliate/dashboard/resources`               | `GET`  | The caller's active codes (with `discountPercent`) + every published (`ACTIVE`) asset                              |
| `/api/affiliate/dashboard/resources/[id]/download` | `GET`  | Atomically increments the engagement counter, then redirects (307) to the real file — usable as a plain `<a href>` |
| `/api/affiliate/dashboard/resources/[id]/copy`     | `POST` | Increments the counter, returns server-authoritative `copyText` for swipe-file assets                              |

### Frontend

The **existing, live** `app/affiliate/dashboard/resources/page.tsx` (previously a stub stating assets "aren't published yet") was wired to the new endpoint: real referral codes with discount badges, a real brand-assets grid with working downloads, and a new Copywriting Swipes section. Kept the file's existing minimal Tailwind styling rather than porting the prototype's fuller redesign — that's frontend-migration scope, not this session's.

**No admin UI page was built** — this was explicitly a backend-only ask, and the prototype UI is expected to eventually become the real frontend.

### Seed data

3 real brand-asset files were copied from the prototype's `public/` into this repo's `public/` (`davintrade-ai-icon.png`, `DavinTrade_Logo.jpg`, `marketing-icon.svg`) and seeded as 4 assets (3 file-backed + 1 swipe-copy) — both in `prisma/seed.ts` (idempotent, for future fresh databases) and directly into the live database this session.

## 5. A real bug found and fixed via live verification (not by unit tests)

`NextResponse.redirect(asset.fileUrl)` threw `TypeError: Invalid URL` for every relative `/public`-style `fileUrl` — 3 of the 4 seeded assets use one. Next.js's redirect helper requires an **absolute** URL. The fully-mocked unit test suite was 100% green throughout because its mock echoed any string back uncritically — it never exercised the real API's validation.

**Fix:** resolve to absolute first — `new URL(asset.fileUrl, request.url)` — before redirecting. A regression test for the relative-input case was added. Generalized as **`docs/migration-orders/LESSONS-LEARNED.md` L30**: _"A fully-mocked unit test suite can pass 100% while missing a real Next.js Response API constraint; verify redirects live, not just via mocks."_

## 6. Verification performed

- `tsc --noEmit` — clean
- `eslint app components lib hooks --max-warnings 0` — clean (0 warnings introduced; 5 pre-existing warnings elsewhere, unrelated to this session)
- `prettier --check` — clean
- `test:ci` — **164/164 suites, 2422/2422 tests**, all green (37 new tests across 8 new test files)
- **Live-verified end-to-end** against the real dev server and the real (Railway) database, not just mocks:
  - Logged in as the seeded `affiliate-test@trading-alerts.test` user — the wired affiliate page rendered real codes (`TESTCODE20`/`TESTCODE10` with live discount %) and all 4 seeded assets; clicked "Copy Text" and confirmed the counter incremented; exercised the download redirect both before and after the URL fix (500 → 307 → real 200)
  - Logged in as `admin-test@trading-alerts.test` and exercised the full admin CRUD lifecycle via `fetch()`: list, create a `SWIPE_COPY` asset (201), delete it (200)
  - Confirmed the MIME-type allowlist live: a `text/html` upload correctly 400s; an MP4 upload correctly clears the type check (and only then hits the still-open `BLOB_READ_WRITE_TOKEN` gap below — not a new bug)
- The real Vercel Blob **file-upload path itself was not live-exercised** (no `BLOB_READ_WRITE_TOKEN` in this session's environment) — it's covered by mocked unit tests only

## 7. Open follow-ups (not done, flagged for later)

1. **Provision `BLOB_READ_WRITE_TOKEN`** — Vercel dashboard → Storage tab → Blob store for this project. Until then, real (non-seeded) file uploads will 500 at the `uploadAssetFile()` call. Documented in `.env.example`.
2. **Admin UI page** — no page exists yet to drive the admin API from a browser; it was verified via direct `fetch()` calls instead. Out of scope for this backend-only session.
3. **Optional `money-service` mirror** — the rest of the affiliate domain (codes/commissions/stats) has a flagged read-API mirror in `money-service`; this brand-new domain does not. Not requested, not attempted speculatively — worth doing once this feature sees real traffic, for consistency.
4. **Format auto-derivation** (raised, deliberately not done) — the admin's `format` field is still free text rather than derived from the uploaded file's real MIME type. Left as an idea for a future session, not silently implemented.

## 8. Files changed / commits

Pushed to `origin/main` as 5 commits (`1be1d7d1..8d577467`):

| Commit     | Summary                                              | Files                                                                                                                                                |
| ---------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `b4cd7a1e` | Schema, `@vercel/blob` dep, static config, seed data | `prisma/non-market-data/schema.prisma`, `package.json`, `pnpm-lock.yaml`, `next.config.js`, `.env.example`, `prisma/seed.ts`, 3 new `public/` assets |
| `34218183` | `lib/marketing-resources/` service layer             | `validators.ts`, `service.ts`, `storage.ts` + 2 test files                                                                                           |
| `05b515e5` | Admin CRUD API + MIME allowlist                      | `app/api/admin/resources/{route.ts,[id]/route.ts}` + 2 test files                                                                                    |
| `2c11e64e` | Affiliate API + live page wiring                     | `app/api/affiliate/dashboard/resources/**`, `app/affiliate/dashboard/resources/page.tsx` + 3 test files                                              |
| `8d577467` | Session documentation                                | `CLAUDE.md`, `docs/migration-orders/LESSONS-LEARNED.md`                                                                                              |

Full per-session narrative (decisions, deviations, verification detail) is also recorded in `CLAUDE.md`'s "Current state" section under the 2026-08-20 ad-hoc entries — that's the canonical source this report summarizes.

## 9. How to verify locally

```bash
npm run prisma:generate:non-market-data   # regenerate the Prisma client
npm run test:ci                            # full suite
npm run dev                                # then log in as affiliate-test@trading-alerts.test
                                            # or admin-test@trading-alerts.test (see prisma/seed.ts)
```

Visit `/affiliate/dashboard/resources` as the affiliate test user, or drive `/api/admin/resources` directly as the admin test user.
