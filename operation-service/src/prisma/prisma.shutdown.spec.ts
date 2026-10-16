import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';

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
 * Remediation Tier 1 (§5.5/§5.6), same proof as money-service's
 * prisma.shutdown.spec.ts:
 *  - PrismaService disconnects in onApplicationShutdown(), which NestJS 11
 *    runs AFTER it has closed the HTTP server (onModuleDestroy runs before),
 *    so in-flight requests keep their database connection while they drain.
 *  - main.ts passes { useProcessExit: true }: once the hooks finish the
 *    process ends with process.exit(0) instead of re-sending SIGTERM to
 *    itself (which otel.ts's own SIGTERM listener swallows).
 *
 * Real NestJS shutdown-hook mechanism and a synthetic `process.emit` (an
 * in-process event, not a real OS signal); no database is touched.
 */
@Injectable()
class OtherProviderDestroyProbe implements OnModuleDestroy {
  static onDestroy: () => void = () => undefined;
  onModuleDestroy(): void {
    OtherProviderDestroyProbe.onDestroy();
  }
}

describe('PrismaService graceful shutdown (Tier 1 §5.5/§5.6)', () => {
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

  afterEach(() => {
    jest.restoreAllMocks();
    OtherProviderDestroyProbe.onDestroy = () => undefined;
  });

  it('no longer disconnects in onModuleDestroy', () => {
    expect(
      (PrismaService.prototype as unknown as Record<string, unknown>)[
        'onModuleDestroy'
      ]
    ).toBeUndefined();
    expect(typeof PrismaService.prototype.onApplicationShutdown).toBe(
      'function'
    );
  });

  it('disconnects Prisma on SIGTERM and ends the process with exit(0) rather than re-sending the signal', async () => {
    const { app, prisma } = await bootApp();
    const connectSpy = jest
      .spyOn(prisma, '$connect')
      .mockResolvedValue(undefined);
    const disconnectSpy = jest
      .spyOn(prisma, '$disconnect')
      .mockResolvedValue(undefined);
    const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => true);
    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);

    app.enableShutdownHooks(undefined, { useProcessExit: true });
    await app.init();

    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(disconnectSpy).not.toHaveBeenCalled();

    process.emit('SIGTERM', 'SIGTERM');
    await waitUntil(() => exitSpy.mock.calls.length > 0);

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
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
    jest.spyOn(app.getHttpAdapter(), 'close').mockImplementation(async () => {
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
