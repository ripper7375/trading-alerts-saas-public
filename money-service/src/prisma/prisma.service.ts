import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// Prisma 7 requires a driver adapter for every PrismaClient instantiation.
// DATABASE_URL is the pooled (PgBouncer) connection string, authenticating as
// the `money_svc` role (blueprint §5.1) — a distinct, narrower-scoped role
// than operation-service's `core_app`. Mirrors operation-service's own
// PrismaService/lib/db/prisma.ts adapter setup so behavior is identical
// across services.
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
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

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
