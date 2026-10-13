/**
 * @jest-environment node
 */

import {
  CRYPTO_QUOTES,
  CRYPTO_TICKERS,
  OTHER_TICKERS,
  PAIR_CODES,
} from '@/lib/intake/text/scope';
import {
  ALLOWED_SYMBOL,
  ALLOWED_TIMEFRAMES,
  PACKET_SYMBOL,
  TIMEFRAMES,
  canonicalTimeframe,
  checkScope,
  normalizeQuestion,
  scanText,
  type ScopeInput,
  type ScopeReason,
} from '@/lib/intake';

const norm = (text: string): string => normalizeQuestion(text).text;

const reasonsOf = (input: ScopeInput): string[] => {
  const verdict = checkScope(input);
  if (verdict.inScope) throw new Error('the question was in scope');
  return verdict.reasons.map((r) => `${r.kind}:${r.token}:${r.source}`);
};

const inScope = (input: ScopeInput): string[] => {
  const verdict = checkScope(input);
  if (!verdict.inScope) {
    throw new Error(
      `out of scope: ${verdict.reasons.map((r) => `${r.kind}:${r.token}`).join(', ')}`
    );
  }
  return verdict.timeframes;
};

const tokens = (text: string): string[] =>
  scanText(norm(text)).map((r) => `${r.kind}:${r.token}`);

describe('what is allowed', () => {
  it('is gold on M5 and M15, the same symbol and timeframes the packet and the roster name', () => {
    expect(ALLOWED_SYMBOL).toBe('XAUUSD');
    expect(ALLOWED_SYMBOL).toBe(PACKET_SYMBOL);
    expect([...ALLOWED_TIMEFRAMES]).toEqual(['M5', 'M15']);
    expect([...ALLOWED_TIMEFRAMES]).toEqual([...TIMEFRAMES]);
  });
});

// ---------------------------------------------------------------------------------------
// The text
// ---------------------------------------------------------------------------------------

describe('questions that are in scope', () => {
  it.each([
    ['Should I buy gold now?', []],
    ['XAUUSD M5', ['M5']],
    ['xauusd m15', ['M15']],
    ['XAU/USD on 15 min', ['M15']],
    ['XAU USD 5 minutes', ['M5']],
    ['gold 5-minute chart', ['M5']],
    ['gold on the 15 minute chart', ['M15']],
    ['gold 15m and 5m', ['M5', 'M15']],
    ['M15 then M5', ['M5', 'M15']],
    ['gold in USD', []],
    ['XAU.USD', []],
    ['XAUUSD.m', []],
    ['Is the dollar pushing gold down?', []],
    ['Is the EMA200 above price? What about TP1 and SL2?', []],
    ['What does UOEDT mean at 4384.28?', []],
    ['MCD1 says what?', []],
    ['Why is MCD2 CAUTIONARY?', []],
    ['Where is sr_1 and the baseline?', []],
    ['risk 0.75% with a 1:5 leverage', []],
    ['Is there news at 14:30 today? NFP?', []],
    // text-speak: "2day" is today, not the two-day timeframe
    ['is ther big nws 4 gold 2day?? fomc cpi nfp', []],
    ['gold 2day', []],
    ['XAUUSD M5 2day', ['M5']],
    ['买入黄金 M5', ['M5']],
    ['黄金15分钟', []],
    ['', []],
  ] as [string, string[]][])('%s', (text, timeframes) => {
    expect(inScope({ text: norm(text) })).toEqual(timeframes);
  });

  it('is in scope when there is nothing to find', () => {
    expect(checkScope({ text: '' })).toEqual({ inScope: true, timeframes: [] });
    expect(checkScope({ text: 'hello' })).toEqual({
      inScope: true,
      timeframes: [],
    });
  });
});

