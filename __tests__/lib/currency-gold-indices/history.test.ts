import { isM15CloseBar } from '@/lib/currency-gold-indices/history';

// 00:00 server-time reopen -- the 8 FX-based indices (incl. USDX). A clean
// multiple of 900, unlike XAUX's own 01:01 reopen below.
const FX_SESSION_OPEN = 1_800_000_000;
// XAUX's own daily reopen is 01:01 server time (60s past the hour past
// midnight) -- NOT a clean 15-minute offset from midnight, so its own anchor
// mod 900 is 60, not 0. isM15CloseBar must still get this right using each
// row's own session_open_bar_time rather than a hardcoded global constant.
const XAUX_SESSION_OPEN = FX_SESSION_OPEN + 3660;

describe('isM15CloseBar', () => {
  it('keeps only the 3rd bar of each 15-minute triplet from the session open (FX-based index)', () => {
    const offsets = [0, 300, 600, 900, 1200, 1500];
    const results = offsets.map((offset) =>
      isM15CloseBar(FX_SESSION_OPEN + offset, FX_SESSION_OPEN)
    );
    expect(results).toEqual([false, false, true, false, false, true]);
  });

  it('gets the triplet pattern right for REAL XAUX bar times, which sit on the 5-minute grid, not on the 01:01 anchor', () => {
    // Real M5 bars are stamped at multiples of 300s: 01:05, 01:10, 01:15 ...
    // The previous version of this test placed XAUX bars at anchor + 600
    // (01:11), a time no M5 bar can have -- which is how isM15CloseBar
    // shipped rejecting every real XAUX bar.
    const XAUX_GRID_BAR = XAUX_SESSION_OPEN - 60; // 01:00, the bar containing 01:01
    expect(XAUX_GRID_BAR % 300).toBe(0);

    const barTimes = [0, 300, 600, 900, 1200, 1500].map(
      (offset) => XAUX_GRID_BAR + offset
    );
    const results = barTimes.map((t) => isM15CloseBar(t, XAUX_SESSION_OPEN));
    expect(results).toEqual([false, false, true, false, false, true]);
  });

  it('excludes a bar that does not land on a clean 300s offset from the session open (a data gap)', () => {
    expect(isM15CloseBar(FX_SESSION_OPEN + 650, FX_SESSION_OPEN)).toBe(false);
  });

  it('excludes a bar before the session open (should never happen, but must not wrap negative)', () => {
    expect(isM15CloseBar(FX_SESSION_OPEN - 300, FX_SESSION_OPEN)).toBe(false);
  });

  it("is correct across multiple days using each bar's own per-day anchor", () => {
    const day1Open = FX_SESSION_OPEN;
    const day2Open = FX_SESSION_OPEN + 86_400;

    // Day 1's M15 close bar (offset 600 from day 1's own open).
    expect(isM15CloseBar(day1Open + 600, day1Open)).toBe(true);
    // Day 2's M15 close bar (offset 600 from day 2's own open) -- same
    // offset pattern, different day, each tested against its own anchor.
    expect(isM15CloseBar(day2Open + 600, day2Open)).toBe(true);
  });

  it("uses the row's OWN anchor: a bar before its own session's first M5 bar is excluded", () => {
    // Once floored to the 5-minute grid, XAUX's 01:01 anchor and the FX 00:00
    // anchor share a 900s phase, so the same on-grid bar gets the same answer
    // from both -- which is correct (both are MT5's clock-aligned M15 close
    // bar). What still depends on the row's own anchor is the session start:
    // the 00:55 bar is an M15 close bar of the FX session (3300s after 00:00),
    // but precedes the XAUX session entirely -- same bar, different anchor,
    // different answer.
    const xauxGridBar = XAUX_SESSION_OPEN - 60;
    expect(isM15CloseBar(xauxGridBar + 600, XAUX_SESSION_OPEN)).toBe(true);
    expect(isM15CloseBar(xauxGridBar - 300, XAUX_SESSION_OPEN)).toBe(false);
    expect(isM15CloseBar(xauxGridBar - 300, FX_SESSION_OPEN)).toBe(true);
  });
});
