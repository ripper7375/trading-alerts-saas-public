/**
 * The live e-mail templates, built in the reader's language and formats.
 * Pure: see `languages.ts`. The sending wrappers (`lib/email/email.ts`,
 * `operation-service/src/email/email.util.ts`) call these and hand the result
 * to Resend.
 *
 * Every value that came from a person or a provider (name, device, location,
 * reason, links) is escaped; the catalog text is static.
 */

import { raw } from './catalog';
import { formatEmailDate, formatEmailDateTime, formatEmailUsd } from './format';
import type { EmailLocale } from './languages';
import type { EmailMessageKey } from './messages/en-US';
import {
  APP_NAME,
  banner,
  card,
  createContext,
  displayName,
  documentShell,
  htmlToText,
  textLink,
  type EmailContext,
} from './layout';

export interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

/** Account and security mail linked back to the app. */
const CARD_URL_FALLBACK = 'http://localhost:3000';
/** Billing mail kept its own fallback when it was written. */
const BANNER_URL_FALLBACK = 'https://tradingalerts.com';
export const SUPPORT_EMAIL = 'support@tradingalerts.com';

function appUrl(fallback: string): string {
  return process.env['NEXTAUTH_URL'] || fallback;
}

function finish(subject: string, html: string): BuiltEmail {
  return { subject, html, text: htmlToText(html) };
}

// ─── Values that arrive in English from the sender ──────────────────────────

const DEVICE_KEYS: Record<string, EmailMessageKey> = {
  desktop: 'value.device.desktop',
  mobile: 'value.device.mobile',
  tablet: 'value.device.tablet',
  unknown: 'value.unknown',
};

function deviceText(ctx: EmailContext, device: string): string {
  const key = DEVICE_KEYS[device.trim().toLowerCase()];
  return key ? ctx.p(key) : device;
}

/** `Unknown` / `Unknown location` parts become the reader's word for them. */
function placeText(ctx: EmailContext, place: string): string {
  return place
    .split(', ')
    .map((part) => {
      if (part === 'Unknown location') return ctx.p('value.unknownLocation');
      if (part === 'Unknown') return ctx.p('value.unknown');
      return part;
    })
    .join(', ');
}

// ─── Account mail ───────────────────────────────────────────────────────────

export function buildWelcomeEmail(
  locale: EmailLocale,
  input: { name: string | null | undefined }
): BuiltEmail {
  const ctx = createContext(locale);
  const name = displayName(ctx, input.name);
  const url = appUrl(CARD_URL_FALLBACK);

  const inner = card.wrap(
    ctx,
    `${card.h1(ctx.h('welcome.heading', { name }))}
        ${card.p(ctx.h('welcome.body'))}
        ${card.h2(ctx.h('welcome.getStarted'))}
        ${card.ul(ctx, [
          ctx.h('welcome.step1'),
          ctx.h('welcome.step2'),
          ctx.h('welcome.step3'),
        ])}
        ${card.button(`${url}/dashboard`, ctx.h('welcome.button'), '#2563eb')}
        ${card.small(ctx.h('common.questions'), '32px 0 0 0')}`
  );

  return finish(
    ctx.p('welcome.subject'),
    documentShell(ctx, ctx.p('welcome.title'), card.bodyStyle, inner)
  );
}

export function buildAffiliateWelcomeEmail(
  locale: EmailLocale,
  input: { name: string | null | undefined; codesDistributed: number }
): BuiltEmail {
  const ctx = createContext(locale);
  const name = displayName(ctx, input.name);
  const url = appUrl(CARD_URL_FALLBACK);

  const inner = card.wrap(
    ctx,
    `${card.h1(ctx.h('affiliateWelcome.heading', { name }))}
        ${card.p(
          ctx.h('affiliateWelcome.body', { count: input.codesDistributed })
        )}
        ${card.button(
          `${url}/affiliate/dashboard`,
          ctx.h('affiliateWelcome.button'),
          '#2563eb'
        )}
        ${card.small(ctx.h('affiliateWelcome.footer'), '32px 0 0 0')}`
  );

  return finish(
    ctx.p('affiliateWelcome.subject'),
    documentShell(ctx, ctx.p('affiliateWelcome.title'), card.bodyStyle, inner)
  );
}