describe('another symbol is out of scope', () => {
  it.each([
    // currency pairs
    ['EURUSD', ['SYMBOL:EURUSD']],
    ['eurusd', ['SYMBOL:EURUSD']],
    ['EUR/USD', ['SYMBOL:EURUSD']],
    ['EUR-USD', ['SYMBOL:EURUSD']],
    ['EUR_USD', ['SYMBOL:EURUSD']],
    ['EUR USD', ['SYMBOL:EURUSD']],
    ['USD/JPY', ['SYMBOL:USDJPY']],
    ['GBPJPY outlook', ['SYMBOL:GBPJPY']],
    ['AUDNZD', ['SYMBOL:AUDNZD']],
    ['USDCHF, USDCAD', ['SYMBOL:USDCHF', 'SYMBOL:USDCAD']],
    // metals that are not gold, and gold against another currency
    ['XAGUSD', ['SYMBOL:XAGUSD']],
    ['XAG/USD', ['SYMBOL:XAGUSD']],
    ['XAUEUR', ['SYMBOL:XAUEUR']],
    ['XAU-GBP', ['SYMBOL:XAUGBP']],
    ['XPTUSD', ['SYMBOL:XPTUSD']],
    ['USDXAU', ['SYMBOL:USDXAU']],
    ['silver', ['SYMBOL:SILVER']],
    [
      'Platinum, palladium and copper',
      ['SYMBOL:PLATINUM', 'SYMBOL:PALLADIUM', 'SYMBOL:COPPER'],
    ],
    // crypto
    ['BTC', ['SYMBOL:BTC']],
    ['btc price?', ['SYMBOL:BTC']],
    ['BTCUSD', ['SYMBOL:BTCUSD']],
    ['BTC/USD', ['SYMBOL:BTC']],
    ['ETH-USD', ['SYMBOL:ETH']],
    ['ethusdt', ['SYMBOL:ETHUSDT']],
    ['Bitcoin', ['SYMBOL:BITCOIN']],
    ['dogecoin and XRP', ['SYMBOL:DOGECOIN', 'SYMBOL:XRP']],
    // indices, energy, volatility
    ['US30', ['SYMBOL:US30']],
    ['us100 today', ['SYMBOL:US100']],
    ['NAS100', ['SYMBOL:NAS100']],
    ['S&P 500', ['SYMBOL:S&P']],
    ['Dow Jones', ['SYMBOL:DOW JONES']],
    ['SPX500 and DAX', ['SYMBOL:SPX500', 'SYMBOL:DAX']],
    ['GER40', ['SYMBOL:GER40']],
    ['WTI crude', ['SYMBOL:WTI']],
    ['USOIL or Brent', ['SYMBOL:USOIL', 'SYMBOL:BRENT']],
    ['DXY', ['SYMBOL:DXY']],
    ['VIX', ['SYMBOL:VIX']],
    ['Nasdaq', ['SYMBOL:NASDAQ']],
    // between the characters of another script
    ['我想买EURUSD', ['SYMBOL:EURUSD']],
    ['ビットコインBTCを買う', ['SYMBOL:BTC']],
    ['اشتري BTC الآن', ['SYMBOL:BTC']],
  ] as [string, string[]][])('%s', (text, expected) => {
    expect(tokens(text)).toEqual(expected);
    expect(
      reasonsOf({ text: norm(text) }).map((r) =>
        r.split(':').slice(0, 2).join(':')
      )
    ).toEqual(expected);
  });

  it('is a mixed question when gold and another symbol are both there', () => {
    expect(reasonsOf({ text: 'Is gold better than bitcoin?' })).toEqual([
      'SYMBOL:BITCOIN:TEXT',
    ]);
    expect(reasonsOf({ text: 'XAUUSD and EURUSD' })).toEqual([
      'SYMBOL:EURUSD:TEXT',
    ]);
    expect(reasonsOf({ text: 'gold and BTC and US30' })).toEqual([
      'SYMBOL:BTC:TEXT',
      'SYMBOL:US30:TEXT',
    ]);
  });

  it('finds a symbol that was written with zero-width characters once the text is normalised', () => {
    expect(tokens('EUR\u200bUSD')).toEqual(['SYMBOL:EURUSD']);
    expect(tokens('B\u202eT\u2060C')).toEqual(['SYMBOL:BTC']);
    expect(tokens('ＥＵＲＵＳＤ')).toEqual(['SYMBOL:EURUSD']);
    expect(tokens('ｂｔｃ')).toEqual(['SYMBOL:BTC']);
  });

  it('does not take other words for symbols', () => {
    for (const text of [
      'EMA200',
      'EMA50 and SMA20',
      'RSI14',
      'ATR14',
      'TP1',
      'SL50',
      'R1 S1 pivot',
      'MCD1',
      'sr_1',
      'dollar',
      'the euro',
      'oil prices',
      'try it',
      'Try USD',
      'ethical',
      'letter',
      'bitcoins',
      'BTCs',
      'XAUUSDT',
      'US300',
      'USDJPYX',
      'GOLD',
      'XAU',
    ]) {
      const found = tokens(text).filter((t) => t.startsWith('SYMBOL'));
      expect({ text, found }).toEqual({ text, found: [] });
    }
  });

  it('reads the pairs of gold itself as gold, with a broker suffix and any separator', () => {
    for (const text of [
      'XAUUSD',
      'XAU/USD',
      'XAU-USD',
      'XAU_USD',
      'XAU USD',
      'xau/usd',
      'XAUUSD.m',
    ]) {
      expect({ text, found: tokens(text) }).toEqual({ text, found: [] });
    }
  });
});

