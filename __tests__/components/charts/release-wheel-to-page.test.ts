/**
 * releaseWheelToPage -- a plain wheel event must not reach the chart (which
 * would zoom and `preventDefault()` the page scroll), while Ctrl/Cmd+wheel
 * still does. The chart is stood in for by a child element with its own
 * non-passive `wheel` listener, as lightweight-charts attaches one.
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import { releaseWheelToPage } from '@/components/charts/release-wheel-to-page';

function wheel(init: WheelEventInit = {}): WheelEvent {
  return new WheelEvent('wheel', {
    deltaY: 100,
    bubbles: true,
    cancelable: true,
    ...init,
  });
}

describe('releaseWheelToPage', () => {
  let container: HTMLDivElement;
  let chartElement: HTMLDivElement;
  let chartSaw: WheelEvent[];

  beforeEach(() => {
    container = document.createElement('div');
    chartElement = document.createElement('div');
    container.appendChild(chartElement);
    document.body.appendChild(container);
    chartSaw = [];
    // Like lightweight-charts: it takes the wheel to zoom and cancels it.
    chartElement.addEventListener(
      'wheel',
      (event) => {
        chartSaw.push(event);
        event.preventDefault();
      },
      { passive: false }
    );
  });

  afterEach(() => {
    container.remove();
  });

  it('keeps a plain wheel event away from the chart and leaves it uncancelled', () => {
    releaseWheelToPage(container);
    const event = wheel();
    chartElement.dispatchEvent(event);

    expect(chartSaw).toHaveLength(0);
    // Uncancelled, so the browser scrolls the page.
    expect(event.defaultPrevented).toBe(false);
  });

  it('keeps a Shift+wheel event away from the chart too', () => {
    releaseWheelToPage(container);
    chartElement.dispatchEvent(wheel({ shiftKey: true }));
    expect(chartSaw).toHaveLength(0);
  });

  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['Cmd', { metaKey: true }],
  ])('lets %s+wheel reach the chart, to zoom it', (_name, init) => {
    releaseWheelToPage(container);
    chartElement.dispatchEvent(wheel(init));
    expect(chartSaw).toHaveLength(1);
  });

  it('stops intercepting once released', () => {
    const release = releaseWheelToPage(container);
    release();
    chartElement.dispatchEvent(wheel());
    expect(chartSaw).toHaveLength(1);
  });
});
