import {
  getAccountDeletionEmail,
  getPasswordChangedEmail,
  getSubscriptionConfirmationEmail,
  sendAccountDeletionEmail,
  sendVerificationEmail,
} from './email.util';
import { setRecipientLocaleResolver } from './recipient-locale';
import {
  getAffiliateCommissionEmailTemplate,
  getPaymentFailedEmailTemplate,
  getPaymentReceiptEmailTemplate,
  getSubscriptionCanceledEmailTemplate,
} from './subscription-email.util';

const expiresAt = new Date('2026-10-23T09:30:00.000Z');

describe("operation-service e-mail is written in the reader's language", () => {
  afterEach(() => setRecipientLocaleResolver(null));

  it('keeps English exactly as it was when no locale is known', () => {
    const html = getAccountDeletionEmail(
      'Alice',
      'https://a.test/c',
      'https://a.test/x',
      expiresAt
    );
    expect(html).toContain('Confirm Your Account Deletion');
    expect(html).toContain('October 23, 2026');
    expect(html).toContain('UTC');
    expect(html).toContain('<html lang="en-US">');
  });

  it("writes the account-deletion mail in the locale it is given, with the reader's time", () => {
    const html = getAccountDeletionEmail(
      'Alice',
      'https://a.test/c',
      'https://a.test/x',
      expiresAt,
      {
        language: 'th',
        timezone: 'Asia/Bangkok',
        dateFormat: 'DMY',
        timeFormat: '24h',
      }
    );
    expect(html).toContain('ยืนยันการลบบัญชีของคุณ');
    expect(html).toContain('23/10/2026 16:30 GMT+7');
    expect(html).toContain('href="https://a.test/c"');
    expect(html).not.toContain('Confirm Your Account Deletion');
  });

  it('writes the arabic mail right-to-left', () => {
    const html = getPasswordChangedEmail('Ali', '1.2.3.4', 'Dubai', expiresAt, {
      language: 'ar',
    });
    expect(html).toContain('<html lang="ar" dir="rtl">');
  });

  it('prices the confirmation with the list price this port has always shown', () => {
    expect(getSubscriptionConfirmationEmail('Ada', 'PRO', 'monthly')).toContain(
      '$29/month'
    );
    expect(getSubscriptionConfirmationEmail('Ada', 'PRO', 'yearly')).toContain(
      '$290/year'
    );
    expect(
      getSubscriptionConfirmationEmail(
        'Ada',
        'PRO',
        'monthly',
        { language: 'en-US' },
        35
      )
    ).toContain('$35/month');
  });

  it("builds the billing templates in the reader's language, with a text part", () => {
    const de = { language: 'de' as const };
    const failed = getPaymentFailedEmailTemplate(
      'Ada',
      'Card declined',
      29,
      de
    );
    expect(failed.subject).toBe(
      'Zahlung fehlgeschlagen - Handeln erforderlich'
    );
    expect(failed.text).toContain('Grund: Card declined');

    const receipt = getPaymentReceiptEmailTemplate(
      'Ada',
      29,
      expiresAt,
      undefined,
      de
    );
    expect(receipt.subject).toBe('Zahlungsbeleg - Trading Alerts PRO');
    expect(receipt.html).toMatch(/29,00\s?\$/);

    const canceled = getSubscriptionCanceledEmailTemplate(
      'Ada',
      'PRO',
      expiresAt,
      de
    );
    expect(canceled.html).toContain('23. Oktober 2026');

    const commission = getAffiliateCommissionEmailTemplate(
      'Ada',
      'ADA20',
      10.5,
      105.75,
      de
    );
    // German writes a (non-breaking) space between the figure and the sign
    expect(commission.subject).toMatch(
      /^Provision verdient! 10,50\s\$ - Trading Alerts$/
    );
    // no rate is invented when the outbox event does not carry one
    expect(commission.html).not.toContain('Provisionssatz');
    expect(
      getAffiliateCommissionEmailTemplate('Ada', 'ADA20', 10.5, 105.75, de, 25)
        .html
    ).toContain('25 % der Abonnementeinnahmen');
  });
});

describe("the senders find the recipient's language through the registered resolver", () => {
  const originalKey = process.env['RESEND_API_KEY'];

  afterEach(() => {
    setRecipientLocaleResolver(null);
    if (originalKey === undefined) delete process.env['RESEND_API_KEY'];
    else process.env['RESEND_API_KEY'] = originalKey;
    jest.dontMock('resend');
  });

  function isolatedSender() {
    const send = jest
      .fn()
      .mockResolvedValue({ data: { id: 'msg-1' }, error: null });
    process.env['RESEND_API_KEY'] = 'test-key';
    let email: typeof import('./email.util') | undefined;
    let registry: typeof import('./recipient-locale') | undefined;
    jest.isolateModules(() => {
      jest.doMock('resend', () => ({
        Resend: jest.fn().mockImplementation(() => ({ emails: { send } })),
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      email = require('./email.util');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      registry = require('./recipient-locale');
    });
    return { send, email: email!, registry: registry! };
  }

  it('sends the verification mail in the resolved language', async () => {
    const { send, email, registry } = isolatedSender();
    registry.setRecipientLocaleResolver(async () => ({ language: 'es' }));

    await email.sendVerificationEmail('a@b.test', 'Ada', 'tok');

    const sent = send.mock.calls[0]?.[0] as { subject: string; html: string };
    expect(sent.subject).toBe(
      'Verifica tu correo electrónico - Trading Alerts'
    );
    expect(sent.html).toContain('Verifica tu dirección de correo electrónico');
    expect(sent.html).toContain('/verify-email?token=tok');
  });

  it('sends in English, and still sends, when nothing is registered', async () => {
    const { send, email } = isolatedSender();
    const result = await email.sendVerificationEmail('a@b.test', 'Ada', 'tok');
    expect(result).toEqual({ success: true, messageId: 'msg-1' });
    expect((send.mock.calls[0]?.[0] as { subject: string }).subject).toBe(
      'Verify Your Email - Trading Alerts'
    );
  });

  it('greets an account with no name by the localized word', async () => {
    const { send, email, registry } = isolatedSender();
    registry.setRecipientLocaleResolver(async () => ({ language: 'de' }));

    await email.sendAccountDeletionEmail(
      'a@b.test',
      null,
      'https://a.test/c',
      'https://a.test/x',
      expiresAt
    );

    expect((send.mock.calls[0]?.[0] as { html: string }).html).toContain(
      'Hallo Nutzer'
    );
  });
});

// The module-level senders imported at the top still work with no resolver.
describe('the senders imported directly', () => {
  it('are functions', () => {
    expect(typeof sendVerificationEmail).toBe('function');
    expect(typeof sendAccountDeletionEmail).toBe('function');
  });
});