describe('another timeframe is out of scope', () => {
  it.each([
    // the names of MetaTrader
    ['H1', ['TIMEFRAME:H1']],
    ['h4', ['TIMEFRAME:H4']],
    ['D1', ['TIMEFRAME:D1']],
    ['W1', ['TIMEFRAME:W1']],
    ['MN1', ['TIMEFRAME:MN1']],
    ['M1', ['TIMEFRAME:M1']],
    ['M30', ['TIMEFRAME:M30']],
    ['M10', ['TIMEFRAME:M10']],
    ['M05 and M005', []],
    // spoken forms
    ['1h', ['TIMEFRAME:H1']],
    ['4H chart', ['TIMEFRAME:H4']],
    ['1 hour', ['TIMEFRAME:H1']],
    ['1-hour', ['TIMEFRAME:H1']],
    ['2 hours', ['TIMEFRAME:H2']],
    ['4 hrs', ['TIMEFRAME:H4']],
    ['1d', ['TIMEFRAME:D1']],
    ['3 days', ['TIMEFRAME:D3']],
    // "2day" in one word is "today"; every other way of writing two days stays D2
    ['2 day', ['TIMEFRAME:D2']],
    ['2-day', ['TIMEFRAME:D2']],
    ['2days', ['TIMEFRAME:D2']],
    ['2d', ['TIMEFRAME:D2']],
    ['2 days', ['TIMEFRAME:D2']],
    ['22day', ['TIMEFRAME:D22']],
    ['1day', ['TIMEFRAME:D1']],
    ['news 2day and 2 days', ['TIMEFRAME:D2']],
    ['1 week', ['TIMEFRAME:W1']],
    ['2 wks', ['TIMEFRAME:W2']],
    ['1 month', ['TIMEFRAME:MN1']],
    ['3 months', ['TIMEFRAME:MN3']],
    ['1mo', ['TIMEFRAME:MN1']],
    ['1m', ['TIMEFRAME:M1']],
    ['30 minutes', ['TIMEFRAME:M30']],
    ['30 min', ['TIMEFRAME:M30']],
    ['1 minute', ['TIMEFRAME:M1']],
    ['10 mins', ['TIMEFRAME:M10']],
    ['last 2 hours', ['TIMEFRAME:H2']],
    ['60 minutes', ['TIMEFRAME:M60']],
    // words
    ['daily', ['TIMEFRAME:D1']],
    ['Daily chart', ['TIMEFRAME:D1']],
    ['weekly', ['TIMEFRAME:W1']],
    ['monthly', ['TIMEFRAME:MN1']],
    ['hourly', ['TIMEFRAME:H1']],
    // more than one
    ['H1 and D1', ['TIMEFRAME:H1', 'TIMEFRAME:D1']],
    ['M5 against H1', ['TIMEFRAME:H1']],
    ['5 min vs 4 hours', ['TIMEFRAME:H4']],
    // between the characters of another script
    ['买入黄金H1', ['TIMEFRAME:H1']],
    ['日足D1', ['TIMEFRAME:D1']],
  ] as [string, string[]][])('%s', (text, expected) => {
    expect(tokens(text)).toEqual(expected);
  });

  it('does not take other things for a timeframe', () => {
    for (const text of [
      'MCD1',
      'MCD2 and MCD3',
      'EMA200',
      'sr_1',
      'v1',
      'ad1',
      'cd5',
      'M',
      'H',
      'Hello',
      'Mondays',
      'wide',
      'Doing',
      '4377',
      '4377 M',
      '4,377 m',
      '1.5 hours of news',
      '1.5h',
      '5 meters',
      '5 mild',
      'a 5Min',
      'every dayly',
      'monthlyish',
      'D1X',
      'XD1',
      'W11111',
      'M2000',
      'today',
      '2day',
      '2DAY',
      '2Day',
      'is there big news 4 gold 2day??',
      'any news for gold 2day.',
      '(2day)',
      'in a day',
      'this week',
      'intraday',
    ]) {
      const found = tokens(text).filter((t) => t.startsWith('TIMEFRAME'));
      // "a 5Min" is five minutes (allowed), "1.5h" and "1.5 hours" are not read
      expect({ text, found }).toEqual({ text, found: [] });
    }
  });

  it('leaves M5 and M15 allowed, in every way of writing them', () => {
    for (const text of [
      'M5',
      'm5',
      'M15',
      '5m',
      '5 m',
      '5min',
      '5 mins',
      '5 minute',
      '5-minute',
      '5 minutes',
      '15m',
      '15 min',
      '15-minutes',
      'M05',
      'M015',
    ]) {
      const verdict = checkScope({ text: norm(text) });
      expect({ text, ok: verdict.inScope }).toEqual({ text, ok: true });
    }
  });

  it('names the timeframes it saw, in the order M5 then M15', () => {
    expect(inScope({ text: 'M15 and M5 and m15' })).toEqual(['M5', 'M15']);
    expect(inScope({ text: 'only 15 minutes' })).toEqual(['M15']);
    expect(inScope({ text: 'only M5' })).toEqual(['M5']);
  });
});

