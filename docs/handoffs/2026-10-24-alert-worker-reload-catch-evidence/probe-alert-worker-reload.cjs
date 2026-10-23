'use strict';
// Process-level probe for F4 (adhoc-alert-worker-reload-catch): does a failed `alerts:changed` reload end the alert worker?
//
// Loads the COMPILED service (dist/alert-engine/alert-worker.service.js) in a child Node process, with `ioredis` replaced by
// an EventEmitter stub and Prisma, the queue and the dispatcher replaced by stubs. No database, no Redis, no network.
//   call 1 of drawingAlert.findMany (start)            -> one row (the watch cache holds 1 key)
//   call 2 (first `alerts:changed`)                    -> rejects like a pool timeout
//   call 3 (second `alerts:changed`)                   -> resolves [] (the cache must be replaced, so 0 keys)
// Parent mode (no args): spawns the child with hidden windows, prints one JSON summary, exits 0 when the child lived to the end.
// Usage: node probe-alert-worker-reload.cjs [path-to-dist-alert-worker.service.js]
const cp = require('child_process');
const path = require('path');
const EventEmitter = require('events');
const Module = require('module');

const DEFAULT_DIST = 'D:/SaaS/operation-service/dist/alert-engine/alert-worker.service.js';

if (process.argv[2] !== '--child') {
  const dist = process.argv[2] || DEFAULT_DIST;
  const r = cp.spawnSync(process.execPath, [__filename, '--child', dist], {
    windowsHide: true,
    encoding: 'utf8',
    timeout: 60_000,
  });
  const strip = (text) => text.replace(/\x1b\[[0-9;]*m/g, '');
  const stdout = strip(r.stdout || '').trim().split(/\r?\n/).filter(Boolean);
  const stderr = strip(r.stderr || '').trim().split(/\r?\n/).filter(Boolean);
  const summary = {
    node: process.version,
    dist,
    exitCode: r.status,
    signal: r.signal,
    lived_to_the_end: stdout.includes('PROBE-LIVED'),
    stdout,
    stderr_first_lines: stderr.slice(0, 8),
  };
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.lived_to_the_end && r.status === 0 ? 0 : 1);
}

// ---- child -----------------------------------------------------------------------------------------------------------
const dist = path.resolve(process.argv[3]);
process.env.REDIS_URL = 'redis://stub:6379';

class FakeRedis extends EventEmitter {
  constructor() {
    super();
    FakeRedis.instances.push(this);
  }
  psubscribe() { return Promise.resolve(); }
  subscribe() { return Promise.resolve(); }
  quit() { return Promise.resolve(); }
}
FakeRedis.instances = [];

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'ioredis') return FakeRedis;
  return originalLoad.apply(this, arguments);
};

const row = {
  id: 'da1',
  alertId: 'a1',
  targetLevel: 'line',
  direction: 'either',
  tolerance: 0,
  cooldownSec: 60,
  oneShot: false,
  drawing: {
    id: 'd1',
    userId: 'u1',
    symbol: 'XAUUSD',
    timeframe: 'M10',
    type: 'HLINE',
    anchors: [{ time: 0, price: 1980 }],
    style: { color: '#2962FF', lineWidth: 2, lineStyle: 'solid' },
  },
};

let calls = 0;
const findMany = async () => {
  calls += 1;
  if (calls === 1) return [row];
  if (calls === 2) throw new Error('timeout exceeded when trying to connect');
  return [];
};

const { AlertWorkerService } = require(dist);
const service = new AlertWorkerService(
  { drawingAlert: { findMany } },
  { enqueueFire: async () => undefined, startWorker: () => undefined },
  { dispatch: async () => undefined }
);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function expect(what, ok) {
  if (!ok) {
    console.log('PROBE-MISMATCH: ' + what);
    process.exit(2);
  }
}
const keep = setInterval(() => undefined, 1000); // keeps the loop alive like the worker's connections do

(async () => {
  await service.start();
  const subscriber = FakeRedis.instances[0];
  console.log(`after start: findMany calls=${calls}, cache keys=${service.cache.size}`);

  subscriber.emit('message', 'alerts:changed', '{}');
  await wait(600);
  console.log(`after the failed reload: findMany calls=${calls}, cache keys=${service.cache.size} (the old cache must survive)`);
  expect('the old cache survives a failed reload', service.cache.size === 1 && calls === 2);

  subscriber.emit('message', 'some:other:channel', '{}');
  await wait(100);
  console.log(`after a message on another channel: findMany calls=${calls}`);
  expect('another channel does not reload', calls === 2);

  subscriber.emit('message', 'alerts:changed', '{}');
  await wait(300);
  console.log(`after the next reload: findMany calls=${calls}, cache keys=${service.cache.size} (replaced by the new result)`);
  expect('the next successful reload replaces the cache', service.cache.size === 0 && calls === 3);

  console.log('PROBE-LIVED');
  clearInterval(keep);
  process.exit(0);
})().catch((error) => {
  console.error('probe harness error:', error);
  process.exit(3);
});
