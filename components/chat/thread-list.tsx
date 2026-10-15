'use client';

/**
 * Panel A's conversations (build step 7 part 9): the "SESSIONS" part of the sidebar, now the trader's
 * real threads from the chat that Panels A, B and C share.
 *
 *  - PRO, chat on: a "New thread" control, then the threads newest first with "Show more" for the next
 *    page; the thread Panel B shows is highlighted; loading shows skeleton rows, an empty list says so,
 *    a failed read says so and offers "Try again";
 *  - chat not switched on yet: one quiet line, and no request is made;
 *  - FREE: the recorded example only, as one row (ADR-072, ADR-098 D19); there is nothing to create,
 *    rename or delete.
 *
 * On the collapsed rail every row is its icon (with the title as its name) and "New thread" is a plus.
 * While a request is in flight, or a thread is being opened, "New thread" and the rows wait: the
 * workspace has one request at a time, and Panel B must not change under it.
 *
 * @module components/chat/thread-list
 */

import { Loader2, MessageSquare, Plus } from 'lucide-react';
import type { ReactElement } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { ThreadItem } from './thread-item';
import type { DemoRecording } from './types';
import { useChatThreads } from './use-chat-threads';
import { useChatWords } from './use-chat-words';

export interface ThreadListProps {
  /** the sidebar is the narrow rail */
  collapsed: boolean;
  tier: 'FREE' | 'PRO';
  /** the Free tier's recorded example; null when there is none yet */
  demo?: DemoRecording | null;
}

function Skeletons({ collapsed }: { collapsed: boolean }): ReactElement {
  const { tr } = useChatWords();
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={tr('chat.threads.loading')}
      data-testid="threads-loading"
      className="grid min-w-0 grid-cols-1 gap-1"
    >
      {[0, 1, 2].map((row) => (
        <Skeleton
          key={row}
          className={cn('rounded-lg', collapsed ? 'h-8 w-full' : 'h-[52px]')}
        />
      ))}
    </div>
  );
}

/** The recorded example as the one thread a Free trader has. */
function DemoThread({
  demo,
  collapsed,
}: {
  demo: DemoRecording | null;
  collapsed: boolean;
}): ReactElement {
  const { tr, time } = useChatWords();
  if (demo === null) {
    return collapsed ? (
      <></>
    ) : (
      <p
        role="status"
        data-testid="threads-demo-empty"
        className="px-2 text-[11px] leading-snug text-muted-foreground"
      >
        {tr('chat.demo.empty')}
      </p>
    );
  }
  const title = tr('chat.threads.demo_title');
  return (
    <ul data-testid="threads-demo" className="grid min-w-0 grid-cols-1 gap-1">
      <li data-testid="thread-item" data-active="true" data-demo="true">
        <div
          aria-current="true"
          title={title}
          aria-label={collapsed ? title : undefined}
          className={cn(
            'border-[var(--primary)]/50 bg-[var(--primary)]/15 flex w-full min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[var(--primary)]',
            collapsed && 'justify-center px-0'
          )}
        >
          <MessageSquare
            className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]"
            aria-hidden="true"
          />
          {collapsed ? null : (
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[11px] font-bold">{title}</span>
              <time
                dateTime={demo.as_of}
                className="font-mono text-[9px] tabular-nums opacity-80"
              >
                <bdi dir="ltr">{time(demo.as_of)}</bdi>
              </time>
            </span>
          )}
        </div>
      </li>
    </ul>
  );
}

