/**
 * Layout guards for Report 2 (build step 5, part 7): right-to-left languages, dark
 * mode and a phone narrower than 380 px.
 *
 * jsdom cannot draw a page, so these tests hold the things a page is made from:
 *  - the markup says right to left in Arabic and Urdu, and a figure inside a sentence
 *    is isolated so the sentence cannot reorder it;
 *  - the classes are logical (start/end, not left/right), so the same markup mirrors;
 *  - every dark-on-light colour has its dark-mode partner in the same declaration;
 *  - nothing is wider than a small phone, and the grids stack below the small
 *    breakpoint.
 * The real pixels were looked at in a browser on the development route
 * (`app/dev/report2`) in dark mode, at 320 and 360 px, and in Arabic.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';

import { screen, waitFor, within } from '@testing-library/react';
import * as ts from 'typescript';

import { Report2Card } from '@/components/report2/report2-card';
import { TradeSetupForm } from '@/components/report2/trade-setup-modal';

import {
  EngineApi,
  offerAnswer,
  offeredModal,
  scene,
  sizeAnswer,
} from './helpers/engine-api';
import { plain, renderIn, waitForLanguage } from './helpers/render';

jest.mock('next/navigation', () => ({
  usePathname: () => '/dev/report2',
}));

const ROOT = resolve(__dirname, '..', '..', '..');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}
const FILES = sourceFiles(join(ROOT, 'components', 'report2'));

/** every string a component writes (class names live in these) */
function strings(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.ES2020,
    true,
    ts.ScriptKind.TSX
  );
  const out: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      out.push(node.text);
    }
    if (ts.isTemplateExpression(node))
      out.push(
        node.head.text,
        ...node.templateSpans.map((s) => s.literal.text)
      );
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

// ---------------------------------------------------------------------------
// the classes
// ---------------------------------------------------------------------------

