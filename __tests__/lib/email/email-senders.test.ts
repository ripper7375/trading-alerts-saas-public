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
