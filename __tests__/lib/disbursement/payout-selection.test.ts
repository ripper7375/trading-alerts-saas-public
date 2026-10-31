/**
 * MAX_PAYOUT_SELECTION is a copy of the hard ceiling of the maxBatchSize setting (the routes use it
 * to refuse an oversized selection before it is parsed). This keeps the two from drifting apart.
 */
import { MAX_PAYOUT_SELECTION } from '@/lib/disbursement/constants';
import { DISBURSEMENT_SETTING_DEFINITIONS } from '@/lib/disbursement/settings';

describe('MAX_PAYOUT_SELECTION', () => {
  it('equals the ceiling of the maxBatchSize setting', () => {
    expect(MAX_PAYOUT_SELECTION).toBe(
      DISBURSEMENT_SETTING_DEFINITIONS.maxBatchSize.max
    );
  });
});
