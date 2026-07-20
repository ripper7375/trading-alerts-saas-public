import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 CLI no longer auto-loads .env or reads datasource url/directUrl
// from schema.prisma. Mirror Next.js's own .env precedence (.env.local
// overrides/supplements .env) since DIRECT_URL only lives in .env.local —
// a bare `import 'dotenv/config'` only loads .env and misses it.
config();
config({ path: '.env.local', override: true });

// Migrations/CLI operations use the DIRECT connection (not the
// PgBouncer-pooled one) per LESSONS-LEARNED.md L3 — runtime queries go
// through the pooled URL via the driver adapter in lib/db/prisma.ts instead.
// Session 2-4: prisma/schema.prisma retired — the split schemas
// (prisma/market-data/, prisma/non-market-data/) share this one migration
// history (LESSONS-LEARNED.md L24). `schema` here only matters as the
// default for bare `prisma migrate`/`studio` CLI invocations with no
// explicit --schema flag; non-market-data is the larger of the two and the
// one nearly every CLI operation actually concerns.
export default defineConfig({
  schema: 'prisma/non-market-data/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DIRECT_URL'),
  },
});
