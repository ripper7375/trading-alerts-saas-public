import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// Prisma 7 requires a driver adapter for every PrismaClient instantiation.
// DATABASE_URL is the same production Postgres the root Next.js app and
// money-service connect to. No `ssl` override here, matching
// money-service/src/prisma/prisma.service.ts's own finding (Session 4A-1):
// PgBouncer's internal listener (pgbouncer.railway.internal) rejects a TLS
// negotiation outright, and Railway's private network makes an app-level
// TLS hop redundant anyway.
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
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
