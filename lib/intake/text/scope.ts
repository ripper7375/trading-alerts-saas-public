/**
 * The scope check (architecture 4.2 step 3, ADR-046, plan part 2).
 *
 * DavinTrade covers ONE symbol on TWO timeframes: gold (XAUUSD) on M5 and M15. A question
 * about anything else gets a fixed reply in the trader's language and nothing else runs.
 * The check is deterministic, so no reasoning is spent on instruments we do not cover.
 *
 * Two things are read:
 *  - the TEXT, in the Latin script: the question as typed and, when there is one, the model's
 *    English text. Tickers (`EURUSD`, `BTC`, `US30`, `NAS100`), the pairs of currency and metal
 *    codes (`EUR/USD`, `XAU-EUR`), the names of other assets the traders write in English
 *    (silver, bitcoin, nasdaq), and timeframes (`H1`, `D1`, `4h`, `15 min`, `daily`). It
 *    works even when the model says nothing, and on text a person typed between Chinese or
 *    Thai characters. It does NOT guess: a word is flagged only if it is on the lists below,
 *    so `EMA200` and `TP1` and `dollar` pass. It cannot read a symbol written in another
 *    script; the model's tokens cover those.
 *  - the model's `symbols` and `timeframes` tokens, compared with the allowed set. A token
 *    that is not gold, and not a timeframe of M5 or M15, is out of scope. Anything the check
 *    cannot read as an allowed token counts as out of scope too (decision: strict).
 *
 * Readings that the plan leaves open, as built (the part 2 hand-off lists them for Davin):
 *  - a question that names an allowed AND another symbol or timeframe is out of scope ("gold
 *    and BTC", "M5 against H1");
 *  - a duration counts as a timeframe: `last 2 hours` is H2, `10 minutes` is M10;
 *  - a bare `USD` is not a second symbol: it is the quote currency of gold;
 *  - the model's own `OUT_OF_SCOPE` label is out of scope.
 *
 * Pure: no I/O, no clock, no randomness.
 *
 * @module lib/intake/text/scope
 */

import { PACKET_SYMBOL } from '../packet';
import { TIMEFRAMES, type Timeframe } from '../roster';

import type { UnderstandIntent } from '../intents';

export type ScopeReasonKind = 'SYMBOL' | 'TIMEFRAME' | 'INTENT';
export type ScopeSource = 'TEXT' | 'ENGLISH' | 'MODEL';

export interface ScopeReason {
  kind: ScopeReasonKind;
  /** the symbol or timeframe as the check read it (upper case), or the label */
  token: string;
  source: ScopeSource;
}

export type ScopeVerdict =
  | {
      inScope: true;
      /** the allowed timeframes the question names, in the order M5, M15 */
      timeframes: Timeframe[];
    }
  | { inScope: false; reasons: ScopeReason[] };

export interface ScopeInput {
  /** the normalised question as typed */
  text: string;
  /** the model's English text */
  english?: string;
  /** the model's tokens */
  symbols?: readonly string[];
  timeframes?: readonly string[];
  intent?: UnderstandIntent;
}

// ---------------------------------------------------------------------------
// What is allowed
// ---------------------------------------------------------------------------

/** The one symbol (the packet's own constant) and the two timeframes (the roster's). */
export const ALLOWED_SYMBOL: string = PACKET_SYMBOL;
export const ALLOWED_TIMEFRAMES: readonly Timeframe[] = TIMEFRAMES;

/** Gold as a model or a trader writes it: `XAUUSD`, `XAU/USD`, `XAU.USD`, `XAU`, `GOLD`, with a broker suffix (`XAUUSD.M`). */
const GOLD_TOKEN = /^(?:XAUUSD|XAU[/._-]USD|XAU|GOLD)(?:[._][A-Z0-9]{1,4})?$/;

/** The quote currency of gold is not a second instrument. */
const QUOTE_CURRENCY = 'USD';

// ---------------------------------------------------------------------------
// What is not: the lists the text scan reads
// ---------------------------------------------------------------------------

/** Currency and metal codes whose pairs are other instruments (`EURUSD`, `USDJPY`, `XAGUSD`, `XAUEUR`). */
export const PAIR_CODES = [
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'CHF',
  'AUD',
  'NZD',
  'CAD',
  'CNH',
  'CNY',
  'SEK',
  'NOK',
  'DKK',
  'PLN',
  'CZK',
  'HUF',
  'ZAR',
  'MXN',
  'BRL',
  'INR',
  'SGD',
  'HKD',
  'KRW',
  'THB',
  'IDR',
  'XAU',
  'XAG',
  'XPT',
  'XPD',
];

