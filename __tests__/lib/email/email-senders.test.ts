/**
 * @jest-environment node
 */
/**
 * The senders in `lib/email/email.ts` and `lib/email/subscription-emails.ts`
 * write to the recipient in the recipient's own language and formats, find
 * that language themselves, and still send when they cannot.
 */
const mockSend = jest.fn();
jest.mock('resend', () => ({
  Resend: class {
    emails = { send: (...args: unknown[]) => mockSend(...args) };
  },
}));

const mockLocaleFor = jest.fn();
jest.mock('@/lib/email/recipient-locale', () => ({
  emailLocaleForRecipient: (...args: unknown[]) => mockLocaleFor(...args),
}));

process.env['RESEND_API_KEY'] = 'test-key';

import {
  sendNewDeviceLoginEmail,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendSubscriptionConfirmationEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
} from '@/lib/email/email';
import {
  sendAffiliateCommissionEmail,
  sendPaymentReceiptEmail,
  sendPlanSwitchScheduledEmail,
  sendSubscriptionCanceledEmail,
  sendSubscriptionResumedEmail,
  sendSubscriptionUpgradedEmail,
} from '@/lib/email/subscription-emails';

const thai = {
  language: 'th' as const,
  timezone: 'Asia/Bangkok',
  dateFormat: 'DMY' as const,
  timeFormat: '24h' as const,
};

const sent = (): { to: string; subject: string; html: string } =>
  mockSend.mock.calls[0]?.[0];

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  mockSend.mockResolvedValue({ data: { id: 'msg-1' }, error: null });
  mockLocaleFor.mockResolvedValue({ language: 'en-US' });
});

describe("a sender finds the recipient's language itself", () => {
  it.each([
    ['verification', () => sendVerificationEmail('a@b.test', 'Ada', 'tok')],
    ['password reset', () => sendPasswordResetEmail('a@b.test', 'Ada', 'tok')],
    ['welcome', () => sendWelcomeEmail('a@b.test', 'Ada')],
    [
      'password changed',
      () => sendPasswordChangedEmail('a@b.test', 'Ada', '1.2.3.4', 'Bangkok'),
    ],
    [
      'subscription confirmed',
      () =>
        sendSubscriptionConfirmationEmail(
          'a@b.test',
          'Ada',
          'PRO',
          'monthly',
          35
        ),
    ],
    [
      'payment receipt',
      () => sendPaymentReceiptEmail('a@b.test', 'Ada', 35, new Date()),
    ],
    [
      'commission',
      () => sendAffiliateCommissionEmail('a@b.test', 'Ada', 'X', 1, 2),
    ],
    [
      'cancel scheduled (S2)',
      () => sendSubscriptionCanceledEmail('a@b.test', 'Ada', 'PRO', new Date()),
    ],
    [
      'subscription resumed (S2)',
      () => sendSubscriptionResumedEmail('a@b.test', 'Ada', 'PRO', new Date()),
    ],
    [
      'upgraded to yearly (S3)',
      () =>
        sendSubscriptionUpgradedEmail(
          'a@b.test',
          'Ada',
          'PRO',
          270.35,
          290,
          new Date(),
          false
        ),
    ],
    [
      'switch to monthly scheduled (S3)',
      () =>
        sendPlanSwitchScheduledEmail('a@b.test', 'Ada', 'PRO', new Date(), 29),
    ],
  ])('%s', async (_label, send) => {
    mockLocaleFor.mockResolvedValue(thai);
    await send();
    expect(mockLocaleFor).toHaveBeenCalledWith('a@b.test');
    expect(sent().to).toBe('a@b.test');
    expect(sent().html).toContain('<html lang="th">');
    expect(sent().subject).not.toMatch(/^[\x20-\x7e]+$/); // not plain ASCII English
  });

  it('writes the verification mail in Thai', async () => {
    mockLocaleFor.mockResolvedValue(thai);
    await sendVerificationEmail('a@b.test', 'Ada', 'tok');
    expect(sent().subject).toBe('ยืนยันอีเมลของคุณ - Trading Alerts');
    expect(sent().html).toContain('ยืนยันที่อยู่อีเมลของคุณ');
    expect(sent().html).toContain('/verify-email?token=tok');
  });

  it("shows the sign-in time in the recipient's timezone and formats", async () => {
    mockLocaleFor.mockResolvedValue(thai);
    await sendNewDeviceLoginEmail('a@b.test', 'Ada', {
      device: 'Desktop',
      browser: 'Chrome',
      os: 'Windows',
      location: 'Bangkok, Thailand',
      ipAddress: '1.2.3.4',
      timestamp: new Date('2026-10-23T09:30:00.000Z'),
    });
    expect(sent().html).toContain('23/10/2026 16:30 GMT+7');
  });
});

