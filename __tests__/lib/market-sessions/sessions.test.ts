import { describe, it, expect } from '@jest/globals';

import {
  MARKET_SESSIONS,
  getMarketSessionState,
  getSessionDefinition,
  isForexMarketOpen,
  formatCountdown,
  type MarketSessionId,
} from '@/lib/market-sessions/sessions';

/**
 * Every instant below is a real UTC timestamp with its zone arithmetic
 * worked out in the comment, so a failure says which fact broke rather than
 * just which assertion. 2026 is not a leap year; all weekdays are verified.
 */

function stateAt(iso: string) {
  return getMarketSessionState(new Date(iso));
}

function isOpen(iso: string, id: MarketSessionId): boolean {
  return stateAt(iso).sessions.find((s) => s.id === id)?.isOpen ?? false;
}

describe('MARKET_SESSIONS definitions', () => {
  it('covers the four centres the panel shows, in clock order', () => {
    expect(MARKET_SESSIONS.map((s) => s.id)).toEqual([
      'sydney',
      'tokyo',
      'london',
      'newYork',
    ]);
    expect(MARKET_SESSIONS.map((s) => s.countryCode)).toEqual([
      'AU',
      'JP',
      'GB',
      'US',
    ]);
  });

  it('uses IANA zone identifiers, never fixed offsets', () => {
    for (const session of MARKET_SESSIONS) {
      expect(session.timeZone).toMatch(/^[A-Za-z]+\/[A-Za-z_]+$/);
      expect(session.openHour).toBeGreaterThanOrEqual(0);
      expect(session.closeHour).toBeLessThanOrEqual(23);
      expect(session.openHour).toBeLessThan(session.closeHour);
    }
  });

  it('resolves a definition by id', () => {
    expect(getSessionDefinition('london')?.timeZone).toBe('Europe/London');
    expect(getSessionDefinition('nope' as MarketSessionId)).toBeUndefined();
  });
});

describe('isForexMarketOpen', () => {
  it('is open midweek', () => {
    // Wed 2026-01-14 12:00 UTC -> New York 07:00 EST, Wednesday.
    expect(isForexMarketOpen(new Date('2026-01-14T12:00:00Z'))).toBe(true);
  });

  it('is closed all Saturday', () => {
    // Sat 2026-01-17 12:00 UTC -> New York 07:00 EST, Saturday.
    expect(isForexMarketOpen(new Date('2026-01-17T12:00:00Z'))).toBe(false);
  });

  it('is closed Friday after the New York close', () => {
    // Fri 2026-01-16 23:00 UTC -> New York 18:00 EST, past the 17:00 close.
    expect(isForexMarketOpen(new Date('2026-01-16T23:00:00Z'))).toBe(false);
    // ...but still open an hour before it.
    expect(isForexMarketOpen(new Date('2026-01-16T21:00:00Z'))).toBe(true);
  });

  it('is closed Sunday before the reopen, open after it', () => {
    // Sun 2026-01-18 12:00 UTC -> New York 07:00 EST: still shut.
    expect(isForexMarketOpen(new Date('2026-01-18T12:00:00Z'))).toBe(false);
    // Sun 2026-01-18 23:00 UTC -> New York 18:00 EST: trading again.
    expect(isForexMarketOpen(new Date('2026-01-18T23:00:00Z'))).toBe(true);
  });
});

describe('getMarketSessionState -- northern DST', () => {
  it('opens London at 08:00 GMT in winter', () => {
    // Wed 2026-01-14. London is GMT (UTC+0) in January.
    expect(isOpen('2026-01-14T07:30:00Z', 'london')).toBe(false); // 07:30 local
    expect(isOpen('2026-01-14T08:30:00Z', 'london')).toBe(true); // 08:30 local
  });

  it('opens London an hour earlier in UTC terms during BST', () => {
    // Wed 2026-07-15. London is BST (UTC+1) in July, so the SAME 07:30 UTC
    // that is shut in January is 08:30 local and open here. This pair is the
    // whole point: a hardcoded offset passes one and fails the other.
    expect(isOpen('2026-07-15T07:30:00Z', 'london')).toBe(true);
    expect(isOpen('2026-07-15T06:30:00Z', 'london')).toBe(false); // 07:30 local
  });
});

describe('getMarketSessionState -- southern DST runs the other way', () => {
  it('opens Sydney earlier in UTC during AEDT than during AEST', () => {
    // 21:30 UTC lands on the following Sydney morning both times.
    // January: AEDT (UTC+11) -> 08:30 Thu, open.
    expect(isOpen('2026-01-14T21:30:00Z', 'sydney')).toBe(true);
    // July: AEST (UTC+10) -> 07:30 Thu, still shut. Opposite of London's
    // seasonal shift, which is why one global offset constant cannot work.
    expect(isOpen('2026-07-15T21:30:00Z', 'sydney')).toBe(false);
  });
});

