import { Test } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AccountDeletionModule } from './account-deletion.module';
import { AccountDeletionScheduler } from './account-deletion.scheduler';
import { AccountDeletionWorker } from './account-deletion.worker';
import { BillingCanceller } from './billing-canceller';
import { StripeBillingCanceller } from './stripe-billing-canceller';

describe('AccountDeletionModule wiring', () => {
  async function compile() {
    // PrismaModule and RedisModule are @Global() in the app; stand-ins here.
    return Test.createTestingModule({ imports: [AccountDeletionModule] })
      .useMocker((token) => {
        if (token === PrismaService || token === RedisService) return {};
        return undefined;
      })
      .compile();
  }

  it('resolves the whole graph, with BillingCanceller bound to the Stripe adapter', async () => {
    const moduleRef = await compile();

    expect(moduleRef.get(BillingCanceller)).toBeInstanceOf(
      StripeBillingCanceller
    );
    expect(moduleRef.get(AccountDeletionWorker)).toBeInstanceOf(
      AccountDeletionWorker
    );
    expect(moduleRef.get(AccountDeletionScheduler)).toBeInstanceOf(
      AccountDeletionScheduler
    );
  });

  it('builds the scheduler switched off: constructing it starts nothing', async () => {
    const moduleRef = await compile();

    expect(moduleRef.get(AccountDeletionScheduler).isEnabled()).toBe(false);
  });
});
