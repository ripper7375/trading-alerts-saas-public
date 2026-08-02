import { Module } from '@nestjs/common';

import { TierController } from './tier.controller';
import { TierService } from './tier.service';

/**
 * Tier domain module (Session 4B-10). `PrismaModule` is not needed here —
 * this domain reads no database state at all (pure config/constants),
 * unlike Alerts/Drawings/Notifications.
 *
 * @module tier/tier.module
 */
@Module({
  controllers: [TierController],
  providers: [TierService],
})
export class TierModule {}
