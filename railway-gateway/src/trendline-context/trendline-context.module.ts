import { DynamicModule, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TrendlineContextController } from './trendline-context.controller';
import { TrendlineContextProcessor } from './trendline-context.processor';
import { TrendlineContextService } from './trendline-context.service';
import {
  TRENDLINE_POLICY_QUEUE,
  trendlineContextEnabled,
} from './trendline-context.keys';

/**
 * Layer 1 (policy) ingestion for hand-drawn, labelled trendlines
 * (TRENDLINE-CONTEXT-BLUEPRINT.md, in backend-stack-c/.../mq5/
 * new-market-context-synthesis-and-analysis-architecture/).
 *
 * A DYNAMIC module on purpose, mirroring SensorsModule.register():
 * `TrendlineContextModule.register()` gives back an EMPTY module -- no
 * controller, no queue, no consumer, no route -- unless the environment
 * says exactly `TRENDLINE_CONTEXT_ENABLED=true`. Anything else, including a
 * typo, leaves the gateway exactly as it was before this module existed:
 * POST /api/v1/trendline-context/policy does not exist (404), not "exists
 * but is rejected". Flipping the variable off and redeploying is the
 * rollback.
 *
 * This module covers Layer 1 ONLY (the analyst's Publish). Layer 2
 * (TrendlineContextReading, computed every 5-minute cycle by the sensor
 * worker) is a separate piece of work, not built yet (Blueprint §9).
 */
@Module({})
export class TrendlineContextModule {
  static register(env: NodeJS.ProcessEnv = process.env): DynamicModule {
    if (!trendlineContextEnabled(env)) {
      return { module: TrendlineContextModule };
    }

    return {
      module: TrendlineContextModule,
      imports: [BullModule.registerQueue({ name: TRENDLINE_POLICY_QUEUE })],
      controllers: [TrendlineContextController],
      providers: [TrendlineContextProcessor, TrendlineContextService],
      exports: [TrendlineContextService],
    };
  }
}
