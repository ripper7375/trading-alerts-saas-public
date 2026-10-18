/**
 * useMountedOnceOpen -- a modal that is closed until asked for is not mounted
 * (so its code is not fetched) until it first opens, and stays mounted after.
 */
import { renderHook } from '@testing-library/react';

import { useMountedOnceOpen } from '@/components/currency-index-pro/hooks/use-mounted-once-open';

describe('useMountedOnceOpen', () => {
  it('is false while the modal has never been open', () => {
    const { result, rerender } = renderHook(
      ({ open }) => useMountedOnceOpen(open),
      { initialProps: { open: false } }
    );
    expect(result.current).toBe(false);
    rerender({ open: false });
    expect(result.current).toBe(false);
  });

  it('is true from the very render in which the modal opens', () => {
    const renders: boolean[] = [];
    const { rerender } = renderHook(
      ({ open }) => {
        const mounted = useMountedOnceOpen(open);
        renders.push(mounted);
        return mounted;
      },
      { initialProps: { open: false } }
    );
    renders.length = 0;
    rerender({ open: true });
    // Never a committed render where the modal is open but not yet mounted.
    expect(renders.at(-1)).toBe(true);
    expect(renders.includes(false)).toBe(false);
  });

  it('stays true after the modal closes, so it can play its exit and keep its state', () => {
    const { result, rerender } = renderHook(
      ({ open }) => useMountedOnceOpen(open),
      { initialProps: { open: false } }
    );
    rerender({ open: true });
    rerender({ open: false });
    expect(result.current).toBe(true);
  });

  it('is true at once for a modal that starts open', () => {
    const { result } = renderHook(() => useMountedOnceOpen(true));
    expect(result.current).toBe(true);
  });
});
