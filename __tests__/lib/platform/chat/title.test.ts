/**
 * @jest-environment node
 */

import { PACKET_INTENTS } from '@/lib/intake';
import type { Bias, PacketIntent } from '@/lib/intake';
import {
  PREVIEW_MAX_CHARS,
  TITLE_MAX_CHARS,
  deriveThreadTitle,
  previewOf,
  sanitizeTitle,
} from '@/lib/platform/chat/title';

import { SLOT_SECONDS } from '../../reply/helpers/fixtures';

const ch = (code: number): string => String.fromCodePoint(code);
const points = (text: string): number => Array.from(text).length;

const title = (patch: Partial<Parameters<typeof deriveThreadTitle>[0]> = {}) =>
  deriveThreadTitle({
    symbol: 'XAUUSD',
    intent: 'DIRECTION',
    bias: 'LONG',
    cycleSlot: SLOT_SECONDS,
    ...patch,
  });

describe('deriveThreadTitle (decision D15)', () => {
  it('is the symbol, the bias and the cycle slot', () => {
    expect(title()).toBe('XAUUSD · LONG · 18 SEP 20:55');
  });

  it.each([
    ['LONG', 'LONG'],
    ['SHORT', 'SHORT'],
    ['NEUTRAL', 'NEUTRAL'],
    ['STAND_ASIDE', 'STAND ASIDE'],
  ] as [Bias, string][])('writes the bias %s as %s', (bias, word) => {
    expect(title({ bias })).toBe(`XAUUSD · ${word} · 18 SEP 20:55`);
  });

  it('names the chart for an instant prompt', () => {
    expect(title({ intent: 'INSTANT_M15_INSPECT' })).toBe(
      'XAUUSD · M15 · LONG · 18 SEP 20:55'
    );
    expect(title({ intent: 'INSTANT_M5_INSPECT', bias: 'SHORT' })).toBe(
      'XAUUSD · M5 · SHORT · 18 SEP 20:55'
    );
    expect(title({ intent: 'INSTANT_M5_INSPECT', bias: null })).toBe(
      'XAUUSD · M5 · 18 SEP 20:55'
    );
  });

  it('names the intent when there is no bias to name', () => {
    expect(title({ intent: 'EXPLAIN', bias: null })).toBe(
      'XAUUSD · EXPLAIN · 18 SEP 20:55'
    );
    expect(title({ intent: 'NEWS', bias: null })).toBe(
      'XAUUSD · NEWS · 18 SEP 20:55'
    );
    expect(title({ intent: 'EXIT_TARGETS', bias: null })).toBe(
      'XAUUSD · TARGETS · 18 SEP 20:55'
    );
    expect(title({ intent: 'RISK_SIZING', bias: null })).toBe(
      'XAUUSD · SIZING · 18 SEP 20:55'
    );
    expect(title({ intent: 'ENTRY_TIMING', bias: null })).toBe(
      'XAUUSD · ENTRY · 18 SEP 20:55'
    );
    expect(title({ intent: 'REPORT_2', bias: null })).toBe(
      'XAUUSD · TRADE SETUP · 18 SEP 20:55'
    );
    expect(title({ intent: 'DIRECTION', bias: null })).toBe(
      'XAUUSD · DIRECTION · 18 SEP 20:55'
    );
  });

  it('does not repeat the intent when the bias is named', () => {
    expect(title({ intent: 'EXPLAIN', bias: 'LONG' })).toBe(
      'XAUUSD · LONG · 18 SEP 20:55'
    );
  });

  it('leaves out a stamp it does not have', () => {
    expect(title({ cycleSlot: null })).toBe('XAUUSD · LONG');
    expect(title({ cycleSlot: null, bias: null, intent: 'EXPLAIN' })).toBe(
      'XAUUSD · EXPLAIN'
    );
  });

  it('is the same for the same facts and never longer than a title may be', () => {
    expect(title()).toBe(title());
    for (const intent of PACKET_INTENTS as readonly PacketIntent[]) {
      for (const bias of [
        'LONG',
        'SHORT',
        'NEUTRAL',
        'STAND_ASIDE',
        null,
      ] as (Bias | null)[]) {
        const text = title({ intent, bias, symbol: 'A'.repeat(24) });
        expect(points(text)).toBeLessThanOrEqual(TITLE_MAX_CHARS);
      }
    }
  });

  it('is accepted by the checker the trader`s own titles go through', () => {
    expect(sanitizeTitle(title())).toEqual({ ok: true, title: title() });
  });
});

