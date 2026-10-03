import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * The test helper that starts the Python runner (`helpers/kit-runner.ts`) writes an all-`shadow` worker configuration
 * into a folder of its own under the operating system's temporary folder. Until build step 3 part 7 that folder was
 * never removed (134 `mcd-shadow-*` folders had piled up by then). It is now removed by an `afterAll` the helper
 * registers itself, in every spec file that loads it.
 *
 * This spec loads a private copy of the helper, with `afterAll` replaced by a recorder for the moment of loading, and
 * checks what the helper registered and what it does when Jest calls it. That Jest does call an `afterAll` at the end
 * of a file is Jest's contract; the count of `mcd-shadow-*` folders before and after a whole run is the end-to-end
 * check (the hand-off for part 7 records it).
 */

type KitRunner = typeof import('./helpers/kit-runner');

function loadHelper(): { helper: KitRunner; registered: Array<() => void> } {
  const registered: Array<() => void> = [];
  const original = (globalThis as { afterAll?: unknown }).afterAll;
  (globalThis as { afterAll?: unknown }).afterAll = (hook: () => void) => {
    registered.push(hook);
  };
  let helper: KitRunner | undefined;
  try {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      helper = require('./helpers/kit-runner') as KitRunner;
    });
  } finally {
    (globalThis as { afterAll?: unknown }).afterAll = original;
  }
  return { helper: helper as KitRunner, registered };
}

describe('the kit-runner helper cleans up after itself', () => {
  it('registers exactly one afterAll when it is loaded, and loading it makes no folder', () => {
    const before = fs
      .readdirSync(os.tmpdir())
      .filter((n) => n.startsWith('mcd-shadow-'));
    const { registered } = loadHelper();
    expect(registered).toHaveLength(1);
    const after = fs
      .readdirSync(os.tmpdir())
      .filter((n) => n.startsWith('mcd-shadow-'));
    expect(after).toEqual(before);
  });

  it('makes one folder for its configuration under the temporary folder, and the registered hook deletes it', () => {
    const { helper, registered } = loadHelper();
    const file = helper.shadowConfigPath();
    const dir = path.dirname(file);
    expect(path.dirname(dir)).toBe(os.tmpdir());
    expect(path.basename(dir)).toMatch(/^mcd-shadow-/);
    expect(fs.readFileSync(file, 'utf8')).toContain('MCD3: shadow');
    expect(helper.shadowConfigPath()).toBe(file); // made once

    registered[0]();
    expect(fs.existsSync(dir)).toBe(false);
  });

  it('deleting twice, or before anything was made, does nothing', () => {
    const { helper, registered } = loadHelper();
    expect(() => registered[0]()).not.toThrow();
    const dir = path.dirname(helper.shadowConfigPath());
    helper.removeShadowConfig();
    expect(() => helper.removeShadowConfig()).not.toThrow();
    expect(fs.existsSync(dir)).toBe(false);
  });

  it('after a deletion the next use makes a new folder, which is deleted in its turn', () => {
    const { helper } = loadHelper();
    const first = path.dirname(helper.shadowConfigPath());
    helper.removeShadowConfig();
    const second = path.dirname(helper.shadowConfigPath());
    expect(second).not.toBe(first);
    expect(fs.existsSync(second)).toBe(true);
    helper.removeShadowConfig();
    expect(fs.existsSync(second)).toBe(false);
  });

  it('outside Jest (no afterAll) loading the helper registers nothing and does not fail', () => {
    const original = (globalThis as { afterAll?: unknown }).afterAll;
    (globalThis as { afterAll?: unknown }).afterAll = undefined;
    try {
      expect(() =>
        jest.isolateModules(() => {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('./helpers/kit-runner');
        })
      ).not.toThrow();
    } finally {
      (globalThis as { afterAll?: unknown }).afterAll = original;
    }
  });

  it('removes only the folder it made: another mcd-shadow-* folder next to it is left alone', () => {
    const { helper } = loadHelper();
    const stranger = fs.mkdtempSync(path.join(os.tmpdir(), 'mcd-shadow-'));
    try {
      helper.shadowConfigPath();
      helper.removeShadowConfig();
      expect(fs.existsSync(stranger)).toBe(true);
    } finally {
      fs.rmSync(stranger, { recursive: true, force: true });
    }
  });
});
