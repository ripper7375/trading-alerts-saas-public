import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';

import { logger } from '../common/logger.util';

import { PrismaService } from './prisma.service';

// Loading @prisma/client and compiling a Nest module is slow when the whole suite runs
// in parallel (this spec timed out at Jest's 5 s default: LESSONS-LEARNED L24).
jest.setTimeout(30_000);

/** Polls for an observable outcome instead of guessing how many ticks an async chain needs. */
async function waitUntil(done: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!done()) {
    if (Date.now() > deadline)
      throw new Error('timed out waiting for shutdown');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

/**
 * Session 4A-W4 (Defect 1): before this session, main.ts never called
 * app.enableShutdownHooks(), so PrismaService's shutdown hook was wired
 * into Nest's lifecycle but never actually invoked on SIGTERM/SIGINT — a
 * Railway redeploy severed in-flight queries instead of draining them.
 *
 * Remediation Tier 1 (§5.5/§5.6) changed two things, both proven here:
 *  - PrismaService disconnects in onApplicationShutdown(), which NestJS 11
 *    runs AFTER it has closed the HTTP server (onModuleDestroy runs before),
 *    so in-flight requests keep their database connection while they drain.
 *  - main.ts passes { useProcessExit: true }: once the hooks finish the
 *    process ends with process.exit(0) instead of re-sending SIGTERM to
 *    itself (which otel.ts's own SIGTERM listener swallows).
 *
 * This uses the real NestJS shutdown-hook mechanism (not a hand-rolled call
 * to the hook) and a synthetic `process.emit` (an in-process event, not a
 * real OS signal — safe to run under Jest, doesn't touch a live database).
 */
@Injectable()
class OtherProviderDestroyProbe implements OnModuleDestroy {
  static onDestroy: () => void = () => undefined;
  onModuleDestroy(): void {
    OtherProviderDestroyProbe.onDestroy();
  }
}

describe('graceful shutdown (4A-W4 Defect 1, Tier 1 §5.5/§5.6)', () => {
  async function bootApp(): Promise<{
    app: INestApplication;
    prisma: PrismaService;
  }> {
    const moduleRef = await Test.createTestingModule({
      providers: [PrismaService, OtherProviderDestroyProbe],
    }).compile();
    const app = moduleRef.createNestApplication();
    return { app, prisma: app.get(PrismaService) };
  }

  /** Nest's real listenToShutdownSignals() ends in process.exit(0) or process.kill. */
  function stubProcessEnd() {
    const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => true);
    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    return { killSpy, exitSpy };
  }

  afterEach(() => {
    jest.restoreAllMocks();
    OtherProviderDestroyProbe.onDestroy = () => undefined;
  });

  it('disconnects Prisma on SIGTERM, logs it, and ends the process with exit(0) rather than re-sending the signal', async () => {
    const { app, prisma } = await bootApp();

    // Stub the network-touching methods only — this proves our own
    // shutdown wiring, not Prisma's/Postgres's connection behavior.
    const connectSpy = jest
      .spyOn(prisma, '$connect')
      .mockResolvedValue(undefined);
    const disconnectSpy = jest
      .spyOn(prisma, '$disconnect')
      .mockResolvedValue(undefined);
    // No mockImplementation — let this call through to the real logger so
    // the cleanup line actually prints (visible proof, not just an
    // assertion), matching this repo's other spec files' convention of
    // not suppressing real log output during tests.
    const logSpy = jest.spyOn(logger, 'info');
    const { killSpy, exitSpy } = stubProcessEnd();

    app.enableShutdownHooks(undefined, { useProcessExit: true });
    await app.init();

    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(disconnectSpy).not.toHaveBeenCalled();

    process.emit('SIGTERM', 'SIGTERM');

    // Let the async shutdown chain (triggered by the SIGTERM listener Nest
    // registered via enableShutdownHooks) run to its end: process.exit(0).
    await waitUntil(() => exitSpy.mock.calls.length > 0);

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      'PrismaService disconnected cleanly on module shutdown'
    );
    // Proves Nest's real shutdown-signal wiring ran end to end and ended the
    // process the way main.ts asks (useProcessExit), not by re-delivering
    // the signal.
    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(killSpy).not.toHaveBeenCalledWith(process.pid, 'SIGTERM');
  });

  it('disconnects Prisma only AFTER the other providers are destroyed and the HTTP server is closed', async () => {
    const { app, prisma } = await bootApp();
    const order: string[] = [];

    jest.spyOn(prisma, '$connect').mockResolvedValue(undefined);
    jest.spyOn(prisma, '$disconnect').mockImplementation(async () => {
      order.push('prisma.$disconnect');
    });
    OtherProviderDestroyProbe.onDestroy = () => order.push('onModuleDestroy');
    const adapter = app.getHttpAdapter();
    jest.spyOn(adapter, 'close').mockImplementation(async () => {
      order.push('http.close');
    });

    await app.init();
    await app.close();

    expect(order).toEqual([
      'onModuleDestroy',
      'http.close',
      'prisma.$disconnect',
    ]);
  });
});
