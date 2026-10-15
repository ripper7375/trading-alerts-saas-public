'use client';

/**
 * The footer of every reply (build step 7 part 8; architecture 5.7, 7.4; the compliance material's
 * "AI-generated notice and provenance"): what wrote it, the model, the version of the prompt and the
 * request id support opens, and the fixed disclaimer.
 *
 * The disclaimer arrives as a VERSION (`disclaimer_version`); the text shown is the interface's own,
 * in the reader's language, so counsel reviews one text per language and no model ever writes it. A
 * reply no model wrote (the answer from the sensor board, the Trade Setup action) says so instead of
 * claiming it was written by AI.
 *
 * @module components/chat/ai-notice
 */

import type { ReactElement } from 'react';

import { Code } from './figure';
import type { ReplyResult } from './types';
import { useChatWords } from './use-chat-words';

export function AiNotice({ result }: { result: ReplyResult }): ReactElement {
  const { tr } = useChatWords();
  const provenance = result.provenance;
  return (
    <footer
      data-testid="ai-notice"
      className="border-border/60 space-y-1 border-t pt-2 text-[10px] leading-snug text-muted-foreground"
    >
      {provenance.model === null ? null : <p>{tr('chat.notice.ai')}</p>}
      <p>
        {tr('chat.disclaimer.text')}{' '}
        <span data-testid="disclaimer-version">
          {tr('chat.disclaimer.version', {
            version: result.disclaimer_version,
          })}
        </span>
      </p>
      <dl className="flex flex-wrap gap-x-3 gap-y-0.5">
        <div className="flex gap-1">
          <dt>{tr('chat.provenance.model')}</dt>
          <dd data-testid="provenance-model">
            {provenance.model === null ? (
              tr('chat.provenance.no_model')
            ) : (
              <Code>{provenance.model}</Code>
            )}
          </dd>
        </div>
        {provenance.prompt_version === null ? null : (
          <div className="flex gap-1">
            <dt>{tr('chat.provenance.prompt')}</dt>
            <dd data-testid="provenance-prompt">
              <Code>{provenance.prompt_version}</Code>
            </dd>
          </div>
        )}
        <div className="flex min-w-0 gap-1">
          <dt>{tr('chat.provenance.request')}</dt>
          <dd data-testid="provenance-request" className="min-w-0">
            <Code className="break-all">{provenance.request_id}</Code>
          </dd>
        </div>
      </dl>
    </footer>
  );
}
