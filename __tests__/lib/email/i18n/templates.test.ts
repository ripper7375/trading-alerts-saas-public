/**
 * @jest-environment node
 */
/**
 * Every live e-mail, built in every one of the 19 locales. The catalog tests
 * hold the texts; these hold what the builders do with them: nothing left
 * unfilled, everything a person or a provider supplied escaped, the document
 * stamped with its language and direction, and the user's own date, time and
 * money formats applied.
 */
import {
  EMAIL_LANGUAGES,
  type EmailLanguage,
  type EmailLocale,
} from '@/lib/email/i18n/languages';
import {
  buildAccountDeletionEmail,
  buildAffiliateCommissionEmail,
  buildAffiliateWelcomeEmail,
  buildCancellationEmail,
  buildNewDeviceLoginEmail,
  buildPasswordChangedEmail,
  buildPasswordResetEmail,
  buildPaymentFailedEmail,
  buildPaymentReceiptEmail,
  buildSubscriptionCanceledEmail,
  buildSubscriptionConfirmationEmail,
  buildTwoFactorDisabledEmail,
  buildTwoFactorEnabledEmail,
  buildVerificationEmail,
  buildWelcomeEmail,
  type BuiltEmail,
} from '@/lib/email/i18n/templates';

const when = new Date('2026-10-23T09:30:00.000Z');

const details = {
  device: 'Desktop',
  browser: 'Chrome 130',
  os: 'Windows 11',
  location: 'Bangkok, Bangkok, Thailand',
  ipAddress: '203.0.113.7',
  timestamp: when,
};

const BUILDERS: Record<string, (locale: EmailLocale) => BuiltEmail> = {
  welcome: (l) => buildWelcomeEmail(l, { name: 'Ada' }),
  affiliateWelcome: (l) =>
    buildAffiliateWelcomeEmail(l, { name: 'Ada', codesDistributed: 12 }),
  verification: (l) =>
    buildVerificationEmail(l, {
      name: 'Ada',
      verificationUrl: 'https://app.test/verify-email?token=abc',
    }),
  passwordReset: (l) =>
    buildPasswordResetEmail(l, {
      name: 'Ada',
      resetUrl: 'https://app.test/reset-password?token=abc',
    }),
  accountDeletion: (l) =>
    buildAccountDeletionEmail(l, {
      name: 'Ada',
      confirmationUrl: 'https://app.test/delete/confirm?token=abc',
      cancelUrl: 'https://app.test/delete/cancel?token=abc',
      expiresAt: when,
    }),
  newDevice: (l) => buildNewDeviceLoginEmail(l, { name: 'Ada', details }),
  passwordChanged: (l) =>
    buildPasswordChangedEmail(l, {
      name: 'Ada',
      ipAddress: '203.0.113.7',
      location: 'Bangkok, Thailand',
      timestamp: when,
    }),
  twoFactorEnabled: (l) =>
    buildTwoFactorEnabledEmail(l, {
      name: 'Ada',
      ipAddress: '203.0.113.7',
      location: 'Bangkok, Thailand',
      timestamp: when,
    }),
  twoFactorDisabled: (l) =>
    buildTwoFactorDisabledEmail(l, {
      name: 'Ada',
      ipAddress: '203.0.113.7',
      location: 'Bangkok, Thailand',
      timestamp: when,
    }),
  subscriptionPro: (l) =>
    buildSubscriptionConfirmationEmail(l, {
      name: 'Ada',
      plan: 'PRO',
      billingPeriod: 'monthly',
      priceUsd: 35,
    }),
  subscriptionProThreeDay: (l) =>
    buildSubscriptionConfirmationEmail(l, {
      name: 'Ada',
      plan: 'PRO',
      billingPeriod: 'three_day',
      priceUsd: 1.99,
    }),
  subscriptionFree: (l) =>
    buildSubscriptionConfirmationEmail(l, {
      name: 'Ada',
      plan: 'FREE',
      billingPeriod: 'monthly',
      priceUsd: 35,
    }),
  cancellation: (l) => buildCancellationEmail(l, { name: 'Ada' }),
  paymentFailed: (l) =>
    buildPaymentFailedEmail(l, {
      name: 'Ada',
      reason: 'Your card was declined.',
      price: 35,
      billingPeriod: 'monthly',
    }),
  paymentFailedThreeDay: (l) =>
    buildPaymentFailedEmail(l, {
      name: 'Ada',
      reason: 'Your card was declined.',
      price: 1.99,
      billingPeriod: 'three_day',
    }),
  paymentReceipt: (l) =>
    buildPaymentReceiptEmail(l, {
      name: 'Ada',
      amount: 35,
      nextBillingDate: when,
      invoiceUrl: 'https://pay.test/invoice.pdf',
    }),
  subscriptionCanceled: (l) =>
    buildSubscriptionCanceledEmail(l, {
      name: 'Ada',
      plan: 'PRO',
      cancelAt: when,
    }),
  affiliateCommission: (l) =>
    buildAffiliateCommissionEmail(l, {
      name: 'Ada',
      code: 'ADA20',
      commissionAmount: 7,
      totalEarnings: 70.5,
      commissionPercent: 20,
    }),
};

