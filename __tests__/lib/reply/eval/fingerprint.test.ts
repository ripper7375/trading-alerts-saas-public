/**
 * @jest-environment node
 */

/**
 * The fingerprint of a run (build step 7 part 10): six things name the configuration a recorded run
 * is evidence about, and a change to any one of them makes the run stale.
 */

import {
  capsSha256,
  currentFingerprint,
  currentParts,
  fingerprintDifferences,
  fingerprintOf,
  fingerprintProblems,
  promptSha256,
  wordingSha256,
} from '@/lib/reply/eval/fingerprint';
import type { FingerprintParts } from '@/lib/reply/eval/fingerprint';

const PARTS: FingerprintParts = {
  model_slug: 'google/gemini-3.6-flash',
  provider: 'google-vertex',
  prompt_version: 'prompts.v1',
  prompt_sha256: 'a'.repeat(64),
  wording_version: 'wording.v1',
  wording_sha256: 'b'.repeat(64),
  caps_sha256: 'c'.repeat(64),
  scenario_set_sha256: 'd'.repeat(64),
};

describe('fingerprintOf', () => {
  it('is a SHA-256 of the parts, the same every time, and the parts are kept beside it', async () => {
    const a = await fingerprintOf(PARTS);
    const b = await fingerprintOf({ ...PARTS });
    expect(a.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toEqual(b);
    expect(a).toMatchObject(PARTS);
  });

  it.each(Object.keys(PARTS) as (keyof FingerprintParts)[])(
    'changes when %s changes',
    async (key) => {
      const base = await fingerprintOf(PARTS);
      const changed = await fingerprintOf({
        ...PARTS,
        [key]: `${PARTS[key]}x`,
      });
      expect(changed.sha256).not.toBe(base.sha256);
    }
  );

  it('does not depend on the order the parts were written in', async () => {
    const reversed = Object.fromEntries(
      Object.entries(PARTS).reverse()
    ) as unknown as FingerprintParts;
    expect((await fingerprintOf(reversed)).sha256).toBe(
      (await fingerprintOf(PARTS)).sha256
    );
  });
});

describe('fingerprintProblems', () => {
  it('accepts a fingerprint made from its parts and refuses a hand-edited one', async () => {
    const good = await fingerprintOf(PARTS);
    expect(await fingerprintProblems(good)).toEqual([]);
    expect(await fingerprintProblems({ ...good, provider: 'another' })).toEqual(
      ['fingerprint.sha256 does not match its parts']
    );
  });

  it('names what is missing, unknown or not a hash', async () => {
    const good = await fingerprintOf(PARTS);
    const { provider: _provider, ...without } = good;
    void _provider;
    expect((await fingerprintProblems(without)).join()).toContain(
      'fingerprint.provider is missing'
    );
    expect(
      (await fingerprintProblems({ ...good, extra: 'x' })).join()
    ).toContain('fingerprint.extra is not a part');
    expect(
      (await fingerprintProblems({ ...good, caps_sha256: 'not a hash' })).join()
    ).toContain('caps_sha256 is not a SHA-256');
    expect(await fingerprintProblems(null)).toEqual([
      'the fingerprint is not an object',
    ]);
    expect(await fingerprintProblems([])).toEqual([
      'the fingerprint is not an object',
    ]);
  });
});

describe('fingerprintDifferences', () => {
  it('says in words what moved, and nothing else', () => {
    expect(fingerprintDifferences(PARTS, PARTS)).toEqual([]);
    expect(
      fingerprintDifferences(PARTS, {
        ...PARTS,
        wording_sha256: 'e'.repeat(64),
        caps_sha256: 'f'.repeat(64),
      })
    ).toEqual(['the wording lists changed', 'the context caps changed']);
    expect(
      fingerprintDifferences(PARTS, {
        ...PARTS,
        model_slug: 'x/y',
        provider: 'z',
      })
    ).toEqual(['the model is another', 'the provider is another']);
  });
});

describe('what the code and the data are right now', () => {
  it('hashes the prompt, the wording lists and the caps, and takes the scenario hash it is given', async () => {
    const parts = await currentParts('e'.repeat(64));
    expect(parts).toMatchObject({
      prompt_version: 'prompts.v1',
      wording_version: 'wording.v1',
      scenario_set_sha256: 'e'.repeat(64),
    });
    expect(parts.prompt_sha256).toBe(await promptSha256());
    expect(parts.wording_sha256).toBe(await wordingSha256());
    expect(parts.caps_sha256).toBe(await capsSha256());
    for (const hash of [
      parts.prompt_sha256,
      parts.wording_sha256,
      parts.caps_sha256,
    ]) {
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(
      new Set([parts.prompt_sha256, parts.wording_sha256, parts.caps_sha256])
        .size
    ).toBe(3);
  });

  it('gives a model the current parts under its own name and host', async () => {
    const parts = await currentParts('e'.repeat(64));
    const a = await currentFingerprint({ slug: 'a/b', provider: 'x' }, parts);
    const b = await currentFingerprint({ slug: 'a/b', provider: 'y' }, parts);
    expect(a).toMatchObject({ model_slug: 'a/b', provider: 'x', ...parts });
    expect(a.sha256).not.toBe(b.sha256);
  });
});
