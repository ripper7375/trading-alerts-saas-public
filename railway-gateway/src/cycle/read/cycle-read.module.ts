import { Module } from '@nestjs/common';
import { ActiveIndicatorService } from '../active-indicator/active-indicator.service';
import { CycleReaderService } from './cycle-reader.service';

/**
 * The read side of the cycle pipeline and the active-indicator setting. The HTTP
 * consumers (GatewayModule: `GET /api/v1/cycles/current`, the active-indicator
 * endpoints) import it now; the sensor worker (build step 3) imports it for the
 * same functions in process. PrismaModule is global, so nothing else is needed.
 */
@Module({
  providers: [CycleReaderService, ActiveIndicatorService],
  exports: [CycleReaderService, ActiveIndicatorService],
})
export class CycleReadModule {}
