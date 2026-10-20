/**
 * @jest-environment node
 */
/**
 * Dates, times and money in an e-mail: written in the reader's own timezone,
 * date format, time format and language. The numeric forms must read exactly
 * like the same time on screen (`lib/i18n/format-datetime.ts`).
 */
import {
  formatEmailDate,
  formatEmailDateTime,
  formatEmailUsd,
} from '@/lib/email/i18n/format';
import type { EmailLocale } from '@/lib/email/i18n/languages';
import { formatDateTimeInZone } from '@/lib/i18n/format-datetime';

// 23 Oct 2026 09:30 UTC: a different calendar day in Auckland, the same in London.
const moment = new Date('2026-10-23T09:30:00.000Z');

describe("formatEmailDateTime with the reader's formats", () => {
  const zones = [
    'UTC',
    'Europe/London',
    'Asia/Bangkok',
    'America/New_York',
    'Pacific/Auckland',
  ];
  const dateFormats = ['MDY', 'DMY', 'YMD'] as const;
  const timeFormats = ['12h', '24h'] as const;

  it.each(
    zones.flatMap((timezone) =>
      dateFormats.flatMap((dateFormat) =>
        timeFormats.map(
          (timeFormat) => [timezone, dateFormat, timeFormat] as const
        )
      )
    )
  )(
    '%s %s %s reads like the same time in the app',
    (timezone, dateFormat, timeFormat) => {
      const locale: EmailLocale = {
        language: 'en-US',
        timezone,
        dateFormat,
        timeFormat,
      };
      const inApp = formatDateTimeInZone(moment, {
        timezone,
        dateFormat,
        timeFormat,
      });
      // The app's text, then the zone's short name
      expect(formatEmailDateTime(moment, locale).startsWith(`${inApp} `)).toBe(
        true
      );
    }
  );

  it('names the zone after the time', () => {
    expect(
      formatEmailDateTime(moment, {
        language: 'en-US',
        timezone: 'Asia/Bangkok',
        dateFormat: 'DMY',
        timeFormat: '24h',
      })
    ).toBe('23/10/2026 16:30 GMT+7');
    expect(
      formatEmailDateTime(moment, {
        language: 'en-US',
        timezone: 'UTC',
        dateFormat: 'MDY',
        timeFormat: '12h',
      })
    ).toBe('10/23/2026 9:30 AM UTC');
  });

  it('moves to the next day where the reader is already there', () => {
    expect(
      formatEmailDateTime(moment, {
        language: 'en-US',
        timezone: 'Pacific/Auckland',
        dateFormat: 'YMD',
        timeFormat: '24h',
      }).startsWith('2026-10-23 22:30')
    ).toBe(true);
  });

  it('keeps Latin digits and the Gregorian year for Thai and Arabic readers', () => {
    for (const language of ['th', 'ar', 'ur', 'hi'] as const) {
      const text = formatEmailDateTime(moment, {
        language,
        timezone: 'Asia/Bangkok',
        dateFormat: 'DMY',
        timeFormat: '24h',
      });
      expect(text).toMatch(/^23\/10\/2026 16:30 /);
    }
  });
});

describe('formatEmailDateTime with no saved formats', () => {
  it('is the long English date in UTC, as e-mail always was', () => {
    const text = formatEmailDateTime(moment, { language: 'en-US' });
    expect(text).toContain('Friday');
    expect(text).toContain('October 23, 2026');
    expect(text).toContain('09:30');
    expect(text).toContain('UTC');
  });

  it("writes the date out in the reader's language", () => {
    expect(formatEmailDateTime(moment, { language: 'de' })).toContain(
      'Oktober'
    );
    expect(formatEmailDateTime(moment, { language: 'fr' })).toContain(
      'octobre'
    );
    expect(formatEmailDateTime(moment, { language: 'es' })).toContain(
      'octubre'
    );
    expect(formatEmailDateTime(moment, { language: 'ja' })).toContain(
      '2026年10月23日'
    );
  });

  it('uses the Gregorian year and Latin digits whatever the language prefers', () => {
    const thai = formatEmailDateTime(moment, { language: 'th' });
    expect(thai).toContain('2026');
    expect(thai).not.toContain('2569');
    const arabic = formatEmailDateTime(moment, { language: 'ar' });
    expect(arabic).toContain('2026');
    expect(arabic).not.toMatch(/[٠-٩]/);
  });

  it('honours a saved 12-hour or 24-hour clock and a saved timezone', () => {
    const twelve = formatEmailDateTime(moment, {
      language: 'en-US',
      timezone: 'America/New_York',
      timeFormat: '12h',
    });
    expect(twelve).toMatch(/05:30\s?AM/);
    const twentyFour = formatEmailDateTime(moment, {
      language: 'en-US',
      timezone: 'America/New_York',
      timeFormat: '24h',
    });
    expect(twentyFour).toContain('05:30');
    expect(twentyFour).not.toMatch(/AM|PM/);
  });

  it('shows -- for an invalid date instead of throwing', () => {
    expect(formatEmailDateTime(new Date('nope'), { language: 'en-US' })).toBe(
      '--'
    );
    expect(formatEmailDate(new Date('nope'), { language: 'en-US' })).toBe('--');
  });
});

describe('formatEmailDate', () => {
  it('is the numeric date in the saved format, in the saved timezone', () => {
    expect(
      formatEmailDate(moment, {
        language: 'en-US',
        timezone: 'Pacific/Auckland',
        dateFormat: 'DMY',
      })
    ).toBe('23/10/2026');
    expect(
      formatEmailDate(moment, { language: 'en-US', dateFormat: 'YMD' })
    ).toBe('2026-10-23');
  });

  it("is the long date in the reader's language without a saved format", () => {
    expect(formatEmailDate(moment, { language: 'en-US' })).toBe(
      'October 23, 2026'
    );
    expect(formatEmailDate(moment, { language: 'de' })).toBe(
      '23. Oktober 2026'
    );
  });
});

describe('formatEmailUsd', () => {
  const english: EmailLocale = { language: 'en-US' };

  it('keeps the bare $ for English, as before', () => {
    expect(formatEmailUsd(29, english, 0)).toBe('$29');
    expect(formatEmailUsd(29.5, english, 0)).toBe('$29.50');
    expect(formatEmailUsd(10.5, english)).toBe('$10.50');
    expect(formatEmailUsd(1234.5, { language: 'en-GB' })).toBe('$1,234.50');
    expect(formatEmailUsd(0, english, 0)).toBe('$0');
  });

  it("writes the amount the way the reader's language does, still in USD", () => {
    const german = formatEmailUsd(29, { language: 'de' }, 0);
    expect(german).toMatch(/^29\s?\$$/);
    const germanFraction = formatEmailUsd(1234.5, { language: 'de' });
    expect(germanFraction).toMatch(/^1\.234,50\s?\$$/);
    expect(formatEmailUsd(10.5, { language: 'ja' })).toBe('$10.50');
    expect(formatEmailUsd(10.5, { language: 'zh' })).toContain('10.50');
    expect(formatEmailUsd(10.5, { language: 'fr' })).toMatch(/^10,50\s?\$/);
  });

  it('keeps Latin digits for Arabic, Hindi and Urdu readers', () => {
    for (const language of ['ar', 'hi', 'ur', 'th'] as const) {
      expect(formatEmailUsd(1234.5, { language })).toMatch(/1[,.\s]?234[.,]50/);
    }
  });
});
