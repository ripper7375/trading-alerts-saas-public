/**
 * Lets a script load a module that carries `import 'server-only'`.
 *
 * The package throws on import outside the Next.js bundler, and the scripts run their TypeScript in
 * plain Node (through `tsx`). Next.js resolves `server-only` to an empty module for the server layers;
 * this does the same for a script, by answering a request for exactly `server-only` with an empty
 * object. Every other module loads as before. It is for scripts only: the app is guarded by the
 * bundler and Jest maps the module itself (`next/jest`), so neither loads this file.
 *
 * Require it BEFORE `tsx/cjs` or before the first import of a script that reaches a marked module.
 * Node standard library only.
 */

'use strict';

const Module = require('module');

const load = Module._load;

if (!load.__serverOnlyStub) {
  const patched = function patchedLoad(request, ...rest) {
    if (request === 'server-only') return {};
    return load.call(this, request, ...rest);
  };
  patched.__serverOnlyStub = true;
  Module._load = patched;
}
