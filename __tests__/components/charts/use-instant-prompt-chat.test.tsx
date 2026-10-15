/**
 * The Panel C press with the workspace's chat given (build step 7 part 9): `useInstantPrompt` with a
 * `chat`, and the badge it drives. The old path (no chat: `POST /api/intake/instant`) is held by
 * `ask-ai-button.test.tsx`, unchanged; here only what is new:
 *
 *  - a PRO press asks the chat for ONE instant request ({ kind: 'INSTANT', intent }) and posts nothing itself;
 *  - while the chat is busy (its own request, or a typed question in Panel B) a press does nothing;
 *  - the badge's `busy` and `pending` are the chat's, so both badges wait and the pressed one spins;
 *  - how the request ended: a result tells the workspace (to open Panel B), a refusal is shown below the
 *    badge in the server's words, a failure says "not available", a stop says nothing;
 *  - a Free press opens the upgrade modal and never reaches the chat.
 *
 * `LocaleProvider` wraps every render and nothing here uses fake timers (LESSONS-LEARNED L40).
 */

import React from 'react';
import { act, renderHook, screen, waitFor } from '@testing-library/react';
import { render as rtlRender } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { AskOptions, AskOutcome } from '@/components/chat/chat-provider';
import { MarketContextBadge } from '@/components/charts/ask-ai-button';
import {
  useInstantPrompt,
  type InstantChat,
  type InstantPromptOptions,
} from '@/components/charts/use-instant-prompt';
import { LocaleProvider } from '@/lib/context/locale-context';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';
import { INTAKE_TEXT } from '@/lib/intake/text';

jest.mock('next/navigation', () => ({ usePathname: () => '/terminal' }));

function providers({ children }: { children: React.ReactNode }) {
  localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(defaultPreferences));
  return <LocaleProvider>{children}</LocaleProvider>;
}

const UNAVAILABLE = INTAKE_TEXT['intake.refusal.feature_unavailable'];

/** A chat whose `ask` the test settles by hand. */
function stubChat(
  initial: Partial<Pick<InstantChat, 'busy' | 'pending'>> = {}
) {
  const asked: {
    input: { kind: 'INSTANT'; intent: string };
    options: AskOptions | undefined;
  }[] = [];
  const chat: InstantChat = {
    busy: initial.busy ?? false,
    pending: initial.pending ?? null,
    ask: jest.fn((input, options) => {
      asked.push({ input, options });
      return true;
    }),
  };
  return {
    chat,
    asked,
    settle: (outcome: AskOutcome, index = asked.length - 1) =>
      asked[index]?.options?.onSettled?.(outcome),
  };
}

function hook(options: Partial<InstantPromptOptions>) {
  return renderHook(
    (props: Partial<InstantPromptOptions>) =>
      useInstantPrompt({ isPro: true, ...props }),
    { wrapper: providers, initialProps: options }
  );
}

let postedToOldRoute: jest.Mock;
beforeEach(() => {
  postedToOldRoute = jest.fn();
});

