'use client';

/**
 * The composer (build step 7 part 8): where the trader types a question.
 *
 * Enter sends, Shift+Enter adds a line, and Enter during an input method's composition (Japanese,
 * Chinese, Korean, Hindi, Thai candidates) is the method's own and sends nothing. The counter counts
 * characters the way the door does, as the trader sees them (a code point is one), against the 500 the
 * door takes; past it the question cannot be sent and the composer says so in words, never by colour
 * alone.
 *
 * While a request is in flight the composer is disabled, and pressing Enter or the button again does
 * nothing: the guard that really prevents a double submit is the ref in `use-chat-stream.ts` (two
 * presses in one tick reach it before any re-render), and this component trusts it by asking the
 * provider's `onSubmit`, which says whether the question was taken. The text is cleared only then.
 *
 * @module components/chat/composer
 */

import { CornerDownLeft } from 'lucide-react';
import { useEffect, useRef, type ReactElement } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { COMPOSER_MAX_CHARS } from './limits';
import { useChatWords } from './use-chat-words';

export interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  /** Send the question; true when it was taken (the text is then cleared). */
  onSubmit: () => boolean;
  /** a request is in flight */
  busy: boolean;
  /** the analyst is not available (nothing can be sent) */
  disabled?: boolean;
}

export function Composer({
  value,
  onChange,
  onSubmit,
  busy,
  disabled = false,
}: ComposerProps): ReactElement {
  const { tr, count, inline } = useChatWords();
  const area = useRef<HTMLTextAreaElement | null>(null);
  const wasBusy = useRef(false);

  // the answer arrived: the trader is back in the box, ready for the next question
  useEffect(() => {
    if (wasBusy.current && !busy) area.current?.focus();
    wasBusy.current = busy;
  }, [busy]);

  const length = Array.from(value).length;
  const tooLong = length > COMPOSER_MAX_CHARS;
  const empty = value.trim() === '';
  const blocked = busy || disabled;
  const canSend = !blocked && !empty && !tooLong;

  const submit = (): void => {
    if (!canSend) return;
    if (onSubmit()) onChange('');
  };

  return (
    <div className="space-y-1" data-testid="composer">
      <div className="relative">
        <label htmlFor="chat-composer-input" className="sr-only">
          {tr('chat.composer.label')}
        </label>
        <textarea
          id="chat-composer-input"
          ref={area}
          value={value}
          rows={2}
          disabled={blocked}
          aria-busy={busy}
          aria-invalid={tooLong}
          aria-describedby="chat-composer-hint chat-composer-count"
          placeholder={
            busy ? tr('chat.composer.busy') : tr('chat.composer.placeholder')
          }
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey) return;
            // Enter that confirms an input method's candidate is not "send"
            if (event.nativeEvent.isComposing || event.keyCode === 229) return;
            event.preventDefault();
            submit();
          }}
          className="min-h-[58px] w-full resize-none rounded-xl border border-input bg-background py-2.5 pe-12 ps-3.5 text-xs text-foreground placeholder:text-xs placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        />
        <div className="absolute bottom-2.5 end-2.5">
          <Button
            type="button"
            size="icon"
            disabled={!canSend}
            onClick={submit}
            className="shadow-xs h-7 w-7 rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-30"
            title={tr('chat.composer.send')}
            aria-label={tr('chat.composer.send')}
          >
            <CornerDownLeft
              className="h-3.5 w-3.5 stroke-[2.5] rtl:-scale-x-100"
              aria-hidden="true"
            />
          </Button>
        </div>
      </div>
      <div className="flex items-start justify-between gap-2 text-[10px] text-muted-foreground">
        <span id="chat-composer-hint">{tr('chat.composer.hint')}</span>
        <span
          id="chat-composer-count"
          data-testid="composer-count"
          className={cn(
            'shrink-0 tabular-nums',
            tooLong && 'font-bold text-rose-600 dark:text-rose-400'
          )}
        >
          {inline(count(length))} / {inline(count(COMPOSER_MAX_CHARS))}
        </span>
      </div>
      {tooLong ? (
        <p
          role="alert"
          className="text-[11px] font-medium text-rose-600 dark:text-rose-400"
        >
          {tr('chat.composer.too_long')}
        </p>
      ) : null}
    </div>
  );
}
