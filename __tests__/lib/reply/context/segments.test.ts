/**
 * @jest-environment node
 */

import {
  PROMPT_SEGMENTS,
  SEGMENT_COMPONENTS,
  composePrompt,
  composeSegments,
  prefixOf,
  promptText,
} from '@/lib/reply/context/segments';
import { CONTEXT_COMPONENTS } from '@/lib/reply/contracts/trace-fields';
import type { ContextComponent } from '@/lib/reply/contracts/trace-fields';

const TEXTS: Record<ContextComponent, string | null> = {
  SYSTEM_RULES: 'RULES\n',
  BOARD_SYNTHESIS: 'BOARD\n',
  OHLC: 'OHLC\n',
  CHART: null,
  READINGS_ZONES: 'READINGS\n',
  KNOWLEDGE: 'KNOWLEDGE\n',
  PROFILE_EVENTS: 'PROFILE\n',
  HISTORY: 'HISTORY\n',
  QUESTION: 'QUESTION\n',
  ANSWER: null,
};
const TOKENS: Record<ContextComponent, number> = {
  SYSTEM_RULES: 1,
  BOARD_SYNTHESIS: 2,
  OHLC: 4,
  CHART: 8,
  READINGS_ZONES: 16,
  KNOWLEDGE: 32,
  PROFILE_EVENTS: 64,
  HISTORY: 128,
  QUESTION: 256,
  ANSWER: 512,
};

describe('the segments, in cache order (ADR-049)', () => {
  it('are the static rules, the cycle block, the chart, the user part', () => {
    expect(PROMPT_SEGMENTS).toEqual(['STATIC', 'CYCLE', 'CHART', 'USER']);
    expect(composeSegments(TEXTS, TOKENS, null).map((s) => s.id)).toEqual([
      ...PROMPT_SEGMENTS,
    ]);
  });

  it('hold the components of 5.4 in the order they appear, and every component but the answer is in one', () => {
    expect(SEGMENT_COMPONENTS).toEqual({
      STATIC: ['SYSTEM_RULES'],
      CYCLE: ['BOARD_SYNTHESIS', 'OHLC'],
      CHART: ['CHART'],
      USER: [
        'PROFILE_EVENTS',
        'READINGS_ZONES',
        'KNOWLEDGE',
        'HISTORY',
        'QUESTION',
      ],
    });
    const placed = Object.values(SEGMENT_COMPONENTS).flat();
    expect(new Set(placed).size).toBe(placed.length);
    expect([...placed, 'ANSWER'].sort()).toEqual(
      [...CONTEXT_COMPONENTS].sort()
    );
  });

  it('join the text of their components in that order', () => {
    const [stat, cycle, chart, user] = composeSegments(TEXTS, TOKENS, null);
    expect(stat?.text).toBe('RULES\n');
    expect(cycle?.text).toBe('BOARD\nOHLC\n');
    expect(chart?.text).toBeNull();
    expect(user?.text).toBe(
      'PROFILE\nREADINGS\nKNOWLEDGE\nHISTORY\nQUESTION\n'
    );
  });

  it("add up the size of their components; the answer's room is in none", () => {
    const [stat, cycle, chart, user] = composeSegments(TEXTS, TOKENS, null);
    expect(stat?.tokens).toBe(1);
    expect(cycle?.tokens).toBe(6);
    expect(chart?.tokens).toBe(8);
    expect(user?.tokens).toBe(64 + 16 + 32 + 128 + 256);
  });

  it('say which of them a provider that caches by prefix can serve from its cache', () => {
    const cacheable = composeSegments(TEXTS, TOKENS, null).map((s) => [
      s.id,
      s.cacheable,
    ]);
    expect(cacheable).toEqual([
      ['STATIC', true],
      ['CYCLE', true],
      ['CHART', false],
      ['USER', false],
    ]);
  });

  it("keep the chart's reference, and nothing of it in the text", () => {
    const [, , chart] = composeSegments(TEXTS, TOKENS, 'chart-ref-1');
    expect(chart?.chartRef).toBe('chart-ref-1');
    expect(chart?.text).toBeNull();
    const [, cycle] = composeSegments(TEXTS, TOKENS, 'chart-ref-1');
    expect(cycle?.chartRef).toBeNull();
  });

  it('write nothing for a component with no text', () => {
    const gap = { ...TEXTS, KNOWLEDGE: null };
    expect(composeSegments(gap, TOKENS, null)[3]?.text).toBe(
      'PROFILE\nREADINGS\nHISTORY\nQUESTION\n'
    );
  });
});

describe('composePrompt: the messages the gateway sends', () => {
  it('is a system message with the rules and a user message with the cycle block, then the user part', () => {
    const prompt = composePrompt(composeSegments(TEXTS, TOKENS, null));
    expect(prompt.messages).toEqual([
      {
        role: 'system',
        parts: [{ type: 'text', segment: 'STATIC', text: 'RULES\n' }],
      },
      {
        role: 'user',
        parts: [
          { type: 'text', segment: 'CYCLE', text: 'BOARD\nOHLC\n' },
          {
            type: 'text',
            segment: 'USER',
            text: 'PROFILE\nREADINGS\nKNOWLEDGE\nHISTORY\nQUESTION\n',
          },
        ],
      },
    ]);
  });

  it('puts the chart between the cycle block and the user part when there is one', () => {
    const prompt = composePrompt(composeSegments(TEXTS, TOKENS, 'chart-ref-1'));
    const parts = prompt.messages[1]?.parts.map((p) =>
      p.type === 'chart' ? `chart:${p.ref}` : p.segment
    );
    expect(parts).toEqual(['CYCLE', 'chart:chart-ref-1', 'USER']);
  });

  it('is read as one text, in order, with the chart left out', () => {
    const withChart = composePrompt(composeSegments(TEXTS, TOKENS, 'x'));
    const without = composePrompt(composeSegments(TEXTS, TOKENS, null));
    expect(promptText(without)).toBe(
      'RULES\nBOARD\nOHLC\nPROFILE\nREADINGS\nKNOWLEDGE\nHISTORY\nQUESTION\n'
    );
    expect(promptText(withChart)).toBe(promptText(without));
  });
});

describe('prefixOf: the part a provider that caches by prefix can reuse', () => {
  it('is the static rules and the cycle block, and their size', () => {
    expect(prefixOf(composeSegments(TEXTS, TOKENS, 'x'))).toEqual({
      text: 'RULES\nBOARD\nOHLC\n',
      tokens: 7,
    });
  });

  it('does not depend on the chart, the user part or the answer', () => {
    const a = prefixOf(composeSegments(TEXTS, TOKENS, null));
    const b = prefixOf(
      composeSegments(
        { ...TEXTS, QUESTION: 'another question\n', HISTORY: 'more\n' },
        { ...TOKENS, ANSWER: 1, CHART: 99 },
        'chart'
      )
    );
    expect(b.text).toBe(a.text);
  });
});
