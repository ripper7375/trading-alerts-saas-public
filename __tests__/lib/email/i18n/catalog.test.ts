/**
 * @jest-environment node
 */
/**
 * The e-mail text catalog (`lib/email/i18n/`): one object per locale, held to
 * the English source. `tsc` already refuses a missing key; these tests hold
 * what the type cannot: the same placeholders and markup in every language, a
 * real translation (not English left behind) in the 17 that are not English,
 * and the renderer's escaping.
 */
import {
  EMAIL_CATALOGS,
  escapeHtml,
  html,
  message,
  plain,
  raw,
  type EmailMessageKey,
} from '@/lib/email/i18n/catalog';
import {
  EMAIL_LANGUAGES,
  isRtlEmailLanguage,
  type EmailLanguage,
  type EmailLocale,
} from '@/lib/email/i18n/languages';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n/languages';

const english = EMAIL_CATALOGS['en-US'];
const keys = Object.keys(english) as EmailMessageKey[];

const placeholders = (text: string): string[] =>
  [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as string).sort();

const locale = (language: EmailLanguage): EmailLocale => ({ language });

/**
 * Words that are the same in the language and in English (a loanword), so an
 * identical text is the correct translation. Anything else identical to
 * English is a translation that was never written.
 */
const IDENTICAL_TO_ENGLISH_OK: Partial<Record<EmailLanguage, string[]>> = {
  de: ['label.browser', 'value.device.desktop', 'value.device.tablet'],
  pt: ['value.device.tablet'],
  'pt-BR': ['value.device.tablet'],
  it: ['label.browser', 'value.device.tablet'],
  fr: ['value.device.mobile', 'receipt.description', 'receipt.date'],
  id: ['label.browser', 'value.device.desktop', 'value.device.tablet'],
  tr: ['value.device.tablet'],
};

describe('e-mail catalogs', () => {
  it('cover exactly the 19 locales of the app, in the same order', () => {
    expect([...EMAIL_LANGUAGES]).toEqual(
      SUPPORTED_LANGUAGES.map((language) => language.code)
    );
    expect(Object.keys(EMAIL_CATALOGS)).toEqual([...EMAIL_LANGUAGES]);
  });

  it.each([...EMAIL_LANGUAGES])(
    '%s has every key as a non-empty text',
    (language) => {
      const catalog = EMAIL_CATALOGS[language];
      expect(Object.keys(catalog).sort()).toEqual([...keys].sort());
      for (const key of keys) {
        expect(typeof catalog[key]).toBe('string');
        expect(catalog[key].trim()).not.toBe('');
      }
    }
  );

  it.each([...EMAIL_LANGUAGES])(
    '%s keeps the placeholders and the bold markers of the English text',
    (language) => {
      const catalog = EMAIL_CATALOGS[language];
      const wrong: string[] = [];
      for (const key of keys) {
        if (
          placeholders(catalog[key]).join() !==
          placeholders(english[key]).join()
        ) {
          wrong.push(`${key}: placeholders`);
        }
        const bold = (text: string): number => text.split('**').length - 1;
        if (bold(catalog[key]) !== bold(english[key])) {
          wrong.push(`${key}: ** markers`);
        }
      }
      expect(wrong).toEqual([]);
    }
  );

  it.each([...EMAIL_LANGUAGES])(
    '%s holds text only, never HTML',
    (language) => {
      const catalog = EMAIL_CATALOGS[language];
      expect(keys.filter((key) => /[<>]/.test(catalog[key]))).toEqual([]);
    }
  );

  it.each(EMAIL_LANGUAGES.filter((language) => !language.startsWith('en')))(
    '%s is translated, not left in English',
    (language) => {
      const catalog = EMAIL_CATALOGS[language];
      const allowed = IDENTICAL_TO_ENGLISH_OK[language] ?? [];
      const untranslated = keys.filter(
        (key) => catalog[key] === english[key] && !allowed.includes(key)
      );
      expect(untranslated).toEqual([]);
    }
  );

  it('writes British English with British spelling and nothing else changed', () => {
    const gb = EMAIL_CATALOGS['en-GB'];
    expect(gb['welcome.step3']).toBe('Customise your notification preferences');
    expect(gb['common.questions']).toContain('help centre');
    const changed = keys.filter((key) => gb[key] !== english[key]);
    expect(changed.sort()).toEqual(
      [
        'affiliateWelcome.footer',
        'common.questions',
        'passwordChanged.tip2',
        'payoutDetails.tip3',
        'twoFactorDisabled.tip3',
        'welcome.step3',
      ].sort()
    );
  });

  it('marks only Arabic and Urdu as right-to-left', () => {
    expect(EMAIL_LANGUAGES.filter((l) => isRtlEmailLanguage(l))).toEqual([
      'ar',
      'ur',
    ]);
  });
});

describe('rendering a text', () => {
  it('fills placeholders and drops the bold markers in plain text', () => {
    expect(
      plain(locale('en-US'), 'subscription.body', { name: 'Ada', plan: 'PRO' })
    ).toBe('Hi Ada, your PRO subscription is now active.');
  });

  it('turns **bold** into <strong> and escapes every value', () => {
    const out = html(locale('en-US'), 'subscription.body', {
      name: '<b>Ada</b>',
      plan: 'PRO',
    });
    expect(out).toBe(
      'Hi &lt;b&gt;Ada&lt;/b&gt;, your <strong>PRO</strong> subscription is now active.'
    );
  });

  it('does not let a value open or close a <strong>', () => {
    const out = html(locale('en-US'), 'paymentFailed.reason', {
      reason: '**x** <i>',
    });
    expect(out).toBe('<strong>Reason:</strong> **x** &lt;i&gt;');
  });

  it('trusts a value only when it is wrapped in raw()', () => {
    const link = raw('<a href="https://x.test/?a=1&amp;b=2">go</a>');
    expect(html(locale('en-US'), 'subscription.upgradeLead', { link })).toBe(
      '<a href="https://x.test/?a=1&amp;b=2">go</a> for alerts, line alerts, and multi-timeframe view!'
    );
  });

  it('keeps apostrophes readable and leaves an unknown placeholder alone', () => {
    expect(html(locale('en-US'), 'verify.ignore')).toContain("didn't");
    expect(html(locale('en-US'), 'welcome.heading', {})).toBe(
      'Welcome to Trading Alerts, {name}!'
    );
  });

  it('falls back to English for a key a locale does not carry', () => {
    const thai = EMAIL_CATALOGS.th as unknown as Record<string, string>;
    const saved = thai['welcome.subject'];
    delete thai['welcome.subject'];
    try {
      expect(message(locale('th'), 'welcome.subject')).toBe(
        english['welcome.subject']
      );
    } finally {
      thai['welcome.subject'] = saved as string;
    }
  });

  it('escapes the five HTML characters', () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;'
    );
  });
});
