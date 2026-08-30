/**
 * Chat widget component tests (Session 14-2, Decision 3): floating trigger +
 * SupportChatWidget wired through the real SupportChatProvider, with
 * lib/socket-client's chatSocketManager mocked so tests can drive
 * onMessage/onTyping/onError callbacks directly without a real socket.
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

// jsdom has no scrollIntoView implementation; the widget calls it on every
// new message to keep the feed pinned to the bottom.
window.HTMLElement.prototype.scrollIntoView = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ''} />
  ),
}));

type Callbacks = {
  onMessage?: (msg: unknown) => void;
  onTyping?: (typing: boolean) => void;
  onError?: (error: unknown) => void;
};

let capturedCallbacks: Callbacks = {};
const mockSendMessage = jest.fn();

jest.mock('@/lib/socket-client', () => ({
  __esModule: true,
  chatSocketManager: {
    initSocket: (callbacks: Callbacks) => {
      capturedCallbacks = callbacks;
      return Promise.resolve(null);
    },
    sendMessage: (...args: unknown[]) => {
      mockSendMessage(...args);
      return {
        id: 'usr-test',
        sender: 'user',
        text: args[0],
        timestamp: new Date().toISOString(),
        topic: args[1],
      };
    },
  },
}));

import { SupportChatProvider } from '@/components/chat-widget/chat-context';
import { FloatingChatTrigger } from '@/components/chat-widget/floating-chat-trigger';
import { SupportChatWidget } from '@/components/chat-widget/support-chat-widget';
import { LocaleProvider } from '@/lib/context/locale-context';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';

function renderWidget() {
  localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(defaultPreferences));
  return render(
    <LocaleProvider initialPreferences={defaultPreferences}>
      <SupportChatProvider>
        <FloatingChatTrigger />
        <SupportChatWidget />
      </SupportChatProvider>
    </LocaleProvider>
  );
}

describe('Chat widget (FloatingChatTrigger + SupportChatWidget)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedCallbacks = {};
    localStorage.clear();
  });

  it('shows the floating trigger and hides the widget until opened', () => {
    renderWidget();

    expect(
      screen.getByRole('button', { name: /Open Support Centre Chat/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Welcome to DavinTrade Support Centre/i)
    ).not.toBeInTheDocument();
  });

  it('opens the widget and renders the welcome message on trigger click', () => {
    renderWidget();

    fireEvent.click(
      screen.getByRole('button', { name: /Open Support Centre Chat/i })
    );

    expect(
      screen.getByText(/Welcome to DavinTrade Support Centre/i)
    ).toBeInTheDocument();
  });

  it('sends a typed message and appends the real backend reply from onMessage', async () => {
    renderWidget();
    fireEvent.click(
      screen.getByRole('button', { name: /Open Support Centre Chat/i })
    );

    const input = screen.getByPlaceholderText(/User type inquiry here/i);
    fireEvent.change(input, { target: { value: 'How much is PRO?' } });
    fireEvent.submit(input.closest('form')!);

    expect(mockSendMessage).toHaveBeenCalledWith(
      'How much is PRO?',
      'Product Info',
      expect.any(Function)
    );
    expect(screen.getByText('How much is PRO?')).toBeInTheDocument();
    expect(
      screen.getByText(/Davin Support AI is typing response/i)
    ).toBeInTheDocument();

    act(() => {
      capturedCallbacks.onMessage?.({
        id: 'bot-1',
        sender: 'bot',
        text: 'PRO is $49/mo.',
        timestamp: new Date().toISOString(),
      });
    });

    expect(screen.getByText('PRO is $49/mo.')).toBeInTheDocument();
    expect(
      screen.queryByText(/Davin Support AI is typing response/i)
    ).not.toBeInTheDocument();
  });

  it('renders the RATE_LIMIT_EXCEEDED banner and dismisses it on click', () => {
    renderWidget();
    fireEvent.click(
      screen.getByRole('button', { name: /Open Support Centre Chat/i })
    );

    act(() => {
      capturedCallbacks.onError?.({
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Guest message limit reached',
      });
    });

    expect(
      screen.getByText(/Guest message limit reached/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Dismiss/i }));
    expect(
      screen.queryByText(/Guest message limit reached/i)
    ).not.toBeInTheDocument();
  });

  it('renders a mailto link for SERVER_ERROR', () => {
    renderWidget();
    fireEvent.click(
      screen.getByRole('button', { name: /Open Support Centre Chat/i })
    );

    act(() => {
      capturedCallbacks.onError?.({
        code: 'SERVER_ERROR',
        message: 'boom',
      });
    });

    const link = screen.getByRole('link', { name: /Email support/i });
    expect(link).toHaveAttribute('href', 'mailto:support@davintrade.app');
  });

  it('clicking a topic chip sends a topic-scoped message', () => {
    renderWidget();
    fireEvent.click(
      screen.getByRole('button', { name: /Open Support Centre Chat/i })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Billing' }));

    expect(mockSendMessage).toHaveBeenCalledWith(
      'I have a question regarding Billing.',
      'Billing',
      expect.any(Function)
    );
  });
});