describe('sanitizeTitle', () => {
  it('keeps a plain title', () => {
    expect(sanitizeTitle('Gold on Friday')).toEqual({
      ok: true,
      title: 'Gold on Friday',
    });
  });

  it('trims the ends and collapses white space, a line break becoming a space', () => {
    expect(sanitizeTitle('  Gold   on\nFriday \t')).toEqual({
      ok: true,
      title: 'Gold on Friday',
    });
  });

  it('takes out control characters, separators, overrides and the byte order mark', () => {
    for (const bad of [
      ch(0),
      ch(0x7f),
      ch(0x85),
      ch(0x2028),
      ch(0x2029),
      ch(0x202e),
      ch(0x2066),
      ch(0xfeff),
      ch(0xe0041),
    ]) {
      const result = sanitizeTitle(`Gold${bad}Friday`);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.title).not.toMatch(/[\p{Cc}]/u);
    }
    expect(sanitizeTitle(`Gold${ch(0x202e)}Friday`)).toEqual({
      ok: true,
      title: 'GoldFriday',
    });
    expect(sanitizeTitle(`Gold${ch(0xe0041)}Friday`)).toEqual({
      ok: true,
      title: 'GoldFriday',
    });
  });

  it('keeps the marks other scripts need', () => {
    const persian = `می${ch(0x200c)}خواهم`;
    expect(sanitizeTitle(persian)).toEqual({ ok: true, title: persian });
    expect(sanitizeTitle('الذهب اليوم')).toEqual({
      ok: true,
      title: 'الذهب اليوم',
    });
    expect(sanitizeTitle('金价')).toEqual({ ok: true, title: '金价' });
  });

  it('composes Unicode (NFC), so one title has one spelling', () => {
    const decomposed = `Cafe${ch(0x0301)}`;
    expect(sanitizeTitle(decomposed)).toEqual({
      ok: true,
      title: 'Café'.normalize('NFC'),
    });
  });

  it('refuses an empty title, however it is empty', () => {
    for (const empty of [
      '',
      '   ',
      '\n\t',
      ch(0x202e),
      ch(0xe0041),
      `${ch(0)}${ch(0x2028)}`,
    ]) {
      expect(sanitizeTitle(empty)).toEqual({ ok: false, code: 'EMPTY' });
    }
  });

  it('refuses a title over 80 characters, counting characters and not code units', () => {
    expect(sanitizeTitle('x'.repeat(TITLE_MAX_CHARS))).toEqual({
      ok: true,
      title: 'x'.repeat(80),
    });
    expect(sanitizeTitle('x'.repeat(TITLE_MAX_CHARS + 1))).toEqual({
      ok: false,
      code: 'TOO_LONG',
    });
    const emoji = ch(0x1f4c8);
    expect(sanitizeTitle(emoji.repeat(80)).ok).toBe(true);
    expect(sanitizeTitle(emoji.repeat(81))).toEqual({
      ok: false,
      code: 'TOO_LONG',
    });
  });

  it('measures after cleaning, so a title padded with spaces is judged by what is left', () => {
    expect(
      sanitizeTitle(`${' '.repeat(50)}${'x'.repeat(80)}${' '.repeat(50)}`).ok
    ).toBe(true);
  });
});

describe('previewOf', () => {
  it('keeps a short text as it is', () => {
    expect(previewOf('Counter-trend rally')).toBe('Counter-trend rally');
    expect(previewOf('')).toBe('');
  });

  it('collapses white space and line breaks to single spaces', () => {
    expect(previewOf('  one \n two\t\tthree  ')).toBe('one two three');
  });

  it('replaces controls and overrides with a space', () => {
    expect(previewOf(`a${ch(0x202e)}b`)).toBe('a b');
  });

  it('holds 120 characters, and cuts a longer text with an ellipsis that counts in the 120', () => {
    expect(previewOf('x'.repeat(PREVIEW_MAX_CHARS))).toBe('x'.repeat(120));
    const cut = previewOf('x'.repeat(PREVIEW_MAX_CHARS + 1));
    expect(points(cut)).toBe(120);
    expect(cut).toBe(`${'x'.repeat(119)}…`);
  });

  it('never splits a character in half', () => {
    const emoji = ch(0x1f4c8);
    const cut = previewOf(emoji.repeat(150));
    expect(points(cut)).toBe(120);
    expect(cut.endsWith('…')).toBe(true);
    expect(cut.slice(0, -1)).toBe(emoji.repeat(119));
    for (const c of Array.from(cut.slice(0, -1))) expect(c).toBe(emoji);
  });

  it('does not leave a space before the ellipsis', () => {
    const text = `${'x'.repeat(118)} ${'y'.repeat(30)}`;
    expect(previewOf(text)).toBe(`${'x'.repeat(118)}…`);
  });
});

describe('sanitizeTitle: the separators and the characters next to them', () => {
  it('turns a line or paragraph separator into a space, like a line break', () => {
    expect(sanitizeTitle(`gold${String.fromCodePoint(0x2028)}long`)).toEqual({
      ok: true,
      title: 'gold long',
    });
    expect(sanitizeTitle(`gold${String.fromCodePoint(0x2029)}long`)).toEqual({
      ok: true,
      title: 'gold long',
    });
    expect(sanitizeTitle('gold\nlong\r\n\tshort')).toEqual({
      ok: true,
      title: 'gold long short',
    });
  });

  it('keeps the characters on either side of those separators', () => {
    for (const code of [0x2027, 0x2030, 0x2032]) {
      const char = String.fromCodePoint(code);
      expect(sanitizeTitle(`a${char}b`)).toEqual({
        ok: true,
        title: `a${char}b`,
      });
    }
  });

  it('removes a bidirectional override and a tag character without leaving a space', () => {
    expect(sanitizeTitle(`ab${String.fromCodePoint(0x202e)}cd`)).toEqual({
      ok: true,
      title: 'abcd',
    });
    expect(sanitizeTitle(`ab${String.fromCodePoint(0xe0041)}cd`)).toEqual({
      ok: true,
      title: 'abcd',
    });
  });
});
