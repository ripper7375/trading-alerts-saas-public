#!/usr/bin/env node
// Lists what the shift-left scans cover, from security/security-inventory.yaml, into a folder the
// workflow reads (one source of truth for Trivy and OSV-Scanner), and prints counts only:
//
//   node scripts/security/shift-left-targets.mjs --out "$RUNNER_TEMP/targets"
//
// Files written to --out:
//   dockerfiles.txt        one repository path per line (Trivy reads each as infrastructure-as-code)
//   images.txt             one image reference per line (Trivy scans each as an image)
//   pip-manifests.txt      one requirements path per line (OSV-Scanner)
//   pip-dev-manifests.txt  the development-only subset (its advisories never reach a running service)
//   targets.json           everything above, for scripts/security/shift-left-counts.mjs
//   iac/<n>/Dockerfile     a copy of each Dockerfile, so one `trivy config` run sees exactly these
//
// The repository is public: stdout carries counts only. Exit codes: 0 done, 1 an inventory path
// is missing or invalid (a scan that quietly shrinks is worse than a failed one), 2 usage error.

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadShiftLeftTargets,
  renderTargetsLine,
} from './shift-left-targets-lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const out = outAt === -1 ? null : args[outAt + 1];
if (args.length !== 2 || outAt !== 0 || !out) {
  console.log(
    'error=usage (node scripts/security/shift-left-targets.mjs --out <dir>)'
  );
  process.exit(2);
}

try {
  const readText = (path) => {
    const file = join(ROOT, path);
    return existsSync(file) ? readFileSync(file, 'utf8') : null;
  };
  const inventoryText = readText('security/security-inventory.yaml');
  if (inventoryText === null) {
    console.log('error=inventory_not_found');
    process.exit(2);
  }
  const targets = loadShiftLeftTargets({ inventoryText, readText });

  mkdirSync(out, { recursive: true });
  const lines = (items) => (items.length === 0 ? '' : `${items.join('\n')}\n`);
  writeFileSync(
    join(out, 'dockerfiles.txt'),
    lines(targets.dockerfiles.map((d) => d.path))
  );
  writeFileSync(join(out, 'images.txt'), lines(targets.images));
  writeFileSync(
    join(out, 'pip-manifests.txt'),
    lines(targets.pip.map((p) => p.path))
  );
  writeFileSync(
    join(out, 'pip-dev-manifests.txt'),
    lines(
      targets.pip.filter((p) => p.scope === 'development').map((p) => p.path)
    )
  );
  writeFileSync(
    join(out, 'targets.json'),
    `${JSON.stringify(targets, null, 2)}\n`
  );
  targets.dockerfiles.forEach((file, index) => {
    const dir = join(out, 'iac', String(index + 1));
    mkdirSync(dir, { recursive: true });
    copyFileSync(join(ROOT, file.path), join(dir, 'Dockerfile'));
  });

  console.log(renderTargetsLine(targets));
  process.exitCode = targets.issues.length > 0 ? 1 : 0;
} catch {
  // an error message could quote a path or a line of a file
  console.log('error=unexpected_failure');
  process.exitCode = 1;
}
