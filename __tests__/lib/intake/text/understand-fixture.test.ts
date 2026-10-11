/**
 * @jest-environment node
 */

import {
  buildUnderstandRequest,
  runUnderstand,
  type UnderstandRequest,
} from '@/lib/intake';
import {
  createFixtureUnderstand,
  questionOf,
} from '@/lib/intake/text/understand-fixture';

import { valid } from '../helpers/understand-cases';

const request = (question: string): UnderstandRequest =>
  buildUnderstandRequest(question, []);

describe('the fixture adapter', () => {
  it('returns the recorded output of the question in the request, unchanged', async () => {
    const output = valid({ english: 'Where do I enter?' });
    const port = createFixtureUnderstand([
      { question: 'Dónde entro', output },
      { question: 'Wo einsteigen', output: 'raw text of a reply' },
    ]);
    expect(await port.understand(request('Dónde entro'))).toBe(output);
    expect(await port.understand(request('Wo einsteigen'))).toBe(
      'raw text of a reply'
    );
  });

  it('replays a bad answer as it was recorded, validated by nothing', async () => {
    const bad = { not: 'a result' };
    const port = createFixtureUnderstand([{ question: 'q', output: bad }]);
    expect(await port.understand(request('q'))).toBe(bad);
    expect(await port.understand(request('q'))).toBe(bad);
    const outcome = await runUnderstand(port, { text: 'q', hits: [] });
    expect(outcome).toMatchObject({ ok: false, failure: 'SCHEMA' });
  });

  it('can replay null, undefined, an empty string and false as answers', async () => {
    const port = createFixtureUnderstand([
      { question: 'null', output: null },
      { question: 'undefined', output: undefined },
      { question: 'empty', output: '' },
      { question: 'false', output: false },
    ]);
    expect(await port.understand(request('null'))).toBeNull();
    expect(await port.understand(request('undefined'))).toBeUndefined();
    expect(await port.understand(request('empty'))).toBe('');
    expect(await port.understand(request('false'))).toBe(false);
  });

  it('rejects for a question with no recording, naming the question', async () => {
    const port = createFixtureUnderstand([{ question: 'known', output: 1 }]);
    await expect(port.understand(request('unknown'))).rejects.toThrow(
      /no recorded answer for the question: unknown/
    );
    await expect(port.understand(request('KNOWN'))).rejects.toThrow(
      /no recorded answer/
    );
    await expect(port.understand(request('known '))).rejects.toThrow(
      /no recorded answer/
    );
  });

  it('names at most 80 characters of a long question in the error', async () => {
    const port = createFixtureUnderstand([]);
    const long = 'x'.repeat(200);
    await expect(port.understand(request(long))).rejects.toThrow(
      new RegExp(`question: x{80}$`)
    );
  });

  it('does not take a question for a property of an object', async () => {
    const port = createFixtureUnderstand([]);
    for (const question of [
      'constructor',
      'toString',
      '__proto__',
      'hasOwnProperty',
    ]) {
      await expect(port.understand(request(question))).rejects.toThrow(
        /no recorded answer/
      );
    }
  });

  it('keeps every request it received, oldest first, even those it rejected', async () => {
    const port = createFixtureUnderstand([{ question: 'a', output: 1 }]);
    expect(port.calls).toEqual([]);
    const first = request('a');
    const second = request('b');
    await port.understand(first);
    await port.understand(second).catch(() => undefined);
    await port.understand(first);
    expect(port.calls).toEqual([first, second, first]);
    expect(port.calls[0]).toBe(first);
  });

  it('gives the last recording for a question that was recorded twice', async () => {
    const port = createFixtureUnderstand([
      { question: 'q', output: 'first' },
      { question: 'q', output: 'second' },
    ]);
    expect(await port.understand(request('q'))).toBe('second');
  });

  it('reads the question out of a request, whatever it holds', () => {
    for (const question of [
      'plain',
      '{"a":1}',
      '"quoted"',
      'ça va',
      '黄金',
      'a\nb',
      '',
    ]) {
      expect(questionOf(request(question))).toBe(question);
    }
  });
});
