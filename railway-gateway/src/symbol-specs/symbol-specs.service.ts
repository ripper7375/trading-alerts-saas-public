import { Injectable } from '@nestjs/common';
import type { SymbolSpec } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The read side of the broker's symbol figures (ADR-066, STACK-D-ARCHITECTURE.md
 * section 6.9). Engine 4 (Section 6) reads the latest row and records its
 * `version` in the consent record, so the figures a trader saw can be named
 * later.
 *
 * Not wired into a consumer yet: nothing imports SymbolSpecsModule until
 * Section 6 is built. The monolith cannot import from this package, so Section 6
 * will either read the table through marketPrisma (the model is mirrored there)
 * or ask for an endpoint; neither is part of build step 2.
 */
@Injectable()
export class SymbolSpecsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The newest observation of `symbol`, or null when none was ever recorded.
   *
   * "Newest" is the latest `captured_at` (when the terminal was read), then the
   * highest `version` as a tie-break. NOT the highest version alone: versions
   * follow the order the gateway recorded the rows, so a late-arriving older
   * observation has a higher version than a newer one that came first.
   *
   * It does not judge staleness. Section 7.6 makes Report 2 unavailable when the
   * newest row is more than 7 days old; the caller has `captured_at` to decide.
   */
  async getLatestSymbolSpec(symbol: string): Promise<SymbolSpec | null> {
    return this.prisma.symbolSpec.findFirst({
      where: { symbol },
      orderBy: [{ captured_at: 'desc' }, { version: 'desc' }],
    });
  }
}
