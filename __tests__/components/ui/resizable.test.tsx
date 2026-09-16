/**
 * ResizableHandle's grip.
 *
 * react-resizable-panels puts `data-panel-group-direction` on the handle
 * itself, so a plain `data-[...]` Tailwind variant on a child element matches
 * nothing. Every direction-conditional class on the grip was written that way
 * and was therefore inert: the grip box had no size and BOTH icons drew, which
 * is the doubled-up grip that showed on every divider in the workbench.
 *
 * jsdom does not run Tailwind, so `display` cannot be read back here -- these
 * assert the variant is scoped to the parent via `group`, which is the thing
 * that was wrong and the thing no rendered-output check would have caught.
 */

import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';

function renderHandle(direction: 'horizontal' | 'vertical') {
  return render(
    <ResizablePanelGroup direction={direction}>
      <ResizablePanel id="a" order={1} defaultSize={50} />
      <ResizableHandle withHandle />
      <ResizablePanel id="b" order={2} defaultSize={50} />
    </ResizablePanelGroup>
  );
}

const handleOf = (container: HTMLElement): HTMLElement => {
  const handle = container.querySelector<HTMLElement>('[role="separator"]');
  if (!handle) throw new Error('no handle rendered');
  return handle;
};

describe('ResizableHandle grip', () => {
  it.each(['horizontal', 'vertical'] as const)(
    'marks the %s handle as the group for its own direction variants',
    (direction) => {
      const handle = handleOf(renderHandle(direction).container);

      // Without this, every group-data- variant on a descendant is dead.
      expect(handle.className.split(/\s+/)).toContain('group');
      expect(handle).toHaveAttribute('data-panel-group-direction', direction);
    }
  );

  it.each(['horizontal', 'vertical'] as const)(
    'scopes the grip box size to the %s group, not the box itself',
    (direction) => {
      const box = handleOf(renderHandle(direction).container).firstElementChild;

      expect(box?.className).toMatch(/group-data-\[panel-group-direction=/);
      // A bare data- variant here is the bug: it would size against an
      // attribute the box does not carry, leaving it with no size at all.
      expect(box?.className).not.toMatch(/(^|\s)data-\[panel-group-direction=/);
    }
  );

  /**
   * A column divider is dragged left/right and wants the vertical grip; a row
   * divider is dragged up/down and wants the horizontal one. Exactly one is
   * hidden, and it is the one matching the group's own direction.
   */
  it.each([
    ['horizontal', 'lucide-grip-horizontal', 'lucide-grip-vertical'],
    ['vertical', 'lucide-grip-vertical', 'lucide-grip-horizontal'],
  ] as const)('hides the %s grip on a %s group', (direction, hidden, shown) => {
    const handle = handleOf(
      renderHandle(direction as 'horizontal' | 'vertical').container
    );
    const iconFor = (name: string): Element | undefined =>
      Array.from(handle.querySelectorAll('svg')).find((svg) =>
        svg.getAttribute('class')?.includes(name)
      );

    expect(iconFor(hidden)?.getAttribute('class')).toContain(
      `group-data-[panel-group-direction=${direction}]:hidden`
    );
    expect(iconFor(shown)?.getAttribute('class')).not.toContain(
      `group-data-[panel-group-direction=${direction}]:hidden`
    );
  });
});
