// Run: node --test 'scripts/security/*.test.mjs'
//
// scripts/security/check-vps-drift.sh, the read-only drift check of the chat VPS (the restore
// gate of the `chat-server` asset), run under a real POSIX shell. `docker`, `ss`, `ps`,
// `dpkg-query`, `systemctl`, `apt-get` and `pip3` are stubs placed first in PATH: they read
// canned answers from a scratch folder and log every call, so the tests need no Docker, no
// root and no network, and can assert what the script asks (read-only) and what it prints
// (never an address).
//
// The tests skip, rather than fail, where no POSIX shell exists. On Linux CI `sh` is dash, so
// a bashism fails there too; a static check below catches the usual ones everywhere. Every
// process costs tens of milliseconds under Git Bash on Windows, so the scenarios run
// concurrently (a small semaphore bounds the shells) and the stubs use shell builtins only.
import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, 'check-vps-drift.sh');
const SOURCE = readFileSync(SCRIPT, 'utf8');
const FAKE_PUBLIC_IP = '203.0.113.77'; // documentation range: must never be printed
const FLOOR = ['--min-node-v22', '22.23.5'];
const PARALLEL = Math.max(2, Math.min(8, availableParallelism()));

// dash first where there is one: it is Linux CI's /bin/sh and the strictest of the common shells
function findShell() {
  const candidates =
    process.platform === 'win32'
      ? [
          'C:\\Program Files\\Git\\usr\\bin\\dash.exe',
          'C:\\Program Files\\Git\\usr\\bin\\sh.exe',
          'C:\\Program Files\\Git\\bin\\sh.exe',
          'C:\\Program Files (x86)\\Git\\bin\\sh.exe',
        ]
      : ['/bin/dash', '/usr/bin/dash', '/bin/sh', '/usr/bin/sh'];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const probe = spawnSync(candidate, ['-c', 'echo ok'], { encoding: 'utf8' });
    if (probe.status === 0 && probe.stdout.trim() === 'ok') return candidate;
  }
  return null;
}
const SHELL = findShell();

// --- the stubs (shell builtins only: no process besides the stub itself) -------------------------

const EMIT = `emit() { [ -f "$1" ] || return 1; while IFS= read -r l || [ -n "$l" ]; do printf '%s\\n' "$l"; done < "$1"; }`;
const STUBS = {
  docker: `#!/bin/sh
d="$STUB_DIR"
echo "docker $*" >> "$d/calls.log"
${EMIT}
[ -f "$d/docker-broken" ] && { echo "permission denied" >&2; exit 1; }
case "$1" in
  ps) if [ "$2" = "-a" ]; then emit "$d/ps-a.txt"; else emit "$d/ps.txt"; fi ;;
  images) emit "$d/images.txt" ;;
  port) emit "$d/port-$2-\${3%/*}_\${3#*/}.txt" ;;
  exec)
    c="$2"; shift 2
    case "$*" in
      "node -v") emit "$d/node-$c.txt" ;;
      "cat /etc/alpine-release") emit "$d/alpine-$c.txt" ;;
      "apk info") emit "$d/apk-$c.txt" ;;
      *) echo "unexpected exec" >&2; exit 1 ;;
    esac ;;
  *) echo "unexpected docker" >&2; exit 1 ;;
esac
`,
  ss: `#!/bin/sh
echo "ss $*" >> "$STUB_DIR/calls.log"
${EMIT}
emit "$STUB_DIR/ss.txt"
`,
  ps: `#!/bin/sh
echo "ps $*" >> "$STUB_DIR/calls.log"
${EMIT}
emit "$STUB_DIR/ps.txt"
`,
  'dpkg-query': `#!/bin/sh
echo "dpkg-query $*" >> "$STUB_DIR/calls.log"
${EMIT}
case "$*" in
  *unattended-upgrades*) emit "$STUB_DIR/status-uu.txt" ;;
  *) emit "$STUB_DIR/packages.txt" ;;
esac
`,
  systemctl: `#!/bin/sh
echo "systemctl $*" >> "$STUB_DIR/calls.log"
${EMIT}
case "$1" in
  list-units) emit "$STUB_DIR/units.txt" ;;
  is-enabled) read -r v < "$STUB_DIR/uu-enabled.txt"; echo "$v"; [ "$v" = enabled ] ;;
  is-active) read -r v < "$STUB_DIR/uu-active.txt"; echo "$v"; [ "$v" = active ] ;;
  *) exit 1 ;;
esac
`,
  'apt-get': `#!/bin/sh
echo "apt-get $*" >> "$STUB_DIR/calls.log"
${EMIT}
case "$*" in
  "-s dist-upgrade") emit "$STUB_DIR/upgrades.txt" ;;
  *) exit 1 ;;
esac
`,
  pip3: `#!/bin/sh
echo "pip3 $*" >> "$STUB_DIR/calls.log"
${EMIT}
emit "$STUB_DIR/pip.txt"
`,
};

