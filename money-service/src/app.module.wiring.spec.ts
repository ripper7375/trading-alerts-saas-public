import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * app.module.ts cannot be built without Redis and a database, so its BullMQ
 * retention (Remediation Tier 2 §6.9) is pinned by reading the source, the way the
 * repository pins other wiring that boots the whole app.
 */
describe('app.module.ts wiring', () => {
  const source = readFileSync(join(__dirname, 'app.module.ts'), 'utf8');

  it('trims finished BullMQ jobs by default: 1,000 completed and 5,000 failed', () => {
    const forRoot = source.slice(source.indexOf('BullModule.forRoot('));
    const block = forRoot.slice(0, forRoot.indexOf('}),') + 3);

    expect(block).toMatch(
      /defaultJobOptions:\s*\{\s*removeOnComplete:\s*1000,\s*removeOnFail:\s*5000,?\s*\}/
    );
  });

  it('keeps the queue prefix next to it', () => {
    expect(source).toMatch(/prefix:\s*MONEY_QUEUE_PREFIX/);
  });
});
