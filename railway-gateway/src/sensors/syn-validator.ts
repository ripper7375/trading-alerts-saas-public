import { Injectable } from '@nestjs/common';
import Ajv2020, { ErrorObject, ValidateFunction } from 'ajv/dist/2020';
import synSchema from './syn-output-1.schema.json';

/**
 * The second look at every SYN reading before it is stored (STACK-D-ARCHITECTURE.md section 3.5,
 * build step 4 part 5): the Python engine has already checked each reading against `syn-output/1`
 * and withheld one that failed (`reading_json` is null then); this checks again, in the process that
 * writes the row, with Ajv (draft 2020-12). It is a second implementation of the same schema on
 * purpose, exactly as `EnvelopeValidator` is for `mcd-output/1`: a runner that changed, or a copy of
 * the schema that drifted, shows up here as a refused reading and not as a row nobody can read.
 *
 * The schema is a byte-identical copy of `mcd_worker/synthesis/syn-output-1.schema.json`
 * (`npm run sync:syn-output-schema`; test/sensors-syn-validator.spec.ts fails if they differ, and holds
 * Ajv's verdict equal to Python's on a corpus of defects). `strict` stays on, so a keyword nobody
 * declared fails here; `strictTypes` is relaxed for the same reason it is in the envelope validator
 * (the schema is the engine's and the copy must stay byte for byte; the parity corpus holds Ajv to
 * the same meaning).
 */

export type SynReadingCheck =
  | { ok: true; reading: Record<string, unknown> }
  | { ok: false; problems: string[] };

@Injectable()
export class SynReadingValidator {
  private readonly validateSchema: ValidateFunction;

  constructor() {
    this.validateSchema = new Ajv2020({
      allErrors: true,
      strict: true,
      strictTypes: false,
    }).compile(synSchema);
  }

  /** `readingJson` is the canonical text the engine returned (what would be stored, byte for byte). */
  check(readingJson: string): SynReadingCheck {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readingJson);
    } catch (error) {
      return {
        ok: false,
        problems: [`<root>: not JSON (${(error as Error).message})`],
      };
    }
    if (this.validateSchema(parsed)) {
      return { ok: true, reading: parsed as Record<string, unknown> };
    }
    return { ok: false, problems: describe(this.validateSchema.errors ?? []) };
  }
}

/** One line per error, `path: message`, in a stable order. */
function describe(errors: ErrorObject[]): string[] {
  return errors
    .map((error) => `${error.instancePath || '<root>'}: ${error.message}`)
    .sort();
}
