import { Injectable, Logger } from '@nestjs/common';
import type { CycleRunResult } from './cycle-run-result';
import {
  type PreparedSynthesis,
  type SynthesisRefusal,
  prepareSynthesis,
} from './synthesis-rows';
import { SynReadingValidator } from './syn-validator';

/**
 * Decides which SYN rows of a cycle may be written (STACK-D-ARCHITECTURE.md section 3, build step 4 part 5).
 *
 * It does not write. The rows go to the database in ONE transaction with the cycle's `mcd_outputs` rows
 * (decision D9, approved with the safeguard of the part 4 hand-off, option (a)); `McdOutputsWriter` owns that
 * transaction and asks this class first. What this class does is judge every reading and every zone, in
 * TypeScript, against everything the database would check (the `syn-output/1` schema, the hashes, the identity of the
 * slot and the profile, and the twin of each of the 25 CHECK constraints of the migration, `synthesis-rows.ts`), so that
 * nothing reaches the transaction that could fail it. A profile that fails is left out whole, its reading and its
 * zones together, and is **logged**: that log line is the record of a refused reading (Davin, part 5 order; the
 * measurement kit of part 6 counts them from it). The sensors' rows and the other profile are written as if nothing had happened.
 *
 * Cases, in the order they are met:
 *
 *   - the result has no `synthesis` section (the `SYN` flag is `off`, which is the committed setting): nothing to do, nothing logged;
 *   - the engine says synthesis raised (`synthesis.error`): no SYN rows; one error line;
 *   - the section is not the shape it must be: no SYN rows; one error line;
 *   - a profile's reading was withheld by the engine's own guard (`reading_json` is null): left out; one error line with the engine's problems;
 *   - a profile fails any check here: left out; one error line with every problem;
 *   - a saved reading whose zones were dropped by the engine (`guard_problems`): written, with one warning.
 *
 * It never throws: an unexpected exception in here is a refusal of the whole section, never a lost cycle.
 */
@Injectable()
export class SynthesisWriter {
  private readonly logger = new Logger(SynthesisWriter.name);

  constructor(private readonly validator: SynReadingValidator) {}

  prepare(write: {
    symbol: string;
    slot: number;
    result: CycleRunResult;
    evaluatedAt: number;
  }): PreparedSynthesis {
    let prepared: PreparedSynthesis;
    try {
      prepared = prepareSynthesis({
        ...write,
        checkReading: (readingJson) => this.validator.check(readingJson),
      });
    } catch (error) {
      prepared = {
        ran: true,
        readings: [],
        zones: [],
        refused: [
          {
            profile: 'ALL',
            source: 'GATEWAY',
            problems: [
              `unexpected failure while checking the synthesis section: ${(error as Error).message}`,
            ],
          },
        ],
        error: null,
      };
    }
    this.log(write.slot, prepared);
    return prepared;
  }

  private log(slot: number, prepared: PreparedSynthesis): void {
    if (prepared.error !== null) {
      this.logger.error(
        `Slot ${slot}: SYN_ENGINE_ERROR synthesis raised in the engine (${prepared.error}); no SYN rows written, the sensors' rows are unaffected`
      );
    }
    for (const refusal of prepared.refused) {
      this.logger.error(refusalLine(slot, refusal));
    }
    for (const reading of prepared.readings) {
      if (reading.guard_problems.length > 0) {
        this.logger.warn(
          `Slot ${slot}: SYN_ZONES_DROPPED ${reading.profile} reading written, some zones dropped by the engine: ${reading.guard_problems.slice(0, 5).join('; ')}`
        );
      }
    }
  }
}

/** The stable line a refused reading is logged as: the prefix is what the measurement kit looks for. */
export function refusalLine(slot: number, refusal: SynthesisRefusal): string {
  const shown = refusal.problems.slice(0, 10).join('; ');
  const more =
    refusal.problems.length > 10
      ? ` (and ${refusal.problems.length - 10} more)`
      : '';
  return `Slot ${slot}: SYN_READING_REFUSED ${refusal.profile} (${refusal.source}): ${shown}${more}`;
}
