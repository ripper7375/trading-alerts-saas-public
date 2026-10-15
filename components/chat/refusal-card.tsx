'use client';

/**
 * A request that did not become an answer (build step 7 part 8; `intake-refusal/1`, architecture 4.2):
 * the gate said no (not signed in, not PRO, no profile, the allowance cannot cover it, a service is
 * down), the door said no (empty, too long), the question could not be read, or it is about another
 * symbol or timeframe.
 *
 * The words are the SERVER's: a fixed reply in the reader's language, one of ten texts counsel reads
 * (ADR-098 D14). This card shows it as it came and adds only what the code knows: for a refusal about
 * the allowance, the share of the month's allowance that is left (a share, never a number of tokens,
 * ADR-073); for "PRO only", the upgrade button.
 *
 * @module components/chat/refusal-card
 */

import { Info } from 'lucide-react';
import type { ReactElement } from 'react';

import { Button } from '@/components/ui/button';
import { useLocale } from '@/lib/context/locale-context';
import { textDirection } from '@/lib/i18n/languages';

import type { IntakeRefusal, QuotaBody } from './types';
import { useChatWords } from './use-chat-words';

export interface RefusalCardProps {
  refusal: IntakeRefusal;
  /** the balance the server sent with an allowance refusal */
  quota?: QuotaBody | null;
  onUpgrade?: () => void;
}

export function RefusalCard({
  refusal,
  quota = null,
  onUpgrade,
}: RefusalCardProps): ReactElement {
  const { tr, percent, inline } = useChatWords();
  const { t } = useLocale();
  const share =
    quota !== null && quota.limit_units > 0
      ? quota.available_units / quota.limit_units
      : null;
  return (
    <div
      role="status"
      data-testid="refusal-card"
      data-code={refusal.code}
      className="bg-muted/40 space-y-2 rounded-xl border border-border p-3 text-xs"
    >
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
        {tr('chat.refusal.title')}
      </p>
      <p
        lang={refusal.reply_locale}
        dir={textDirection(refusal.reply_locale)}
        data-testid="refusal-reply"
        className="break-words text-sm leading-relaxed"
      >
        {refusal.reply}
      </p>
      {share === null ? null : (
        <p
          data-testid="refusal-allowance"
          className="text-[11px] text-muted-foreground"
        >
          {tr('chat.refusal.allowance', { percent: inline(percent(share)) })}
        </p>
      )}
      {refusal.code === 'TIER_REQUIRED' && onUpgrade !== undefined ? (
        <Button
          type="button"
          size="sm"
          onClick={onUpgrade}
          className="h-7 bg-amber-500 text-xs font-bold text-slate-950 hover:bg-amber-400"
        >
          {t('dashboard.upgrade_to_pro', 'Upgrade to PRO')}
        </Button>
      ) : null}
    </div>
  );
}