export function buildVerificationEmail(
  locale: EmailLocale,
  input: { name: string | null | undefined; verificationUrl: string }
): BuiltEmail {
  const ctx = createContext(locale);
  const name = displayName(ctx, input.name);

  const inner = card.wrap(
    ctx,
    `${card.h1(ctx.h('verify.heading'))}
        ${card.p(ctx.h('verify.body', { name }))}
        ${card.button(
          input.verificationUrl,
          ctx.h('verify.button'),
          '#2563eb',
          ' margin: 16px 0;'
        )}
        ${card.small(ctx.h('verify.ignore'))}
        ${card.small(ctx.h('verify.expiry'), '8px 0 0 0')}`
  );

  return finish(
    ctx.p('verify.subject'),
    documentShell(ctx, ctx.p('verify.heading'), card.bodyStyle, inner)
  );
}

export function buildPasswordResetEmail(
  locale: EmailLocale,
  input: { name: string | null | undefined; resetUrl: string }
): BuiltEmail {
  const ctx = createContext(locale);
  const name = displayName(ctx, input.name);

  const inner = card.wrap(
    ctx,
    `${card.h1(ctx.h('reset.heading'))}
        ${card.p(ctx.h('reset.body', { name }))}
        ${card.button(
          input.resetUrl,
          ctx.h('reset.button'),
          '#2563eb',
          ' margin: 16px 0;'
        )}
        ${card.small(ctx.h('reset.ignore'))}
        ${card.small(ctx.h('reset.expiry'), '8px 0 0 0')}`
  );

  return finish(
    ctx.p('reset.subject'),
    documentShell(ctx, ctx.p('reset.heading'), card.bodyStyle, inner)
  );
}

export function buildAccountDeletionEmail(
  locale: EmailLocale,
  input: {
    name: string | null | undefined;
    confirmationUrl: string;
    cancelUrl: string;
    expiresAt: Date;
  }
): BuiltEmail {
  const ctx = createContext(locale);
  const name = displayName(ctx, input.name);

  const inner = card.wrap(
    ctx,
    `${card.banner('#fee2e2', '#991b1b', ctx.h('accountDeletion.heading'))}
        ${card.p(ctx.h('accountDeletion.body', { name }))}
        ${card.p(ctx.h('accountDeletion.confirmIntro'))}
        ${card.button(
          input.confirmationUrl,
          ctx.h('accountDeletion.confirmButton'),
          '#dc2626',
          ' margin: 8px 0;'
        )}
        ${card.p(ctx.h('accountDeletion.cancelIntro'), '24px 0 16px 0')}
        ${card.button(
          input.cancelUrl,
          ctx.h('accountDeletion.cancelButton'),
          '#2563eb',
          ' margin: 8px 0;'
        )}
        ${card.small(
          ctx.h('accountDeletion.expiry', {
            date: formatEmailDateTime(input.expiresAt, locale),
          })
        )}`
  );

  return finish(
    ctx.p('accountDeletion.subject'),
    documentShell(ctx, ctx.p('accountDeletion.heading'), card.bodyStyle, inner)
  );
}

// ─── Security alerts ────────────────────────────────────────────────────────

export interface NewDeviceDetails {
  device: string;
  browser: string;
  os: string;
  location: string;
  ipAddress: string;
  timestamp: Date;
}

export function buildNewDeviceLoginEmail(
  locale: EmailLocale,
  input: { name: string | null | undefined; details: NewDeviceDetails }
): BuiltEmail {
  const ctx = createContext(locale);
  const name = displayName(ctx, input.name);
  const { details } = input;
  const settingsUrl = `${appUrl(CARD_URL_FALLBACK)}/settings/security`;

  const inner = card.wrap(
    ctx,
    `${card.banner('#fef3c7', '#92400e', ctx.h('newDevice.heading'))}
        ${card.p(ctx.h('newDevice.body', { name }))}
        ${card.facts(ctx, [
          [ctx.p('label.device'), deviceText(ctx, details.device)],
          [ctx.p('label.browser'), details.browser],
          [ctx.p('label.os'), details.os],
          [ctx.p('label.location'), placeText(ctx, details.location)],
          [ctx.p('label.ipAddress'), placeText(ctx, details.ipAddress)],
          [ctx.p('label.time'), formatEmailDateTime(details.timestamp, locale)],
        ])}
        ${card.p(ctx.h('newDevice.ifYou'), '16px 0')}
        ${card.p(ctx.h('newDevice.ifNotYou'), '16px 0')}
        ${card.ul(ctx, [
          ctx.h('security.changePassword'),
          ctx.h('newDevice.tip2'),
          ctx.h('newDevice.tip3'),
        ])}
        ${card.button(
          settingsUrl,
          ctx.h('security.secureButton'),
          '#dc2626',
          ` margin-${ctx.end}: 8px;`
        )}
        ${card.securityFooter(ctx, settingsUrl)}`
  );

  return finish(
    ctx.p('newDevice.subject'),
    documentShell(ctx, ctx.p('newDevice.heading'), card.bodyStyle, inner)
  );
}