// ---------------------------------------------------------------------------------------
// What the model says
// ---------------------------------------------------------------------------------------

describe('the symbols the model names', () => {
  it.each([
    'XAUUSD',
    'xauusd',
    'XAU/USD',
    'XAU-USD',
    'XAU_USD',
    'XAU.USD',
    'XAU',
    'GOLD',
    'gold',
    ' XAUUSD ',
    'XAUUSD.m',
    'XAUUSD_pro',
    'XAUUSD.ECN',
    'USD',
    'usd',
  ])('allows %j', (symbol) => {
    expect(checkScope({ text: '', symbols: [symbol] }).inScope).toBe(true);
  });

  it.each([
    'EURUSD',
    'BTC',
    'BTC/USD',
    'US30',
    'XAUEUR',
    'XAGUSD',
    'SILVER',
    'XAUUSDT',
    'XAUUSDm',
    'XAUUSD.',
    'XAUUSD.TOOLONG',
    'XAU/EUR',
    'GOLDEN',
    'EUR',
    'DXY',
    'XAUXAU',
    '12',
    '-',
  ])('refuses %j', (symbol) => {
    const verdict = checkScope({ text: '', symbols: [symbol] });
    expect(verdict.inScope).toBe(false);
    expect(!verdict.inScope && verdict.reasons).toEqual([
      { kind: 'SYMBOL', token: symbol.trim().toUpperCase(), source: 'MODEL' },
    ]);
  });

  it('refuses when any one symbol is not gold', () => {
    expect(reasonsOf({ text: '', symbols: ['XAUUSD', 'BTC', 'GOLD'] })).toEqual(
      ['SYMBOL:BTC:MODEL']
    );
    expect(reasonsOf({ text: '', symbols: ['EURUSD', 'btc'] })).toEqual([
      'SYMBOL:EURUSD:MODEL',
      'SYMBOL:BTC:MODEL',
    ]);
  });

  it('allows an empty list and several spellings of gold', () => {
    expect(checkScope({ text: '', symbols: [] }).inScope).toBe(true);
    expect(
      checkScope({ text: '', symbols: ['XAUUSD', 'GOLD', 'XAU'] }).inScope
    ).toBe(true);
  });
});