const builderNames = Object.keys(BUILDERS);

describe.each([...EMAIL_LANGUAGES])('%s', (language) => {
  const locale: EmailLocale = { language };

  it.each(builderNames)('builds %s with nothing left unfilled', (name) => {
    const email = (BUILDERS[name] as (l: EmailLocale) => BuiltEmail)(locale);
    for (const part of [email.subject, email.html, email.text]) {
      expect(part).not.toMatch(/\{\w+\}/);
      expect(part).not.toContain('**');
      expect(part).not.toContain('undefined');
      expect(part).not.toContain('[object Object]');
    }
    expect(email.subject.trim()).not.toBe('');
    expect(email.text.trim()).not.toBe('');
    // the text part carries no markup
    expect(email.text).not.toMatch(/<\/?[a-z][^>]*>/i);
  });

  it('stamps the document with its language, and right-to-left only where it reads that way', () => {
    const { html } = BUILDERS['verification']!(locale);
    expect(html).toContain(`<html lang="${language}"`);
    const rtl = language === 'ar' || language === 'ur';
    expect(html.includes('dir="rtl"')).toBe(rtl);
  });
});

describe("the reader's language reaches the message", () => {
  it('writes the sign-in alert in Thai', () => {
    const email = BUILDERS['newDevice']!({ language: 'th' });
    expect(email.subject).toBe(
      'การแจ้งเตือนความปลอดภัย: ตรวจพบการเข้าสู่ระบบจากอุปกรณ์ใหม่'
    );
    expect(email.html).toContain('ตรวจพบการเข้าสู่ระบบจากอุปกรณ์ใหม่');
    expect(email.html).toContain('คอมพิวเตอร์ตั้งโต๊ะ'); // "Desktop"
    expect(email.html).not.toContain('New Device Login Detected');
  });

  it('writes the account-deletion mail in Spanish, with both links', () => {
    const email = BUILDERS['accountDeletion']!({ language: 'es' });
    expect(email.subject).toBe(
      'Confirma la eliminación de tu cuenta - Trading Alerts'
    );
    expect(email.html).toContain('Confirmar eliminación de la cuenta');
    expect(email.html).toContain('Cancelar la solicitud de eliminación');
    expect(email.html).toContain(
      'href="https://app.test/delete/confirm?token=abc"'
    );
    expect(email.html).toContain(
      'href="https://app.test/delete/cancel?token=abc"'
    );
    expect(email.html).not.toContain('Confirm Account Deletion');
  });

  it('keeps English exactly as it was for a reader with no preferences', () => {
    const email = BUILDERS['verification']!({ language: 'en-US' });
    expect(email.subject).toBe('Verify Your Email - Trading Alerts');
    expect(email.html).toContain('Verify Your Email Address');
    expect(email.html).toContain('This link will expire in 24 hours.');
  });

  it('translates the "User" the callers pass for an account without a name', () => {
    const named = buildWelcomeEmail({ language: 'de' }, { name: 'Ada' });
    const anonymous = buildWelcomeEmail({ language: 'de' }, { name: 'User' });
    const missing = buildWelcomeEmail({ language: 'de' }, { name: null });
    expect(named.html).toContain('Willkommen bei Trading Alerts, Ada!');
    expect(anonymous.html).toContain('Willkommen bei Trading Alerts, Nutzer!');
    expect(missing.html).toContain('Nutzer!');
  });

  it("puts right-to-left readers' tables and lists on the right side", () => {
    const arabic = BUILDERS['newDevice']!({ language: 'ar' }).html;
    expect(arabic).toContain('dir="rtl"');
    expect(arabic).toContain('padding-right: 20px');
    expect(arabic).toContain('text-align: left');
    const english = BUILDERS['newDevice']!({ language: 'en-US' }).html;
    expect(english).toContain('padding-left: 20px');
    expect(english).toContain('text-align: right');
  });

  it('isolates Latin and numeric values in a right-to-left message, and only there', () => {
    const arabic = buildNewDeviceLoginEmail(
      {
        language: 'ar',
        timezone: 'Asia/Dubai',
        dateFormat: 'DMY',
        timeFormat: '12h',
      },
      { name: 'Ali', details }
    ).html;
    // the time keeps its own order instead of being reflowed by the sentence
    expect(arabic).toContain('<bdi>23/10/2026 1:30 PM GST</bdi>');
    expect(arabic).toContain('<bdi>203.0.113.7</bdi>');
    expect(arabic).toContain('مرحبًا <bdi>Ali</bdi>');
    // ...and left-to-right output is untouched
    for (const language of ['en-US', 'th', 'de', 'ja'] as const) {
      expect(BUILDERS['newDevice']!({ language }).html).not.toContain('<bdi>');
    }
  });

  it('isolates the expiry date inside the Urdu deletion sentence', () => {
    const { html } = BUILDERS['accountDeletion']!({ language: 'ur' });
    expect(html).toMatch(/<bdi>[^<]*2026[^<]*<\/bdi>/);
  });
});

