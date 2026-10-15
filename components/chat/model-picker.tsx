'use client';

/**
 * The model picker (build step 7 part 8; architecture 5.6, 7.3; ADR-055, ADR-072): the models that
 * PASSED their evaluation and nothing else, each with what a message of it costs, MEASURED, or "not
 * measured yet". Until a model has passed (none has today) the picker says there is none; it never
 * lists a candidate, and it never shows a placeholder name.
 *
 * What a measured cost becomes is the number of analyses left on the balance (about N), never the raw
 * cost (ADR-073). A model's name and slug come from the registry as they are, untranslated.
 *
 * A native `<select>`: it works with a keyboard, a screen reader and a phone's own picker at 320 px,
 * which a custom list in a narrow column does not without a lot of care.
 *
 * @module components/chat/model-picker
 */

import { ChevronDown } from 'lucide-react';
import type { ReactElement } from 'react';

import { analysesLeft } from './chat-state';
import type { ChatInfo, PickerModel } from './types';
import { useChatWords } from './use-chat-words';

export function ModelPicker({
  models,
  chosen,
  info,
  onSelect,
  disabled = false,
}: {
  models: readonly PickerModel[];
  chosen: PickerModel | null;
  info: ChatInfo | null;
  onSelect: (slug: string) => void;
  disabled?: boolean;
}): ReactElement {
  const { tr, count, inline } = useChatWords();

  if (models.length === 0 || chosen === null) {
    return (
      <div
        data-testid="model-picker"
        data-state="none"
        role="note"
        className="bg-muted/40 flex h-7 w-[160px] min-w-0 max-w-full shrink items-center rounded-md border border-border px-2 text-[11px] text-muted-foreground"
      >
        <span className="truncate">{tr('chat.model.none')}</span>
      </div>
    );
  }

  const costOf = (model: PickerModel): string => {
    if (model.units_per_msg === null) return tr('chat.model.not_measured');
    const left = analysesLeft(info, model);
    return left === null
      ? tr('chat.model.measured')
      : tr('chat.model.left', { count: inline(count(left)) });
  };

  return (
    <div
      data-testid="model-picker"
      data-state="ready"
      className="relative w-[160px] min-w-0 max-w-full shrink"
    >
      <select
        aria-label={tr('chat.model.label')}
        value={chosen.slug}
        disabled={disabled}
        onChange={(event) => onSelect(event.target.value)}
        className="h-7 w-full appearance-none truncate rounded-md border border-border bg-background pe-6 ps-2 text-xs font-semibold text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 disabled:opacity-50"
      >
        {models.map((model) => (
          <option key={model.slug} value={model.slug} data-slug={model.slug}>
            {`${model.name} · ${costOf(model)}${model.default ? ` · ${tr('chat.model.default')}` : ''}`}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute end-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-50"
        aria-hidden="true"
      />
    </div>
  );
}