function ProThreads({ collapsed }: { collapsed: boolean }): ReactElement {
  const { tr } = useChatWords();
  const threads = useChatThreads();

  const newThread = (
    <Button
      type="button"
      variant="ghost"
      size={collapsed ? 'icon' : 'sm'}
      onClick={threads.startNew}
      disabled={
        threads.busy ||
        threads.status === 'unavailable' ||
        threads.status === 'loading'
      }
      title={collapsed ? tr('chat.threads.new') : undefined}
      aria-label={collapsed ? tr('chat.threads.new') : undefined}
      data-testid="new-thread"
      className={cn(
        'border-[var(--primary)]/40 rounded-lg border border-dashed text-[11px] font-semibold text-[var(--primary)] hover:bg-sidebar-accent hover:text-[var(--primary)]',
        collapsed ? 'h-8 w-full' : 'h-8 w-full justify-start px-2'
      )}
    >
      <Plus
        className={cn('h-3.5 w-3.5 shrink-0', !collapsed && 'me-1.5')}
        aria-hidden="true"
      />
      {collapsed ? null : tr('chat.threads.new')}
    </Button>
  );

  return (
    <div className="grid min-w-0 grid-cols-1 gap-1" data-testid="threads-pro">
      {newThread}

      {threads.status === 'loading' ? (
        <Skeletons collapsed={collapsed} />
      ) : null}

      {threads.status === 'unavailable' ? (
        collapsed ? null : (
          <p
            role="status"
            data-testid="threads-unavailable"
            className="px-2 text-[11px] leading-snug text-muted-foreground"
          >
            {tr('chat.threads.unavailable')}
          </p>
        )
      ) : null}

      {threads.status === 'error' ? (
        <div
          role="alert"
          data-testid="threads-error"
          className={cn(
            'rounded-lg border border-rose-500/40 bg-rose-500/5 px-2 py-1.5 text-[11px]',
            collapsed && 'sr-only'
          )}
        >
          <p>{tr('chat.threads.error')}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={threads.reload}
            className="mt-1 h-6 text-[11px]"
          >
            {tr('chat.retry')}
          </Button>
        </div>
      ) : null}

      {threads.status === 'ready' && threads.threads.length === 0 ? (
        collapsed ? null : (
          <div
            data-testid="threads-empty"
            className="px-2 py-1 text-[11px] leading-snug text-muted-foreground"
          >
            <p className="font-semibold text-sidebar-foreground">
              {tr('chat.threads.empty_title')}
            </p>
            <p>{tr('chat.threads.empty_body')}</p>
          </div>
        )
      ) : null}

      {threads.status === 'ready' && threads.threads.length > 0 ? (
        <ul
          aria-label={tr('chat.threads.label')}
          data-testid="threads"
          className="grid min-w-0 grid-cols-1 gap-1"
        >
          {threads.threads.map((thread) => (
            <ThreadItem
              key={thread.id}
              thread={thread}
              active={thread.id === threads.activeId}
              collapsed={collapsed}
              busy={threads.busy}
              onSelect={() => threads.select(thread.id)}
              onRename={(title) => threads.rename(thread.id, title)}
              onDelete={() => threads.remove(thread.id)}
            />
          ))}
        </ul>
      ) : null}

      {threads.status === 'ready' && threads.hasMore ? (
        <div className={cn(collapsed && 'sr-only')}>
          {threads.moreFailed ? (
            <p
              role="alert"
              data-testid="threads-more-failed"
              className="px-2 pb-1 text-[10px] text-rose-600 dark:text-rose-400"
            >
              {tr('chat.threads.more_failed')}
            </p>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={threads.loadMore}
            disabled={threads.loadingMore}
            aria-busy={threads.loadingMore ? true : undefined}
            data-testid="threads-more"
            className="h-7 w-full text-[11px] text-muted-foreground"
          >
            {threads.loadingMore ? (
              <Loader2
                className="me-1.5 h-3 w-3 animate-spin"
                aria-hidden="true"
              />
            ) : null}
            {threads.moreFailed
              ? tr('chat.retry')
              : tr('chat.threads.load_more')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function ThreadList({
  collapsed,
  tier,
  demo = null,
}: ThreadListProps): ReactElement {
  return tier === 'FREE' ? (
    <DemoThread demo={demo} collapsed={collapsed} />
  ) : (
    <ProThreads collapsed={collapsed} />
  );
}
