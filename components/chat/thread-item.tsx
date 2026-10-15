'use client';

/**
 * One conversation in Panel A (build step 7 part 9): its title, the direction of its last answer, the
 * time of its last message and one line of preview. A press opens it in Panel B; a pencil renames it;
 * a bin deletes it after a plain question.
 *
 * What the row shows is the server's: the title is deterministic from the first answer (or the trader's
 * own, after a rename) and is market data (`XAUUSD · M15 · LONG · 18 SEP 20:55`), shown as it came; the
 * time goes through the viewer's date and time settings; the badge is the last bias in the reader's
 * words. Nothing is made up here.
 *
 * Deleting says what is removed and what is not: the messages of the conversation go for good, and the
 * audit record of each request stays on the server (ADR-098 D16). The confirmation stays open until the
 * server has answered, and says so if it could not delete.
 *
 * On the narrow rail (the sidebar collapsed) a row is its icon alone, with the title as its name.
 *
 * @module components/chat/thread-item
 */

import { Check, MessageSquare, Pencil, Trash2, X } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactElement,
} from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import { THREAD_TITLE_MAX_CHARS } from './limits';
import type { DeleteOutcome, RenameOutcome } from './threads-wire';
import type { ChatKey } from './text';
import type { Bias, ThreadSummary } from './types';
import { useChatWords } from './use-chat-words';
import { Pill, type Tone } from './figure';

const BIAS_TONE: Record<Bias, Tone> = {
  LONG: 'good',
  SHORT: 'bad',
  NEUTRAL: 'neutral',
  STAND_ASIDE: 'warn',
};

const BIAS_KEY: Record<Bias, ChatKey> = {
  LONG: 'chat.threads.bias.LONG',
  SHORT: 'chat.threads.bias.SHORT',
  NEUTRAL: 'chat.threads.bias.NEUTRAL',
  STAND_ASIDE: 'chat.threads.bias.STAND_ASIDE',
};

/** The thread's last direction, as a small badge: LONG, SHORT, NEUTRAL or STAND ASIDE in the reader's words. */
export function ThreadBias({ bias }: { bias: Bias }): ReactElement {
  const { tr } = useChatWords();
  return (
    <Pill
      tone={BIAS_TONE[bias]}
      testId="thread-bias"
      className="min-w-0 max-w-[60%] px-1.5 py-0 text-[9px] uppercase tracking-wide"
    >
      <span className="truncate" title={tr(BIAS_KEY[bias])}>
        {tr(BIAS_KEY[bias])}
      </span>
    </Pill>
  );
}

export interface ThreadItemProps {
  thread: ThreadSummary;
  active: boolean;
  /** the sidebar is the narrow rail: the row is its icon */
  collapsed: boolean;
  /** a request is in flight or a thread is being opened: this row cannot be opened or deleted now */
  busy: boolean;
  onSelect: () => void;
  onRename: (title: string) => Promise<RenameOutcome>;
  onDelete: () => Promise<DeleteOutcome>;
}

const codePoints = (text: string): number => Array.from(text).length;

const ICON_BUTTON =
  'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40';

