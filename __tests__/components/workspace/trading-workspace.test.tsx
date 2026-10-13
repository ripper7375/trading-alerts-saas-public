import React from 'react';
import {
  render as rtlRender,
  screen,
  fireEvent,
  act,
  type RenderOptions,
} from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import { LocaleProvider } from '@/lib/context/locale-context';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';
import {
  FALLBACK_PANEL_SPACE_PX,
  buildPanelConstraints,
} from '@/components/workspace/panel-layout';
import { TradingWorkspace } from '@/components/workspace/trading-workspace';

/**
 * The wiring between the collapse buttons and the panel group. The regression
 * this pins: collapse buttons that changed what a panel rendered without
 * resizing the panel (sidebar), or that unmounted it (AI Analyst, Market
 * Comments). The child panels are stubbed so only that wiring is under test.
 *
 * jsdom has no layout, so sizes are read from react-resizable-panels'
 * `data-panel-size` attribute (the flex-grow percentage, 1 decimal).
 */

jest.mock('next/navigation', () => ({
  usePathname: () => '/terminal',
}));

jest.mock('next/dynamic', () => () => {
  // the chart is stubbed; it shows what the workspace handed it
  const MockChart = (props: {
    isPro?: boolean;
    instantPromptsEnabled?: boolean;
    onOpenUpgradeModal?: () => void;
  }): React.JSX.Element => (
    <div
      data-testid="chart"
      data-is-pro={String(props.isPro)}
      data-instant={String(props.instantPromptsEnabled)}
      data-upgrade={String(typeof props.onOpenUpgradeModal === 'function')}
      onClick={props.onOpenUpgradeModal}
    />
  );
  return MockChart;
});

jest.mock('@/components/chat-sidebar', () => ({
  ChatSidebar: ({
    isCollapsed,
    onToggleCollapse,
  }: {
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
  }) => (
    <button
      type="button"
      data-testid="sidebar-toggle"
      data-collapsed={String(isCollapsed)}
      onClick={onToggleCollapse}
    >
      sidebar
    </button>
  ),
}));

jest.mock('@/components/chat-panel', () => ({
  __esModule: true,
  default: ({ onCollapsePanel }: { onCollapsePanel?: () => void }) => (
    <button type="button" onClick={onCollapsePanel}>
      Collapse AI Analyst
    </button>
  ),
}));

jest.mock('@/components/market-comments-panel', () => ({
  __esModule: true,
  default: ({ onCollapsePanel }: { onCollapsePanel?: () => void }) => (
    <button type="button" onClick={onCollapsePanel}>
      Collapse Market Comments
    </button>
  ),
}));

function render(ui: React.ReactElement, options?: RenderOptions) {
  return rtlRender(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <LocaleProvider>{children}</LocaleProvider>
    ),
    ...options,
  });
}

const constraints = buildPanelConstraints(FALLBACK_PANEL_SPACE_PX);
const rail = (index: number): string =>
  (constraints[index]?.collapsedSize ?? NaN).toFixed(1);

function size(panelId: string): string | null {
  return (
    document.getElementById(panelId)?.getAttribute('data-panel-size') ?? null
  );
}

function sizes(): Record<string, string | null> {
  return {
    sidebar: size('panel-a-sidebar'),
    analyst: size('panel-b-chat'),
    chart: size('panel-c-chart'),
    comments: size('panel-d-comments'),
  };
}

const DEFAULT_SIZES = {
  sidebar: '16.0',
  analyst: '24.0',
  chart: '38.0',
  comments: '22.0',
};

