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
  buildPayoutDetailsChangedEmail,
  buildPlanSwitchScheduledEmail,
  buildSubscriptionCanceledEmail,
  buildSubscriptionConfirmationEmail,
  buildSubscriptionResumedEmail,
  buildSubscriptionUpgradedEmail,
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
  payoutDetailsChanged: (l) =>
    buildPayoutDetailsChangedEmail(l, {
      name: 'Ada',
      changedAt: when,
      holdUntil: new Date(when.getTime() + 72 * 60 * 60 * 1000),
      holdHours: 72,
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
  subscriptionResumed: (l) =>
    buildSubscriptionResumedEmail(l, {
      name: 'Ada',
      plan: 'PRO',
      nextBillingDate: when,
    }),
  subscriptionUpgraded: (l) =>
    buildSubscriptionUpgradedEmail(l, {
      name: 'Ada',
      plan: 'PRO',
      amountCharged: 270.35,
      yearlyPriceUsd: 290,
      nextBillingDate: when,
      inTrial: false,
    }),
  subscriptionUpgradedInTrial: (l) =>
    buildSubscriptionUpgradedEmail(l, {
      name: 'Ada',
      plan: 'PRO',
      amountCharged: 0,
      yearlyPriceUsd: 290,
      nextBillingDate: when,
      inTrial: true,
    }),
  planSwitchScheduled: (l) =>
    buildPlanSwitchScheduledEmail(l, {
      name: 'Ada',
      plan: 'PRO',
      effectiveDate: when,
      monthlyPriceUsd: 29,
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

describe('the payment-failed button (Manage Subscription B4)', () => {
  // It used to open /settings?tab=billing, which the settings hub ignores: the
  // reader landed on the hub, one more click from the page that holds
  // "Pay now" and "Update card".
  it.each([...EMAIL_LANGUAGES])(
    'opens the billing page itself, for the monthly and the 3-day plan, in %s',
    (language) => {
      for (const name of ['paymentFailed', 'paymentFailedThreeDay']) {
        const email = (BUILDERS[name] as (l: EmailLocale) => BuiltEmail)({
          language,
        });
        expect(email.html).toMatch(/href="[^"]*\/settings\/billing"/);
        expect(email.html).not.toContain('tab=billing');
        expect(email.text).toContain('/settings/billing');
        expect(email.text).not.toContain('tab=billing');
      }
    }
  );
});

describe('the cancellation and resume e-mails (Manage Subscription S2, W3/W4)', () => {
  // "Cancel scheduled" is the existing "canceled" e-mail with the date PRO ends.
  it.each([...EMAIL_LANGUAGES])(
    'the cancel-scheduled mail names the date PRO ends, in %s',
    (language) => {
      const email = BUILDERS['subscriptionCanceled']!({ language });
      expect(email.html).toContain('2026');
      expect(email.text).toContain('2026');
      expect(email.html).toMatch(/href="[^"]*\/settings\/billing"/);
    }
  );

  it.each([...EMAIL_LANGUAGES])(
    'the resume mail names the renewal date and links to billing, in %s',
    (language) => {
      const email = BUILDERS['subscriptionResumed']!({ language });
      expect(email.html).toContain('2026');
      expect(email.text).toContain('2026');
      expect(email.html).toMatch(/href="[^"]*\/settings\/billing"/);
      expect(email.html).toContain('PRO');
    }
  );

  it.each([...EMAIL_LANGUAGES].filter((l) => l !== 'en-US' && l !== 'en-GB'))(
    'the resume mail is written in the reader’s language, not English, in %s',
    (language) => {
      const english = BUILDERS['subscriptionResumed']!({ language: 'en-US' });
      const email = BUILDERS['subscriptionResumed']!({ language });
      expect(email.subject).not.toBe(english.subject);
      expect(email.html).not.toContain('Subscription Resumed');
      expect(email.html).not.toContain('Open billing settings');
    }
  );

  it('writes the resume mail in English exactly as agreed', () => {
    const email = BUILDERS['subscriptionResumed']!({ language: 'en-US' });
    expect(email.subject).toBe(
      'Your PRO subscription will continue - Trading Alerts'
    );
    expect(email.html).toContain('Subscription Resumed');
    expect(email.html).toContain(
      'Your <strong>PRO</strong> subscription will continue.'
    );
    expect(email.html).toContain(
      '<strong>Next Billing Date:</strong> October 23, 2026'
    );
    expect(email.html).toContain(
      'Your cancellation has been withdrawn. You keep full PRO access and your subscription renews automatically on October 23, 2026.'
    );
  });

  it("prints the renewal date in the reader's own date format and timezone", () => {
    const email = buildSubscriptionResumedEmail(
      { language: 'de', timezone: 'Asia/Bangkok', dateFormat: 'DMY' },
      { name: 'Ada', plan: 'PRO', nextBillingDate: when }
    );
    expect(email.html).toContain('23/10/2026');
    expect(email.html).not.toContain('October 23, 2026');
  });

  it('escapes the name a person supplied', () => {
    const email = buildSubscriptionResumedEmail(
      { language: 'en-US' },
      {
        name: '<img src=x onerror=alert(1)>',
        plan: 'PRO',
        nextBillingDate: when,
      }
    );
    expect(email.html).not.toContain('<img src=x');
    expect(email.html).toContain('&lt;img');
  });
});

describe('the plan-change e-mails (Manage Subscription S3, W5a/W5b)', () => {
  it.each([...EMAIL_LANGUAGES])(
    'the upgrade mail names what was charged, the yearly price, the next billing date and links to billing, in %s',
    (language) => {
      const email = BUILDERS['subscriptionUpgraded']!({ language });
      expect(email.html).toContain('2026');
      expect(email.html).toMatch(/270|２７０/);
      expect(email.html).toMatch(/290|２９０/);
      expect(email.html).toMatch(/href="[^"]*\/settings\/billing"/);
      expect(email.html).toContain('PRO');
      expect(email.text).toContain('2026');
    }
  );

  it.each([...EMAIL_LANGUAGES])(
    'the free-trial upgrade mail says nothing was charged and gives the first charge date, in %s',
    (language) => {
      const trial = BUILDERS['subscriptionUpgradedInTrial']!({ language });
      const paid = BUILDERS['subscriptionUpgraded']!({ language });
      expect(trial.html).toContain('2026');
      expect(trial.html).not.toBe(paid.html);
    }
  );

  it.each([...EMAIL_LANGUAGES])(
    'the switch-scheduled mail names the switch date and the monthly price and links to billing, in %s',
    (language) => {
      const email = BUILDERS['planSwitchScheduled']!({ language });
      expect(email.html).toContain('2026');
      expect(email.html).toMatch(/29|２９/);
      expect(email.html).toMatch(/href="[^"]*\/settings\/billing"/);
      expect(email.html).toContain('PRO');
      expect(email.text).toContain('2026');
    }
  );

  it.each([...EMAIL_LANGUAGES].filter((l) => l !== 'en-US' && l !== 'en-GB'))(
    'both mails are written in the reader’s language, not English, in %s',
    (language) => {
      for (const name of [
        'subscriptionUpgraded',
        'subscriptionUpgradedInTrial',
        'planSwitchScheduled',
      ]) {
        const english = BUILDERS[name]!({ language: 'en-US' });
        const email = BUILDERS[name]!({ language });
        expect(email.subject).not.toBe(english.subject);
        expect(email.html).not.toContain('Switched to Yearly Billing');
        expect(email.html).not.toContain('Switch to Monthly Billing Scheduled');
        expect(email.html).not.toContain('Open billing settings');
      }
    }
  );

  it('writes the upgrade mail in English exactly as agreed', () => {
    const email = BUILDERS['subscriptionUpgraded']!({ language: 'en-US' });
    expect(email.subject).toBe(
      'You are now on yearly billing - Trading Alerts'
    );
    expect(email.html).toContain('Switched to Yearly Billing');
    expect(email.html).toContain(
      'Your <strong>PRO</strong> subscription now bills yearly.'
    );
    expect(email.html).toContain('<strong>Charged today:</strong> $270.35');
    expect(email.html).toContain('<strong>Yearly price:</strong> $290.00');
    expect(email.html).toContain(
      '<strong>Next billing date:</strong> October 23, 2026'
    );
    expect(email.html).toContain(
      "Today's charge is the yearly price minus the credit for the unused part of your current monthly period."
    );
  });

  it('writes the free-trial upgrade mail in English: nothing charged, first charge on the date', () => {
    const email = BUILDERS['subscriptionUpgradedInTrial']!({
      language: 'en-US',
    });
    expect(email.html).toContain('<strong>Charged today:</strong> $0.00');
    expect(email.html).toContain(
      '<strong>First charge:</strong> October 23, 2026'
    );
    expect(email.html).toContain(
      'Your free trial continues and nothing was charged today. Your first charge, at the yearly price, is on October 23, 2026.'
    );
    expect(email.html).not.toContain('Next billing date');
  });

  it('writes the switch-scheduled mail in English exactly as agreed', () => {
    const email = BUILDERS['planSwitchScheduled']!({ language: 'en-US' });
    expect(email.subject).toBe(
      'Your switch to monthly billing is scheduled - Trading Alerts'
    );
    expect(email.html).toContain('Switch to Monthly Billing Scheduled');
    expect(email.html).toContain(
      'Your <strong>PRO</strong> subscription will switch to monthly billing on October 23, 2026.'
    );
    expect(email.html).toContain(
      '<strong>Switch date:</strong> October 23, 2026'
    );
    expect(email.html).toContain(
      '<strong>Monthly price from then:</strong> $29.00'
    );
    expect(email.html).toContain(
      'You keep your yearly access until October 23, 2026. Nothing is charged or refunded now, and there is no credit for the current year.'
    );
    expect(email.html).toContain(
      'Changed your mind? You can keep yearly billing before then.'
    );
  });

  it("prints the dates in the reader's own date format and timezone, and the amounts in USD formats of the language", () => {
    const upgraded = buildSubscriptionUpgradedEmail(
      { language: 'de', timezone: 'Asia/Bangkok', dateFormat: 'DMY' },
      {
        name: 'Ada',
        plan: 'PRO',
        amountCharged: 270.35,
        yearlyPriceUsd: 290,
        nextBillingDate: when,
        inTrial: false,
      }
    );
    expect(upgraded.html).toContain('23/10/2026');
    expect(upgraded.html).not.toContain('October 23, 2026');
    expect(upgraded.html).toContain('270,35');

    const switched = buildPlanSwitchScheduledEmail(
      { language: 'de', timezone: 'Asia/Bangkok', dateFormat: 'DMY' },
      { name: 'Ada', plan: 'PRO', effectiveDate: when, monthlyPriceUsd: 29 }
    );
    expect(switched.html).toContain('23/10/2026');
    expect(switched.html).toContain('29,00');
  });

  it('escapes the name a person supplied', () => {
    const upgraded = buildSubscriptionUpgradedEmail(
      { language: 'en-US' },
      {
        name: '<img src=x onerror=alert(1)>',
        plan: 'PRO',
        amountCharged: 1,
        yearlyPriceUsd: 290,
        nextBillingDate: when,
        inTrial: false,
      }
    );
    const switched = buildPlanSwitchScheduledEmail(
      { language: 'en-US' },
      {
        name: '<img src=x onerror=alert(1)>',
        plan: 'PRO',
        effectiveDate: when,
        monthlyPriceUsd: 29,
      }
    );
    for (const email of [upgraded, switched]) {
      expect(email.html).not.toContain('<img src=x');
      expect(email.html).toContain('&lt;img');
    }
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
    // the zone's short name comes from the runtime's ICU data ("GST" on older
    // data, "غرينتش+4" on newer), so only the date and time are pinned
    expect(arabic).toMatch(/<bdi>23\/10\/2026 1:30 PM [^<]+<\/bdi>/);
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

describe('the payout-details notice (WS-9, CODE-06A)', () => {
  const changedAt = new Date('2026-10-23T09:30:00.000Z');
  const holdUntil = new Date('2026-10-26T09:30:00.000Z');
  const input = { name: 'Ada', changedAt, holdUntil, holdHours: 72 };

  it('says the payouts are on hold, for how long, and until when', () => {
    const { html, text, subject } = buildPayoutDetailsChangedEmail(
      {
        language: 'en-US',
        timezone: 'UTC',
        dateFormat: 'DMY',
        timeFormat: '24h',
      },
      input
    );
    expect(subject).toBe('Security Alert: Your Payout Details Were Changed');
    expect(html).toContain('on hold for 72 hours');
    expect(html).toContain('23/10/2026 09:30'); // the change
    expect(html).toContain('26/10/2026 09:30'); // the end of the hold
    expect(text).toContain('Payouts on hold until:');
  });

  it("shows both times in the reader's timezone and clock", () => {
    const { html } = buildPayoutDetailsChangedEmail(
      {
        language: 'th',
        timezone: 'Asia/Bangkok',
        dateFormat: 'DMY',
        timeFormat: '24h',
      },
      input
    );
    expect(html).toContain('23/10/2026 16:30 GMT+7');
    expect(html).toContain('26/10/2026 16:30 GMT+7');
  });

  it('sends the reader to the security settings, not to a payout page an attacker may be using', () => {
    const { html } = buildPayoutDetailsChangedEmail(
      { language: 'en-US' },
      input
    );
    expect(html).toContain('/settings/security');
    expect(html).not.toContain('/affiliate/settings/payout');
  });

  it('is written in the reader’s language', () => {
    const { subject, html } = buildPayoutDetailsChangedEmail(
      { language: 'es' },
      input
    );
    expect(subject).toBe('Alerta de seguridad: tus datos de pago han cambiado');
    expect(html).toContain('durante 72 horas');
  });

  it('takes no bank detail at all, so none can reach the message', () => {
    // The builder's input is the name and the two moments: nothing else is
    // accepted, and the output carries only those.
    const { html, text } = buildPayoutDetailsChangedEmail(
      { language: 'en-US' },
      input
    );
    for (const part of [html, text]) {
      expect(part).not.toMatch(/\d{6,}/); // no account, sort code or IBAN-like run
    }
  });
});

describe('what a person or a provider supplied is escaped', () => {
  const hostile = '<img src=x onerror="alert(1)">';

  it('escapes the name in the payout-details notice', () => {
    const { html } = buildPayoutDetailsChangedEmail(
      { language: 'en-US' },
      {
        name: hostile,
        changedAt: when,
        holdUntil: new Date(when.getTime() + 72 * 3600 * 1000),
        holdHours: 72,
      }
    );
    expect(html).not.toContain(hostile);
    expect(html).toContain('&lt;img');
  });

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
