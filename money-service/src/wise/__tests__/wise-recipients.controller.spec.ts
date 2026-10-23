/**
 * Wise Recipients Controller: the admin list (WS-9, CODE-06A).
 *
 * The admin list says which recipients are inside the 72-hour hold, so the
 * recipients page can flag them without knowing the length of the hold.
 */
import type { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock } from '../../test-utils/prisma-mock';
import { WiseRecipientsController } from '../wise-recipients.controller';
import type { WiseConfig } from '../wise.config';
import type { WiseRecipientService } from '../wise-recipient.service';

describe('WiseRecipientsController.list (admin)', () => {
  const NOW = new Date('2026-10-26T10:00:00.000Z');
  const HOUR = 60 * 60 * 1000;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let controller: WiseRecipientsController;

  const row = (id: string, detailsChangedAt: Date | null) => ({
    id,
    affiliateProfileId: `aff-${id}`,
    status: 'ACTIVE',
    detailsChangedAt,
  });

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    prismaMock = createPrismaMock();
    controller = new WiseRecipientsController(
      prismaMock as unknown as PrismaService,
      {} as unknown as WiseRecipientService,
      {} as unknown as WiseConfig
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('adds payoutHoldUntil to a recipient inside the hold, and null to the others', async () => {
    prismaMock.affiliateWiseRecipient.findMany.mockResolvedValue([
      row('held', new Date(NOW.getTime() - 10 * HOUR)),
      row('edge', new Date(NOW.getTime() - 72 * HOUR)),
      row('old', new Date(NOW.getTime() - 400 * HOUR)),
      row('never', null),
    ] as never);
    prismaMock.affiliateWiseRecipient.count.mockResolvedValue(4);

    const result = await controller.list({});

    const byId = Object.fromEntries(
      result.items.map((item) => [item.id, item.payoutHoldUntil])
    );
    expect(byId).toEqual({
      held: '2026-10-29T00:00:00.000Z',
      edge: null,
      old: null,
      never: null,
    });
  });

  it('keeps the list contract: the rows, the total and the paging', async () => {
    prismaMock.affiliateWiseRecipient.findMany.mockResolvedValue([
      row('one', null),
    ] as never);
    prismaMock.affiliateWiseRecipient.count.mockResolvedValue(51);

    const result = await controller.list({ page: '2', pageSize: '1' });

    expect(result.total).toBe(51);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: 'one',
      affiliateProfileId: 'aff-one',
      status: 'ACTIVE',
      detailsChangedAt: null,
    });
  });
});