describe('a PRO press with the chat given', () => {
  it('asks the chat for the instant request and posts nothing to the old route', () => {
    const { chat, asked } = stubChat();
    const { result } = hook({ chat, post: postedToOldRoute });
    act(() => result.current.press('INSTANT_M5_INSPECT'));
    expect(chat.ask).toHaveBeenCalledTimes(1);
    expect(asked[0]?.input).toEqual({
      kind: 'INSTANT',
      intent: 'INSTANT_M5_INSPECT',
    });
    expect(postedToOldRoute).not.toHaveBeenCalled();
  });

  it.each(['INSTANT_M5_INSPECT', 'INSTANT_M15_INSPECT'] as const)(
    'sends %s for its own badge',
    (kind) => {
      const { chat, asked } = stubChat();
      const { result } = hook({ chat });
      act(() => result.current.press(kind));
      expect(asked[0]?.input.intent).toBe(kind);
    }
  );

  it('does nothing while the chat is busy: not a typed question, not the other badge, not this one', () => {
    const { chat } = stubChat({ busy: true, pending: null });
    const { result } = hook({ chat, post: postedToOldRoute });
    act(() => result.current.press('INSTANT_M5_INSPECT'));
    act(() => result.current.press('INSTANT_M15_INSPECT'));
    expect(chat.ask).not.toHaveBeenCalled();
    expect(postedToOldRoute).not.toHaveBeenCalled();
  });

  it('reports the chat’s busy and pending as its own, so both badges wait and the pressed one spins', () => {
    const { result, rerender } = hook({
      chat: stubChat({ busy: true, pending: 'INSTANT_M15_INSPECT' }).chat,
    });
    expect(result.current.busy).toBe(true);
    expect(result.current.pending).toBe('INSTANT_M15_INSPECT');
    // a typed question in flight: busy, and no badge spins
    rerender({ chat: stubChat({ busy: true, pending: null }).chat });
    expect(result.current.busy).toBe(true);
    expect(result.current.pending).toBeNull();
    rerender({ chat: stubChat().chat });
    expect(result.current.busy).toBe(false);
    expect(result.current.pending).toBeNull();
  });

  it('without a chat it is the old hook: busy is "this chart has a request out"', async () => {
    let finish!: (value: { ok: true; body: unknown }) => void;
    const post = jest.fn(
      () =>
        new Promise<{ ok: true; body: unknown }>((resolve) => {
          finish = resolve;
        })
    );
    const { result } = hook({ post });
    expect(result.current.busy).toBe(false);
    act(() => result.current.press('INSTANT_M5_INSPECT'));
    expect(result.current.busy).toBe(true);
    expect(result.current.pending).toBe('INSTANT_M5_INSPECT');
    await act(async () => finish({ ok: true, body: {} }));
    expect(result.current.busy).toBe(false);
  });

  it('a Free press opens the upgrade modal and never reaches the chat', () => {
    const { chat } = stubChat();
    const open = jest.fn();
    const { result } = hook({
      isPro: false,
      chat,
      onOpenUpgradeModal: open,
      post: postedToOldRoute,
    });
    act(() => result.current.press('INSTANT_M5_INSPECT'));
    expect(open).toHaveBeenCalledTimes(1);
    expect(chat.ask).not.toHaveBeenCalled();
    expect(postedToOldRoute).not.toHaveBeenCalled();
  });
});