describe('the timeframes the model names', () => {
  it.each([
    ['M5', 'M5'],
    ['m5', 'M5'],
    ['5m', 'M5'],
    ['5min', 'M5'],
    ['5mins', 'M5'],
    ['5minute', 'M5'],
    ['5 minutes', 'M5'],
    ['5-minute', 'M5'],
    ['5_min', 'M5'],
    ['M15', 'M15'],
    ['15m', 'M15'],
    ['15min', 'M15'],
    ['15MINUTES', 'M15'],
    ['M05', 'M5'],
  ])('allows %j as %s', (token, name) => {
    expect(canonicalTimeframe(token)).toBe(name);
    expect(checkScope({ text: '', timeframes: [token] })).toEqual({
      inScope: true,
      timeframes: [name],
    });
  });

  it.each([
    ['H1', 'H1'],
    ['H4', 'H4'],
    ['1h', 'H1'],
    ['4h', 'H4'],
    ['1hr', 'H1'],
    ['2hours', 'H2'],
    ['D1', 'D1'],
    ['1d', 'D1'],
    ['3days', 'D3'],
    ['daily', 'D1'],
    ['DAILY', 'D1'],
    ['W1', 'W1'],
    ['1w', 'W1'],
    ['2wk', 'W2'],
    ['weekly', 'W1'],
    ['MN1', 'MN1'],
    ['1mo', 'MN1'],
    ['3month', 'MN3'],
    ['monthly', 'MN1'],
    ['hourly', 'H1'],
    ['M1', 'M1'],
    ['1m', 'M1'],
    ['M30', 'M30'],
    ['30min', 'M30'],
  ])('reads %j as %s and refuses it', (token, name) => {
    expect(canonicalTimeframe(token)).toBe(name);
    expect(reasonsOf({ text: '', timeframes: [token] })).toEqual([
      `TIMEFRAME:${name}:MODEL`,
    ]);
  });

  it.each([
    'foo',
    'swing',
    'intra',
    '5',
    'M',
    'H',
    '',
    '1x',
    'XAUUSD',
    '5mx',
    'M5M15',
  ])(
    'refuses %j, which it cannot read as one of the two, under its own name',
    (token) => {
      expect(canonicalTimeframe(token)).toBeNull();
      expect(reasonsOf({ text: '', timeframes: [token] })).toEqual([
        `TIMEFRAME:${token.trim().toUpperCase()}:MODEL`,
      ]);
    }
  );

  it('refuses when any one is not allowed, and lists the allowed ones it saw', () => {
    expect(reasonsOf({ text: '', timeframes: ['M5', 'H1', 'M15'] })).toEqual([
      'TIMEFRAME:H1:MODEL',
    ]);
    expect(inScope({ text: '', timeframes: ['M15', 'M5'] })).toEqual([
      'M5',
      'M15',
    ]);
  });

  it('knows the edges of what it can read', () => {
    expect(canonicalTimeframe('M0')).toBe('M0');
    expect(canonicalTimeframe('H1000')).toBeNull();
    expect(canonicalTimeframe('MN')).toBeNull();
  });
});

describe('the label of the model', () => {
  it('sends an OUT_OF_SCOPE question out of scope on its own', () => {
    expect(
      reasonsOf({ text: 'tell me a joke', intent: 'OUT_OF_SCOPE' })
    ).toEqual(['INTENT:OUT_OF_SCOPE:MODEL']);
  });

  it('lets the seven other labels through', () => {
    for (const intent of [
      'DIRECTION',
      'ENTRY_TIMING',
      'EXIT_TARGETS',
      'RISK_SIZING',
      'EXPLAIN',
      'NEWS',
      'REPORT_2',
    ] as const) {
      expect(checkScope({ text: 'gold', intent }).inScope).toBe(true);
    }
  });
});

describe('the English text of the model', () => {
  it('is read like the question, and says so', () => {
    expect(
      reasonsOf({
        text: norm('اشتري الذهب'),
        english: 'Buy bitcoin on the 4 hour chart',
      })
    ).toEqual(['SYMBOL:BITCOIN:ENGLISH', 'TIMEFRAME:H4:ENGLISH']);
    expect(inScope({ text: 'gold', english: 'Buy gold on M15' })).toEqual([
      'M15',
    ]);
  });

  it('adds a timeframe it names to the ones the question names', () => {
    expect(inScope({ text: 'gold M5', english: 'gold on M15' })).toEqual([
      'M5',
      'M15',
    ]);
  });
});