export function buildPasswordChangedEmail(
  locale: EmailLocale,
  input: {
    name: string | null | undefined;
    ipAddress: string;
    location: string;
    timestamp: Date;
  }
): BuiltEmail {
  const ctx = createContext(locale);
  const name = displayName(ctx, input.name);
  const base = appUrl(CARD_URL_FALLBACK);

  const inner = card.wrap(
    ctx,
    `${card.banner('#dbeafe', '#1e40af', ctx.h('passwordChanged.heading'))}
        ${card.p(ctx.h('passwordChanged.body', { name }))}
        ${card.facts(ctx, [
          [ctx.p('label.time'), formatEmailDateTime(input.timestamp, locale)],
          [ctx.p('label.location'), placeText(ctx, input.location)],
          [ctx.p('label.ipAddress'), placeText(ctx, input.ipAddress)],
        ])}
        ${card.p(ctx.h('passwordChanged.ifYou'), '16px 0')}
        ${card.p(ctx.h('passwordChanged.ifNotYou'), '16px 0')}
        ${card.ul(ctx, [
          ctx.h('passwordChanged.tip1'),
          ctx.h('passwordChanged.tip2'),
          ctx.h('passwordChanged.tip3'),
        ])}
        ${card.button(
          `${base}/forgot-password`,
          ctx.h('reset.button'),
          '#dc2626'
        )}
        ${card.securityFooter(ctx, `${base}/settings/security`)}`
  );

  return finish(
    ctx.p('passwordChanged.subject'),
    documentShell(ctx, ctx.p('passwordChanged.heading'), card.bodyStyle, inner)
  );
}

export function buildTwoFactorEnabledEmail(
  locale: EmailLocale,
  input: {
    name: string | null | undefined;
    ipAddress: string;
    location: string;
    timestamp: Date;
  }
): BuiltEmail {
  const ctx = createContext(locale);
  const name = displayName(ctx, input.name);
  const settingsUrl = `${appUrl(CARD_URL_FALLBACK)}/settings/security`;

  const inner = card.wrap(
    ctx,
    `${card.banner('#dcfce7', '#166534', ctx.h('twoFactorEnabled.heading'))}
        ${card.p(ctx.h('twoFactorEnabled.body', { name }))}
        ${card.facts(ctx, [
          [ctx.p('label.time'), formatEmailDateTime(input.timestamp, locale)],
          [ctx.p('label.location'), placeText(ctx, input.location)],
          [ctx.p('label.ipAddress'), placeText(ctx, input.ipAddress)],
        ])}
        ${card.h3(ctx.h('twoFactorEnabled.remindersHeading'))}
        ${card.ul(ctx, [
          ctx.h('twoFactorEnabled.reminder1'),
          ctx.h('twoFactorEnabled.reminder2'),
          ctx.h('twoFactorEnabled.reminder3'),
        ])}
        ${card.p(ctx.h('twoFactorEnabled.ifNotYou'), '16px 0')}
        ${card.button(settingsUrl, ctx.h('twoFactorEnabled.button'), '#2563eb')}
        ${card.securityFooter(ctx, settingsUrl)}`
  );

  return finish(
    ctx.p('twoFactorEnabled.subject'),
    documentShell(ctx, ctx.p('twoFactorEnabled.heading'), card.bodyStyle, inner)
  );
}