export function ThreadItem({
  thread,
  active,
  collapsed,
  busy,
  onSelect,
  onRename,
  onDelete,
}: ThreadItemProps): ReactElement {
  const { tr, time, inline } = useChatWords();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(thread.title);
  const [renaming, setRenaming] = useState(false);
  const [renameFailed, setRenameFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const alive = useRef(true);
  const field = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (editing) {
      field.current?.focus();
      field.current?.select();
    }
  }, [editing]);

  const lastMessage = tr('chat.threads.last_message', {
    time: inline(time(thread.lastMessageAt)),
  });
  const rowLabel = `${thread.title} · ${lastMessage}`;

  if (collapsed) {
    return (
      <li data-testid="thread-item" data-active={active}>
        <button
          type="button"
          onClick={onSelect}
          disabled={busy && !active}
          title={rowLabel}
          aria-label={thread.title}
          aria-current={active ? 'true' : undefined}
          className={cn(
            'flex h-8 w-full items-center justify-center rounded-lg border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
            active
              ? 'border-[var(--primary)]/50 bg-[var(--primary)]/15 text-[var(--primary)]'
              : 'text-[var(--primary)]/60 border-transparent hover:bg-sidebar-accent hover:text-sidebar-foreground'
          )}
        >
          <MessageSquare className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </button>
      </li>
    );
  }

  const startRename = (): void => {
    setDraft(thread.title);
    setRenameFailed(false);
    setEditing(true);
  };
  const stopRename = (): void => {
    setEditing(false);
    setRenameFailed(false);
  };

  const submitRename = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const title = draft.trim();
    if (title === '' || codePoints(title) > THREAD_TITLE_MAX_CHARS) return;
    if (title === thread.title) {
      stopRename();
      return;
    }
    setRenaming(true);
    setRenameFailed(false);
    const outcome = await onRename(title);
    if (!alive.current) return;
    setRenaming(false);
    if (outcome.ok) setEditing(false);
    else setRenameFailed(true);
  };

  const onFieldKey = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      stopRename();
    }
  };

  const confirmDelete = async (): Promise<void> => {
    setDeleting(true);
    setDeleteFailed(false);
    const outcome = await onDelete();
    if (!alive.current) return;
    setDeleting(false);
    if (outcome.ok || outcome.reason === 'NOT_FOUND') setConfirming(false);
    else setDeleteFailed(true);
  };

  if (editing) {
    return (
      <li data-testid="thread-item" data-active={active} data-editing="true">
        <form
          onSubmit={(event) => void submitRename(event)}
          className="border-[var(--primary)]/40 bg-sidebar-accent/40 space-y-1 rounded-lg border p-1.5"
        >
          <div className="flex items-center gap-1">
            <Input
              ref={field}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onFieldKey}
              maxLength={THREAD_TITLE_MAX_CHARS}
              disabled={renaming}
              aria-label={tr('chat.threads.rename_label')}
              aria-invalid={renameFailed ? true : undefined}
              dir="auto"
              className="h-7 min-w-0 flex-1 px-2 py-1 text-[11px]"
            />
            <button
              type="submit"
              disabled={renaming || draft.trim() === ''}
              aria-label={tr('chat.threads.rename_save')}
              title={tr('chat.threads.rename_save')}
              className={ICON_BUTTON}
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={stopRename}
              disabled={renaming}
              aria-label={tr('chat.threads.rename_cancel')}
              title={tr('chat.threads.rename_cancel')}
              className={ICON_BUTTON}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          {renameFailed ? (
            <p
              role="alert"
              data-testid="rename-failed"
              className="px-0.5 text-[10px] text-rose-600 dark:text-rose-400"
            >
              {tr('chat.threads.rename_failed')}
            </p>
          ) : null}
        </form>
      </li>
    );
  }

  return (
    <li
      data-testid="thread-item"
      data-active={active}
      data-thread-id={thread.id}
      className="group relative min-w-0"
    >
      <button
        type="button"
        onClick={onSelect}
        disabled={busy && !active}
        title={rowLabel}
        aria-current={active ? 'true' : undefined}
        className={cn(
          'flex w-full min-w-0 flex-col gap-0.5 rounded-lg border px-2 py-1.5 text-start transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
          active
            ? 'border-[var(--primary)]/50 bg-[var(--primary)]/15 text-[var(--primary)]'
            : 'border-transparent text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
        )}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <MessageSquare
            className={cn(
              'h-3.5 w-3.5 shrink-0',
              active ? 'text-[var(--primary)]' : 'text-[var(--primary)]/60'
            )}
            aria-hidden="true"
          />
          <bdi
            dir="auto"
            data-testid="thread-title"
            className={cn(
              'min-w-0 flex-1 truncate text-[11px]',
              active ? 'font-bold' : 'font-medium'
            )}
          >
            {thread.title}
          </bdi>
        </span>
        <span className="flex min-w-0 items-center gap-1.5 ps-5">
          {thread.lastBias === null ? null : (
            <ThreadBias bias={thread.lastBias} />
          )}
          <time
            dateTime={thread.lastMessageAt}
            data-testid="thread-time"
            className="ms-auto shrink-0 font-mono text-[9px] tabular-nums opacity-80"
          >
            <bdi dir="ltr">{time(thread.lastMessageAt)}</bdi>
          </time>
        </span>
        {thread.lastPreview === '' ? null : (
          <bdi
            dir="auto"
            data-testid="thread-preview"
            className="block truncate ps-5 text-[10px] opacity-80"
          >
            {thread.lastPreview}
          </bdi>
        )}
      </button>

      <div
        className={cn(
          'bg-sidebar/90 absolute end-1 top-1 flex items-center gap-0.5 rounded transition-opacity',
          'opacity-0 focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100',
          active && 'opacity-100'
        )}
      >
        <button
          type="button"
          onClick={startRename}
          aria-label={tr('chat.threads.rename_for', {
            title: inline(thread.title),
          })}
          title={tr('chat.threads.rename_for', { title: thread.title })}
          className={ICON_BUTTON}
        >
          <Pencil className="h-3 w-3" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => {
            setDeleteFailed(false);
            setConfirming(true);
          }}
          disabled={busy && active}
          aria-label={tr('chat.threads.delete_for', {
            title: inline(thread.title),
          })}
          title={tr('chat.threads.delete_for', { title: thread.title })}
          className={ICON_BUTTON}
        >
          <Trash2 className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>

      <AlertDialog
        open={confirming}
        onOpenChange={(next) => {
          if (!deleting) setConfirming(next);
        }}
      >
        <AlertDialogContent data-testid="delete-dialog" className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">
              {tr('chat.threads.delete_title')}
            </AlertDialogTitle>
            <AlertDialogDescription
              data-testid="delete-body"
              className="text-start leading-relaxed"
            >
              {tr('chat.threads.delete_body')}
            </AlertDialogDescription>
            <p
              dir="auto"
              className="break-words text-start text-xs font-medium text-foreground"
            >
              <bdi dir="auto">{thread.title}</bdi>
            </p>
          </AlertDialogHeader>
          {deleteFailed ? (
            <p
              role="alert"
              data-testid="delete-failed"
              className="text-start text-xs text-rose-600 dark:text-rose-400"
            >
              {tr('chat.threads.delete_failed')}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {tr('chat.threads.delete_cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              data-testid="delete-confirm"
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={(event) => {
                // the dialog stays open until the server has answered
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {tr('chat.threads.delete_confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