describe('the reasons', () => {
  it('say where each was found and list each once, text first, then English, then the model', () => {
    const reasons = (
      checkScope({
        text: 'EURUSD H1',
        english: 'EURUSD on H1 and BTC',
        symbols: ['EURUSD', 'XAUUSD'],
        timeframes: ['H1'],
        intent: 'OUT_OF_SCOPE',
      }) as { reasons: ScopeReason[] }
    ).reasons;
    expect(reasons).toEqual([
      { kind: 'SYMBOL', token: 'EURUSD', source: 'TEXT' },
      { kind: 'TIMEFRAME', token: 'H1', source: 'TEXT' },
      { kind: 'SYMBOL', token: 'BTC', source: 'ENGLISH' },
      { kind: 'INTENT', token: 'OUT_OF_SCOPE', source: 'MODEL' },
    ]);
  });

  it('are the same whatever the order of the model’s tokens, as a set', () => {
    const a = reasonsOf({ text: '', symbols: ['BTC', 'ETH'] });
    const b = reasonsOf({ text: '', symbols: ['ETH', 'BTC'] });
    expect([...a].sort()).toEqual([...b].sort());
  });

  it('are what scanText finds in a text, with the source asked for', () => {
    expect(scanText('EURUSD on H1')).toEqual([
      { kind: 'SYMBOL', token: 'EURUSD', source: 'TEXT' },
      { kind: 'TIMEFRAME', token: 'H1', source: 'TEXT' },
    ]);
    expect(scanText('BTC', 'ENGLISH')).toEqual([
      { kind: 'SYMBOL', token: 'BTC', source: 'ENGLISH' },
    ]);
    expect(scanText('gold M5 M15')).toEqual([]);
  });
});

describe('the scan is not slow', () => {
  it('reads a long text without trouble', () => {
    const text = `${'gold M5 '.repeat(2000)}${'x'.repeat(50000)} ${'1 '.repeat(10000)}EURUSD`;
    expect(scanText(text).map((r) => r.token)).toEqual(['EURUSD']);
  });
});

// ---------------------------------------------------------------------------------------
// Gaps the mutation check found
// ---------------------------------------------------------------------------------------

describe('every code and ticker on the lists works end to end', () => {
  it('reads each currency or metal code as one half of a pair, in both orders', () => {
    expect(PAIR_CODES.length).toBeGreaterThan(25);
    for (const code of PAIR_CODES) {
      // XAU and USD together are gold, so pair XAU with another code
      const partner = code === 'XAU' || code === 'USD' ? 'EUR' : 'USD';
      expect(tokens(`${code}${partner}`)).toEqual([`SYMBOL:${code}${partner}`]);
      expect(tokens(`${partner}${code}`)).toEqual([`SYMBOL:${partner}${code}`]);
      expect(tokens(`${code.toLowerCase()}/${partner.toLowerCase()}`)).toEqual([
        `SYMBOL:${code}${partner}`,
      ]);
    }
  });

  it('reads each crypto ticker and name alone and with each quote', () => {
    expect(CRYPTO_TICKERS.length).toBeGreaterThan(15);
    for (const coin of CRYPTO_TICKERS) {
      expect(tokens(coin)).toEqual([`SYMBOL:${coin}`]);
      expect(tokens(coin.toLowerCase())).toEqual([`SYMBOL:${coin}`]);
      for (const quote of CRYPTO_QUOTES) {
        expect(tokens(`${coin}${quote}`)).toEqual([`SYMBOL:${coin}${quote}`]);
      }
    }
    expect([...CRYPTO_QUOTES].sort()).toEqual(['EUR', 'GBP', 'USD', 'USDT']);
  });

  it('reads each index, energy and metal ticker', () => {
    expect(OTHER_TICKERS.length).toBeGreaterThan(35);
    for (const ticker of OTHER_TICKERS) {
      expect(tokens(ticker)).toEqual([`SYMBOL:${ticker}`]);
      expect(tokens(`the ${ticker.toLowerCase()} chart`)).toEqual([
        `SYMBOL:${ticker}`,
      ]);
    }
  });

  it('reads a ticker that is the start of a longer one as the longer one', () => {
    expect(tokens('FTSE100')).toEqual(['SYMBOL:FTSE100']);
    expect(tokens('NIKKEI225')).toEqual(['SYMBOL:NIKKEI225']);
    expect(tokens('SPX500')).toEqual(['SYMBOL:SPX500']);
    expect(tokens('US500')).toEqual(['SYMBOL:US500']);
    expect(tokens('DOGECOIN')).toEqual(['SYMBOL:DOGECOIN']);
    expect(tokens('USDTUSD')).toEqual(['SYMBOL:USDTUSD']);
  });

  it('keeps the hand-written ones too, so the lists are not only checked against themselves', () => {
    for (const ticker of [
      'BTC',
      'ETH',
      'XRP',
      'DOGE',
      'US30',
      'NAS100',
      'GER40',
      'UK100',
      'WTI',
      'BRENT',
      'DXY',
      'VIX',
      'NIKKEI',
    ]) {
      expect(OTHER_TICKERS.concat(CRYPTO_TICKERS)).toContain(ticker);
    }
    for (const code of ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'XAU', 'XAG']) {
      expect(PAIR_CODES).toContain(code);
    }
  });
});