/** Crypto tickers and names (none of them is an ordinary word in the 17 languages). */
export const CRYPTO_TICKERS = [
  'BTC',
  'ETH',
  'XRP',
  'LTC',
  'BCH',
  'BNB',
  'DOGE',
  'USDT',
  'USDC',
  'XLM',
  'SHIB',
  'AVAX',
  'MATIC',
  'TRX',
  'BITCOIN',
  'ETHEREUM',
  'LITECOIN',
  'DOGECOIN',
];
export const CRYPTO_QUOTES = ['USDT', 'USD', 'EUR', 'GBP'];

/** Indices, energy, metals and other tickers and names written in the Latin script. */
export const OTHER_TICKERS = [
  'US30',
  'US100',
  'US500',
  'US2000',
  'NAS100',
  'NDX',
  'SPX',
  'SPX500',
  'SP500',
  'DJI',
  'DJIA',
  'DAX',
  'GER30',
  'GER40',
  'DE30',
  'DE40',
  'UK100',
  'FTSE',
  'FTSE100',
  'JP225',
  'NIKKEI',
  'NIKKEI225',
  'HK50',
  'AUS200',
  'CAC40',
  'FRA40',
  'WTI',
  'BRENT',
  'USOIL',
  'UKOIL',
  'XTIUSD',
  'XBRUSD',
  'NGAS',
  'XNGUSD',
  'DXY',
  'USDX',
  'VIX',
  'NASDAQ',
  'SILVER',
  'PLATINUM',
  'PALLADIUM',
  'COPPER',
];

// No order is needed in an alternation: the check after it fails on a prefix (FTSE before
// FTSE100) and the engine goes on to the next alternative.
const alternation = (words: readonly string[]): string => words.join('|');

const NOT_WORD = '(?<![A-Z0-9])';
const NOT_WORD_AFTER = '(?![A-Z0-9])';

/** `EUR/USD`, `eur_usd`, `EUR USD`, `EURUSD`, `XAU-EUR`. */
const PAIR = new RegExp(
  `${NOT_WORD}(${alternation(PAIR_CODES)})[/_ -]?(${alternation(PAIR_CODES)})${NOT_WORD_AFTER}`,
  'g'
);
const CRYPTO_TICKER = new RegExp(
  `${NOT_WORD}(?:${alternation(CRYPTO_TICKERS)})(?:${alternation(CRYPTO_QUOTES)})?${NOT_WORD_AFTER}`,
  'g'
);
const OTHER_TICKER = new RegExp(
  `${NOT_WORD}(?:${alternation(OTHER_TICKERS)}|S&P|DOW JONES)${NOT_WORD_AFTER}`,
  'g'
);

// ---------------------------------------------------------------------------
// Timeframes
// ---------------------------------------------------------------------------

type Unit = 'M' | 'H' | 'D' | 'W' | 'MN';

/** `M5`, `H4`, `D1`, `W1`, `MN1` (the MT5 names). */
const MT5_TIMEFRAME = /(?<![A-Z0-9])(MN|M|H|D|W)(\d{1,3})(?![A-Z0-9])/g;
/** `5m`, `15 min`, `15-minute`, `1h`, `4 hours`, `1d`, `2 weeks`, `3 months`. */
const SPOKEN_TIMEFRAME =
  /(?<![A-Z0-9.,])(\d{1,3})[ -]?(MINUTES?|MINS?|HOURS?|HRS?|DAYS?|WEEKS?|WKS?|MONTHS?|MO|M|H|D|W)(?![A-Z])/g;
const TIMEFRAME_WORD =
  /(?<![A-Z0-9])(?:DAILY|WEEKLY|MONTHLY|HOURLY)(?![A-Z0-9])/g;

const WORD_UNIT: ReadonlyMap<string, string> = new Map([
  ['HOURLY', 'H1'],
  ['DAILY', 'D1'],
  ['WEEKLY', 'W1'],
  ['MONTHLY', 'MN1'],
]);

function unitOf(spoken: string): Unit {
  if (spoken === 'M' || spoken.startsWith('MIN')) return 'M';
  if (spoken.startsWith('MO')) return 'MN';
  if (spoken.startsWith('H')) return 'H';
  if (spoken.startsWith('D')) return 'D';
  return 'W';
}

const timeframeName = (unit: string, count: string | number): string =>
  `${unit}${Number(count)}`;

/**
 * A timeframe written by a model as one token (`M5`, `5m`, `15min`, `H4`, `1h`, `daily`, `D1`,
 * `4-hour`, `W1`) as its MT5 name, or null when it is not one the check can read.
 */