const lines = (...items) => `${items.join('\n')}\n`;
const apkList = lines(...Array.from({ length: 40 }, (_, i) => `pkg-${i}-r0`));

// a healthy host: the three Compose containers, Node above the floor, loopback bindings
const HEALTHY = {
  'ps.txt': lines('socket_chat_server', 'redis_broker', 'ai_bot_worker'),
  'ps-a.txt': lines(
    'socket_chat_server saas-chat-server:latest',
    'redis_broker redis:7-alpine',
    'ai_bot_worker saas-chat-bot:latest'
  ),
  'images.txt': lines(
    'saas-chat-server:latest',
    'redis:7-alpine',
    'saas-chat-bot:latest'
  ),
  'port-socket_chat_server-3001_tcp.txt': lines('127.0.0.1:3001'),
  'port-redis_broker-6379_tcp.txt': lines('127.0.0.1:6379'),
  'node-socket_chat_server.txt': lines('v22.23.5'),
  'node-ai_bot_worker.txt': lines('v22.23.6'),
  'alpine-socket_chat_server.txt': lines('3.22.2'),
  'alpine-ai_bot_worker.txt': lines('3.22.2'),
  'alpine-redis_broker.txt': lines('3.22.2'),
  'apk-socket_chat_server.txt': apkList,
  'apk-ai_bot_worker.txt': apkList,
  'apk-redis_broker.txt': apkList,
  'ss.txt': lines(
    'State  Recv-Q Send-Q Local Address:Port Peer Address:Port',
    'LISTEN 0      4096   127.0.0.1:3001     0.0.0.0:*',
    'LISTEN 0      4096   127.0.0.1:6379     0.0.0.0:*',
    'LISTEN 0      128    0.0.0.0:22         0.0.0.0:*'
  ),
  'packages.txt': lines(
    'curl',
    'docker-ce',
    'openssh-server',
    'unattended-upgrades'
  ),
  'units.txt': lines(
    'ssh.service loaded active running OpenBSD Secure Shell server',
    'docker.service loaded active running Docker Application Container Engine'
  ),
  'pip.txt': lines('Package Version', 'pip 24.0'),
  'status-uu.txt': lines('install ok installed'),
  'uu-enabled.txt': lines('enabled'),
  'uu-active.txt': lines('active'),
  'upgrades.txt': lines(
    'Inst libssl3 [3.0.1] (3.0.2 Ubuntu)',
    'Inst tzdata [1] (2 Ubuntu)'
  ),
};

// a small semaphore: no more shells at once than the machine can start quickly
let active = 0;
const waiting = [];
const acquire = () =>
  new Promise((resolve) => {
    if (active < PARALLEL) {
      active += 1;
      resolve();
    } else waiting.push(resolve);
  });
const release = () => {
  const next = waiting.shift();
  if (next) next();
  else active -= 1;
};

const slash = (p) => p.replaceAll('\\', '/');

