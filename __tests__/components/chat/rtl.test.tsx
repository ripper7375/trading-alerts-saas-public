/**
 * Right-to-left and the codes that never flip (build step 7 part 8): Arabic and Urdu text flows right
 * to left, while prices, level names, sensor ids (`MCD1`), state codes, rule ids, zone ids, model slugs
 * and request ids stay left to right and untranslated. A structure check of the real cards in Arabic,
 * German and Thai, not a snapshot: it asks which elements carry which direction.
 *
 * A reply written in Arabic is made here by taking the recorded report and putting an Arabic text in
 * the model's lines (the fixture model writes English), with `reply_locale` set to `ar`; every other
 * part of it is the server's recorded answer.
 */

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { screen, waitFor, within } from '@testing-library/react';

import { FixedAnswerCard } from '@/components/chat/fixed-answer-card';
import { formatPrice, LRI, PDI } from '@/components/chat/format';
import { Report1Card } from '@/components/chat/report1-card';
import { AnswerCard } from '@/components/chat/answer-card';
import type { Report1Result } from '@/components/chat/types';
import { textDirection } from '@/lib/i18n/languages';

import { renderIn, waitForLanguage } from '../report2/helpers/render';
import { resultOfKind } from './helpers/fake-fetch';

jest.mock('next/navigation', () => ({
  usePathname: () => '/dev/chat',
}));

const ROOT = join(__dirname, '..', '..', '..');

const arabic = (result: Report1Result): Report1Result => ({
  ...result,
  reply_locale: 'ar',
  report: {
    ...result.report,
    headline: `السعر قرب ${LRI}4,331.58${PDI} داخل نطاق اليوم`,
    alignment: {
      ...result.report.alignment,
      lines: result.report.alignment.lines.map((line) => ({
        ...line,
        text: `يبقى السعر أعلى القاعدة عند ${LRI}4,318.20${PDI}`,
      })),
    },
    watch: result.report.watch.map((line) => ({
      ...line,
      text: `إغلاق أسفل ${LRI}4,350.42${PDI} يلغي القراءة`,
    })),
  },
});

const report = (): Report1Result => resultOfKind('report1-long', 'REPORT1');

/** The language has arrived when its dictionary has: a word of it is on the page (the attribute comes first). */
async function arrived(language: string, word: string): Promise<void> {
  await waitForLanguage(language);
  await waitFor(() => expect(document.body.textContent).toContain(word));
}

describe('Arabic', () => {
  it('the page runs right to left, and the card is in Arabic', async () => {
    renderIn(<Report1Card result={arabic(report())} />, 'ar');
    await arrived('ar', 'تحليل السوق');
    expect(document.documentElement.dir).toBe('rtl');
    expect(textDirection('ar')).toBe('rtl');
    expect(
      screen.getByRole('heading', { name: 'تحليل السوق' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'المستويات' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'مناطق الدخول' })
    ).toBeInTheDocument();
    expect(screen.getByTestId('status-pill')).toHaveTextContent('مباشر');
  });

  it('the model’s text is in a block that says it is Arabic and runs right to left', async () => {
    renderIn(<Report1Card result={arabic(report())} />, 'ar');
    await arrived('ar', 'تحليل السوق');
    const headline = screen.getByTestId('headline');
    expect(headline).toHaveAttribute('lang', 'ar');
    expect(headline).toHaveAttribute('dir', 'rtl');
    for (const block of within(screen.getByTestId('watch-lines')).getAllByText(
      /إغلاق/
    )) {
      expect(block).toHaveAttribute('lang', 'ar');
      expect(block).toHaveAttribute('dir', 'rtl');
    }
  });

  it('every figure and code in the card is drawn in a left-to-right element', async () => {
    const result = report();
    renderIn(<Report1Card result={arabic(result)} />, 'ar');
    await arrived('ar', 'تحليل السوق');
    const card = screen.getByTestId('report1-card');
    const ltr = (text: string) => {
      const found = within(card).getAllByText(text);
      expect(found.length).toBeGreaterThan(0);
      for (const element of found) {
        expect({
          text,
          dir: element.closest('bdi')?.getAttribute('dir') ?? null,
        }).toEqual({ text, dir: 'ltr' });
      }
    };
    // the sensors, their states, the levels, the zones and what they say
    for (const channel of result.report.alignment.channels) {
      ltr(channel.mcd_id);
      if (channel.state_code !== null) ltr(channel.state_code);
    }
    for (const level of result.report.levels) {
      ltr(level.name);
      ltr(formatPrice(level.price, 'ar'));
    }
    for (const zone of result.report.zones) {
      ltr(formatPrice(zone.low, 'ar'));
      ltr(formatPrice(zone.high, 'ar'));
      ltr(formatPrice(zone.reference_price, 'ar'));
      ltr(formatPrice(zone.invalidation_price, 'ar'));
      for (const sensor of zone.source_sensors) ltr(sensor);
    }
    ltr(result.provenance.model as string);
    ltr(result.provenance.prompt_version as string);
    ltr(result.provenance.request_id);
  });

  it('a figure or code inside a SENTENCE is isolated, so the sentence does not reorder it', async () => {
    const result = report();
    renderIn(<Report1Card result={arabic(result)} />, 'ar');
    await arrived('ar', 'تحليل السوق');
    const rule = within(screen.getByTestId('direction-line')).getByText(
      (text) => text.includes(result.report.direction.rule_id)
    );
    expect(rule.textContent).toContain(
      `${LRI}${result.report.direction.rule_id}${PDI}`
    );
    expect(screen.getByTestId('data-stamp').textContent).toContain(LRI);
    // the news calendar's age is a number inside a sentence
    expect(screen.getByTestId('news').textContent).toContain(`${LRI}2${PDI}`);
  });

  it('the structure of a fixed answer: the board, the codes and the reason', async () => {
    renderIn(
      <FixedAnswerCard
        result={resultOfKind('fixed-model-down', 'FIXED_ANSWER')}
      />,
      'ar'
    );
    await arrived('ar', 'نموذج التحليل غير متاح الآن');
    expect(screen.getByTestId('fixed-reason')).toHaveTextContent(
      'نموذج التحليل غير متاح الآن'
    );
    for (const line of screen.getAllByTestId('board-line')) {
      expect(
        within(line)
          .getAllByText(/^MCD\d/)[0]
          ?.closest('bdi')
      ).toHaveAttribute('dir', 'ltr');
    }
  });

  it('a short answer’s ids are isolated inside the "based on" line', async () => {
    renderIn(<AnswerCard result={resultOfKind('answer', 'ANSWER')} />, 'ar');
    await arrived('ar', 'استنادًا');
    const result = resultOfKind('answer', 'ANSWER');
    const line = screen.getByText(
      (text) =>
        text.includes(result.answer.cites[0] as string) &&
        text.includes('استنادًا')
    );
    expect(line.textContent).toContain(`${LRI}${result.answer.cites[0]}${PDI}`);
  });
});

