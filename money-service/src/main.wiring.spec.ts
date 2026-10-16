import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * main.ts bootstraps the whole app on import, so its shutdown wiring is
 * pinned by reading the source (Remediation Tier 1 §5.6). The behaviour the
 * options buy is proven in prisma/prisma.shutdown.spec.ts.
 */
describe('main.ts wiring', () => {
  const source = readFileSync(join(__dirname, 'main.ts'), 'utf8');

  it('ends shutdown with process.exit(0) instead of re-sending the signal', () => {
    expect(source).toMatch(
      /app\.enableShutdownHooks\(\s*undefined,\s*\{\s*useProcessExit:\s*true\s*\}\s*\)/
    );
  });

  it('does not call enableShutdownHooks() with its defaults anywhere', () => {
    expect(source).not.toMatch(/enableShutdownHooks\(\s*\)/);
  });
});
