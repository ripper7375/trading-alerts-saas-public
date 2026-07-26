import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';

import { logger } from '../common/logger.util';

import { PrismaService } from './prisma.service';

/**
 * Session 4A-W4 (Defect 1): before this session, main.ts never called
 * app.enableShutdownHooks(), so PrismaService.onModuleDestroy() was wired
 * into Nest's lifecycle but never actually invoked on SIGTERM/SIGINT — a
 * Railway redeploy severed in-flight queries instead of draining them.
 *
 * This proves the fix using the real NestJS shutdown-hook mechanism (not a
 * hand-rolled call to onModuleDestroy) and a synthetic `process.emit`
 * (an in-process event, not a real OS signal — safe to run under Jest,
 * doesn't touch a live database).
 */
describe('graceful shutdown (4A-W4 Defect 1)', () => {
  it('fires PrismaService.onModuleDestroy and logs cleanup when the process receives SIGTERM', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    const app: INestApplication = moduleRef.createNestApplication();
    const prisma = app.get(PrismaService);

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

    // Nest's real listenToShutdownSignals() re-sends the OS signal to this
    // process (process.kill(process.pid, signal)) once destroy hooks finish,
    // so the default handler terminates it — exactly what a production
    // Railway redeploy wants, but fatal to a Jest worker. Stub it so we can
    // observe the hook firing without actually killing the test process.
    const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => true);
    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);

    app.enableShutdownHooks();
    await app.init();

    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(disconnectSpy).not.toHaveBeenCalled();

    process.emit('SIGTERM', 'SIGTERM');

    // Let the async onModuleDestroy chain (triggered by the SIGTERM
    // listener Nest registered via enableShutdownHooks) actually run.
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      'PrismaService disconnected cleanly on module shutdown'
    );
    // Proves Nest's real shutdown-signal wiring ran end to end (it tried to
    // re-deliver the signal after cleanup), not just a hand-called hook.
    expect(killSpy).toHaveBeenCalledWith(process.pid, 'SIGTERM');

    connectSpy.mockRestore();
    disconnectSpy.mockRestore();
    logSpy.mockRestore();
    killSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
