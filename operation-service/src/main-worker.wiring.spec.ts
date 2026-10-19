import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * main-worker.ts starts the alert worker on import, so its shutdown wiring is
 * pinned by reading the source, like main.wiring.spec.ts does for main.ts. The
 * behaviour the options buy is proven in prisma/prisma.shutdown.spec.ts.
 */
describe('main-worker.ts wiring', () => {
  const source = readFileSync(join(__dirname, 'main-worker.ts'), 'utf8');

  it('ends shutdown with process.exit(0) instead of re-sending the signal', () => {
    expect(source).toMatch(
      /app\.enableShutdownHooks\(\s*undefined,\s*\{\s*useProcessExit:\s*true\s*\}\s*\)/
    );
  });

  it('does not call enableShutdownHooks() with its defaults anywhere', () => {
    expect(source).not.toMatch(/enableShutdownHooks\(\s*\)/);
  });

  it('is an application context with no HTTP server (what makes process.exit safe)', () => {
    expect(source).toMatch(/NestFactory\.createApplicationContext\(/);
    expect(source).not.toMatch(/NestFactory\.create</);
    expect(source).not.toMatch(/\.listen\(/);
  });

  it('starts the account deletion worker (F21) here, and only here', () => {
    expect(source).toMatch(
      /app\.get\(AccountDeletionScheduler\)[\s\S]*\.enable\(\)/
    );
    expect(source).toMatch(/deletionScheduler\.enable\(\)/);
    const mainSource = readFileSync(join(__dirname, 'main.ts'), 'utf8');
    expect(mainSource).not.toMatch(/AccountDeletionScheduler/);
  });
});