export function buildTwoFactorDisabledEmail(
  locale: EmailLocale,
  input: {
    name: string | null | undefined;
    ipAddress: string;
    location: string;
    timestamp: Date;
  }
): BuiltEmail {
  const ctx = createContext(locale);
  const name = displayName(ctx, input.name);
  const settingsUrl = `${appUrl(CARD_URL_FALLBACK)}/settings/security`;

  const inner = card.wrap(
    ctx,
    `${card.banner('#fef3c7', '#92400e', ctx.h('twoFactorDisabled.heading'))}
        ${card.p(ctx.h('twoFactorDisabled.body', { name }))}
        ${card.facts(ctx, [
          [ctx.p('label.time'), formatEmailDateTime(input.timestamp, locale)],
          [ctx.p('label.location'), placeText(ctx, input.location)],
          [ctx.p('label.ipAddress'), placeText(ctx, input.ipAddress)],
        ])}
        ${card.p(
          ctx.h('twoFactorDisabled.warning'),
          '16px 0',
          ' color: #dc2626; font-weight: 500;'
        )}
        ${card.p(ctx.h('twoFactorDisabled.ifYou'), '16px 0')}
        ${card.p(ctx.h('twoFactorDisabled.ifNotYou'), '16px 0')}
        ${card.ul(ctx, [
          ctx.h('security.changePassword'),
          ctx.h('twoFactorDisabled.tip2'),
          ctx.h('twoFactorDisabled.tip3'),
        ])}
        ${card.button(settingsUrl, ctx.h('security.secureButton'), '#dc2626')}
        ${card.securityFooter(ctx, settingsUrl)}`
  );

  return finish(
    ctx.p('twoFactorDisabled.subject'),
    documentShell(
      ctx,
      ctx.p('twoFactorDisabled.heading'),
      card.bodyStyle,
      inner
    )
  );
}

// ─── Subscription mail ──────────────────────────────────────────────────────

export function buildSubscriptionConfirmationEmail(
  locale: EmailLocale,
  input: {
    name: string | null | undefined;
    plan: 'FREE' | 'PRO';
    billingPeriod: 'monthly' | 'yearly' | 'three_day';
    /** PRO price per billing period, as charged. */
    priceUsd: number;
  }
): BuiltEmail {
  const ctx = createContext(locale);
  const name = displayName(ctx, input.name);
  const url = appUrl(CARD_URL_FALLBACK);
  const { plan } = input;

  const billing =
    plan === 'PRO'
      ? ctx.p(
          input.billingPeriod === 'yearly'
            ? 'billing.perYear'
            : input.billingPeriod === 'three_day'
              ? 'billing.perThreeDays'
              : 'billing.perMonth',
          { price: formatEmailUsd(input.priceUsd, locale, 0) }
        )
      : formatEmailUsd(0, locale, 0);

  // The 3-day plan is charged at checkout, so it has no 7-day free trial.
  const trial =
    plan === 'PRO' && input.billingPeriod !== 'three_day'
      ? `<p style="color: #22c55e; font-weight: 600;">${ctx.h('subscription.trial')}</p>`
      : '';

  const proFeatures = `${card.h3(ctx.h('subscription.proHeading'))}
        ${card.ul(ctx, [
          ctx.h('subscription.pro1'),
          ctx.h('subscription.pro2'),
          ctx.h('subscription.pro3'),
          ctx.h('subscription.pro4'),
          ctx.h('subscription.pro5'),
          ctx.h('subscription.pro6'),
        ])}`;

  const upgradeLink = textLink(
    `${url}/pricing`,
    ctx.p('subscription.upgradeLink'),
    'color: #2563eb; font-weight: 500;'
  );
  const freeFeatures = `${card.h3(ctx.h('subscription.freeHeading'))}
        ${card.ul(ctx, [
          ctx.h('subscription.free1'),
          ctx.h('subscription.free2'),
          ctx.h('subscription.free3'),
        ])}
        ${card.p(ctx.h('subscription.upgradeLead', { link: raw(upgradeLink) }), '16px 0')}`;

  const inner = card.wrap(
    ctx,
    `${card.h1(ctx.h('subscription.heading'))}
        ${card.p(ctx.h('subscription.body', { name, plan }))}

        <div style="background: #f4f4f5; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #18181b; margin: 0 0 12px 0; font-size: 16px;">${ctx.h('subscription.planDetails')}</h3>
          <p style="color: #52525b; margin: 4px 0;"><strong>${ctx.h('subscription.tier')}</strong> ${plan}</p>
          <p style="color: #52525b; margin: 4px 0;"><strong>${ctx.h('subscription.billing')}</strong> ${billing}</p>
          ${trial}
        </div>

        ${plan === 'PRO' ? proFeatures : freeFeatures}

        ${card.button(`${url}/dashboard`, ctx.h('welcome.button'), '#2563eb')}
        ${card.small(ctx.h('common.questions'), '32px 0 0 0')}`
  );

  return finish(
    ctx.p('subscription.subject', { plan }),
    documentShell(ctx, ctx.p('subscription.heading'), card.bodyStyle, inner)
  );
}

