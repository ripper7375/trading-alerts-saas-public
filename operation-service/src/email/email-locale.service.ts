import { Injectable, OnModuleInit } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { currentEmailLocaleHint } from './email-locale.context';
import {
  resolveEmailLocale,
  type EmailLocale,
  type EmailLocaleHint,
} from './i18n';
import { setRecipientLocaleResolver } from './recipient-locale';

/**
 * Decides which language and formats an e-mail to one person is written in.
 *
 * Order, field by field: what the person saved in Settings -> Language &
 * Region (`UserPreferences.preferences`), then the hint of the request that
 * triggered the mail, then English and UTC. The saved choice comes first on
 * purpose: a password reset or a deletion link goes to the account owner, and
 * the browser that asked for it may be someone else's. Mail no request triggers
 * (an outbox event from money-service) can only use the saved choice.
 *
 * Registered with `recipient-locale` at start-up, so `sendWelcomeEmail(...)` and the
 * other senders find the recipient's locale without their callers passing it.
 */
@Injectable()
export class EmailLocaleService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    setRecipientLocaleResolver((email) => this.forRecipient(email));
  }

  /** The locale an e-mail to `email` is written in. Never throws. */
  async forRecipient(email: string): Promise<EmailLocale> {
    return resolveEmailLocale(
      await this.savedHint(email),
      currentEmailLocaleHint()
    );
  }

  private async savedHint(email: string): Promise<EmailLocaleHint> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (!user) return {};

      const row = await this.prisma.userPreferences.findUnique({
        where: { userId: user.id },
        select: { preferences: true },
      });
      const stored = (row?.preferences ?? {}) as Record<string, unknown>;
      return {
        language: stored['language'],
        timezone: stored['timezone'],
        dateFormat: stored['dateFormat'],
        timeFormat: stored['timeFormat'],
      };
    } catch (error) {
      console.error('[Email] Could not read saved language preferences', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {};
    }
  }
}