describe('the resume mail (Manage Subscription S2, W4)', () => {
  it("names the renewal date in the recipient's timezone and format, and links to billing", async () => {
    mockLocaleFor.mockResolvedValue(thai);
    await sendSubscriptionResumedEmail(
      'a@b.test',
      'Ada',
      'PRO',
      new Date('2026-10-23T20:30:00.000Z')
    );
    // 20:30 UTC is already the 24th in Bangkok.
    expect(sent().html).toContain('24/10/2026');
    expect(sent().html).toContain('/settings/billing');
  });

  it('is sent in English, with the renewal date, when the language cannot be found', async () => {
    mockLocaleFor.mockRejectedValue(new Error('db down'));
    const result = await sendSubscriptionResumedEmail(
      'a@b.test',
      'Ada',
      'PRO',
      new Date('2026-10-23T09:30:00.000Z')
    );
    expect(result.success).toBe(true);
    expect(sent().subject).toBe(
      'Your PRO subscription will continue - Trading Alerts'
    );
    expect(sent().html).toContain('October 23, 2026');
  });
});

describe('the plan-change mails (Manage Subscription S3, W5a/W5b)', () => {
  it("the upgrade mail names what was charged and the next billing date in the recipient's timezone and format, and links to billing", async () => {
    mockLocaleFor.mockResolvedValue(thai);
    await sendSubscriptionUpgradedEmail(
      'a@b.test',
      'Ada',
      'PRO',
      270.35,
      290,
      new Date('2027-10-23T20:30:00.000Z'),
      false
    );
    // 20:30 UTC is already the 24th in Bangkok.
    expect(sent().html).toContain('24/10/2027');
    expect(sent().html).toContain('270.35');
    expect(sent().html).toContain('/settings/billing');
  });

  it('the free-trial upgrade mail says the first charge date, not a next billing date', async () => {
    await sendSubscriptionUpgradedEmail(
      'a@b.test',
      'Ada',
      'PRO',
      0,
      290,
      new Date('2026-10-28T09:30:00.000Z'),
      true
    );
    expect(sent().html).toContain('First charge:');
    expect(sent().html).toContain('October 28, 2026');
    expect(sent().html).toContain('$0.00');
    expect(sent().html).not.toContain('Next billing date');
  });

  it("the switch mail names the switch date in the recipient's timezone and format and the monthly price", async () => {
    mockLocaleFor.mockResolvedValue(thai);
    await sendPlanSwitchScheduledEmail(
      'a@b.test',
      'Ada',
      'PRO',
      new Date('2027-10-23T20:30:00.000Z'),
      29
    );
    expect(sent().html).toContain('24/10/2027');
    expect(sent().html).toContain('29.00');
    expect(sent().html).toContain('/settings/billing');
  });

  it('both are sent in English when the language cannot be found', async () => {
    mockLocaleFor.mockRejectedValue(new Error('db down'));
    const upgraded = await sendSubscriptionUpgradedEmail(
      'a@b.test',
      'Ada',
      'PRO',
      270.35,
      290,
      new Date('2027-10-23T09:30:00.000Z'),
      false
    );
    expect(upgraded.success).toBe(true);
    expect(sent().subject).toBe(
      'You are now on yearly billing - Trading Alerts'
    );

    mockSend.mockClear();
    const switched = await sendPlanSwitchScheduledEmail(
      'a@b.test',
      'Ada',
      'PRO',
      new Date('2027-10-23T09:30:00.000Z'),
      29
    );
    expect(switched.success).toBe(true);
    expect(sent().subject).toBe(
      'Your switch to monthly billing is scheduled - Trading Alerts'
    );
  });

  it('uses an explicit locale as given, with no lookup', async () => {
    await sendPlanSwitchScheduledEmail(
      'a@b.test',
      'Ada',
      'PRO',
      new Date('2027-10-23T09:30:00.000Z'),
      29,
      { language: 'de' }
    );
    expect(mockLocaleFor).not.toHaveBeenCalled();
    expect(sent().subject).toBe(
      'Ihre Umstellung auf monatliche Abrechnung ist geplant - Trading Alerts'
    );
  });
});

describe('an explicit locale', () => {
  it('is used as given, with no lookup', async () => {
    await sendWelcomeEmail('a@b.test', 'Ada', { language: 'de' });
    expect(mockLocaleFor).not.toHaveBeenCalled();
    expect(sent().subject).toBe('Willkommen bei Trading Alerts!');
  });
});

describe('when the language cannot be found', () => {
  it('sends in English instead of not sending', async () => {
    mockLocaleFor.mockRejectedValue(new Error('db down'));
    const result = await sendWelcomeEmail('a@b.test', 'Ada');
    expect(result.success).toBe(true);
    expect(sent().subject).toBe('Welcome to Trading Alerts!');
  });
});

describe('the commission rate', () => {
  it('is the one passed in, never a fixed 20%', async () => {
    await sendAffiliateCommissionEmail(
      'a@b.test',
      'Ada',
      'X',
      1,
      2,
      undefined,
      25
    );
    expect(sent().html).toContain('25% of subscription revenue');
    expect(sent().html).not.toContain('20%');
  });
});
