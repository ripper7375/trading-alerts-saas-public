import { Module } from '@nestjs/common';
import { SymbolSpecsService } from './symbol-specs.service';

/**
 * The read side of the broker's symbol figures. PrismaModule is global, so
 * nothing else is needed. Nothing imports this yet (see SymbolSpecsService).
 */
@Module({
  providers: [SymbolSpecsService],
  exports: [SymbolSpecsService],
})
export class SymbolSpecsModule {}