describe('the edges of what is gold and what is a timeframe', () => {
  it('allows a broker suffix of one to four characters after a dot or an underscore', () => {
    for (const suffix of ['A', 'AB', 'ABC', 'ABCD', '1234']) {
      expect(
        checkScope({ text: '', symbols: [`XAUUSD.${suffix}`] }).inScope
      ).toBe(true);
      expect(
        checkScope({ text: '', symbols: [`GOLD_${suffix}`] }).inScope
      ).toBe(true);
    }
    expect(checkScope({ text: '', symbols: ['XAUUSD.ABCDE'] }).inScope).toBe(
      false
    );
    expect(checkScope({ text: '', symbols: ['GOLD_ABCDE'] }).inScope).toBe(
      false
    );
    expect(checkScope({ text: '', symbols: ['XAUUSD.'] }).inScope).toBe(false);
  });

  it('reads up to three digits in a timeframe name, in a text and as a token', () => {
    expect(tokens('M123')).toEqual(['TIMEFRAME:M123']);
    expect(tokens('M1234')).toEqual([]);
    expect(tokens('123 min')).toEqual(['TIMEFRAME:M123']);
    expect(tokens('1234 min')).toEqual([]);
    expect(canonicalTimeframe('M123')).toBe('M123');
    expect(canonicalTimeframe('M1234')).toBeNull();
    expect(canonicalTimeframe('123min')).toBe('M123');
    expect(canonicalTimeframe('1234min')).toBeNull();
    expect(canonicalTimeframe('1m')).toBe('M1');
  });

  it('reads a timeframe token only whole', () => {
    for (const token of [
      'x5m',
      'ab15min',
      'xM5',
      'M5x',
      '5mx',
      'x1h',
      'dailyx',
      'xdaily',
    ]) {
      expect({ token, name: canonicalTimeframe(token) }).toEqual({
        token,
        name: null,
      });
    }
  });

  it('names a token the way it was given, upper case and without the spaces around it', () => {
    expect(reasonsOf({ text: '', symbols: [' btc '] })).toEqual([
      'SYMBOL:BTC:MODEL',
    ]);
    expect(reasonsOf({ text: '', timeframes: [' foo '] })).toEqual([
      'TIMEFRAME:FOO:MODEL',
    ]);
    expect(reasonsOf({ text: '', timeframes: ['  H1  '] })).toEqual([
      'TIMEFRAME:H1:MODEL',
    ]);
  });

  it('takes the English text as optional', () => {
    expect(checkScope({ text: 'gold', english: undefined }).inScope).toBe(true);
    expect(checkScope({ text: 'gold', english: '' }).inScope).toBe(true);
    expect(checkScope({ text: 'gold' }).inScope).toBe(true);
  });
});
