import { Controller, Get, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard, AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // Unprefixed (excluded from the global 'v1' prefix, see main.ts) so
  // Railway's healthcheck config doesn't need to know about API versioning.
  @Get('health')
  async health() {
    const database = await this.checkDatabase();
    const allHealthy = database.status === 'up';

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      services: { database },
      uptime: process.uptime(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('health-auth')
  healthAuth(@Req() request: AuthenticatedRequest) {
    return {
      status: 'ok',
      user: {
        id: request.user.id,
        email: request.user.email,
        tier: request.user.tier,
        role: request.user.role,
        isAffiliate: request.user.isAffiliate,
      },
    };
  }

  private async checkDatabase(): Promise<{
    status: 'up' | 'down';
    error?: string;
  }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up' };
    } catch (error) {
      return {
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
