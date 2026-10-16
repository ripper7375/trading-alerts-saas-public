import {
  Injectable,
  OnModuleInit,
  OnApplicationShutdown,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// Prisma 7 requires a driver adapter for every PrismaClient instantiation.
// DATABASE_URL is the pooled (PgBouncer) connection string, same production
// Postgres the root Next.js app connects to (plan §1) — matches
// lib/db/prisma.ts's own adapter setup so behavior is identical across
// services.
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnApplicationShutdown
{
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: process.env['DATABASE_URL'],
        ssl: { rejectUnauthorized: false },
      }),
      log:
        process.env['NODE_ENV'] === 'development'
          ? ['query', 'error', 'warn']
          : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  // NestJS 11 shutdown order: onModuleDestroy -> onBeforeApplicationShutdown ->
  // close the HTTP server (dispose) -> onApplicationShutdown. Disconnecting in
  // onModuleDestroy cut the database off while in-flight requests and queue
  // jobs were still running; here the HTTP server has already drained.
  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
  }
}