export function canonicalTimeframe(token: string): string | null {
  const word = token.toUpperCase().replace(/[\s_-]+/g, '');
  const wordName = WORD_UNIT.get(word);
  if (wordName !== undefined) return wordName;
  const mt5 = /^(MN|M|H|D|W)(\d{1,3})$/.exec(word);
  if (mt5 !== null) return timeframeName(mt5[1] as string, mt5[2] as string);
  const spoken =
    /^(\d{1,3})(MINUTES?|MINS?|HOURS?|HRS?|DAYS?|WEEKS?|WKS?|MONTHS?|MO|M|H|D|W)$/.exec(
      word
    );
  if (spoken !== null) {
    return timeframeName(unitOf(spoken[2] as string), spoken[1] as string);
  }
  return null;
}

/** Whether a model's symbol token is gold (or the quote currency of gold). */
function isAllowedSymbol(token: string): boolean {
  const upper = token.trim().toUpperCase();
  return GOLD_TOKEN.test(upper) || upper === QUOTE_CURRENCY;
}

const isAllowedTimeframe = (name: string): boolean =>
  (ALLOWED_TIMEFRAMES as readonly string[]).includes(name);

// ---------------------------------------------------------------------------
// The check
// ---------------------------------------------------------------------------

interface Found {
  kind: 'SYMBOL' | 'TIMEFRAME';
  token: string;
}

/** Everything in a Latin-script text that names another symbol or another timeframe. */
function readText(text: string): { found: Found[]; allowed: Timeframe[] } {
  const upper = text.toUpperCase();
  const found: Found[] = [];
  const allowed = new Set<Timeframe>();

  for (const match of upper.matchAll(PAIR)) {
    const pair = `${match[1] as string}${match[2] as string}`;
    if (!GOLD_TOKEN.test(pair)) found.push({ kind: 'SYMBOL', token: pair });
  }
  for (const match of upper.matchAll(CRYPTO_TICKER)) {
    found.push({ kind: 'SYMBOL', token: match[0] });
  }
  for (const match of upper.matchAll(OTHER_TICKER)) {
    found.push({ kind: 'SYMBOL', token: match[0] });
  }

  const timeframe = (name: string): void => {
    if (isAllowedTimeframe(name)) allowed.add(name as Timeframe);
    else found.push({ kind: 'TIMEFRAME', token: name });
  };
  for (const match of upper.matchAll(MT5_TIMEFRAME)) {
    timeframe(timeframeName(match[1] as string, match[2] as string));
  }
  for (const match of upper.matchAll(SPOKEN_TIMEFRAME)) {
    timeframe(timeframeName(unitOf(match[2] as string), match[1] as string));
  }
  for (const match of upper.matchAll(TIMEFRAME_WORD)) {
    timeframe(WORD_UNIT.get(match[0]) as string);
  }
  return { found, allowed: [...allowed] };
}

/**
 * Everything in a text that is outside the scope, without any model output: the part of the
 * check that can run before the model is called (decision for part 5).
 */
export function scanText(
  text: string,
  source: Extract<ScopeSource, 'TEXT' | 'ENGLISH'> = 'TEXT'
): ScopeReason[] {
  return readText(text).found.map(({ kind, token }) => ({
    kind,
    token,
    source,
  }));
}

export function checkScope(input: ScopeInput): ScopeVerdict {
  const reasons: ScopeReason[] = [];
  const allowed = new Set<Timeframe>();
  const seen = new Set<string>();
  const add = (reason: ScopeReason): void => {
    const key = `${reason.kind}:${reason.token}`;
    if (seen.has(key)) return;
    seen.add(key);
    reasons.push(reason);
  };

  const readSource = (text: string, source: 'TEXT' | 'ENGLISH'): void => {
    const read = readText(text);
    read.allowed.forEach((name) => allowed.add(name));
    read.found.forEach(({ kind, token }) => add({ kind, token, source }));
  };
  readSource(input.text, 'TEXT');
  if (input.english !== undefined) readSource(input.english, 'ENGLISH');

  for (const symbol of input.symbols ?? []) {
    if (!isAllowedSymbol(symbol)) {
      add({
        kind: 'SYMBOL',
        token: symbol.trim().toUpperCase(),
        source: 'MODEL',
      });
    }
  }
  for (const token of input.timeframes ?? []) {
    const name = canonicalTimeframe(token);
    if (name !== null && isAllowedTimeframe(name))
      allowed.add(name as Timeframe);
    else {
      add({
        kind: 'TIMEFRAME',
        token: name ?? token.trim().toUpperCase(),
        source: 'MODEL',
      });
    }
  }
  if (input.intent === 'OUT_OF_SCOPE') {
    add({ kind: 'INTENT', token: 'OUT_OF_SCOPE', source: 'MODEL' });
  }

  if (reasons.length > 0) return { inScope: false, reasons };
  return {
    inScope: true,
    timeframes: ALLOWED_TIMEFRAMES.filter((name) => allowed.has(name)),
  };
}
