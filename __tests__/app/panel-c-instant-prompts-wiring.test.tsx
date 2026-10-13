/**
 * The server side of the Panel C instant prompts (build step 6 part 10): the two workspace pages
 * read `isInstantPromptsEnabled()` on the server and pass it down, and the two workspace shells hand
 * it to the shared `TradingWorkspace`. The browser never sees the variable.
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
    onOpenUpgradeModal?: () => void;
  }) => (
    <button
      type="button"
      data-testid="workspace"
      data-tier={props.tier}
      data-instant={String(props.instantPromptsEnabled)}
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