const PHYSICAL =
  /(?<![\w-])(?:[a-z0-9]+:)*(?:-?(?:ml|mr|pl|pr)-(?:\d|\[|px|auto)|(?:left|right)-(?:\d|\[|px|auto|full)|text-(?:left|right)|border-[lr](?:-|(?![\w-]))|rounded-[lr](?:-|(?![\w-]))|space-x-|float-(?:left|right)|-?translate-x-)/;

describe('direction-neutral classes', () => {
  test('there are components to check', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(14);
  });

  test('no component says left or right: start and end mirror by themselves', () => {
    const found: string[] = [];
    for (const file of FILES) {
      for (const text of strings(file)) {
        for (const token of text.split(/\s+/)) {
          if (PHYSICAL.test(token))
            found.push(`${file.slice(ROOT.length + 1)}: ${token}`);
        }
      }
    }
    expect(found).toEqual([]);
  });

  test('the guard sees what it should', () => {
    for (const bad of [
      'ml-2',
      'sm:pr-4',
      'text-left',
      'border-l',
      'rounded-r-md',
      'left-0',
      'space-x-2',
      '-ml-1',
      'float-right',
    ]) {
      expect(PHYSICAL.test(bad)).toBe(true);
    }
    for (const good of [
      'ms-2',
      'pe-4',
      'text-start',
      'border-s',
      'rounded-e-md',
      'start-0',
      'gap-2',
      'ml',
      'sm:ms-2',
    ]) {
      expect(PHYSICAL.test(good)).toBe(false);
    }
  });

  test('uses the logical ones where something is pushed to a side', () => {
    const all = FILES.flatMap(strings).join(' ');
    expect(all).toMatch(/\bms-\d/);
    expect(all).toMatch(/\btext-(start|end)\b/);
    expect(all).toMatch(/\bps-\d/);
  });
});

describe('dark mode', () => {
  const NEEDS_PARTNER =
    /\btext-(red|emerald|amber|sky|green|blue|yellow)-(600|700|800|900|950)\b/;

  test('every dark-on-light text colour has a dark: partner in the same declaration', () => {
    const lonely: string[] = [];
    for (const file of FILES) {
      for (const text of strings(file)) {
        // split the declaration into its colour tokens: a base token without a variant prefix
        const base = text
          .split(/\s+/)
          .filter((t) => NEEDS_PARTNER.test(t) && !t.includes(':'));
        if (base.length > 0 && !/\bdark:text-/.test(text)) {
          lonely.push(`${file.slice(ROOT.length + 1)}: ${text}`);
        }
      }
    }
    expect(lonely).toEqual([]);
  });

  test('the semantic tokens of the theme carry the rest (background, border, muted text), which switch by themselves', () => {
    const all = FILES.flatMap(strings).join(' ');
    for (const token of [
      'bg-card',
      'text-muted-foreground',
      'bg-background',
      'border-input',
      'text-primary-foreground',
    ]) {
      expect(all).toContain(token);
    }
    // and no hard-coded white or black that a dark theme could not turn round
    expect(all).not.toMatch(/\b(bg|text|border)-(white|black)\b/);
    expect(all).not.toMatch(
      /\b(bg|text)-(gray|slate|zinc|neutral|stone)-\d{3}\b/
    );
  });

  test('a coloured fill is translucent, so it reads on both a light and a dark page', () => {
    const fills = FILES.flatMap(strings)
      .flatMap((text) => text.split(/\s+/))
      .filter((token) =>
        /^(?:[a-z]+:)*bg-(red|emerald|amber|sky)-\d{3}(?:\/\d+)?$/.test(token)
      );
    expect(fills.length).toBeGreaterThan(5);
    for (const token of fills) expect(token).toMatch(/\/\d+$/);
  });
});

describe('a small phone (under 380 px)', () => {
  test('nothing is given a fixed width beyond what a 320 px phone has', () => {
    const wide: string[] = [];
    for (const file of FILES) {
      for (const text of strings(file)) {
        for (const match of text.matchAll(
          /(?<![\w-])(?:[a-z0-9]+:)*(?:min-w|w)-\[(\d+)px\]/g
        )) {
          if (Number(match[1]) > 300)
            wide.push(`${file.slice(ROOT.length + 1)}: ${match[0]}`);
        }
      }
    }
    expect(wide).toEqual([]);
  });

  test('the dialog is a screen-wide sheet with a 16 px gutter that scrolls, not a fixed box', () => {
    const modal = readFileSync(
      join(ROOT, 'components/report2/trade-setup-modal.tsx'),
      'utf8'
    );
    expect(modal).toContain('w-[calc(100vw-1rem)]');
    expect(modal).toContain('max-h-[92vh]');
    expect(modal).toContain('overflow-y-auto');
    expect(modal).toContain('p-4 sm:p-6');
  });

  test('the scenario cards, the three fields and the buttons stack below the small breakpoint', () => {
    const all = FILES.flatMap(strings).join(' ');
    expect(all).toContain('grid-cols-1 gap-2 sm:grid-cols-3');
    expect(all).toContain('grid-cols-1 gap-3 sm:grid-cols-3');
    expect(all).toContain('flex-col-reverse');
    expect(all).toContain('w-full');
    expect(all).toContain('sm:w-auto');
  });

  test('long words and numbers wrap or truncate inside their box instead of pushing the page sideways', () => {
    const all = FILES.flatMap(strings).join(' ');
    expect(all).toContain('min-w-0');
    expect(all).toContain('break-words');
    expect(all).toContain('flex-wrap');
  });

  test('a tap target is at least 40 px tall (the buttons are h-10)', () => {
    const bar = readFileSync(
      join(ROOT, 'components/report2/consent-bar.tsx'),
      'utf8'
    );
    expect(bar).toContain('h-10');
  });
});

// ---------------------------------------------------------------------------
// the markup in Arabic and Urdu
// ---------------------------------------------------------------------------

describe.each([
  ['ar', 'أنت من تضع الأمر لدى وسيطك'],
  ['ur', 'آرڈر آپ خود اپنے بروکر کے پاس لگاتے ہیں'],
])('%s', (language, sentence) => {
  test('the card says right to left, the page too, and the words are in the language', async () => {
    const world = scene();
    const answer = sizeAnswer(world, {
      zoneId: 'Z1',
      entry: '4367.20',
      equity: '10000',
      riskPct: '0.75',
      stopDistance: '16.78',
      rrr: '1.75',
    });
    renderIn(
      <Report2Card
        setup={answer.setup}
        badge={answer.badge}
        offer={answer.offer}
      />,
      language
    );
    await waitForLanguage(language);
    await waitFor(() =>
      expect(screen.getByTestId('report2-compulsory').textContent).toContain(
        sentence
      )
    );
    expect(screen.getByTestId('report2-card')).toHaveAttribute('dir', 'rtl');
    expect(document.documentElement.dir).toBe('rtl');
    expect(screen.getByTestId('report2-card')).not.toHaveTextContent(
      'Declared risk'
    );
  });

  test('a figure inside a sentence is isolated; a figure on a line of its own is a bdi', async () => {
    const world = scene();
    const answer = sizeAnswer(world, {
      zoneId: 'Z1',
      entry: '4367.20',
      equity: '10000',
      riskPct: '0.75',
      stopDistance: '16.78',
      rrr: '1.75',
    });
    renderIn(
      <Report2Card
        setup={answer.setup}
        badge={answer.badge}
        offer={answer.offer}
      />,
      language
    );
    await waitForLanguage(language);
    await waitFor(() =>
      expect(screen.getByTestId('report2-compulsory').textContent).toContain(
        sentence
      )
    );
    const room = screen.getByTestId('report2-room').textContent ?? '';
    // the level name and the price are wrapped in isolates, so the Arabic sentence cannot reorder them
    expect(room).toMatch(/⁨[^⁩]*sr_1[^⁩]*⁩/);
    expect(plain(room)).toContain('M15 sr_1');
    expect(
      screen.getByTestId('report2-risk-pair').querySelectorAll('bdi').length
    ).toBeGreaterThan(3);
  });

  test('the modal form says right to left, keeps the number fields left to right, and the buttons are in the language', async () => {
    const world = scene();
    const modal = offeredModal(offerAnswer(world));
    renderIn(
      <TradeSetupForm
        modal={modal}
        cycleSlot={String(world.s.slot)}
        api={new EngineApi(world)}
        debounceMs={0}
      />,
      language
    );
    await waitForLanguage(language);
    await waitFor(() =>
      expect(screen.getByTestId('report2-modal-form')).toHaveAttribute(
        'data-sizing',
        'false'
      )
    );
    expect(screen.getByTestId('report2-modal-form')).toHaveAttribute(
      'dir',
      'rtl'
    );
    // a typed number is read left to right in every language
    for (const id of ['report2-equity', 'report2-risk', 'report2-rrr']) {
      expect(screen.getByTestId(id)).toHaveAttribute('dir', 'ltr');
    }
    const buttons = within(screen.getByTestId('report2-consent')).getAllByRole(
      'button'
    );
    expect(buttons).toHaveLength(3);
    for (const button of buttons)
      expect(button.textContent).not.toMatch(/Accept|Modify|Decline/);
    // the zone pills keep their rank order: Z1 first, in the markup, whatever the direction
    const zones = within(screen.getByTestId('report2-pills'))
      .getAllByRole('radio')
      .map((r) => (r as HTMLInputElement).value);
    expect(zones).toEqual(['Z1', 'Z2', 'CUSTOM']);
  });
});

describe('left to right languages', () => {
  test('English says left to right and wraps nothing in isolate marks', async () => {
    const world = scene();
    const answer = sizeAnswer(world, {
      zoneId: 'Z1',
      entry: '4367.20',
      equity: '10000',
      riskPct: '0.75',
      stopDistance: '16.78',
      rrr: '1.75',
    });
    renderIn(
      <Report2Card
        setup={answer.setup}
        badge={answer.badge}
        offer={answer.offer}
      />,
      'en-US'
    );
    expect(screen.getByTestId('report2-card')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByTestId('report2-card').textContent).not.toMatch(/[⁦-⁩]/);
  });
});
