import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ENGINE_DIR } from './helpers/cycle-fixtures';
import { pythonAvailable } from './helpers/kit-runner';

/**
 * The copy of the Python sensor engine inside this package (build step 3, `scripts/sync-sensor-kit.js`).
 *
 * Railway builds `railway-gateway/` alone, so the worker's engine folder (SENSOR_ENGINE_DIR) has to be inside
 * the package. `sensors/` holds 34 runtime files copied byte for byte from
 * `davintrade-stack-d-and-e/engine-1-5-new/` (docs/runbooks/deploy-stack-d-step3.md section 2.2). Three things can
 * go wrong without anything failing loudly, and each has a block below:
 *
 *   1. The engine changes and the copy is not refreshed: the image runs yesterday's evaluators.
 *   2. The list is wrong: a file the runner opens is missing (the worker fails at the first cycle, in the
 *      image only) or one it never opens is shipped.
 *   3. The script itself: `--check` says "fine" when it is not, or `sync` writes outside `sensors/`.
 *
 * The list below is written out on purpose. If it were read from the script, a wrong edit of the script's list
 * would pass this spec.
 *
 * This spec reads files outside the package, like six existing gateway specs (the checkout must be whole).
 */

// Each scratch test copies 35 files and starts node a few times; `npm run` and Python start slowly on Windows.
jest.setTimeout(60_000);

const PACKAGE_DIR = path.resolve(__dirname, '..');
const SCRIPT = path.join(PACKAGE_DIR, 'scripts', 'sync-sensor-kit.js');
const COPY_DIR = path.join(PACKAGE_DIR, 'sensors');
const ENGINE_REL = path.join('davintrade-stack-d-and-e', 'engine-1-5-new');

const RUNTIME_FILES = [
  'mcd_common/__init__.py',
  'mcd_common/budget.py',
  'mcd_common/cycle_inputs.py',
  'mcd_common/envelope.py',
  'mcd_common/preflight.py',
  'mcd_common/reason_codes.py',
  'mcd_common/testing.py',
  'mcd_common/wording.py',
  'mcd_common/mcd-output-1.schema.json',
  'mcd0/mcd0_evaluator.py',
  'mcd0/mcd0_params.yaml',
  'mcd0/mcd0_registry.yaml',
  'mcd1/mcd1_evaluator.py',
  'mcd1/mcd1_params.yaml',
  'mcd1/mcd1_registry.yaml',
  'mcd2/mcd2_evaluator.py',
  'mcd2/mcd2_params.yaml',
  'mcd2/mcd2_registry.yaml',
  'mcd3/mcd3_evaluator.py',
  'mcd3/mcd3_params.yaml',
  'mcd3/mcd3_registry.yaml',
  'mcd_worker/__init__.py',
  'mcd_worker/cli.py',
  'mcd_worker/cycle_runner.py',
  'mcd_worker/errors.py',
  'mcd_worker/flags.py',
  'mcd_worker/guards.py',
  'mcd_worker/inheritance.py',
  'mcd_worker/registry.py',
  'mcd_worker/worker_config.yaml',
  'mcd_worker/checklists/MCD0.yaml',
  'mcd_worker/checklists/MCD1.yaml',
  'mcd_worker/checklists/MCD2.yaml',
  'mcd_worker/checklists/MCD3.yaml',
] as const;

const SORTED_FILES = [...RUNTIME_FILES].sort();
const TOTAL_BYTES = RUNTIME_FILES.reduce(
  (sum, f) => sum + fs.statSync(path.join(ENGINE_DIR, f)).size,
  0
);

interface Run {
  status: number | null;
  stdout: string;
  stderr: string;
}

/** Every file under `dir` (relative, forward slashes, sorted), without Python's own caches. */
function listFiles(dir: string, base = dir): string[] {
  if (!fs.existsSync(dir)) return [];
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__pycache__') found.push(...listFiles(full, base));
    } else if (!entry.name.endsWith('.pyc')) {
      found.push(path.relative(base, full).split(path.sep).join('/'));
    }
  }
  return found.sort();
}