describe("the reader's formats reach the message", () => {
  const thai: EmailLocale = {
    language: 'th',
    timezone: 'Asia/Bangkok',
    dateFormat: 'DMY',
    timeFormat: '24h',
  };

  it("shows the sign-in time in the reader's timezone, date format and clock", () => {
    const { html } = buildNewDeviceLoginEmail(thai, { name: 'Ada', details });
    expect(html).toContain('23/10/2026 16:30 GMT+7');
  });

  it('shows the deletion link expiry the same way', () => {
    const { html } = buildAccountDeletionEmail(
      {
        language: 'en-US',
        timezone: 'America/New_York',
        dateFormat: 'MDY',
        timeFormat: '12h',
      },
      {
        name: 'Ada',
        confirmationUrl: 'https://a.test/c',
        cancelUrl: 'https://a.test/x',
        expiresAt: when,
      }
    );
    expect(html).toContain('10/23/2026 5:30 AM');
  });

  it("writes the receipt amount and dates in the reader's formats, still in USD", () => {
    const german = buildPaymentReceiptEmail(
      {
        language: 'de',
        timezone: 'Europe/Berlin',
        dateFormat: 'DMY',
        timeFormat: '24h',
      },
      { name: 'Ada', amount: 35, nextBillingDate: when, paidAt: when }
    );
    expect(german.html).toMatch(/35,00\s?\$/);
    expect(german.html).toContain('23/10/2026');
    const english = buildPaymentReceiptEmail(
      { language: 'en-US' },
      { name: 'Ada', amount: 35, nextBillingDate: when, paidAt: when }
    );
    expect(english.html).toContain('$35.00');
    expect(english.html).toContain('October 23, 2026');
  });

  it("prices the subscription per period in the reader's number format", () => {
    const pro = (
      language: EmailLanguage,
      billingPeriod: 'monthly' | 'yearly'
    ): string =>
      buildSubscriptionConfirmationEmail(
        { language },
        {
          name: 'Ada',
          plan: 'PRO',
          billingPeriod,
          priceUsd: billingPeriod === 'yearly' ? 350 : 35,
        }
      ).html;
    expect(pro('en-US', 'monthly')).toContain('$35/month');
    expect(pro('en-US', 'yearly')).toContain('$350/year');
    expect(pro('de', 'monthly')).toMatch(/35\s?\$\/Monat/);
    expect(pro('fr', 'yearly')).toMatch(/350[\s  ]?\$US\/an/);
  });

  it('prices the 3-day plan per 3 days, in every locale', () => {
    const billing = (language: EmailLanguage): string =>
      buildSubscriptionConfirmationEmail(
        { language },
        { name: 'Ada', plan: 'PRO', billingPeriod: 'three_day', priceUsd: 1.99 }
      ).html;
    expect(billing('en-US')).toContain('$1.99/3 days');
    expect(billing('en-GB')).toContain('$1.99/3 days');
    expect(billing('de')).toMatch(/1,99\s?\$\/3 Tage/);
    expect(billing('ja')).toContain('／3日');
    expect(billing('ko')).toContain('3일 US$1.99');
    for (const language of EMAIL_LANGUAGES) {
      expect(billing(language)).not.toContain('{price}');
    }
    const failed = buildPaymentFailedEmail(
      { language: 'en-US' },
      {
        name: 'Ada',
        reason: 'Declined',
        price: 1.99,
        billingPeriod: 'three_day',
      }
    );
    expect(failed.html).toContain('$1.99/3 days');
    expect(failed.html).not.toContain('/month');
  });

  it('leaves the free-trial notice out of the 3-day plan, which is charged at checkout', () => {
    const trialNotice = 'color: #22c55e; font-weight: 600;';
    const build = (
      language: EmailLanguage,
      billingPeriod: 'monthly' | 'yearly' | 'three_day'
    ): string =>
      buildSubscriptionConfirmationEmail(
        { language },
        { name: 'Ada', plan: 'PRO', billingPeriod, priceUsd: 35 }
      ).html;
    for (const language of EMAIL_LANGUAGES) {
      expect(build(language, 'monthly')).toContain(trialNotice);
      expect(build(language, 'yearly')).toContain(trialNotice);
      expect(build(language, 'three_day')).not.toContain(trialNotice);
    }
    expect(build('en-US', 'three_day')).not.toContain('7-Day Free Trial');
  });

  it('leaves the commission rate out when it is not known, instead of guessing', () => {
    const base = {
      name: 'Ada',
      code: 'ADA20',
      commissionAmount: 7,
      totalEarnings: 70,
    };
    const known = buildAffiliateCommissionEmail(
      { language: 'en-US' },
      { ...base, commissionPercent: 25 }
    );
    const unknown = buildAffiliateCommissionEmail({ language: 'en-US' }, base);
    expect(known.html).toContain('25% of subscription revenue');
    expect(unknown.html).not.toContain('Commission Rate');
    expect(unknown.html).not.toContain('20%');
  });
});