describe('Urdu', () => {
  it('runs right to left as well', async () => {
    renderIn(
      <Report1Card result={{ ...report(), reply_locale: 'ur' }} />,
      'ur'
    );
    await arrived('ur', 'مارکیٹ کا تجزیہ');
    expect(document.documentElement.dir).toBe('rtl');
    expect(
      screen.getByRole('heading', { name: 'مارکیٹ کا تجزیہ' })
    ).toBeInTheDocument();
    expect(screen.getByTestId('headline')).toHaveAttribute('dir', 'rtl');
  });
});

describe('the codes never change with the language', () => {
  const codesOf = (): string[] =>
    [...document.querySelectorAll('.font-mono')]
      .map((element) => element.textContent ?? '')
      .sort();

  it('the same sensors, states, levels, zones, rule, model and request id in English, German, Arabic and Thai', async () => {
    const seen: Record<string, string[]> = {};
    for (const language of ['en-US', 'de', 'ar', 'th']) {
      const { unmount } = renderIn(<Report1Card result={report()} />, language);
      await arrived(
        language,
        {
          'en-US': 'Entry zones',
          de: 'Einstiegszonen',
          ar: 'مناطق الدخول',
          th: 'โซนเข้าเทรด',
        }[language] as string
      );
      seen[language] = codesOf();
      unmount();
    }
    expect(seen['en-US']!.length).toBeGreaterThan(20);
    expect(seen['de']).toEqual(seen['en-US']);
    expect(seen['ar']).toEqual(seen['en-US']);
    expect(seen['th']).toEqual(seen['en-US']);
  });

  it('the figures take the marks of the language, and stay left to right', async () => {
    const result = report();
    const zone = result.report.zones[0]!;
    renderIn(<Report1Card result={result} />, 'de');
    await arrived('de', 'Einstiegszonen');
    const block = within(screen.getAllByTestId('zone')[0] as HTMLElement);
    const text = formatPrice(zone.reference_price, 'de');
    expect(text).toMatch(/^\d\.\d{3},\d{2}$/);
    expect(block.getByText(text).closest('bdi')).toHaveAttribute('dir', 'ltr');
    expect(
      block.queryByText(formatPrice(zone.reference_price, 'en-US'))
    ).not.toBeInTheDocument();
  });

  it('German chrome, Thai chrome: the words are the language’s, the headings are there', async () => {
    const german = renderIn(<Report1Card result={report()} />, 'de');
    await arrived('de', 'Einstiegszonen');
    expect(
      screen.getByRole('heading', { name: 'Marktanalyse' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Einstiegszonen' })
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('direction-line')).getByTestId('bias-pill')
    ).toHaveTextContent('Long (Kauf)');
    german.unmount();
    renderIn(<Report1Card result={report()} />, 'th');
    await arrived('th', 'โซนเข้าเทรด');
    expect(
      screen.getByRole('heading', { name: 'การวิเคราะห์ตลาด' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'โซนเข้าเทรด' })
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('direction-line')).getByTestId('bias-pill')
    ).toHaveTextContent('ลอง (ซื้อ)');
  });
});

describe('logical direction in the source', () => {
  const files = readdirSync(join(ROOT, 'components/chat'))
    .filter((name) => /\.tsx$/.test(name))
    .map(
      (name) =>
        [
          'components/chat/' + name,
          readFileSync(join(ROOT, 'components/chat', name), 'utf8'),
        ] as const
    );
  files.push([
    'components/chat-panel.tsx',
    readFileSync(join(ROOT, 'components/chat-panel.tsx'), 'utf8'),
  ]);

  it('there are components to check', () => {
    expect(files.length).toBeGreaterThan(15);
  });

  it('none uses a physical side where a logical one flips with the language (ms/me/ps/pe/start/end, not ml/mr/pl/pr/left/right)', () => {
    const offenders: string[] = [];
    for (const [name, source] of files) {
      const classes = [
        ...source.matchAll(
          /className=(?:"([^"]*)"|\{`([^`]*)`\}|\{cn\(([^)]*)\)\})/g
        ),
      ]
        .map((m) => m[1] ?? m[2] ?? m[3] ?? '')
        .join(' ');
      for (const token of classes.split(/\s+/)) {
        if (
          /^(?:[a-z]+:)*(?:-?m[lr]-|-?p[lr]-|text-(?:left|right)$|(?:left|right)-\d|float-(?:left|right)|border-[lr](?:-|$)|rounded-[lr](?:-|$))/.test(
            token
          )
        ) {
          offenders.push(`${name}: ${token}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