function execShell(args, env) {
  return new Promise((resolve) => {
    const child = spawn(SHELL, args, { env, windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (d) => (stdout += d));
    child.stderr.setEncoding('utf8').on('data', (d) => (stderr += d));
    const timer = setTimeout(() => child.kill(), 120000);
    child.on('error', () => {
      clearTimeout(timer);
      resolve({ status: null, stdout, stderr });
    });
    child.on('close', (status) => {
      clearTimeout(timer);
      resolve({ status, stdout, stderr });
    });
  });
}

/**
 * Runs the script against a scratch folder of canned answers.
 * `files` replaces or adds answers; a value of null removes one; `broken` makes docker fail.
 */
async function runScript(args, { files = {}, broken = false } = {}) {
  await acquire();
  const dir = mkdtempSync(join(tmpdir(), 'vps-drift-'));
  try {
    const answers = join(dir, 'answers');
    const bin = join(dir, 'bin');
    mkdirSync(answers);
    mkdirSync(bin);
    for (const [name, content] of Object.entries({ ...HEALTHY, ...files })) {
      if (content !== null) writeFileSync(join(answers, name), content);
    }
    if (broken) writeFileSync(join(answers, 'docker-broken'), '1');
    for (const [name, content] of Object.entries(STUBS)) {
      writeFileSync(join(bin, name), content);
      chmodSync(join(bin, name), 0o755);
    }
    const result = await execShell([slash(SCRIPT), ...args], {
      ...process.env,
      PATH: `${slash(bin)}${delimiter}${process.env.PATH}`,
      STUB_DIR: slash(answers),
    });
    const callsFile = join(answers, 'calls.log');
    return {
      ...result,
      calls: existsSync(callsFile)
        ? readFileSync(callsFile, 'utf8').split('\n').filter(Boolean)
        : [],
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
    release();
  }
}

const line = (out, status, id) =>
  out.stdout.split('\n').find((l) => l.startsWith(`${status} ${id}:`));

// --- the file itself --------------------------------------------------------------------------

test('the script is a POSIX sh file with LF line endings and a final newline', () => {
  assert.ok(SOURCE.startsWith('#!/bin/sh\n'), 'shebang');
  assert.equal(SOURCE.includes('\r'), false, 'no carriage return');
  assert.ok(SOURCE.endsWith('\n'));
});

test('the script has no bashism that dash would reject', () => {
  const code = SOURCE.split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');
  const bashisms = [
    // `[[ ... ]]` as a command; a POSIX class such as [[:space:]] is fine
    [/(^|[\s;&|({!])\[\[\s/, '[[ ]]'],
    [/<<</, 'here-string'],
    [/\$'/, "$'...'"],
    [/\$\{[A-Za-z_]+\/\//, '${var//x/y}'],
    [/\$\{[A-Za-z_]+[,^]{1,2}\}/, 'case conversion'],
    [/\bfunction\s+\w+/, 'function keyword'],
    [/\blocal\s/, 'local'],
    [/\becho\s+-e\b/, 'echo -e'],
    [/\bsource\s/, 'source'],
    [/&>/, '&>'],
    // a bare (( )) command; $(( )) arithmetic expansion is POSIX
    [/(^|[^$])\(\(/, '(( ))'],
    [/\w=\(/, 'array'],
    [/\[\s[^\]]*==/, '== in test'],
    [/\blet\s/, 'let'],
    [/\bmapfile\b|\breadarray\b/, 'mapfile'],
  ];
  for (const [pattern, name] of bashisms) {
    assert.equal(pattern.test(code), false, `bashism: ${name}`);
  }
});

test('the script holds no address except loopback and wildcard, and no credential word', () => {
  const addresses = SOURCE.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) ?? [];
  for (const address of addresses) {
    assert.ok(['127.0.0.1', '0.0.0.0'].includes(address), `address ${address}`);
  }
  assert.equal(
    /password|passwd|secret|api[_-]?key|BEGIN [A-Z ]*PRIVATE|bearer|token/i.test(
      SOURCE
    ),
    false
  );
  assert.equal(/:\/\//.test(SOURCE), false, 'no URL');
});

test('the script only reads: no write, no change of state, no network, no sudo', () => {
  const code = SOURCE.split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');
  // a command word: at the start of a line, after a separator, `$(`, or a keyword like `if`
  const at =
    '(?:^|[;&|({!]|\\$\\(|\\b(?:if|then|elif|else|while|until|do))\\s*';
  const forbidden = new RegExp(
    `${at}(?:rm|mv|cp|chmod|chown|kill|pkill|killall|sudo|su|curl|wget|nc|ssh|scp|dd|mkfs|reboot|shutdown|tee|touch|mkdir|mktemp|ln|crontab)\\s`,
    'm'
  );
  assert.equal(forbidden.test(code), false, forbidden.exec(code)?.[0]);
  const docker = [
    ...code.matchAll(new RegExp(`${at}docker\\s+([a-z-]+)`, 'gm')),
  ].map((m) => m[1]);
  assert.ok(docker.length >= 5, 'the docker calls were found');
  for (const sub of docker) {
    assert.ok(['ps', 'images', 'port', 'exec'].includes(sub), `docker ${sub}`);
  }
  const exec = [
    ...code.matchAll(
      new RegExp(`${at}docker\\s+exec\\s+"\\$\\w+"\\s+([^\\n)|]+)`, 'gm')
    ),
  ].map((m) => m[1].trim().replace(/\s*2>.*$/, ''));
  assert.ok(exec.length >= 3, 'the docker exec calls were found');
  for (const inner of exec) {
    assert.ok(
      ['node -v', 'cat /etc/alpine-release', 'apk info'].includes(inner),
      `docker exec ... ${inner}`
    );
  }
  assert.equal(
    new RegExp(`${at}apt-get\\s+(?!-s\\b)`, 'm').test(code),
    false,
    'apt-get only simulates'
  );
  assert.equal(
    new RegExp(
      `${at}systemctl\\s+(?:start|stop|restart|enable|disable|mask|reload|daemon)`,
      'm'
    ).test(code),
    false
  );
  assert.equal(
    /\s>>?\s*[^&\s/]/.test(code.replace(/2>&1|>\/dev\/null/g, '')),
    false,
    'no file is written'
  );
});

// --- behaviour, under a real shell ---------------------------------------------------------------

const behaviour = {
  concurrency: PARALLEL,
  skip: SHELL ? false : 'no POSIX shell on this machine',
};

// one healthy run, shared by the tests that read it
let healthyRun = null;
const healthy = () => (healthyRun ??= runScript(FLOOR));

describe('check-vps-drift.sh run under a POSIX shell', behaviour, () => {
  // --- arguments -----------------------------------------------------------------------------

  it('--help prints the usage and exits 0 without asking the system anything', async () => {
    const out = await runScript(['--help']);
    assert.equal(out.status, 0);
    assert.match(out.stdout, /Usage:/);
    for (const flag of [
      '--min-node-v22',
      '--min-node-v24',
      '--compose-file',
      '--format',
    ]) {
      assert.ok(out.stdout.includes(flag), flag);
    }
    assert.match(out.stdout, /Exit codes:/);
    assert.deepEqual(out.calls, []);
  });

  it('a usage error exits 2 before anything is asked of the system', async () => {
    const cases = [
      [[], 'the floor is required'],
      [['--min-node-v22', 'banana'], 'malformed floor'],
      [['--min-node-v22'], 'missing value'],
      [[...FLOOR, '--min-node-v24', '24'], 'malformed v24 floor'],
      [[...FLOOR, '--format', 'xml'], 'bad format'],
      [[...FLOOR, '--bogus'], 'unknown flag'],
      [
        [...FLOOR, '--compose-file', '/nonexistent/compose.yml'],
        'unreadable compose file',
      ],
      [[...FLOOR, 'positional'], 'positional'],
    ];
    await Promise.all(
      cases.map(async ([args, why]) => {
        const out = await runScript(args);
        assert.equal(out.status, 2, why);
        assert.match(out.stdout + out.stderr, /error|Usage/i, why);
        assert.deepEqual(out.calls, [], `${why}: nothing was asked`);
      })
    );
  });

  // --- a healthy host ------------------------------------------------------------------------

  it('a healthy host passes every check and exits 0', async () => {
    const out = await healthy();
    assert.equal(out.status, 0, out.stdout + out.stderr);
    for (const id of ['containers', 'node-version', 'pgadmin', 'bindings']) {
      assert.ok(line(out, 'PASS', id), `${id}:\n${out.stdout}`);
    }
    assert.match(out.stdout, /RESULT: pass/);
    assert.match(
      line(out, 'PASS', 'node-version'),
      /socket_chat_server v22\.23\.5/
    );
    assert.match(line(out, 'PASS', 'node-version'), /ai_bot_worker v22\.23\.6/);
    // the update summary is information, not a verdict
    const info = line(out, 'INFO', 'updates');
    assert.ok(info, out.stdout);
    assert.match(info, /unattended-upgrades=enabled\/active/);
    assert.match(info, /pending=2/);
    assert.match(info, /socket_chat_server alpine=3\.22\.2 packages=40/);
    assert.equal(out.stdout.includes(FAKE_PUBLIC_IP), false);
  });

  it('the script asks the system only read-only questions', async () => {
    const out = await healthy();
    assert.ok(out.calls.length > 5);
    for (const call of out.calls) {
      const [tool, sub, ...rest] = call.split(' ');
      if (tool === 'docker') {
        assert.ok(['ps', 'images', 'port', 'exec'].includes(sub), call);
        if (sub === 'exec') {
          assert.ok(
            ['node -v', 'cat /etc/alpine-release', 'apk info'].includes(
              rest.slice(1).join(' ')
            ),
            call
          );
        }
      } else if (tool === 'apt-get') {
        assert.equal(sub, '-s', call);
      } else if (tool === 'systemctl') {
        assert.ok(
          ['list-units', 'is-enabled', 'is-active'].includes(sub),
          call
        );
      } else {
        assert.ok(['ss', 'ps', 'dpkg-query', 'pip3'].includes(tool), call);
      }
    }
  });

  // --- containers ----------------------------------------------------------------------------

  it('a missing expected container is drift', async () => {
    const out = await runScript(FLOOR, {
      files: { 'ps.txt': lines('socket_chat_server', 'ai_bot_worker') },
    });
    assert.equal(out.status, 1);
    assert.match(line(out, 'FAIL', 'containers'), /missing: redis_broker/);
    assert.match(out.stdout, /RESULT: fail/);
  });

  it('an unexpected running container is drift, whatever it is called', async () => {
    const out = await runScript(FLOOR, {
      files: {
        'ps.txt': lines(
          'socket_chat_server',
          'redis_broker',
          'ai_bot_worker',
          'some_tool'
        ),
      },
    });
    assert.equal(out.status, 1);
    assert.match(line(out, 'FAIL', 'containers'), /unexpected: some_tool/);
  });

  it('the expected containers come from the Compose file when one is given', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vps-compose-'));
    try {
      const compose = join(dir, 'docker-compose.yml');
      const base = lines(
        'services:',
        '  chat_server:',
        '    container_name: socket_chat_server',
        '  # container_name: a_commented_out_name',
        '  redis:',
        '    container_name: "redis_broker" # broker',
        '  bot_worker:',
        '    container_name: ai_bot_worker'
      );
      writeFileSync(compose, base);
      const flag = ['--compose-file', slash(compose)];
      const same = await runScript([...FLOOR, ...flag]);
      assert.equal(same.status, 0, same.stdout);
      // a Compose file that names a fourth container makes it an expected one: it is missing
      writeFileSync(
        compose,
        `${base}  extra:\n    container_name: extra_one\n`
      );
      const four = await runScript([...FLOOR, ...flag]);
      assert.equal(four.status, 1);
      assert.match(line(four, 'FAIL', 'containers'), /missing: extra_one/);
      // a Compose file with no container names cannot be used
      writeFileSync(compose, lines('services: {}'));
      const none = await runScript([...FLOOR, ...flag]);
      assert.equal(none.status, 2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // --- node -v -------------------------------------------------------------------------------

  it('a Node below the floor is drift; at the floor or above passes', async () => {
    const [below, higher, lower] = await Promise.all([
      runScript(FLOOR, {
        files: { 'node-ai_bot_worker.txt': lines('v22.23.4') },
      }),
      runScript(FLOOR, {
        files: { 'node-ai_bot_worker.txt': lines('v22.24.0') },
      }),
      runScript(FLOOR, {
        files: { 'node-ai_bot_worker.txt': lines('v22.9.99') },
      }),
    ]);
    assert.equal(below.status, 1);
    const fail = line(below, 'FAIL', 'node-version');
    assert.match(fail, /ai_bot_worker v22\.23\.4 is below 22\.23\.5/);
    assert.equal(
      fail.includes('socket_chat_server'),
      false,
      'only the failing one is named'
    );
    assert.equal(higher.status, 0, 'a higher minor passes');
    assert.equal(lower.status, 1, 'versions compare as numbers, not as text');
  });

  it('a Node line needs its own floor, and an unreadable answer is an error, not a pass', async () => {
    const v24 = lines('v24.22.3');
    const [noFloor, withFloor, belowV24, garbled, unreadable] =
      await Promise.all([
        runScript(FLOOR, { files: { 'node-socket_chat_server.txt': v24 } }),
        runScript([...FLOOR, '--min-node-v24', '24.22.3'], {
          files: { 'node-socket_chat_server.txt': v24 },
        }),
        runScript([...FLOOR, '--min-node-v24', '24.22.4'], {
          files: { 'node-socket_chat_server.txt': v24 },
        }),
        runScript(FLOOR, {
          files: { 'node-ai_bot_worker.txt': lines('not a version') },
        }),
        runScript(FLOOR, { files: { 'node-ai_bot_worker.txt': null } }),
      ]);
    assert.equal(noFloor.status, 1);
    assert.match(line(noFloor, 'FAIL', 'node-version'), /no floor for line 24/);
    assert.equal(withFloor.status, 0, withFloor.stdout);
    assert.equal(belowV24.status, 1);
    assert.equal(garbled.status, 2);
    assert.ok(line(garbled, 'ERROR', 'node-version'));
    assert.equal(unreadable.status, 2);
  });

  // --- pgAdmin -------------------------------------------------------------------------------

  it('any trace of pgAdmin is drift: container, image, package, unit, python package, port', async () => {
    const traces = [
      [
        'container',
        {
          'ps-a.txt': lines(
            'socket_chat_server x',
            'redis_broker y',
            'ai_bot_worker z',
            'pgadmin4 dpage/pgadmin4'
          ),
        },
      ],
      ['image', { 'images.txt': lines('dpage/pgadmin4:latest') }],
      ['package', { 'packages.txt': lines('curl', 'pgadmin4-server') }],
      [
        'unit',
        {
          'units.txt': lines(
            'pgadmin4.service loaded active running pgAdmin 4'
          ),
        },
      ],
      [
        'python-package',
        { 'pip.txt': lines('Package Version', 'pgadmin4 9.9') },
      ],
      [
        'port',
        {
          'ss.txt':
            HEALTHY['ss.txt'] + lines('LISTEN 0 128 0.0.0.0:5050 0.0.0.0:*'),
        },
      ],
    ];
    await Promise.all(
      traces.map(async ([kind, files]) => {
        const out = await runScript(FLOOR, { files });
        assert.equal(out.status, 1, kind);
        assert.match(line(out, 'FAIL', 'pgadmin'), new RegExp(kind), kind);
      })
    );
  });

  it('a pgAdmin process is found in the process list', async () => {
    // the stub serves one answer to `docker ps` and `ps`, so the line is also an unexpected
    // container: the point here is that the pgadmin check names the process
    const out = await runScript(FLOOR, {
      files: {
        'ps.txt': lines(
          'socket_chat_server',
          'redis_broker',
          'ai_bot_worker',
          '/usr/bin/python3 /usr/pgadmin4/web/pgAdmin4.py'
        ),
      },
    });
    assert.equal(out.status, 1);
    assert.match(line(out, 'FAIL', 'pgadmin'), /process/);
  });

  it('a clean host says so without naming anything; an unreadable source is not "clean"', async () => {
    const [clean, noImages] = await Promise.all([
      healthy(),
      runScript(FLOOR, { files: { 'images.txt': null } }),
    ]);
    assert.match(
      line(clean, 'PASS', 'pgadmin'),
      /no container, image, package, unit, process or listening port/
    );
    assert.equal(noImages.status, 2, noImages.stdout);
    assert.ok(line(noImages, 'ERROR', 'pgadmin'));
  });

  // --- bindings ------------------------------------------------------------------------------

  it('Redis and the chat server must be published on loopback only', async () => {
    const cases = [
      [
        'port-redis_broker-6379_tcp.txt',
        '0.0.0.0:6379\n',
        /redis_broker 6379 wildcard/,
      ],
      [
        'port-redis_broker-6379_tcp.txt',
        '[::]:6379\n',
        /redis_broker 6379 wildcard/,
      ],
      [
        'port-socket_chat_server-3001_tcp.txt',
        '0.0.0.0:3001\n[::]:3001\n',
        /socket_chat_server 3001 wildcard/,
      ],
      [
        'port-socket_chat_server-3001_tcp.txt',
        `${FAKE_PUBLIC_IP}:3001\n`,
        /socket_chat_server 3001 other/,
      ],
      [
        'port-socket_chat_server-3001_tcp.txt',
        '127.0.0.1:3001\n0.0.0.0:3001\n',
        /wildcard/,
      ],
    ];
    await Promise.all(
      cases.map(async ([file, answer, expected]) => {
        const out = await runScript(FLOOR, { files: { [file]: answer } });
        assert.equal(out.status, 1, answer);
        assert.match(line(out, 'FAIL', 'bindings'), expected, answer);
        assert.equal(
          out.stdout.includes(FAKE_PUBLIC_IP),
          false,
          'no address in the output'
        );
        assert.equal(
          out.stdout.includes('0.0.0.0'),
          false,
          'classes, not addresses'
        );
      })
    );
  });

  it('a published port that is missing, or a host listener that is not loopback, is drift', async () => {
    const [unpublished, listener, v6] = await Promise.all([
      runScript(FLOOR, { files: { 'port-redis_broker-6379_tcp.txt': null } }),
      // docker says loopback, the host says a wildcard listener
      runScript(FLOOR, {
        files: {
          'ss.txt': lines(
            'State  Recv-Q Send-Q Local Address:Port Peer Address:Port',
            'LISTEN 0 4096 0.0.0.0:6379 0.0.0.0:*',
            'LISTEN 0 4096 127.0.0.1:3001 0.0.0.0:*'
          ),
        },
      }),
      // an IPv6 wildcard listener counts too
      runScript(FLOOR, {
        files: {
          'ss.txt': lines(
            'LISTEN 0 4096 [::]:3001 [::]:*',
            'LISTEN 0 4096 127.0.0.1:6379 0.0.0.0:*'
          ),
        },
      }),
    ]);
    assert.equal(unpublished.status, 1);
    assert.match(
      line(unpublished, 'FAIL', 'bindings'),
      /redis_broker 6379 not published/
    );
    assert.equal(listener.status, 1);
    assert.match(
      line(listener, 'FAIL', 'bindings'),
      /redis_broker 6379 listener wildcard/
    );
    assert.equal(v6.status, 1);
    assert.match(
      line(v6, 'FAIL', 'bindings'),
      /socket_chat_server 3001 listener wildcard/
    );
  });

  it('an unreadable listener table: the binding comes from Docker, but the pgAdmin port check cannot pass', async () => {
    const out = await runScript(FLOOR, { files: { 'ss.txt': null } });
    // Docker states what it publishes: that stays the verdict for the bindings, with a note
    assert.match(line(out, 'PASS', 'bindings'), /listener table not readable/);
    // but "no pgAdmin on any port" cannot be said without the table: an error is not a clean result
    assert.ok(line(out, 'ERROR', 'pgadmin'), out.stdout);
    assert.match(line(out, 'ERROR', 'pgadmin'), /ports/);
    assert.equal(out.status, 2);
  });

  // --- docker unusable -----------------------------------------------------------------------

  it('when docker cannot be used nothing is reported clean, and the exit code says so', async () => {
    const out = await runScript(FLOOR, { broken: true });
    assert.equal(out.status, 2, out.stdout);
    for (const id of ['containers', 'node-version', 'bindings', 'pgadmin']) {
      assert.ok(line(out, 'ERROR', id), `${id}:\n${out.stdout}`);
      assert.equal(line(out, 'PASS', id), undefined, `${id} must not pass`);
    }
    assert.match(out.stdout, /RESULT: error/);
    assert.match(out.stdout, /permission denied|not usable/i);
    assert.match(out.stdout, /sudo/); // a hint for the operator; the script never runs it
  });

  it('drift outranks an error in the exit code', async () => {
    const out = await runScript(FLOOR, {
      files: {
        'ps.txt': lines('socket_chat_server', 'ai_bot_worker'),
        'node-ai_bot_worker.txt': lines('garbage'),
      },
    });
    assert.ok(line(out, 'FAIL', 'containers'));
    assert.ok(line(out, 'ERROR', 'node-version'));
    assert.equal(out.status, 1);
    assert.match(out.stdout, /RESULT: fail/);
  });

  // --- json ----------------------------------------------------------------------------------

  it('--format json prints one valid JSON document with the same verdicts', async () => {
    const [ok, bad, broken] = await Promise.all([
      runScript([...FLOOR, '--format', 'json']),
      runScript([...FLOOR, '--format=json'], {
        files: { 'ps.txt': lines('socket_chat_server', 'ai_bot_worker') },
      }),
      runScript([...FLOOR, '--format', 'json'], { broken: true }),
    ]);
    assert.equal(ok.status, 0, ok.stdout);
    const doc = JSON.parse(ok.stdout);
    assert.equal(doc.schema_version, '1.0');
    assert.equal(doc.result, 'pass');
    assert.match(doc.checked_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    assert.deepEqual(
      doc.checks.map((c) => [c.id, c.status]),
      [
        ['containers', 'pass'],
        ['node-version', 'pass'],
        ['pgadmin', 'pass'],
        ['bindings', 'pass'],
      ]
    );
    for (const check of doc.checks) assert.equal(typeof check.detail, 'string');
    assert.equal(doc.updates.host.unattended_upgrades.enabled, 'enabled');
    assert.equal(doc.updates.host.unattended_upgrades.active, 'active');
    assert.equal(doc.updates.host.pending_upgrades, 2);
    const container = doc.updates.containers.find(
      (c) => c.name === 'socket_chat_server'
    );
    assert.deepEqual(container, {
      name: 'socket_chat_server',
      alpine: '3.22.2',
      packages: 40,
    });

    assert.equal(bad.status, 1);
    const failed = JSON.parse(bad.stdout);
    assert.equal(failed.result, 'fail');
    assert.equal(
      failed.checks.find((c) => c.id === 'containers').status,
      'fail'
    );
    assert.equal(bad.stdout.includes(FAKE_PUBLIC_IP), false);

    assert.equal(broken.status, 2);
    assert.equal(JSON.parse(broken.stdout).result, 'error');
  });

  it('the update summary says unknown, not nothing, when the host cannot tell', async () => {
    const out = await runScript([...FLOOR, '--format', 'json'], {
      files: {
        'status-uu.txt': null,
        'uu-enabled.txt': lines('disabled'),
        'uu-active.txt': lines('inactive'),
        'upgrades.txt': null,
        'alpine-redis_broker.txt': null,
      },
    });
    assert.equal(out.status, 0, out.stdout);
    const doc = JSON.parse(out.stdout);
    assert.equal(doc.updates.host.unattended_upgrades.installed, 'no');
    assert.equal(doc.updates.host.unattended_upgrades.enabled, 'disabled');
    assert.equal(doc.updates.host.pending_upgrades, 'unknown');
    const redis = doc.updates.containers.find((c) => c.name === 'redis_broker');
    assert.equal(redis.alpine, 'unknown');
  });
});
