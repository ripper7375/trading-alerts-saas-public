/**
 * Loads the TypeScript the reply scripts run (build step 7 part 10): the registry, the evaluation
 * suite, the gateway adapter and the test harness that runs a scenario through the real orchestrator,
 * through `tsx`, with the two database clients replaced by nothing.
 *
 * The orchestrator's world is built over in-memory stores and a fixture model, so a script that
 * uses it touches no database and no network of its own. The stub is what makes that a fact and not
 * a hope: a module that tried to read a table would get an empty object and throw.
 *
 * Node standard library and `tsx` (a devDependency) only.
 */

'use strict';

const Module = require('module');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

let loaded = null;

function boot() {
  if (loaded !== null) return loaded;
  // the gateway, the readers and the route layer carry `import 'server-only'`, which throws in plain Node
  require('../server-only-stub');
  require('tsx/cjs');
  const load = Module._load;
  Module._load = function patched(request, ...rest) {
    if (request === '@/lib/db/prisma') return { prisma: {} };
    if (request === '@/lib/db/market-prisma') return { marketPrisma: {} };
    return load.call(this, request, ...rest);
  };
  const at = (rel) => require(path.join(ROOT, rel));
  loaded = {
    root: ROOT,
    harness: at('__tests__/lib/reply/eval/helpers/harness.ts'),
    scenarios: at('lib/reply/eval/scenarios.ts'),
    suite: at('lib/reply/eval/suite.ts'),
    report: at('lib/reply/eval/report.ts'),
    registry: at('lib/reply/gateway/registry.ts'),
    openrouter: at('lib/reply/gateway/openrouter.ts'),
  };
  return loaded;
}

module.exports = { boot, ROOT };
