/**
 * The stage events of a run (build step 7 part 7a; architecture 5.11, ADR-054, decision D24).
 *
 * The intake path times its own stages with a `TraceRecorder` (door, understand, scope, snapshot,
 * data, events, board, route, retrieve, assemble). A client shows six: GATE, UNDERSTAND, DATA,
 * CONTEXT, MODEL, CHECKS. `StageTracker` turns the one into the other and keeps the order rules of
 * `validateStreamOrder`: each stage is STARTED once and then DONE, or SKIPPED on its own, never
 * twice, never going back, and only one is open at a time. When a stage starts, the one before it
 * is DONE and any stage between that never began is SKIPPED (an instant prompt has no
 * UNDERSTAND). A stage left open by a request that ended early is closed by the terminal event
 * the route sends, which is the rule of the stream.
 *
 * Pure: the clock is the intake path's.
 *
 * @module lib/reply/run/stages
 */

import { REPLY_STAGES } from '../contracts/stage-events';
import type { ReplyStage, StageEvent } from '../contracts/stage-events';
import { TraceRecorder } from '../contracts/intake';
import type { TraceRecorderOptions, TraceStageName } from '../contracts/intake';

/** The six stages a client shows, for each stage the intake path times. */
const STAGE_OF: Readonly<Record<TraceStageName, ReplyStage>> = {
  GATE: 'GATE',
  DOOR: 'UNDERSTAND',
  UNDERSTAND: 'UNDERSTAND',
  SCOPE: 'UNDERSTAND',
  SNAPSHOT: 'DATA',
  DATA: 'DATA',
  EVENTS: 'DATA',
  BOARD: 'DATA',
  ROUTE: 'DATA',
  RETRIEVE: 'CONTEXT',
  ASSEMBLE: 'CONTEXT',
};

export class StageTracker {
  /** the position in `REPLY_STAGES` of the stage that is open, or -1 */
  private open = -1;
  /** the position of the latest stage that began or was skipped */
  private latest = -1;
  private startedAt = 0;

  constructor(
    private readonly emit: (event: StageEvent) => void,
    private readonly clock: () => number
  ) {}

  /** The stage that is open now, or null. */
  get current(): ReplyStage | null {
    return this.open < 0 ? null : (REPLY_STAGES[this.open] as ReplyStage);
  }

  private closeOpen(): void {
    if (this.open < 0) return;
    this.emit({
      type: 'stage',
      stage: REPLY_STAGES[this.open] as ReplyStage,
      status: 'DONE',
      ms: Math.max(0, Math.round(this.clock() - this.startedAt)),
    });
    this.open = -1;
  }

  /** Begin a stage. A stage that is already open (or already past) is left as it is. */
  enter(stage: ReplyStage): void {
    const at = REPLY_STAGES.indexOf(stage);
    if (at <= this.latest) return;
    this.closeOpen();
    for (let between = this.latest + 1; between < at; between += 1) {
      this.emit({
        type: 'stage',
        stage: REPLY_STAGES[between] as ReplyStage,
        status: 'SKIPPED',
        ms: null,
      });
    }
    this.emit({ type: 'stage', stage, status: 'STARTED', ms: null });
    this.open = at;
    this.latest = at;
    this.startedAt = this.clock();
  }

  /** Close the open stage; the stages that never began are skipped when the next one starts. */
  close(): void {
    this.closeOpen();
  }

  /** Mark every stage from the next one to the end as skipped: the request needed no model. */
  skipRest(): void {
    this.closeOpen();
    for (let next = this.latest + 1; next < REPLY_STAGES.length; next += 1) {
      this.emit({
        type: 'stage',
        stage: REPLY_STAGES[next] as ReplyStage,
        status: 'SKIPPED',
        ms: null,
      });
    }
    this.latest = REPLY_STAGES.length - 1;
  }

  /** The stage of the client that an intake stage belongs to. */
  static stageOf(name: TraceStageName): ReplyStage {
    return STAGE_OF[name];
  }
}

/** A trace recorder that tells the tracker which stage it is in as the intake path runs. */
export class EventedRecorder extends TraceRecorder {
  constructor(
    options: TraceRecorderOptions,
    private readonly tracker: StageTracker
  ) {
    super(options);
  }

  override async stage<T>(
    name: Parameters<TraceRecorder['stage']>[0],
    run: () => Promise<T>
  ): Promise<T> {
    this.tracker.enter(StageTracker.stageOf(name));
    return super.stage(name, run);
  }
}
