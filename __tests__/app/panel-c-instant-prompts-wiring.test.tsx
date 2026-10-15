/**
 * The server side of the Panel C instant prompts (build step 6 part 10; Option A, 2026-10-14: the
 * instant prompts are the top-left Market Context badges of the two chart panes, not a separate
 * button): the two workspace pages read `isInstantPromptsEnabled()` on the server and pass it down,
 * and the two workspace shells hand it to the shared `TradingWorkspace`, which gives it to the
 * stacked charts (`trading-workspace.test.tsx`, and `ask-ai-button.test.tsx` for the badges). The
 * browser never sees the variable. The flag is read here as exactly `true`: any other value leaves
 * the badges as the older, plain ones.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { getServerSession } from 'next-auth';

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/i18n/server-metadata', () => ({
  localizedMetadata: jest.fn(),
}));
jest.mock('next/navigation', () => ({
  redirect: jest.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
}));

jest.mock('@/components/workspace/trading-workspace', () => ({
  TradingWorkspace: (props: {
    tier: string;
    instantPromptsEnabled?: boolean;
    replyEnabled?: boolean;
    onOpenUpgradeModal?: () => void;
  }) => (
    <button
      type="button"
      data-testid="workspace"
      data-tier={props.tier}
      data-instant={String(props.instantPromptsEnabled)}
      data-reply={String(props.replyEnabled)}
      data-upgrade={String(typeof props.onOpenUpgradeModal === 'function')}
      onClick={props.onOpenUpgradeModal}
    />
  ),
}));

jest.mock('@/components/ui/pro-upgrade-modal', () => ({
  ProUpgradeModal: ({ isOpen }: { isOpen: boolean }) => (
    <div data-testid="upgrade-modal" data-open={String(isOpen)} />
  ),
}));

import FreePage from '@/app/free/page';
import { FreeWorkspace } from '@/app/free/free-workspace';
import TerminalPage from '@/app/terminal/page';
import { TerminalWorkspace } from '@/app/terminal/terminal-workspace';

const mockSession = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;
const ORIGINAL_FLAG = process.env['INTAKE_INSTANT_PROMPTS_ENABLED'];

function setFlag(value: string | undefined): void {
  if (value === undefined) delete process.env['INTAKE_INSTANT_PROMPTS_ENABLED'];
  else process.env['INTAKE_INSTANT_PROMPTS_ENABLED'] = value;
}

afterEach(() => {
  setFlag(ORIGINAL_FLAG);
  jest.clearAllMocks();
});

const asProps = (element: React.ReactElement | React.ReactNode) =>
  (element as React.ReactElement<{ instantPromptsEnabled?: boolean }>).props;

describe('the pages read the flag on the server', () => {
  it.each([
    ['true', true],
    [undefined, false],
    ['', false],
    ['false', false],
    ['TRUE', false],
    ['1', false],
    [' true', false],
  ])(
    'INTAKE_INSTANT_PROMPTS_ENABLED=%j gives %s on /terminal',
    async (value, expected) => {
      setFlag(value);
      mockSession.mockResolvedValue({ user: { id: 'u', tier: 'PRO' } });
      const element = await TerminalPage();
      expect(element.type).toBe(TerminalWorkspace);
      expect(asProps(element).instantPromptsEnabled).toBe(expected);
    }
  );

  it.each([
    ['true', true],
    [undefined, false],
    ['', false],
    ['TRUE', false],
  ])(
    'INTAKE_INSTANT_PROMPTS_ENABLED=%j gives %s on /free',
    async (value, expected) => {
      setFlag(value);
      mockSession.mockResolvedValue({ user: { id: 'u', tier: 'FREE' } });
      const element = await FreePage();
      expect(element.type).toBe(FreeWorkspace);
      expect(asProps(element).instantPromptsEnabled).toBe(expected);
    }
  );

  it('is not turned on by INTAKE_ENABLED alone', async () => {
    setFlag(undefined);
    const before = process.env['INTAKE_ENABLED'];
    process.env['INTAKE_ENABLED'] = 'true';
    try {
      mockSession.mockResolvedValue({ user: { id: 'u', tier: 'PRO' } });
      expect(asProps(await TerminalPage()).instantPromptsEnabled).toBe(false);
    } finally {
      if (before === undefined) delete process.env['INTAKE_ENABLED'];
      else process.env['INTAKE_ENABLED'] = before;
    }
  });

  it('still sends a signed-out visitor to /login and a FREE trader from /terminal to /free', async () => {
    setFlag('true');
    mockSession.mockResolvedValue(null);
    await expect(TerminalPage()).rejects.toThrow('NEXT_REDIRECT:/login');
    await expect(FreePage()).rejects.toThrow('NEXT_REDIRECT:/login');
    mockSession.mockResolvedValue({ user: { id: 'u', tier: 'FREE' } });
    await expect(TerminalPage()).rejects.toThrow('NEXT_REDIRECT:/free');
  });
});

describe('the pages read the reply flag on the server (build step 7 part 9)', () => {
  const ORIGINAL_REPLY = process.env['REPLY_ENABLED'];
  afterEach(() => {
    if (ORIGINAL_REPLY === undefined) delete process.env['REPLY_ENABLED'];
    else process.env['REPLY_ENABLED'] = ORIGINAL_REPLY;
  });
  const setReply = (value: string | undefined): void => {
    if (value === undefined) delete process.env['REPLY_ENABLED'];
    else process.env['REPLY_ENABLED'] = value;
  };
  const replyOf = (element: React.ReactElement | React.ReactNode) =>
    (element as React.ReactElement<{ replyEnabled?: boolean }>).props
      .replyEnabled;

  it.each([
    ['true', true],
    [undefined, false],
    ['', false],
    ['false', false],
    ['TRUE', false],
    ['1', false],
    ['yes', false],
    [' true', false],
  ])(
    'REPLY_ENABLED=%j gives %s on /terminal and on /free',
    async (value, expected) => {
      setReply(value);
      mockSession.mockResolvedValue({ user: { id: 'u', tier: 'PRO' } });
      expect(replyOf(await TerminalPage())).toBe(expected);
      expect(replyOf(await FreePage())).toBe(expected);
    }
  );

  it('is independent of the instant-prompts flag, and of the intake flag', async () => {
    setReply('true');
    setFlag(undefined);
    mockSession.mockResolvedValue({ user: { id: 'u', tier: 'PRO' } });
    const element = await TerminalPage();
    expect(replyOf(element)).toBe(true);
    expect(asProps(element).instantPromptsEnabled).toBe(false);
    setReply(undefined);
    setFlag('true');
    const other = await TerminalPage();
    expect(replyOf(other)).toBe(false);
    expect(asProps(other).instantPromptsEnabled).toBe(true);
  });

  it('the shells hand it to the shared workspace, and it is off when they are not told', () => {
    const { unmount } = render(<TerminalWorkspace replyEnabled />);
    expect(screen.getByTestId('workspace')).toHaveAttribute(
      'data-reply',
      'true'
    );
    unmount();
    const free = render(<FreeWorkspace replyEnabled instantPromptsEnabled />);
    expect(screen.getByTestId('workspace')).toHaveAttribute(
      'data-reply',
      'true'
    );
    free.unmount();
    render(<TerminalWorkspace />);
    expect(screen.getByTestId('workspace')).toHaveAttribute(
      'data-reply',
      'false'
    );
  });
});

describe('the workspace shells hand the flag to the shared workspace', () => {
  it('/terminal: PRO, the flag as given, nothing to upgrade to', () => {
    render(<TerminalWorkspace instantPromptsEnabled />);
    const workspace = screen.getByTestId('workspace');
    expect(workspace).toHaveAttribute('data-tier', 'PRO');
    expect(workspace).toHaveAttribute('data-instant', 'true');
    expect(workspace).toHaveAttribute('data-upgrade', 'false');
  });

  it('/terminal: off by default', () => {
    render(<TerminalWorkspace />);
    expect(screen.getByTestId('workspace')).toHaveAttribute(
      'data-instant',
      'false'
    );
  });

  it('/free: FREE, the flag as given, and a press can open the upgrade modal', () => {
    render(<FreeWorkspace instantPromptsEnabled />);
    const workspace = screen.getByTestId('workspace');
    expect(workspace).toHaveAttribute('data-tier', 'FREE');
    expect(workspace).toHaveAttribute('data-instant', 'true');
    expect(workspace).toHaveAttribute('data-upgrade', 'true');
    expect(screen.getByTestId('upgrade-modal')).toHaveAttribute(
      'data-open',
      'false'
    );
    fireEvent.click(workspace);
    expect(screen.getByTestId('upgrade-modal')).toHaveAttribute(
      'data-open',
      'true'
    );
  });

  it('/free: off by default', () => {
    render(<FreeWorkspace />);
    expect(screen.getByTestId('workspace')).toHaveAttribute(
      'data-instant',
      'false'
    );
  });
});
