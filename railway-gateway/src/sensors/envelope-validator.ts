import { Injectable } from '@nestjs/common';
import Ajv2020, { ErrorObject, ValidateFunction } from 'ajv/dist/2020';
import envelopeSchema from './mcd-output-1.schema.json';

/**
 * The second look at every envelope before it is stored (STACK-D-ARCHITECTURE.md section 2.3,
 * standard section 11.2): the Python runner has already checked each reading against
 * `mcd-output/1` and replaced one that failed with an INVALID + EVALUATOR_ERROR; this checks
 * again, in the process that writes the row, with Ajv (draft 2020-12). It is a second
 * implementation of the same schema on purpose: a runner that changed, or a copy of the schema
 * that drifted, shows up here as a refusal and not as a row nobody can read.
 *
 * The schema is a byte-identical copy of the kit's `mcd_common/mcd-output-1.schema.json`
 * (`npm run sync:mcd-output-schema`; test/sensors-envelope-validator.spec.ts fails if they
 * differ, and holds Ajv's verdict equal to Python's on a corpus of defects). `strict` stays on
 * (an unknown keyword in the schema is a typo to hear about) with ONE exception: `strictTypes`.
 * The kit's schema writes `maxItems` under `levels` without a sibling `type: "array"`, which is
 * valid JSON Schema and what Python's jsonschema reads, but Ajv's `strictTypes` refuses to
 * compile. The kit owns the schema and the copy must stay byte for byte, so the check is relaxed
 * here and the parity corpus is what holds Ajv to the same meaning.
 */

export type EnvelopeCheck =
  | { ok: true; envelope: Record<string, unknown> }
  | { ok: false; problems: string[] };

@Injectable()
export class EnvelopeValidator {
  private readonly validateSchema: ValidateFunction;

  constructor() {
    this.validateSchema = new Ajv2020({
      allErrors: true,
      strict: true,
      strictTypes: false,
    }).compile(envelopeSchema);
  }

  /** `envelopeJson` is the canonical text the runner returned (what would be stored, byte for byte). */
  check(envelopeJson: string): EnvelopeCheck {
    let parsed: unknown;
    try {
      parsed = JSON.parse(envelopeJson);
    } catch (error) {
      return {
        ok: false,
        problems: [`<root>: not JSON (${(error as Error).message})`],
      };
    }
    if (this.validateSchema(parsed)) {
      return { ok: true, envelope: parsed as Record<string, unknown> };
    }
    return { ok: false, problems: describe(this.validateSchema.errors ?? []) };
  }
}

/** One line per error, like the kit's (`path: message`), in a stable order. */
function describe(errors: ErrorObject[]): string[] {
  return errors
    .map((error) => `${error.instancePath || '<root>'}: ${error.message}`)
    .sort();
}
