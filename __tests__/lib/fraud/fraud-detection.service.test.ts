/**
 * @jest-environment node
 */
/**
 * Guard: the fraud alert service is server-only and exposes only the four
 * admin functions.
 *
 * It used to start with a top-level 'use server' directive, which makes every
 * exported async function a Server Action. The module does no authorization of
 * its own (the admin routes call requireAdmin() first), so it must stay
 * 'server-only' and must not grow unauthenticated exports again.
 */
import fs from 'fs';
import path from 'path';

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));

const SERVICE_PATH = path.join(
  process.cwd(),
  'lib/fraud/fraud-detection.service.ts'
);

describe('lib/fraud/fraud-detection.service', () => {
  it("is imported with 'server-only', not marked 'use server'", () => {
    const source = fs.readFileSync(SERVICE_PATH, 'utf8');

    expect(source).not.toMatch(/^\s*['"]use server['"]/m);
    expect(source).toMatch(/^import 'server-only';/m);
  });

  it('exports only the four admin functions', async () => {
    const service = await import('@/lib/fraud/fraud-detection.service');

    expect(Object.keys(service).sort()).toEqual([
      'blockUserFromFraudAlert',
      'getFraudAlertStats',
      'getFraudAlerts',
      'updateFraudAlertStatus',
    ]);
  });
});