describe('how the request ended', () => {
  it('a result tells the workspace which thread it is in, and leaves no notice', () => {
    const { chat, settle } = stubChat();
    const onChatResult = jest.fn();
    const { result } = hook({ chat, onChatResult });
    act(() => result.current.press('INSTANT_M15_INSPECT'));
    act(() => settle({ kind: 'RESULT', threadId: 'th-1', requestId: 'r-1' }));
    expect(onChatResult).toHaveBeenCalledTimes(1);
    expect(onChatResult).toHaveBeenCalledWith({ threadId: 'th-1' });
    expect(result.current.notice).toBeNull();
  });

  it('a refusal is shown below the badge that was pressed, in the server’s own words', () => {
    const { chat, settle } = stubChat();
    const onChatResult = jest.fn();
    const { result } = hook({ chat, onChatResult });
    act(() => result.current.press('INSTANT_M15_INSPECT'));
    act(() =>
      settle({ kind: 'REFUSAL', reply: 'Der Zugriff ist Pro vorbehalten.' })
    );
    expect(result.current.notice).toEqual({
      kind: 'INSTANT_M15_INSPECT',
      text: 'Der Zugriff ist Pro vorbehalten.',
    });
    expect(onChatResult).not.toHaveBeenCalled();
  });

  it('a refusal with no words falls back to the fixed "not available" text', () => {
    const { chat, settle } = stubChat();
    const { result } = hook({ chat });
    act(() => result.current.press('INSTANT_M5_INSPECT'));
    act(() => settle({ kind: 'REFUSAL', reply: '   ' }));
    expect(result.current.notice?.text).toBe(UNAVAILABLE);
  });

  it.each(['UNAVAILABLE', 'FAILED'] as const)(
    '%s says the fixed "not available" text below the badge',
    (kind) => {
      const { chat, settle } = stubChat();
      const onChatResult = jest.fn();
      const { result } = hook({ chat, onChatResult });
      act(() => result.current.press('INSTANT_M5_INSPECT'));
      act(() => settle({ kind }));
      expect(result.current.notice).toEqual({
        kind: 'INSTANT_M5_INSPECT',
        text: UNAVAILABLE,
      });
      expect(onChatResult).not.toHaveBeenCalled();
    }
  );

  it('a stop says nothing', () => {
    const { chat, settle } = stubChat();
    const onChatResult = jest.fn();
    const { result } = hook({ chat, onChatResult });
    act(() => result.current.press('INSTANT_M5_INSPECT'));
    act(() => settle({ kind: 'CANCELLED' }));
    expect(result.current.notice).toBeNull();
    expect(onChatResult).not.toHaveBeenCalled();
  });

  it('a new press clears the last notice', () => {
    const { chat, settle } = stubChat();
    const { result } = hook({ chat });
    act(() => result.current.press('INSTANT_M5_INSPECT'));
    act(() => settle({ kind: 'FAILED' }));
    expect(result.current.notice).not.toBeNull();
    act(() => result.current.press('INSTANT_M15_INSPECT'));
    expect(result.current.notice).toBeNull();
  });

  it('a result that arrives after the badge is gone does nothing (no update, no call)', () => {
    const { chat, settle } = stubChat();
    const onChatResult = jest.fn();
    const spy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const { result, unmount } = hook({ chat, onChatResult });
    act(() => result.current.press('INSTANT_M5_INSPECT'));
    unmount();
    settle({ kind: 'RESULT', threadId: 'th-1', requestId: 'r-1' });
    settle({ kind: 'FAILED' });
    expect(onChatResult).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('a refusal goes away by itself, as it always did', async () => {
    const { chat, settle } = stubChat();
    const { result } = hook({ chat, noticeMs: 20 });
    act(() => result.current.press('INSTANT_M5_INSPECT'));
    act(() => settle({ kind: 'REFUSAL', reply: 'No.' }));
    expect(result.current.notice?.text).toBe('No.');
    await waitFor(() => expect(result.current.notice).toBeNull());
  });
});

describe('the badge it drives', () => {
  it('shows the chat’s busy state on both badges and the spinner on the pressed one', () => {
    const view = (
      busy: boolean,
      loading: boolean,
      kind: 'INSTANT_M5_INSPECT' | 'INSTANT_M15_INSPECT'
    ) =>
      rtlRender(
        <MarketContextBadge
          symbol="XAUUSD"
          timeframe={kind === 'INSTANT_M5_INSPECT' ? 'M5' : 'M15'}
          active={false}
          instant={{ kind, busy, loading, notice: null, onPress: jest.fn() }}
        />,
        { wrapper: providers }
      );
    const pressed = view(true, true, 'INSTANT_M5_INSPECT');
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('market-context-spinner-m5')).toBeInTheDocument();
    pressed.unmount();
    view(true, false, 'INSTANT_M15_INSPECT');
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByTestId('market-context-spinner-m15')).toBeNull();
  });

  it('a press on an idle badge reaches the hook once', async () => {
    const { chat } = stubChat();
    function Harness(): React.ReactElement {
      const instant = useInstantPrompt({ isPro: true, chat });
      return (
        <MarketContextBadge
          symbol="XAUUSD"
          timeframe="M5"
          active={false}
          instant={{
            kind: 'INSTANT_M5_INSPECT',
            loading: instant.pending === 'INSTANT_M5_INSPECT',
            busy: instant.busy,
            notice: instant.notice?.text ?? null,
            onPress: instant.press,
          }}
        />
      );
    }
    rtlRender(<Harness />, { wrapper: providers });
    await userEvent.click(screen.getByRole('button'));
    expect(chat.ask).toHaveBeenCalledTimes(1);
  });
});