export function buildCancellationEmail(
  locale: EmailLocale,
  input: { name: string | null | undefined }
): BuiltEmail {
  const ctx = createContext(locale);
  const name = displayName(ctx, input.name);
  const url = appUrl(BANNER_URL_FALLBACK);

  const inner = `${banner.header('#f3f4f6', '#374151', ctx.h('cancellation.heading'))}

  ${banner.content(`${banner.p(ctx.h('common.greeting', { name }))}

    ${banner.p(ctx.h('cancellation.body', { app: APP_NAME }))}

    ${banner.p(ctx.h('cancellation.freeAccess'))}

    ${banner.ul(ctx, [
      ctx.h('freeTier.xauusd'),
      ctx.h('freeTier.marketData'),
      ctx.h('freeTier.noAlerts'),
    ])}

    ${banner.callout(
      ctx,
      '#22c55e',
      `<p style="margin: 0; font-size: 14px;">
        <strong>${ctx.h('cancellation.changedMind')}</strong><br>
        ${ctx.h('cancellation.upgradeAgain')}
      </p>`
    )}

    ${banner.button(`${url}/pricing`, ctx.h('cancellation.button'), '#22c55e')}

    ${banner.p(ctx.h('cancellation.thanks'))}

    ${banner.signature(ctx, url)}`)}`;

  return finish(
    ctx.p('cancellation.subject'),
    documentShell(ctx, ctx.p('cancellation.heading'), banner.bodyStyle, inner)
  );
}

export function buildPaymentFailedEmail(
  locale: EmailLocale,
  input: {
    name: string | null | undefined;
    reason: string;
    /** The subscriber's own price per billing period, in USD. */
    price: number;
    billingPeriod?: 'monthly' | 'yearly' | 'three_day';
  }
): BuiltEmail {
  const ctx = createContext(locale);
  const name = displayName(ctx, input.name);
  const url = appUrl(BANNER_URL_FALLBACK);
  const amount = ctx.p(
    input.billingPeriod === 'yearly'
      ? 'billing.perYear'
      : input.billingPeriod === 'three_day'
        ? 'billing.perThreeDays'
        : 'billing.perMonth',
    { price: formatEmailUsd(input.price, locale, 0) }
  );
  const support = textLink(
    `mailto:${SUPPORT_EMAIL}`,
    SUPPORT_EMAIL,
    'color: #2563eb;'
  );

  const inner = `${banner.header('#fef2f2', '#dc2626', ctx.h('paymentFailed.heading'))}

  ${banner.content(`${banner.p(ctx.h('common.greeting', { name }))}

    ${banner.p(ctx.h('paymentFailed.body', { app: APP_NAME, amount }))}

    ${banner.callout(
      ctx,
      '#dc2626',
      `<p style="margin: 0; font-size: 14px; color: #991b1b;">
        ${ctx.h('paymentFailed.reason', { reason: input.reason })}
      </p>`,
      '#fef2f2'
    )}

    ${banner.p(ctx.h('paymentFailed.action'))}

    ${banner.button(
      `${url}/settings?tab=billing`,
      ctx.h('paymentFailed.button'),
      '#dc2626'
    )}

    ${banner.p(ctx.h('paymentFailed.downgrade'))}

    <p style="font-size: 14px; color: #666;">
      ${ctx.h('common.needHelpReply', { email: raw(support) })}
    </p>

    ${banner.signature(ctx, url)}`)}`;

  return finish(
    ctx.p('paymentFailed.subject'),
    documentShell(ctx, ctx.p('paymentFailed.heading'), banner.bodyStyle, inner)
  );
}

export function buildPaymentReceiptEmail(
  locale: EmailLocale,
  input: {
    name: string | null | undefined;
    /** Amount paid, in USD. */
    amount: number;
    nextBillingDate: Date;
    invoiceUrl?: string;
    /** When the payment was taken; now by default. */
    paidAt?: Date;
  }
): BuiltEmail {
  const ctx = createContext(locale);
  const name = displayName(ctx, input.name);
  const url = appUrl(BANNER_URL_FALLBACK);

  const invoice = input.invoiceUrl
    ? banner.button(input.invoiceUrl, ctx.h('receipt.button'), '#2563eb')
    : '';

  const inner = `${banner.header(
    'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    'white',
    ctx.h('receipt.heading')
  )}

  ${banner.content(`${banner.p(ctx.h('common.greeting', { name }))}

    ${banner.p(ctx.h('receipt.body'))}

    ${banner.statement(ctx, [
      {
        label: ctx.p('receipt.description'),
        text: ctx.p('receipt.descriptionValue', { app: APP_NAME }),
        bold: true,
      },
      {
        label: ctx.p('receipt.amount'),
        text: formatEmailUsd(input.amount, locale),
        bold: true,
      },
      {
        label: ctx.p('receipt.date'),
        text: formatEmailDate(input.paidAt ?? new Date(), locale),
      },
      {
        label: ctx.p('receipt.nextBilling'),
        text: formatEmailDate(input.nextBillingDate, locale),
      },
    ])}

    ${invoice}

    ${banner.p(ctx.h('receipt.thanks'))}

    ${banner.signature(ctx, url)}`)}`;

  return finish(
    ctx.p('receipt.subject', { app: APP_NAME }),
    documentShell(ctx, ctx.p('receipt.title'), banner.bodyStyle, inner)
  );
}

