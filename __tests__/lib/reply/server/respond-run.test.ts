/**
 * @jest-environment node
 */

/**
 * The route body around a run (build step 7 part 7b; `lib/reply/server/respond.ts`): what it builds
 * from the environment, what it hands the run, and what it does when the run itself breaks. The run
 * (`runReply`) and the production ports are mocked here, so these are the cases a real run never
 * produces: it answers every failure of its own with an outcome, and a rejection would be a bug.
 */

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));

const runReply = jest.fn();
jest.mock('@/lib/reply/orchestrator', () => ({
  runReply: (...args: unknown[]) => runReply(...args),
}));

const createReplyPorts = jest.fn();
jest.mock('@/lib/reply/server/ports', () => ({
  createReplyPorts: (...args: unknown[]) => createReplyPorts(...args),
}));

import type { StageEvent } from '@/lib/reply/contracts/stage-events';
import { runMessageRoute } from '@/lib/reply/server/respond';

const log = jest.fn();
const ports = { log } as never;

const request = () =>
  new Request('http://localhost/api/chat/message', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });

const stage = (
  name: StageEvent['stage'],
  status: StageEvent['status']
): StageEvent => ({
  type: 'stage',
  stage: name,
  status,
  ms: status === 'DONE' ? 4 : null,
});

const lines = (text: string): unknown[] =>
  text
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line));

type EmitOptions = { emit: (event: StageEvent) => void };

beforeEach(() => {
  runReply.mockReset();
  createReplyPorts.mockReset();
  log.mockReset();
});

describe('the environment', () => {
  it('builds the production ports from the environment it was given, once, and runs on them', async () => {
    const env = { REPLY_ENABLED: 'true' };
    createReplyPorts.mockReturnValue(ports);
    runReply.mockResolvedValue({ kind: 'DISABLED' });
    const response = await runMessageRoute(request(), { env });
    expect(response.status).toBe(404);
    expect(createReplyPorts).toHaveBeenCalledTimes(1);
    expect(createReplyPorts.mock.calls[0]![0]).toBe(env);
    expect(runReply).toHaveBeenCalledTimes(1);
    expect(runReply.mock.calls[0]![0]).toBe(ports);
  });

  it('is a 404 that builds and asks nothing while the flag is not exactly true', async () => {
    for (const REPLY_ENABLED of [undefined, '', 'TRUE', '1', 'yes', ' true']) {
      const response = await runMessageRoute(request(), {
        env: { REPLY_ENABLED },
      });
      expect(response.status).toBe(404);
    }
    expect(createReplyPorts).not.toHaveBeenCalled();
    expect(runReply).not.toHaveBeenCalled();
  });
});

describe('what the run is given', () => {
  it('the client’s signal, an emitter, and a deadline only when one was asked for', async () => {
    runReply.mockResolvedValue({ kind: 'DISABLED' });
    await runMessageRoute(request(), { ports, deadlineMs: 1_234 });
    await runMessageRoute(request(), { ports });
    expect(runReply.mock.calls[0]![2]).toEqual({
      signal: expect.any(AbortSignal),
      emit: expect.any(Function),
      deadlineMs: 1_234,
    });
    expect(Object.keys(runReply.mock.calls[1]![2] as object).sort()).toEqual([
      'emit',
      'signal',
    ]);
  });
});

describe('a run that breaks', () => {
  it('before it left the gate is a 500 with no stream, and the log says only that it broke', async () => {
    runReply.mockRejectedValue(new Error('the secret reason'));
    const response = await runMessageRoute(request(), { ports });
    expect(response.status).toBe(500);
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe('INTERNAL');
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('ROUTE_RUN_FAILED');
  });

  it('after it left the gate is an error event at the end of the stream the client is already reading', async () => {
    runReply.mockImplementation(
      async (_ports, _reader, options: EmitOptions) => {
        options.emit(stage('GATE', 'DONE'));
        options.emit(stage('DATA', 'STARTED'));
        await Promise.resolve();
        throw new Error('the secret reason');
      }
    );
    const response = await runMessageRoute(request(), { ports });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('ndjson');
    expect(lines(await response.text())).toEqual([
      stage('GATE', 'DONE'),
      stage('DATA', 'STARTED'),
      {
        type: 'error',
        request_id: 'unknown',
        code: 'INTERNAL',
        retryable: false,
      },
    ]);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('ROUTE_RUN_FAILED');
  });
});

describe('a run that ends the moment it leaves the gate', () => {
  const done = {
    kind: 'REPLY',
    requestId: 'r1',
    result: { schema: 'reply-result/1' },
    replayed: false,
  };

  it('still sends the stages it passed, then its result, as a stream', async () => {
    runReply.mockImplementation(
      async (_ports, _reader, options: EmitOptions) => {
        options.emit(stage('GATE', 'DONE'));
        options.emit(stage('DATA', 'STARTED'));
        return done;
      }
    );
    const response = await runMessageRoute(request(), { ports });
    expect(response.status).toBe(200);
    expect(lines(await response.text())).toEqual([
      stage('GATE', 'DONE'),
      stage('DATA', 'STARTED'),
      {
        type: 'result',
        request_id: 'r1',
        result: { schema: 'reply-result/1' },
      },
    ]);
  });

  it('and a run that never left the gate sends its one event alone, whatever stages the gate reported', async () => {
    runReply.mockImplementation(
      async (_ports, _reader, options: EmitOptions) => {
        options.emit(stage('GATE', 'STARTED'));
        return {
          kind: 'ERROR',
          requestId: 'r2',
          code: 'INTERNAL',
          retryable: true,
        };
      }
    );
    const response = await runMessageRoute(request(), { ports });
    expect(response.status).toBe(200);
    expect(lines(await response.text())).toEqual([
      { type: 'error', request_id: 'r2', code: 'INTERNAL', retryable: true },
    ]);
  });
});
