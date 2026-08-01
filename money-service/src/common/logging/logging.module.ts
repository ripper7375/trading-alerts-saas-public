import { Global, Module } from '@nestjs/common';

import { PinoLoggerService } from './logging.service';

@Global()
@Module({
  providers: [PinoLoggerService],
  exports: [PinoLoggerService],
})
export class LoggingModule {}
