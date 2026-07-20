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
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DIRECT_URL'),
  },
});
