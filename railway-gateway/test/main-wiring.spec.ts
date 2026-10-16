import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * main.ts bootstraps the whole app on import, so its wiring is pinned by
 * reading the source (Remediation Tier 1 §5.6, approved by Davin 2026-10-16).
 * What the options do is proven in prisma-shutdown.spec.ts (shutdown order and
 * exit) and ingestion-throttle.e2e-spec.ts (per-address throttling).
 */
describe('main.ts wiring', () => {
  const source = readFileSync(join(__dirname, '..', 'src', 'main.ts'), 'utf8');

  it('creates a NestExpressApplication so app.set() is typed', () => {
    expect(source).toMatch(
      /NestFactory\.create<NestExpressApplication>\(AppModule\)/
    );
  });

  it("trusts exactly one proxy hop (Railway's edge)", () => {
    expect(source).toMatch(/app\.set\(\s*'trust proxy',\s*1\s*\)/);
  });

  it('drains on SIGTERM and ends the process with process.exit(0)', () => {
    expect(source).toMatch(
      /app\.enableShutdownHooks\(\s*undefined,\s*\{\s*useProcessExit:\s*true\s*\}\s*\)/
    );
  });
});
