import { Injectable } from '@nestjs/common';
import type {
  TrendlinePolicySession,
  TrendlinePolicyLine,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type TrendlinePolicySessionWithLines = TrendlinePolicySession & {
  lines: TrendlinePolicyLine[];
};

/**
 * The read side of the trendline policy (Layer 1). Not wired into a
 * consumer yet: nothing imports TrendlineContextModule's exports until the
 * sensor-worker's Layer-2 computation (TrendlineContextReading, Blueprint
 * §9, not built) or the reply pipeline needs them.
 */
@Injectable()
export class TrendlineContextService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The most recently published session for `symbol`, with its lines, or
   * null when none was ever recorded. "Latest" is the highest
   * `published_at` -- a Publish is never edited, so this is unambiguous.
   */
  async getLatestPublishedSession(
    symbol: string
  ): Promise<TrendlinePolicySessionWithLines | null> {
    return this.prisma.trendlinePolicySession.findFirst({
      where: { symbol },
      orderBy: { published_at: 'desc' },
      include: { lines: true },
    });
  }
}
