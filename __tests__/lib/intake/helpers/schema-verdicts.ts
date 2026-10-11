/**
 * What a JSON Schema file says about a list of documents: one Python process for the lot
 * (`schema_verdicts.py`, the `jsonschema` package, Draft 2020-12). The tests that compare a
 * hand-written validator with its schema use it. Needs Python and the two packages; the callers
 * are `describePython` suites, so they are skipped without.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { runPython } from './python';

export interface Verdict {
  ok: boolean;
  errors?: string[];
}

const VERDICTS = join(__dirname, 'schema_verdicts.py');

export function schemaVerdicts(
  schemaFile: string,
  documents: unknown[]
): Verdict[] {
  const dir = mkdtempSync(join(tmpdir(), 'schema-'));
  try {
    const file = join(dir, 'documents.json');
    writeFileSync(file, JSON.stringify(documents));
    const run = runPython([VERDICTS, schemaFile, file]);
    if (run.status !== 0) throw new Error(run.stderr || `exit ${run.status}`);
    return JSON.parse(run.stdout) as Verdict[];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
