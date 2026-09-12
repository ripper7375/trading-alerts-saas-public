import {
  sampleM15Bars,
  computeHrma,
  computeSmma,
  type CurrencyIndexBar,
} from '@/lib/currency-index-pro/math';

const SESSION_OPEN = 1_800_000_000;

function bar(offsetSec: number, changePct: number): CurrencyIndexBar {
  return {
    barTime: SESSION_OPEN + offsetSec,
    value: 100 + changePct,
    changePct,
  };
}

describe('sampleM15Bars', () => {
  it('keeps only the 3rd bar of each 15-minute triplet from the session open', () => {
    const bars = [
      bar(0, 0.0), // :00 -- open bar, not a close
      bar(300, 0.1), // :05
      bar(600, 0.2), // :10 -- M15 close #1
      bar(900, 0.3), // :15
      bar(1200, 0.4), // :20
      bar(1500, 0.5), // :25 -- M15 close #2
    ];

    const m15 = sampleM15Bars(bars, SESSION_OPEN);
    expect(m15.map((b) => b.changePct)).toEqual([0.2, 0.5]);
  });

  it('excludes a bar that does not land on a clean 300s offset from the session open (a data gap)', () => {
    const bars = [bar(0, 0.0), bar(650, 0.2)]; // 650s offset, not a multiple of 300
    expect(sampleM15Bars(bars, SESSION_OPEN)).toEqual([]);
  });

  it('returns [] for an empty input', () => {
    expect(sampleM15Bars([], SESSION_OPEN)).toEqual([]);
  });
});

describe('computeHrma', () => {
  it('returns [] for an empty series', () => {
    expect(computeHrma([])).toEqual([]);
  });

  it('seeds the first point from the series itself (no NaN on a 1-point series)', () => {
    expect(computeHrma([10], 36)).toEqual([10]);
  });

  it('matches a hand-computed 3-point example (len=4)', () => {
    // alpha1 = 2/3, alpha2 = 2/5, alpha3 = 2/3 (sqrt(4) = 2)
    // t=0: rma1=rma2=hrma=10
    // t=1: rma1=50/3, rma2=14, diff=58/3, hrma=146/9
    // t=2: rma1=230/9, rma2=102/5, diff=1382/45, hrma=3494/135
    const result = computeHrma([10, 20, 30], 4);
    expect(result[0]).toBeCloseTo(10, 8);
    expect(result[1]).toBeCloseTo(146 / 9, 8);
    expect(result[2]).toBeCloseTo(3494 / 135, 8);
  });
});

describe('computeSmma', () => {
  it('is null before the seed point (index < len - 1)', () => {
    const result = computeSmma([10, 20, 30, 40, 50], 3);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
  });

  it('never fabricates a value for a series shorter than len', () => {
    const result = computeSmma([10, 20], 5);
    expect(result).toEqual([null, null]);
  });

  it("matches Wilder's hand-computed formula (len=3)", () => {
    // smma[2] = avg(10,20,30) = 20
    // smma[3] = (20*2 + 40)/3 = 26.666...
    // smma[4] = (26.666...*2 + 50)/3 = 34.444...
    const result = computeSmma([10, 20, 30, 40, 50], 3);
    expect(result[2]).toBeCloseTo(20, 8);
    expect(result[3]).toBeCloseTo(80 / 3, 8);
    expect(result[4]).toBeCloseTo(310 / 9, 8);
  });
});
