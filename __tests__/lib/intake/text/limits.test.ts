/**
 * @jest-environment node
 */

import {
  ENGLISH_MAX_CHARS,
  MAX_GLOSSARY_HINTS,
  MAX_RESULT_TOKENS,
  NORMALIZED_MAX_CHARS,
  QUESTION_MAX_CHARS,
  REFUSAL_CODES,
  REFUSAL_STAGE,
  glossaryHints,
  normalizeQuestion,
  passTheDoor,
  spotTerms,
  validatePacket,
} from '@/lib/intake';
import * as limits from '@/lib/intake/text/limits';

import { BASE, variant } from '../helpers/validate';

describe('the limits', () => {
  it('are the starting values of the plan: 500 typed, 1,000 normalised or in English', () => {
    expect(QUESTION_MAX_CHARS).toBe(500);
    expect(NORMALIZED_MAX_CHARS).toBe(1000);
    expect(ENGLISH_MAX_CHARS).toBe(1000);
    expect(MAX_GLOSSARY_HINTS).toBe(16);
    expect(MAX_RESULT_TOKENS).toBe(8);
  });

  it('re-export the packet’s own limits, so the door and the packet cannot disagree', () => {
    expect(limits.QUESTION_MAX_CHARS).toBe(QUESTION_MAX_CHARS);
    expect(limits.ENGLISH_MAX_CHARS).toBe(ENGLISH_MAX_CHARS);
  });

  it('are the ones the packet validator enforces on the question and its English text', () => {
    const typed = variant((p) => {
      p.question.source = 'TYPED';
      p.question.original = 'x'.repeat(QUESTION_MAX_CHARS);
      p.question.english = 'y'.repeat(ENGLISH_MAX_CHARS);
      p.intent = 'DIRECTION';
    });
    expect(validatePacket(typed).ok).toBe(true);
    const tooLong = variant((p) => {
      p.question.source = 'TYPED';
      p.question.original = 'x'.repeat(QUESTION_MAX_CHARS + 1);
      p.intent = 'DIRECTION';
    });
    expect(validatePacket(tooLong).ok).toBe(false);
    expect(validatePacket(BASE).ok).toBe(true);
  });

  it('stop the hints and the tokens where the contract stops them', () => {
    // a question can name no more hints than the prompt carries
    const hits = spotTerms(
      'buy sell gold stop loss take profit entry support resistance trend UOEDT LOEDT baseline'
    );
    expect(hits).toHaveLength(12);
    expect(glossaryHints(hits).length).toBeLessThanOrEqual(MAX_GLOSSARY_HINTS);
  });
});

describe('the door', () => {
  const door = (raw: string) => passTheDoor(raw);

  it('lets an ordinary question in, normalised, with the original kept', () => {
    const result = door('  Should I buy  gold now?\n');
    expect(result).toEqual({
      ok: true,
      question: normalizeQuestion('  Should I buy  gold now?\n'),
    });
    expect(result.ok && result.question.text).toBe('Should I buy gold now?');
    expect(result.ok && result.question.original).toBe(
      '  Should I buy  gold now?\n'
    );
  });

  it('refuses a question of 501 characters and lets in one of 500', () => {
    expect(door('a'.repeat(500)).ok).toBe(true);
    expect(door('a'.repeat(501))).toEqual({
      ok: false,
      code: 'QUESTION_TOO_LONG',
    });
    expect(door('a'.repeat(100000))).toEqual({
      ok: false,
      code: 'QUESTION_TOO_LONG',
    });
  });

  it('counts in UTF-16 code units, the unit of the packet validator', () => {
    expect(door('😀'.repeat(250)).ok).toBe(true); // 500 units
    expect(door('😀'.repeat(251))).toEqual({
      ok: false,
      code: 'QUESTION_TOO_LONG',
    }); // 502
    expect(door('金'.repeat(500)).ok).toBe(true);
    expect(door('金'.repeat(501)).ok).toBe(false);
  });

  it('measures the typed question before it normalises it', () => {
    // white space and zero-width characters count, and a text of nothing else is too long, not empty
    expect(door(' '.repeat(501))).toEqual({
      ok: false,
      code: 'QUESTION_TOO_LONG',
    });
    expect(door('\u200b'.repeat(501))).toEqual({
      ok: false,
      code: 'QUESTION_TOO_LONG',
    });
    expect(door(`${'\u200b'.repeat(499)}gold`).ok).toBe(false);
    expect(door(`${'\u200b'.repeat(496)}gold`).ok).toBe(true);
  });

  it('refuses a question with nothing in it as empty', () => {
    for (const raw of [
      '',
      ' ',
      '   \t\n  ',
      '\u200b',
      '\u200b\u200c\u200d\ufeff',
      '\u202e\u202c',
      '\u0000\u0007',
      '　 ',
      '\ud800',
      '\u{e0041}',
    ]) {
      expect({ raw, result: door(raw) }).toEqual({
        raw,
        result: { ok: false, code: 'QUESTION_EMPTY' },
      });
    }
    expect(door('.').ok).toBe(true);
    expect(door('?').ok).toBe(true);
    expect(door('0').ok).toBe(true);
  });

  it('refuses a question that is short but grows past 1,000 characters when normalised', () => {
    // U+FDFA is one character and becomes 18
    expect(door('ﷺ'.repeat(55)).ok).toBe(true); // 990
    expect(normalizeQuestion('ﷺ'.repeat(55)).text).toHaveLength(990);
    expect(door('ﷺ'.repeat(56))).toEqual({
      ok: false,
      code: 'QUESTION_TOO_LONG',
    }); // 1008
    expect(door('ﷺ'.repeat(500))).toEqual({
      ok: false,
      code: 'QUESTION_TOO_LONG',
    });
  });

  it('lets in a question whose normalised form is exactly 1,000 and refuses 1,001', () => {
    const exactly = `${'ﷺ'.repeat(55)}${'a'.repeat(10)}`;
    expect(normalizeQuestion(exactly).text).toHaveLength(1000);
    expect(door(exactly).ok).toBe(true);
    expect(door(`${exactly}a`)).toEqual({
      ok: false,
      code: 'QUESTION_TOO_LONG',
    });
  });

  it('answers with codes the refusal contract has, at the stage of the door', () => {
    for (const raw of ['', 'a'.repeat(501)]) {
      const result = door(raw);
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(REFUSAL_CODES).toContain(result.code);
      expect(REFUSAL_STAGE[result.code]).toBe('DOOR');
    }
  });

  it('keeps the flags of the normaliser on the question it lets in', () => {
    const result = door('risk 4.377');
    expect(result.ok && result.question.flags).toEqual(['AMBIGUOUS_NUMBER']);
  });
});