function runScript(script: string, ...args: string[]): Run {
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd: path.dirname(path.dirname(script)),
    encoding: 'utf8',
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

// ---------------------------------------------------------------------------------------------------------------
// The list itself
// ---------------------------------------------------------------------------------------------------------------

describe('the list of runtime files', () => {
  it('has 34 distinct files, and every one exists in the engine', () => {
    expect(RUNTIME_FILES).toHaveLength(34);
    expect(new Set(RUNTIME_FILES).size).toBe(34);
    const missing = RUNTIME_FILES.filter(
      (f) => !fs.existsSync(path.join(ENGINE_DIR, f))
    );
    expect(missing).toEqual([]);
  });

  it('holds the kit, the four MCDs (evaluator, parameters, registry) and the cycle runner, and nothing that only tests use', () => {
    const byFolder = (folder: string) =>
      RUNTIME_FILES.filter((f) => f.startsWith(`${folder}/`)).length;
    expect(byFolder('mcd_common')).toBe(9);
    for (const n of [0, 1, 2, 3]) {
      expect(byFolder(`mcd${n}`)).toBe(3);
      for (const kind of ['evaluator.py', 'params.yaml', 'registry.yaml'])
        expect(RUNTIME_FILES).toContain(`mcd${n}/mcd${n}_${kind}`);
    }
    expect(byFolder('mcd_worker')).toBe(13);
    // Fixtures, tests, concept notes and the statistics engine are not per-cycle runtime.
    const notRuntime = RUNTIME_FILES.filter((f) =>
      /(^|\/)(tests?|fixtures|statistics|tools|legacy|concept)\//.test(f)
    );
    expect(notRuntime).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The real copy in railway-gateway/sensors/
// ---------------------------------------------------------------------------------------------------------------

describe('railway-gateway/sensors/ (run `npm run sync:sensor-kit` when this block fails)', () => {
  it('holds exactly the 34 runtime files', () => {
    expect(listFiles(COPY_DIR)).toEqual(SORTED_FILES);
  });

  it.each(RUNTIME_FILES)('%s equals the engine’s file byte for byte', (f) => {
    const source = fs.readFileSync(path.join(ENGINE_DIR, f));
    const copy = fs.readFileSync(path.join(COPY_DIR, f));
    expect(source.equals(copy)).toBe(true);
  });

  it('`node scripts/sync-sensor-kit.js --check` passes and says what it checked', () => {
    const r = runScript(SCRIPT, '--check');
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    expect(r.stdout).toContain(
      `34 files, ${TOTAL_BYTES.toLocaleString('en-US')} bytes`
    );
  });

  it('`npm run check:sensor-kit` passes', () => {
    const r = spawnSync('npm run --silent check:sensor-kit', {
      cwd: PACKAGE_DIR,
      encoding: 'utf8',
      shell: true,
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('34 files');
  });

  it('is wired into package.json', () => {
    const scripts = JSON.parse(
      fs.readFileSync(path.join(PACKAGE_DIR, 'package.json'), 'utf8')
    ).scripts;
    expect(scripts['sync:sensor-kit']).toBe('node scripts/sync-sensor-kit.js');
    expect(scripts['check:sensor-kit']).toBe(
      'node scripts/sync-sensor-kit.js --check'
    );
  });

  const maybe = pythonAvailable() ? it : it.skip;
  maybe(
    'runs on its own: the kit, the worker, four registries, four checklists and the configuration load with no other file and without openpyxl or tiktoken',
    () => {
      const code = [
        'import sys, json',
        // A None entry makes `import X` raise ImportError, as on a machine without the package.
        "sys.modules['openpyxl'] = None",
        "sys.modules['tiktoken'] = None",
        'import mcd_common, mcd_worker.cli, mcd_worker.cycle_runner, mcd_worker.guards, mcd_worker.inheritance',
        'from mcd_worker.registry import load_registry',
        'from mcd_worker.flags import load_checklists, load_worker_config',
        'print(json.dumps({"registry": sorted(load_registry()), "checklists": sorted(load_checklists()), "flags": sorted(load_worker_config().flags)}))',
      ].join('\n');
      const r = spawnSync('python', ['-B', '-c', code], {
        cwd: COPY_DIR,
        encoding: 'utf8',
        env: {
          ...process.env,
          PYTHONDONTWRITEBYTECODE: '1',
          PYTHONIOENCODING: 'utf-8',
        },
        timeout: 60_000,
      });
      expect(r.stderr).toBe('');
      expect(r.status).toBe(0);
      const ids = ['MCD0', 'MCD1', 'MCD2', 'MCD3'];
      expect(JSON.parse(r.stdout)).toEqual({
        registry: ids,
        checklists: ids,
        flags: ids,
      });
      // `-B` and PYTHONDONTWRITEBYTECODE: the check must not have left a cache in the folder the image ships.
      expect(
        fs
          .readdirSync(path.join(COPY_DIR, 'mcd_worker'))
          .includes('__pycache__')
      ).toBe(false);
    }
  );
});

// ---------------------------------------------------------------------------------------------------------------
// The script, on a scratch checkout (it finds the engine and the copy from its own location, so a copy of the
// script in a scratch tree touches only that tree)
// ---------------------------------------------------------------------------------------------------------------

describe('scripts/sync-sensor-kit.js on a scratch checkout', () => {
  const roots: string[] = [];

  function scratch(): { root: string; script: string; copy: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensor-kit-'));
    roots.push(root);
    const script = path.join(
      root,
      'railway-gateway',
      'scripts',
      'sync-sensor-kit.js'
    );
    fs.mkdirSync(path.dirname(script), { recursive: true });
    fs.copyFileSync(SCRIPT, script);
    for (const f of RUNTIME_FILES) {
      const to = path.join(root, ENGINE_REL, f);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(path.join(ENGINE_DIR, f), to);
    }
    return {
      root,
      script,
      copy: path.join(root, 'railway-gateway', 'sensors'),
    };
  }

  afterEach(() => {
    for (const root of roots.splice(0))
      fs.rmSync(root, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      });
  });

  it('creates the folder, copies the 34 files and reports the count and the total bytes', () => {
    const { script, copy } = scratch();
    expect(fs.existsSync(copy)).toBe(false);
    const r = runScript(script);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain(
      `34 files, ${TOTAL_BYTES.toLocaleString('en-US')} bytes`
    );
    expect(r.stdout).toContain('34 written, 0 already identical');
    expect(listFiles(copy)).toEqual(SORTED_FILES);
    for (const f of RUNTIME_FILES)
      expect(
        fs
          .readFileSync(path.join(copy, f))
          .equals(fs.readFileSync(path.join(ENGINE_DIR, f)))
      ).toBe(true);
  });

  it('passes `--check` straight after a sync, and a second sync writes nothing', () => {
    const { script } = scratch();
    expect(runScript(script).status).toBe(0);
    const check = runScript(script, '--check');
    expect(check.status).toBe(0);
    expect(check.stderr).toBe('');
    const again = runScript(script);
    expect(again.status).toBe(0);
    expect(again.stdout).toContain('0 written, 34 already identical');
  });

  it('writes only inside railway-gateway/sensors/', () => {
    const { root, script } = scratch();
    const before = listFiles(root);
    expect(runScript(script).status).toBe(0);
    const added = listFiles(root).filter((f) => !before.includes(f));
    expect(added).toHaveLength(34);
    expect(added.every((f) => f.startsWith('railway-gateway/sensors/'))).toBe(
      true
    );
    expect(listFiles(root).filter((f) => before.includes(f))).toEqual(before);
  });

  it('--check on a missing folder fails, names all 34 files, and does not create the folder', () => {
    const { script, copy } = scratch();
    const r = runScript(script, '--check');
    expect(r.status).toBe(1);
    expect(r.stderr.match(/^ {2}missing {4}/gm)).toHaveLength(34);
    expect(fs.existsSync(copy)).toBe(false);
  });

  it('--check catches a file that differs by one byte of the same length, and changes nothing', () => {
    const { script, copy } = scratch();
    runScript(script);
    const target = path.join(copy, 'mcd_worker', 'guards.py');
    const bytes = fs.readFileSync(target);
    bytes[Math.floor(bytes.length / 2)] ^= 0x20;
    fs.writeFileSync(target, bytes);
    const r = runScript(script, '--check');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('different  mcd_worker/guards.py');
    expect(r.stderr).not.toContain('missing');
    expect(fs.readFileSync(target).equals(bytes)).toBe(true);
  });

  it('--check catches a missing file, and a sync puts it back', () => {
    const { script, copy } = scratch();
    runScript(script);
    fs.rmSync(path.join(copy, 'mcd1', 'mcd1_params.yaml'));
    const r = runScript(script, '--check');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('missing    mcd1/mcd1_params.yaml');
    expect(fs.existsSync(path.join(copy, 'mcd1', 'mcd1_params.yaml'))).toBe(
      false
    );
    const fixed = runScript(script);
    expect(fixed.stdout).toContain('1 written, 33 already identical');
    expect(runScript(script, '--check').status).toBe(0);
  });

  it('--check catches an engine file that changed after the sync, and a sync brings the copy up to date', () => {
    const { root, script, copy } = scratch();
    runScript(script);
    const source = path.join(root, ENGINE_REL, 'mcd_worker', 'cli.py');
    fs.appendFileSync(source, '# changed\n');
    const r = runScript(script, '--check');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('different  mcd_worker/cli.py');
    expect(runScript(script).stdout).toContain('1 written');
    expect(runScript(script, '--check').status).toBe(0);
    expect(
      fs.readFileSync(path.join(copy, 'mcd_worker', 'cli.py')).toString()
    ).toMatch(/# changed\n$/);
  });

  it('--check reports a file that is not on the list; a sync leaves it alone and says so; Python caches are ignored', () => {
    const { script, copy } = scratch();
    runScript(script);
    // Both rules are tested on their own: anything inside a __pycache__ folder, and a .pyc file anywhere.
    fs.mkdirSync(path.join(copy, 'mcd_worker', '__pycache__'));
    fs.writeFileSync(
      path.join(copy, 'mcd_worker', '__pycache__', 'cli.cpython-311.pyc'),
      'x'
    );
    fs.writeFileSync(
      path.join(copy, 'mcd_worker', '__pycache__', 'readme.txt'),
      'x'
    );
    fs.writeFileSync(path.join(copy, 'mcd_worker', 'cli.pyc'), 'x');
    expect(runScript(script, '--check').status).toBe(0);
    const stray = path.join(copy, 'mcd_worker', 'notes.txt');
    fs.writeFileSync(stray, 'x');
    const r = runScript(script, '--check');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('not listed mcd_worker/notes.txt');
    const sync = runScript(script);
    expect(sync.status).toBe(0);
    expect(sync.stderr).toContain('mcd_worker/notes.txt');
    expect(fs.existsSync(stray)).toBe(true);
  });

  it('refuses to run, and writes nothing, when a listed engine file is missing (exit 2, not drift)', () => {
    const { root, script, copy } = scratch();
    fs.rmSync(path.join(root, ENGINE_REL, 'mcd_worker', 'errors.py'));
    for (const args of [[], ['--check']]) {
      const r = runScript(script, ...args);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain('mcd_worker/errors.py');
    }
    expect(fs.existsSync(copy)).toBe(false);
  });

  it('refuses to run, and writes nothing, when a registry flag and worker_config.yaml disagree', () => {
    const { root, script, copy } = scratch();
    const registry = path.join(root, ENGINE_REL, 'mcd1', 'mcd1_registry.yaml');
    const text = fs.readFileSync(registry, 'utf8');
    expect(text).toMatch(/^flag: 'off'/m);
    fs.writeFileSync(registry, text.replace(/^flag: 'off'/m, "flag: 'shadow'"));
    for (const args of [[], ['--check']]) {
      const r = runScript(script, ...args);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain("MCD1: mcd1/mcd1_registry.yaml says 'shadow'");
      expect(r.stderr).toContain("worker_config.yaml says 'off'");
    }
    expect(fs.existsSync(copy)).toBe(false);
  });

  it('refuses a flag line it cannot read', () => {
    const { root, script } = scratch();
    const config = path.join(
      root,
      ENGINE_REL,
      'mcd_worker',
      'worker_config.yaml'
    );
    fs.writeFileSync(
      config,
      fs.readFileSync(config, 'utf8').replace(/^ {2}MCD2:.*$/m, '  MCD2: maybe')
    );
    const r = runScript(script, '--check');
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('no readable flag for MCD2');
  });

  it.each(['shadow', 'live'])(
    'accepts matching flags that are `%s`, so a recorded promotion does not break the sync',
    (flag) => {
      const { root, script } = scratch();
      const registry = path.join(
        root,
        ENGINE_REL,
        'mcd0',
        'mcd0_registry.yaml'
      );
      const config = path.join(
        root,
        ENGINE_REL,
        'mcd_worker',
        'worker_config.yaml'
      );
      fs.writeFileSync(
        registry,
        fs
          .readFileSync(registry, 'utf8')
          .replace(/^flag: 'off'/m, `flag: '${flag}'`)
      );
      fs.writeFileSync(
        config,
        fs
          .readFileSync(config, 'utf8')
          .replace(/^ {2}MCD0: 'off'/m, `  MCD0: '${flag}'`)
      );
      expect(runScript(script).status).toBe(0);
      expect(runScript(script, '--check').status).toBe(0);
    }
  );

  it('reads the flags of an engine checked out with Windows line endings (this checkout is CRLF)', () => {
    const { root, script, copy } = scratch();
    for (const f of [
      'mcd_worker/worker_config.yaml',
      'mcd0/mcd0_registry.yaml',
      'mcd1/mcd1_registry.yaml',
      'mcd2/mcd2_registry.yaml',
      'mcd3/mcd3_registry.yaml',
    ]) {
      const file = path.join(root, ENGINE_REL, f);
      const text = fs.readFileSync(file, 'utf8');
      fs.writeFileSync(file, text.replace(/\r?\n/g, '\r\n'));
    }
    const r = runScript(script);
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    expect(runScript(script, '--check').status).toBe(0);
    // Byte for byte means the CRLF files arrive as CRLF.
    expect(
      fs
        .readFileSync(path.join(copy, 'mcd_worker', 'worker_config.yaml'))
        .includes('\r\n')
    ).toBe(true);
  });

  it('refuses, before anything is read or written, a list entry that would leave the engine folder or sensors/', () => {
    const { root, script, copy } = scratch();
    // The entry exists, so it is the path guard that refuses and not the missing-file check.
    fs.writeFileSync(
      path.join(root, 'davintrade-stack-d-and-e', 'escape.py'),
      'x'
    );
    const text = fs.readFileSync(script, 'utf8');
    expect(text).toContain("'mcd_worker/errors.py',");
    fs.writeFileSync(
      script,
      text.replace("'mcd_worker/errors.py',", "'../escape.py',")
    );
    const before = listFiles(root);
    for (const args of [[], ['--check']]) {
      const r = runScript(script, ...args);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain('../escape.py');
      expect(r.stderr).toContain('nothing was read or written');
    }
    expect(listFiles(root)).toEqual(before);
    expect(fs.existsSync(copy)).toBe(false);
  });

  it('rejects an option it does not know (exit 2) and prints the usage for --help', () => {
    const { script, copy } = scratch();
    const bad = runScript(script, '--chek');
    expect(bad.status).toBe(2);
    expect(bad.stderr).toContain('unknown option: --chek');
    expect(fs.existsSync(copy)).toBe(false);
    const help = runScript(script, '--help');
    expect(help.status).toBe(0);
    expect(help.stdout).toContain('usage: node scripts/sync-sensor-kit.js');
  });
});

describe('the script is plain JavaScript outside the TypeScript build', () => {
  it('is a .js file, parses, and no .ts file sits in scripts/ (tsconfig compiles scripts/**/*.ts and would move dist/main.js)', () => {
    expect(path.extname(SCRIPT)).toBe('.js');
    const check = spawnSync(process.execPath, ['-c', SCRIPT], {
      encoding: 'utf8',
    });
    expect(check.status).toBe(0);
    const ts = fs
      .readdirSync(path.join(PACKAGE_DIR, 'scripts'))
      .filter((f) => f.endsWith('.ts'));
    expect(ts).toEqual([]);
  });
});
