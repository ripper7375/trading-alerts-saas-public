/**
 * @jest-environment node
 */

/**
 * The scenarios of the quota ledger (build step 7 part 6) against the in-memory MODEL of its two
 * tables: the state machine RESERVED -> SETTLED | RELEASED | EXPIRED (and EXPIRED -> SETTLED), the
 * arithmetic of the period, idempotent settlement, a late settlement, the month boundary, and the
 * races (which the model, being single-threaded, can only run one after the other).
 *
 * The same scenarios run against a REAL PostgreSQL in `__tests__/reply/ledger.pg.spec.ts`; the model
 * answers only the exact statements the store sends, so it cannot drift from the store silently.
 */

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));

import { LedgerModel } from '../helpers/ledger-model';
import { SCENARIOS, type ScenarioEnv } from '../helpers/ledger-scenarios';

function envOf(model: LedgerModel): ScenarioEnv {
  let n = 0;
  return {
    client: model,
    newUser: async () => model.addUser(`user-${(n += 1)}`),
    deleteUser: async (id) => model.deleteUser(id),
    countRows: async (id) => ({
      periods: [...model.periods.values()].filter((p) => p.user_id === id)
        .length,
      reservations: [...model.reservations.values()].filter(
        (r) => r.user_id === id
      ).length,
    }),
  };
}

describe('the ledger, on its model', () => {
  it('has a scenario for every state change of the design', () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(25);
    const names = SCENARIOS.map((s) => s.name).join('\n');
    for (const needle of [
      'reserve, then settle',
      'reserve, then release',
      'reserve, then expire',
      'settle after expiry',
      'double submit',
      'month rollover',
      'eight requests race for the last units',
    ]) {
      expect(names).toContain(needle);
    }
  });

  it('gives every scenario a name of its own', () => {
    const names = SCENARIOS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(SCENARIOS.map((s) => [s.name, s] as const))('%s', async (_n, s) => {
    const model = new LedgerModel();
    await s.run(envOf(model));
  });
});
