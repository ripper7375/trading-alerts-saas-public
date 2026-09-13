/**
 * /pro/currency-index/compare -- page-level PRO gate.
 */
// 'jest' deliberately not imported from @jest/globals (hoisted factories).
jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/db/prisma', () => ({
  prisma: { user: { findUnique: jest.fn() } },
}));
jest.mock(
  '@/components/currency-index-comparison/currency-index-comparison-workspace',
  () => ({ CurrencyIndexComparisonWorkspace: () => null })
);

import { describe, it, expect, beforeEach } from '@jest/globals';
import { getServerSession } from 'next-auth';

import { prisma } from '@/lib/db/prisma';
import CurrencyIndexComparePage from '@/app/pro/currency-index/compare/page';

const getServerSessionMock = getServerSession as unknown as jest.Mock;
const findUniqueUser = prisma.user.findUnique as unknown as jest.Mock;

describe('/pro/currency-index/compare', () => {
  beforeEach(() => {
    getServerSessionMock.mockReset();
    findUniqueUser.mockReset();
  });

  it('sends a signed-out visitor to sign in', async () => {
    getServerSessionMock.mockResolvedValue(null);
    await expect(CurrencyIndexComparePage()).rejects.toThrow(
      'REDIRECT:/login?callbackUrl=%2Fpro%2Fcurrency-index%2Fcompare'
    );
  });

  it('sends a genuine FREE user to /pricing', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', tier: 'FREE' },
    });
    findUniqueUser.mockResolvedValue({ tier: 'FREE' });
    await expect(CurrencyIndexComparePage()).rejects.toThrow(
      'REDIRECT:/pricing'
    );
  });

  it('lets in a user whose JWT still says FREE but the database says PRO (just upgraded)', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', tier: 'FREE' },
    });
    findUniqueUser.mockResolvedValue({ tier: 'PRO' });
    await expect(CurrencyIndexComparePage()).resolves.toBeTruthy();
  });

  it('lets in a PRO user without a database round trip', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', tier: 'PRO' } });
    await expect(CurrencyIndexComparePage()).resolves.toBeTruthy();
    expect(findUniqueUser).not.toHaveBeenCalled();
  });
});