describe('what a person or a provider supplied is escaped', () => {
  const hostile = '<img src=x onerror="alert(1)">';

  it.each([
    [
      'welcome name',
      () => buildWelcomeEmail({ language: 'en-US' }, { name: hostile }),
    ],
    [
      'verification name',
      () =>
        buildVerificationEmail(
          { language: 'en-US' },
          { name: hostile, verificationUrl: 'https://a.test/?a=1&b="2"' }
        ),
    ],
    [
      'deletion links',
      () =>
        buildAccountDeletionEmail(
          { language: 'en-US' },
          {
            name: hostile,
            confirmationUrl: 'https://a.test/?a=1&b="2"',
            cancelUrl: 'https://a.test/c',
            expiresAt: when,
          }
        ),
    ],
    [
      'sign-in details',
      () =>
        buildNewDeviceLoginEmail(
          { language: 'en-US' },
          {
            name: 'Ada',
            details: {
              ...details,
              browser: hostile,
              os: hostile,
              location: hostile,
              ipAddress: hostile,
            },
          }
        ),
    ],
    [
      'payment reason',
      () =>
        buildPaymentFailedEmail(
          { language: 'en-US' },
          { name: 'Ada', reason: hostile, price: 35 }
        ),
    ],
    [
      'affiliate code',
      () =>
        buildAffiliateCommissionEmail(
          { language: 'en-US' },
          { name: 'Ada', code: hostile, commissionAmount: 1, totalEarnings: 1 }
        ),
    ],
  ])('%s', (_label, build) => {
    const { html } = build();
    expect(html).not.toContain('<img');
    expect(html).not.toContain('onerror="');
  });

  it("escapes a link's quotes and ampersands in the href", () => {
    const { html } = buildVerificationEmail(
      { language: 'en-US' },
      { name: 'Ada', verificationUrl: 'https://a.test/?a=1&b="2"' }
    );
    expect(html).toContain('href="https://a.test/?a=1&amp;b=&quot;2&quot;"');
  });
});

describe('values that arrive in English from the sender', () => {
  it('translates the device type and unknown places, and leaves proper names alone', () => {
    const { html } = buildNewDeviceLoginEmail(
      { language: 'es' },
      {
        name: 'Ada',
        details: {
          ...details,
          device: 'Mobile',
          location: 'Unknown, Unknown, Thailand',
          ipAddress: 'Unknown',
        },
      }
    );
    expect(html).toContain('Móvil');
    expect(html).toContain('Desconocido, Desconocido, Thailand');
    expect(html).toContain('Chrome 130');
    expect(html).toContain('Windows 11');
  });

  it('translates the "Unknown location" the password routes pass', () => {
    const { html } = buildPasswordChangedEmail(
      { language: 'fr' },
      {
        name: 'Ada',
        ipAddress: 'Unknown',
        location: 'Unknown location',
        timestamp: when,
      }
    );
    expect(html).toContain('Lieu inconnu');
    expect(html).toContain('Inconnu');
  });
});

describe('the plain-text part', () => {
  it('keeps the links and the figures, without markup or entities', () => {
    const { text } = BUILDERS['accountDeletion']!({ language: 'en-US' });
    expect(text).toContain(
      'Confirm Account Deletion (https://app.test/delete/confirm?token=abc)'
    );
    expect(text).toContain(
      'Cancel Deletion Request (https://app.test/delete/cancel?token=abc)'
    );
    expect(text).not.toContain('&amp;');
    const receipt = BUILDERS['paymentReceipt']!({ language: 'en-US' }).text;
    expect(receipt).toContain('Amount $35.00');
  });
});
