import { Module } from '@nestjs/common';

import { EmailLocaleService } from './email-locale.service';

/**
 * Registers the recipient-locale resolver that the e-mail senders in
 * `email.util.ts` use. Imported once by `AppModule`; `PrismaModule` is global.
 */
@Module({
  providers: [EmailLocaleService],
  exports: [EmailLocaleService],
})
export class EmailModule {}
