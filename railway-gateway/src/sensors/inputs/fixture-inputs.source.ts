import * as fs from 'fs';
import * as path from 'path';
import { READER_SYMBOL } from '../../cycle/read/read-types';
import { TIMEFRAMES, Timeframe, isSlot } from '../../cycle/slot';
import { CycleInputsBundle, bundleProblems } from './bundle-types';
import type { InputsSource, LoadedInputs } from './inputs-source';
import { isoToSlot, slotToIso, statsSlots } from './stats-slot';

/**
 * The stored cycle bundles of `davintrade-stack-d-and-e/engine-1-5-new/mcd_worker/
 * fixtures/` (`<slot>.bundle.json`, slots 2026-09-18T2055Z, 2026-09-28T1415Z and
 * 2026-09-28T2315Z), as the second `InputsSource`. They were cut from the replica
 * workbooks by the kit's own provider, so they hold what the database source must
 * produce for the same cycle; the gated parity spec (test/sensors-inputs.pg.spec.ts)
 * seeds a throwaway Postgres from them and compares.
 *
 * A fixture is a stored bundle, so it is returned as it is: nothing is cut, filtered
 * or completed (a replay must give the bytes it was stored with). The only checks
 * are that the file is the JSON form of a `CycleInputs` and that it is the slot that
 * was asked for.
 *
 * The folder is a constructor argument. The gateway is built alone on Railway, where
 * `mcd_worker/fixtures/` does not exist, so nothing here may assume where it is.
 */
export class FixtureInputsSource implements InputsSource {
  constructor(private readonly directory: string) {}

  /** `2026-09-18T2055Z`: the file stem of a slot (Windows forbids ':' in file names). */
  static stem(slot: number): string {
    return slotToIso(slot).replace(':', '');
  }

  async loadCycleInputs(symbol: string, slot: number): Promise<LoadedInputs> {
    if (symbol !== READER_SYMBOL) {
      throw new RangeError(
        `this pipeline carries ${READER_SYMBOL} only, got ${String(symbol)}`
      );
    }
    if (!Number.isInteger(slot) || !isSlot(slot)) {
      throw new RangeError(
        `slot must be a unix time on a 5-minute boundary, got ${String(slot)}`
      );
    }
    const file = path.join(
      this.directory,
      `${FixtureInputsSource.stem(slot)}.bundle.json`
    );
    if (!fs.existsSync(file)) {
      return {
        status: 'NOT_READY',
        reason: 'CYCLE_NOT_READY',
        slot,
        detail: `no fixture bundle for slot ${slot} (${path.basename(file)})`,
      };
    }
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    const problems = bundleProblems(parsed);
    if (problems.length > 0) {
      return {
        status: 'NOT_READY',
        reason: 'INVALID_CYCLE_ROW',
        slot,
        detail: `${path.basename(file)} is not a cycle bundle: ${problems.join('; ')}`,
      };
    }
    const bundle = parsed as CycleInputsBundle;
    if (isoToSlot(bundle.cycle_slot) !== slot || bundle.symbol !== symbol) {
      return {
        status: 'NOT_READY',
        reason: 'INVALID_CYCLE_ROW',
        slot,
        detail: `${path.basename(file)} holds ${bundle.symbol} at ${bundle.cycle_slot}, not ${symbol} at ${slotToIso(slot)}`,
      };
    }
    const counts = {} as Record<Timeframe, number>;
    for (const timeframe of TIMEFRAMES)
      counts[timeframe] = bundle.bars[timeframe].length;
    return {
      status: 'OK',
      bundle,
      provenance: {
        origin: 'fixture',
        slot,
        dataStatus: bundle.data_status,
        retuning: bundle.retuning,
        statsSlot: statsSlots(slot),
        barCounts: counts,
        barsRequested: counts,
        collected: { M5: true, M15: true },
        refusals: [],
        notes: [path.basename(file)],
      },
    };
  }
}
