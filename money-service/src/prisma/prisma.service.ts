import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { logger } from '../common/logger.util';

// Prisma 7 requires a driver adapter for every PrismaClient instantiation.
// DATABASE_URL is the pooled (PgBouncer) connection string, authenticating as
// the `money_svc` role (blueprint §5.1) — a distinct, narrower-scoped role
// than operation-service's `core_app`. Deliberately NOT using
// operation-service's `ssl: { rejectUnauthorized: false }` here — Session
// 4A-1's live deploy proved PgBouncer's own listener rejects a TLS
// negotiation outright ("the server does not support SSL connections"),
// unlike whatever operation-service's DATABASE_URL actually points at.
// Connecting over Railway's private network (pgbouncer.railway.internal)
// makes an app-level TLS hop redundant anyway. See this order's Deviations.
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: process.env['DATABASE_URL'],
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

  async onModuleDestroy() {
    // Session 4A-W4: only observable now that main.ts calls
    // enableShutdownHooks() — previously this method was wired to Nest's
    // lifecycle but never actually invoked on SIGTERM/SIGINT.
    await this.$disconnect();
    logger.info('PrismaService disconnected cleanly on module shutdown');
  }
}
