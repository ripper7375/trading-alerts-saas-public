import { Controller, Get } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/v1')
export class HealthController {
  constructor(
    @InjectQueue('market-data-sync') private readonly queue: Queue,
    private readonly prisma: PrismaService
  ) {}

  @Get('health')
  async check() {
    const [redisHealth, queueHealth, dbHealth] = await Promise.all([
      this.checkRedis(),
      this.checkQueue(),
      this.checkDatabase(),
    ]);

    const isHealthy =
      redisHealth.status === 'up' && queueHealth.status === 'up' && dbHealth.status === 'up';

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        redis: redisHealth,
        queue: queueHealth,
        database: dbHealth,
      },
      uptime: process.uptime(),
    };
  }

  @Get('queue/stats')
  async queueStats() {
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
      this.queue.getPausedCount(),
    ]);

    return {
      queue: 'market-data-sync',
      jobs: { waiting, active, completed, failed, delayed, paused },
    };
  }

  private async checkRedis() {
    try {
      const start = Date.now();
      await this.queue.client.ping();
      return { status: 'up' as const, latency: Date.now() - start };
    } catch (error) {
      return { status: 'down' as const, error: (error as Error).message };
    }
  }

  private async checkQueue() {
    try {
      const [waiting, active, completed, failed] = await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount(),
      ]);
      return { status: 'up' as const, waiting, active, completed, failed };
    } catch (error) {
      return { status: 'down' as const, error: (error as Error).message };
    }
  }

  private async checkDatabase() {
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up' as const, latency: Date.now() - start };
    } catch (error) {
      return { status: 'down' as const, error: (error as Error).message };
    }
  }
}
