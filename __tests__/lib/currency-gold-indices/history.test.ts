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

  it('gets the same triplet pattern right for XAUX, whose anchor is not on a clean 900s boundary', () => {
    const offsets = [0, 300, 600, 900, 1200, 1500];
    const results = offsets.map((offset) =>
      isM15CloseBar(XAUX_SESSION_OPEN + offset, XAUX_SESSION_OPEN)
    );
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

  it("uses the row's OWN anchor, not a same-day-but-different-index one (XAUX vs an FX index)", () => {
    // XAUX's anchor is 3660s (01:01) after the FX indices' 00:00 anchor --
    // NOT a multiple of 900, unlike a whole day is. Testing an XAUX bar
    // against an FX anchor must give a genuinely different (wrong) answer,
    // proving the function actually depends on which anchor it is given
    // rather than only on time-of-day.
    expect(isM15CloseBar(XAUX_SESSION_OPEN + 600, XAUX_SESSION_OPEN)).toBe(
      true
    );
    expect(isM15CloseBar(XAUX_SESSION_OPEN + 600, FX_SESSION_OPEN)).toBe(false);
  });
});