export function buildSubscriptionCanceledEmail(
  locale: EmailLocale,
  input: {
    name: string | null | undefined;
    plan: 'FREE' | 'PRO';
    cancelAt: Date;
  }
): BuiltEmail {
  const ctx = createContext(locale);
  const name = displayName(ctx, input.name);
  const url = appUrl(BANNER_URL_FALLBACK);
  const { plan } = input;
  const date = formatEmailDate(input.cancelAt, locale);
  const reactivate = textLink(
    `${url}/settings/billing`,
    ctx.p('canceled.reactivateLink'),
    'color: #0066cc; font-weight: 600;'
  );
  const support = textLink(
    `mailto:${SUPPORT_EMAIL}`,
    SUPPORT_EMAIL,
    'color: #2563eb;'
  );

  const inner = `${banner.header('#cc0000', 'white', ctx.h('canceled.heading'))}

  ${banner.content(`${banner.p(ctx.h('common.greeting', { name }))}

    ${banner.p(ctx.h('canceled.body', { plan }))}

    ${banner.callout(
      ctx,
      '#ffc107',
      `<p style="margin: 0; font-size: 14px;">
        ${ctx.h('canceled.accessUntil', { date })}<br>
        ${ctx.h('canceled.accessNote', { plan, date })}
      </p>`,
      '#fff3cd'
    )}

    ${banner.p(ctx.h('canceled.afterwards'))}

    ${banner.ul(
      ctx,
      [
        ctx.h('freeTier.xauusd'),
        ctx.h('freeTier.marketData'),
        ctx.h('freeTier.noAlerts'),
      ],
      8
    )}

    ${banner.p(ctx.h('canceled.reactivate', { link: raw(reactivate) }))}

    ${banner.signature(
      ctx,
      url,
      `${ctx.h('common.needHelpContact', { email: raw(support) })}<br><br>`
    )}`)}`;

  return finish(
    ctx.p('canceled.subject'),
    documentShell(ctx, ctx.p('canceled.heading'), banner.bodyStyle, inner)
  );
}

export function buildAffiliateCommissionEmail(
  locale: EmailLocale,
  input: {
    name: string | null | undefined;
    code: string;
    /** Commission earned, in USD. */
    commissionAmount: number;
    /** Total earned to date, in USD. */
    totalEarnings: number;
    /** The configured commission rate; the line is left out when unknown. */
    commissionPercent?: number;
  }
): BuiltEmail {
  const ctx = createContext(locale);
  const name = displayName(ctx, input.name);
  const url = appUrl(BANNER_URL_FALLBACK);
  const earned = formatEmailUsd(input.commissionAmount, locale);

  const rate =
    input.commissionPercent === undefined
      ? ''
      : `<p style="font-size: 14px; color: #666;">
      ${ctx.h('commission.rate', { percent: input.commissionPercent })}
    </p>`;

  const inner = `${banner.header(
    'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    'white',
    ctx.h('commission.heading')
  )}

  ${banner.content(`${banner.p(ctx.h('common.greeting', { name }))}

    ${banner.p(ctx.h('commission.body'))}

    ${banner.statement(ctx, [
      { label: ctx.p('commission.codeUsed'), text: input.code, bold: true },
      {
        label: ctx.p('commission.earned'),
        text: `+${earned}`,
        bold: true,
        color: '#22c55e',
      },
      {
        label: ctx.p('commission.total'),
        text: formatEmailUsd(input.totalEarnings, locale),
        bold: true,
      },
    ])}

    ${rate}

    ${banner.button(
      `${url}/affiliate/dashboard`,
      ctx.h('commission.button'),
      '#22c55e'
    )}

    ${banner.signature(ctx, url)}`)}`;

  return finish(
    ctx.p('commission.subject', { amount: earned, app: APP_NAME }),
    documentShell(ctx, ctx.p('commission.heading'), banner.bodyStyle, inner)
  );
}
