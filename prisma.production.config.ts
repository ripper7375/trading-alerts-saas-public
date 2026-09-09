/**
 * Prisma config for applying migrations to the PRODUCTION database.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 * ─────────────────────────────────────────────────────────────────────────────
 * The default `prisma.config.ts` loads `.env` and then `.env.local` with
 * `override: true`. On this machine `.env.local` points at a NON-PRODUCTION
 * database, so a plain `npx prisma migrate deploy` succeeds, prints
 * "All migrations have been successfully applied", and touches nothing that
 * production reads. That has now misled three separate sessions
 * (2026-07-18, 2026-09-01, 2026-09-09).
 *
 * This config loads ONLY `.env.production.local` — never `.env`, never
 * `.env.local` — so the wrong database cannot be substituted back in.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * USAGE
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. Copy `.env.production.local.example` -> `.env.production.local`
 *      (gitignored via `.env*`; verified with `git check-ignore`).
 *   2. Paste the real production connection string into it. Get it from
 *      Railway -> trading-alerts -> Postgres -> Variables -> DATABASE_PUBLIC_URL.
 *      Do NOT use `postgres.railway.internal` — that address only resolves from
 *      inside Railway's network, never from a laptop.
 *   3. Dry run first — this only reports, it changes nothing:
 *        npx prisma migrate status --config prisma.production.config.ts
 *   4. Run the pre-flight in §PRE-FLIGHT below if the provenance migration is
 *      among the pending ones.
 *   5. Apply:
 *        npx prisma migrate deploy --config prisma.production.config.ts
 *   6. Delete `.env.production.local` when done. It holds a live credential.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PRE-FLIGHT — required before 20260909000000_market_data_v6_provenance_not_null
 * ─────────────────────────────────────────────────────────────────────────────
 * That migration runs `SET NOT NULL` on `market_data_v6.cycle_id` and
 * `.collected_at`. It is NOT unconditionally safe: it aborts if any existing
 * row violates it. Confirm zero first (Railway -> Postgres -> Console, or psql):
 *
 *   SELECT COUNT(*) FROM market_data_v6
 *   WHERE cycle_id IS NULL OR collected_at IS NULL;
 *
 * Must return 0. If it doesn't, backfill or make the columns nullable in the
 * migration before applying. An earlier note claimed a clean apply had already
 * proven this — it had not; that apply was against the non-production database.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SCOPE NOTE — one migration history, possibly two databases
 * ─────────────────────────────────────────────────────────────────────────────
 * `prisma/market-data/` and `prisma/non-market-data/` SHARE this one migration
 * history (`prisma/migrations`). Verified 2026-09-09: `railway-gateway` (which
 * owns `market_data_v6`) uses the `trading-alerts` Postgres. NOT verified: which
 * database the Vercel monolith uses for its own tables (User, Account, ...).
 * If those are two different databases, this history has to be applied to BOTH.
 * Check Vercel -> Settings -> Environment Variables -> DIRECT_URL's host before
 * assuming one is enough.
 */
import { existsSync } from 'node:fs';
import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

const ENV_FILE = '.env.production.local';

// Hosts known NOT to be production. Guards the exact mistake this file exists
// to prevent: pointing at the dev/staging database and believing the success
// message. Remove an entry only with evidence from the Railway dashboard.
const NON_PRODUCTION_HOSTS = ['turntable.proxy.rlwy.net'];

function fail(message: string): never {
  throw new Error(`\n\n[prisma.production.config.ts] ${message}\n`);
}

if (!existsSync(ENV_FILE)) {
  fail(
    `${ENV_FILE} not found.\n` +
      `  Copy .env.production.local.example to ${ENV_FILE} and paste the real\n` +
      `  production connection string (Railway -> trading-alerts -> Postgres ->\n` +
      `  Variables -> DATABASE_PUBLIC_URL). The file is gitignored.`
  );
}

// Deliberately NOT loading .env / .env.local. `override: true` so a value
// already exported in the shell cannot silently win over the file.
const loaded = config({ path: ENV_FILE, override: true });
if (loaded.error) fail(`could not read ${ENV_FILE}: ${loaded.error.message}`);

const directUrl = process.env['DIRECT_URL'];
if (!directUrl) {
  fail(
    `DIRECT_URL is not set in ${ENV_FILE}.\n` +
      `  Migrations use DIRECT_URL, not DATABASE_URL — see prisma.config.ts.\n` +
      `  Set both to the same production value if you are unsure.`
  );
}

// Catch the copied-but-not-yet-edited template explicitly. Without this the
// placeholder fails later as "not a valid URL", which describes the symptom
// rather than the cause and reads as though something is broken.
if (/USER:PASSWORD@HOST:PORT/.test(directUrl)) {
  fail(
    `${ENV_FILE} still contains the example placeholders.
` +
      `  Copying the template is only step 1 — nothing prompts you for the URL.
` +
      `  Open ${ENV_FILE} and replace BOTH lines with the real connection string:
` +
      `      DIRECT_URL="postgresql://...@maglev.proxy.rlwy.net:58290/railway"
` +
      `      DATABASE_URL="postgresql://...@maglev.proxy.rlwy.net:58290/railway"
` +
      `  Get it from Railway -> trading-alerts -> Postgres -> Variables ->
` +
      `  DATABASE_PUBLIC_URL. Use the PUBLIC url: postgres.railway.internal is
` +
      `  Railway's private address and never resolves from a laptop.`
  );
}

// Echo the target host (never the credential) so the database being changed is
// visible before anything runs, rather than inferred from a success message.
let host: string;
try {
  const parsed = new URL(directUrl);
  host = parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
} catch {
  fail(`DIRECT_URL in ${ENV_FILE} is not a valid URL.`);
}

if (NON_PRODUCTION_HOSTS.some((h) => host.startsWith(h))) {
  fail(
    `refusing to run against ${host} — this host is recorded as NOT production.\n` +
      `  This is the exact substitution this config exists to prevent.\n` +
      `  Production is the trading-alerts project's Postgres service; take its\n` +
      `  DATABASE_PUBLIC_URL from the Railway dashboard.\n` +
      `  If this host has genuinely become production, verify it in the dashboard\n` +
      `  first, then remove it from NON_PRODUCTION_HOSTS in this file.`
  );
}

console.log(`\n[prisma.production.config.ts] target database: ${host}`);
console.log(`[prisma.production.config.ts] env file:         ${ENV_FILE}\n`);

export default defineConfig({
  schema: 'prisma/non-market-data/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // No `seed` entry, deliberately. Seeding production is never part of this
    // flow, and leaving it undefined means `prisma db seed` cannot be run
    // against production by muscle memory with this config.
  },
  datasource: {
    url: env('DIRECT_URL'),
  },
});
