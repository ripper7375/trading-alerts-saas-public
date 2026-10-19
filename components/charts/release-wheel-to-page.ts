/**
 * Lets the mouse wheel scroll the page while the pointer is over a chart.
 *
 * lightweight-charts listens for `wheel` on the whole chart (non-passive) and
 * calls `preventDefault()` on every vertical wheel event, because it uses the
 * wheel to zoom. On a page that is taller than the screen, a chart that spans
 * the width therefore swallows the scroll: the page stops moving whenever the
 * pointer is over the chart, and a trader who parks the pointer there cannot
 * scroll down at all.
 *
 * This listens on the chart's container in the capture phase, which runs before
 * the chart's own listener, and stops a plain wheel event there. The browser's
 * default (scrolling the page) is untouched, since nothing calls
 * `preventDefault()`. A wheel event with Ctrl or Cmd held still reaches the
 * chart and zooms it; a trackpad pinch arrives as exactly that, so it zooms too.
 * Dragging to pan and dragging the axes to scale are unaffected.
 *
 * @module components/charts/release-wheel-to-page
 */

/** Returns the function that removes the listener. */
export function releaseWheelToPage(container: HTMLElement): () => void {
  const onWheel = (event: WheelEvent): void => {
    if (event.ctrlKey || event.metaKey) return;
    event.stopPropagation();
  };
  container.addEventListener('wheel', onWheel, { capture: true });
  return (): void => {
    container.removeEventListener('wheel', onWheel, { capture: true });
  };
}
