import * as fs from 'fs';
import * as path from 'path';
import { CycleManifest } from '../src/cycle/cycle-manifest.contract';
import { pendingCycleRow } from '../src/cycle/manifest-row';

/**
 * The mapping from the manifest's vocabulary to the market_cycles columns of the
 * part 2 migration. It is the one place the two meet, so every column is pinned
 * against the real sender's manifest, including the cases where a naive mapping
 * goes quietly wrong: attempts (the larger of the timeframes'), the timings (the
 * M5 cycle's), M15 columns on a slot that does not refresh it (NULL, not 0), and
 * a re-push count the sender did not measure (NULL, not 0).
 */

function fixture(name: string): CycleManifest {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8')
  );
}

const refresh = fixture('cycle-manifest-refresh-slot.json');
const plain = fixture('cycle-manifest-plain-slot.json');
const RECEIVED = 1789765262;

describe('a refresh slot (M5 and M15)', () => {
  const row = pendingCycleRow(refresh, RECEIVED);
  const m5 = refresh.timeframes.M5;
  const m15 = refresh.timeframes.M15!;

  it('identifies the cycle and starts it PENDING', () => {
    expect(row.symbol).toBe('XAUUSD');
    expect(row.slot).toBe(refresh.slot);
    expect(row.state).toBe('PENDING');
  });

  it("attempts is the larger of the two timeframes' (M5 needed 2, M15 needed 1)", () => {
    expect(m5.attempts).toBe(2);
    expect(m15.attempts).toBe(1);
    expect(row.attempts).toBe(2);
  });

  it('attempts follows the timeframe that needed more, whichever it is', () => {
    // in the fixture M5 happens to be the worse one, so this is what pins "larger of the two"
    const m15Worse: CycleManifest = {
      ...refresh,
      timeframes: {
        M5: { ...refresh.timeframes.M5, attempts: 1 },
        M15: { ...refresh.timeframes.M15!, attempts: 3 },
      },
    };
    expect(pendingCycleRow(m15Worse, RECEIVED).attempts).toBe(3);
  });

  it("records the gateway's own arrival time, not the sender's build time", () => {
    expect(row.manifest_received_at).toBe(RECEIVED);
    expect(row.manifest_received_at).not.toBe(refresh.built_at);
  });

  it("takes the cycle's collector timings from the M5 cycle", () => {
    expect(row.collector_started_at).toBe(m5.started_at);
    expect(row.collector_validated_at).toBe(m5.validated_at);
  });

  it('maps each timeframe to its own columns', () => {
    expect(row.m5_collection_cycle_id).toBe(m5.collection_cycle_id);
    expect(row.m15_collection_cycle_id).toBe(m15.collection_cycle_id);
    expect(row.m5_bar_count).toBe(289);
    expect(row.m15_bar_count).toBe(97);
    expect(row.m5_newest_bar_ts).toBe(m5.newest_bar_ts);
    expect(row.m15_newest_bar_ts).toBe(m15.newest_bar_ts);
  });

  it("maps the export file's modification time to the export columns", () => {
    expect(row.m5_export_at).toBe(m5.export_mtime);
    expect(row.m15_export_at).toBe(m15.export_mtime);
  });

  it('maps the terminal, the backlog and the tuning', () => {
    expect(row.terminal_id).toBe(refresh.mt5_terminal);
    expect(row.backlog_rows).toBe(refresh.backlog_rows);
    expect(row.config_hashes).toEqual({
      M5: m5.config_hashes,
      M15: m15.config_hashes,
    });
    expect(row.source_modes).toEqual({
      M5: m5.source_modes,
      M15: m15.source_modes,
    });
    // keyed by timeframe first: the same source can be configured differently on each chart
    expect(Object.keys(row.config_hashes)).toEqual(['M5', 'M15']);
  });

  it("the sender's re-push count is stored as sent", () => {
    expect(refresh.repush_rows_unsent).toBe(5997);
    expect(row.repush_rows_unsent).toBe(5997);
    expect(row.repush_rows_unsent).toBeLessThanOrEqual(row.backlog_rows);
  });

  it('a re-push count the sender did not send is NULL, never zero', () => {
    // a sender older than build step 2 part 9 omits the field
    const { repush_rows_unsent: _omitted, ...olderSender } = refresh;
    expect(_omitted).toBe(5997);
    expect('repush_rows_unsent' in olderSender).toBe(false);
    expect(
      pendingCycleRow(olderSender, RECEIVED).repush_rows_unsent
    ).toBeNull();
    expect(
      pendingCycleRow({ ...refresh, repush_rows_unsent: 0 }, RECEIVED)
        .repush_rows_unsent
    ).toBe(0);
    expect(
      pendingCycleRow({ ...refresh, repush_rows_unsent: 5200 }, RECEIVED)
        .repush_rows_unsent
    ).toBe(5200);
  });

  it('leaves what the decision owns unset', () => {
    for (const column of [
      'data_status',
      'ready_at',
      'closed_bars_digest',
      'check_detail',
      'retuning',
    ]) {
      expect(row).not.toHaveProperty(column);
    }
  });

  it('is plain JSON all the way down (it goes to a database and a job payload)', () => {
    expect(JSON.parse(JSON.stringify(row))).toEqual(row);
  });
});

describe('an M5-only slot', () => {
  const row = pendingCycleRow(plain, RECEIVED);

  it('leaves every M15 column NULL, never zero', () => {
    expect(row.m15_collection_cycle_id).toBeNull();
    expect(row.m15_bar_count).toBeNull();
    expect(row.m15_newest_bar_ts).toBeNull();
    expect(row.m15_export_at).toBeNull();
  });

  it('carries no M15 key in the tuning', () => {
    expect(Object.keys(row.config_hashes)).toEqual(['M5']);
    expect(Object.keys(row.source_modes)).toEqual(['M5']);
  });

  it("attempts is the M5 cycle's", () => {
    expect(row.attempts).toBe(plain.timeframes.M5.attempts);
  });
});