describe('getMarketSessionState -- weekend correctness', () => {
  it('reports every session closed on Saturday', () => {
    // Sat 2026-01-17 01:00 UTC -> Tokyo 10:00 JST, squarely inside the
    // nominal Tokyo session. A clock that ignores the market week shows
    // Tokyo open here; this is the single most common session-clock bug.
    const state = stateAt('2026-01-17T01:00:00Z');
    expect(state.isMarketOpen).toBe(false);
    expect(state.sessions.every((s) => !s.isOpen)).toBe(true);
    expect(state.primarySessionId).toBeNull();
  });

  it('does not open Sydney during the Sunday-evening gap', () => {
    // Sun 2026-01-18 21:30 UTC -> Sydney 08:30 AEDT Monday: nominally open.
    // But New York reads 16:30 Sunday, half an hour before the market
    // reopens, so nothing is trading yet.
    const state = stateAt('2026-01-18T21:30:00Z');
    expect(state.isMarketOpen).toBe(false);
    expect(state.sessions.find((s) => s.id === 'sydney')?.isOpen).toBe(false);
  });

  it('opens Sydney once the market actually reopens', () => {
    // Sun 2026-01-18 23:00 UTC -> New York 18:00 Sunday (open),
    // Sydney 10:00 AEDT Monday (inside 08:00-17:00).
    const state = stateAt('2026-01-18T23:00:00Z');
    expect(state.isMarketOpen).toBe(true);
    expect(state.sessions.find((s) => s.id === 'sydney')?.isOpen).toBe(true);
    expect(state.primarySessionId).toBe('sydney');
  });

  it('counts down to the reopen while closed', () => {
    // Sun 2026-01-18 12:00 UTC -> New York 07:00 EST. Reopen is 17:00 EST
    // the same day: exactly 10 hours.
    const state = stateAt('2026-01-18T12:00:00Z');
    expect(state.isMarketOpen).toBe(false);
    expect(state.marketReopensInSeconds).toBe(10 * 3600);
  });

  it('reports no reopen countdown while open', () => {
    expect(stateAt('2026-01-14T12:00:00Z').marketReopensInSeconds).toBeNull();
  });
});

describe('getMarketSessionState -- overlap and headline', () => {
  it('headlines London when only London trades', () => {
    // Wed 2026-01-14 12:00 UTC -> London 12:00 (open), New York 07:00 (shut).
    const state = stateAt('2026-01-14T12:00:00Z');
    expect(state.primarySessionId).toBe('london');
    expect(isOpen('2026-01-14T12:00:00Z', 'newYork')).toBe(false);
  });

  it('headlines New York during the London/New York overlap', () => {
    // Wed 2026-01-14 15:00 UTC -> London 15:00 (open), New York 10:00 (open).
    // Both trade; New York opened later, so it holds the headline.
    const state = stateAt('2026-01-14T15:00:00Z');
    expect(isOpen('2026-01-14T15:00:00Z', 'london')).toBe(true);
    expect(isOpen('2026-01-14T15:00:00Z', 'newYork')).toBe(true);
    expect(state.primarySessionId).toBe('newYork');
  });
});

describe('getMarketSessionState -- countdown invariants', () => {
  const probes = [
    '2026-01-14T12:00:00Z', // midweek, London
    '2026-01-17T01:00:00Z', // Saturday
    '2026-01-18T21:30:00Z', // Sunday gap
    '2026-07-15T07:30:00Z', // summer, BST
    '2026-01-16T21:30:00Z', // Friday evening
  ];

  it('always returns all four sessions in a stable order', () => {
    for (const iso of probes) {
      expect(stateAt(iso).sessions.map((s) => s.id)).toEqual([
        'sydney',
        'tokyo',
        'london',
        'newYork',
      ]);
    }
  });

  it('never emits a negative or non-finite countdown', () => {
    for (const iso of probes) {
      for (const session of stateAt(iso).sessions) {
        for (const value of [session.opensInSeconds, session.closesInSeconds]) {
          if (value === null) continue;
          expect(Number.isFinite(value)).toBe(true);
          expect(value).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('sets exactly one of opensIn / closesIn per session', () => {
    for (const iso of probes) {
      for (const session of stateAt(iso).sessions) {
        if (session.isOpen) {
          expect(session.closesInSeconds).not.toBeNull();
          expect(session.opensInSeconds).toBeNull();
        } else {
          expect(session.closesInSeconds).toBeNull();
        }
      }
    }
  });

  it('is pure -- the same instant yields the same state', () => {
    for (const iso of probes) {
      expect(stateAt(iso)).toEqual(stateAt(iso));
    }
  });

  it('never opens a session while the market is shut', () => {
    for (const iso of probes) {
      const state = stateAt(iso);
      if (!state.isMarketOpen) {
        expect(state.sessions.every((s) => !s.isOpen)).toBe(true);
      }
    }
  });
});

describe('formatCountdown', () => {
  it('pads to HH:MM:SS', () => {
    expect(formatCountdown(0)).toBe('00:00:00');
    expect(formatCountdown(3661)).toBe('01:01:01');
    expect(formatCountdown(59)).toBe('00:00:59');
  });

  it('reproduces the seed mockup value', () => {
    // seed-code's panel hardcoded 5 * 3600 + 19 * 60 + 36.
    expect(formatCountdown(5 * 3600 + 19 * 60 + 36)).toBe('05:19:36');
  });

  it('adds a day component past 24h', () => {
    // A Friday close to Monday open is ~65h; "65:12:00" reads as nonsense.
    expect(formatCountdown(90000)).toBe('1d 01:00:00');
    expect(formatCountdown(2 * 86400 + 7200)).toBe('2d 02:00:00');
  });

  it('clamps negatives and fractions rather than rendering junk', () => {
    expect(formatCountdown(-5)).toBe('00:00:00');
    expect(formatCountdown(61.9)).toBe('00:01:01');
  });
});