describe('TradingWorkspace -- panel collapse', () => {
  beforeEach(() => {
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('starts with every panel expanded at its default size', () => {
    render(<TradingWorkspace tier="PRO" />);
    expect(sizes()).toEqual(DEFAULT_SIZES);
    expect(screen.getByTestId('sidebar-toggle')).toHaveAttribute(
      'data-collapsed',
      'false'
    );
  });

  it('shrinks the sidebar panel itself to the rail, giving the space to the chart', () => {
    render(<TradingWorkspace tier="PRO" />);
    fireEvent.click(screen.getByTestId('sidebar-toggle'));

    expect(sizes()).toEqual({
      ...DEFAULT_SIZES,
      sidebar: rail(0),
      chart: (38 + 16 - Number(constraints[0]?.collapsedSize)).toFixed(1),
    });
    expect(screen.getByTestId('sidebar-toggle')).toHaveAttribute(
      'data-collapsed',
      'true'
    );

    fireEvent.click(screen.getByTestId('sidebar-toggle'));
    expect(sizes()).toEqual(DEFAULT_SIZES);
    expect(screen.getByTestId('sidebar-toggle')).toHaveAttribute(
      'data-collapsed',
      'false'
    );
  });

  it('keeps the AI Analyst mounted as a rail with its reopen button in place', () => {
    render(<TradingWorkspace tier="PRO" />);
    fireEvent.click(screen.getByText('Collapse AI Analyst'));

    expect(sizes()).toEqual({
      ...DEFAULT_SIZES,
      analyst: rail(1),
      chart: (38 + 24 - Number(constraints[1]?.collapsedSize)).toFixed(1),
    });
    const reopen = screen.getByRole('button', { name: 'Show AI Analyst' });
    expect(document.getElementById('panel-b-chat')).toContainElement(reopen);

    fireEvent.click(reopen);
    expect(sizes()).toEqual(DEFAULT_SIZES);
    expect(screen.getByText('Collapse AI Analyst')).toBeInTheDocument();
  });

  it('keeps Market Comments mounted as a rail with its reopen button in place', () => {
    render(<TradingWorkspace tier="PRO" />);
    fireEvent.click(screen.getByText('Collapse Market Comments'));

    expect(sizes()).toEqual({
      ...DEFAULT_SIZES,
      comments: rail(3),
      chart: (38 + 22 - Number(constraints[3]?.collapsedSize)).toFixed(1),
    });
    const reopen = screen.getByRole('button', { name: 'Show Comments' });
    expect(document.getElementById('panel-d-comments')).toContainElement(
      reopen
    );

    fireEvent.click(reopen);
    expect(sizes()).toEqual(DEFAULT_SIZES);
  });

  it('switches the sidebar to its icon rail when resized closed from the handle, and reopens it wide', () => {
    render(<TradingWorkspace tier="PRO" />);
    const [firstHandle] = document.querySelectorAll(
      '[data-panel-resize-handle-id]'
    );
    expect(firstHandle).toBeDefined();

    // Keyboard resize: 10% per ArrowLeft takes the 16% sidebar below the
    // halfway point between its rail and its minimum, so it snaps shut.
    act(() => {
      fireEvent.keyDown(firstHandle as Element, { key: 'ArrowLeft' });
    });

    expect(size('panel-a-sidebar')).toBe(rail(0));
    expect(screen.getByTestId('sidebar-toggle')).toHaveAttribute(
      'data-collapsed',
      'true'
    );

    fireEvent.click(screen.getByTestId('sidebar-toggle'));
    expect(Number(size('panel-a-sidebar'))).toBeGreaterThanOrEqual(
      Number((constraints[0]?.minSize ?? 0).toFixed(1))
    );
    expect(screen.getByTestId('sidebar-toggle')).toHaveAttribute(
      'data-collapsed',
      'false'
    );
  });
});

describe('TradingWorkspace -- Panel C instant prompts', () => {
  beforeEach(() => {
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('keeps the buttons off unless the page turns them on', () => {
    render(<TradingWorkspace tier="PRO" />);
    expect(screen.getByTestId('chart')).toHaveAttribute(
      'data-instant',
      'false'
    );
  });

  it('hands the page flag to the stacked charts, for PRO', () => {
    render(<TradingWorkspace tier="PRO" instantPromptsEnabled />);
    const chart = screen.getByTestId('chart');
    expect(chart).toHaveAttribute('data-instant', 'true');
    expect(chart).toHaveAttribute('data-is-pro', 'true');
    expect(chart).toHaveAttribute('data-upgrade', 'false');
  });

  it('hands the flag and the upgrade modal to the stacked charts, for FREE', () => {
    const open = jest.fn();
    render(
      <TradingWorkspace
        tier="FREE"
        instantPromptsEnabled
        onOpenUpgradeModal={open}
      />
    );
    const chart = screen.getByTestId('chart');
    expect(chart).toHaveAttribute('data-instant', 'true');
    expect(chart).toHaveAttribute('data-is-pro', 'false');
    expect(chart).toHaveAttribute('data-upgrade', 'true');
    fireEvent.click(chart);
    expect(open).toHaveBeenCalledTimes(1);
  });
});
