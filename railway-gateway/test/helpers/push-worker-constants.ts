import * as fs from 'fs';
import * as path from 'path';

/**
 * The few constants of the VPS push worker that the gateway must agree with,
 * read from its source (the way collector-constants.ts reads the collector's).
 * A rename or a changed value in the Python fails a spec here instead of the two
 * sides quietly drifting apart.
 */
const PUSH_WORKER_PATH = path.join(
  __dirname,
  '../../../backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/backfill_worker_api_gateway_v5.py'
);

export interface PushWorkerConstants {
  priorityClosedBars: { M5: number; M15: number };
  manifestEndpoint: string;
  manifestMaxAgeSec: number;
  manifestSchema: string;
  maxRowsPerCycle: number;
}

function after(
  source: string,
  pattern: RegExp,
  label: string
): RegExpExecArray {
  const match = pattern.exec(source);
  if (!match) throw new Error(`push worker constant not found: ${label}`);
  return match;
}

export function readPushWorkerConstants(): PushWorkerConstants {
  const source = fs.readFileSync(PUSH_WORKER_PATH, 'utf8');
  const bars = after(
    source,
    /^PRIORITY_CLOSED_BARS\s*=\s*\{\s*'M5':\s*(\d+),\s*'M15':\s*(\d+)\s*\}/m,
    'PRIORITY_CLOSED_BARS'
  );
  return {
    priorityClosedBars: { M5: Number(bars[1]), M15: Number(bars[2]) },
    manifestEndpoint: after(
      source,
      /^MANIFEST_ENDPOINT\s*=\s*'([^']+)'/m,
      'MANIFEST_ENDPOINT'
    )[1],
    manifestMaxAgeSec: Number(
      after(
        source,
        /^MANIFEST_MAX_AGE_SEC\s*=\s*(\d+)/m,
        'MANIFEST_MAX_AGE_SEC'
      )[1]
    ),
    manifestSchema: after(
      source,
      /^MANIFEST_SCHEMA\s*=\s*'([^']+)'/m,
      'MANIFEST_SCHEMA'
    )[1],
    maxRowsPerCycle: Number(
      after(source, /^MAX_ROWS_PER_CYCLE\s*=\s*(\d+)/m, 'MAX_ROWS_PER_CYCLE')[1]
    ),
  };
}
