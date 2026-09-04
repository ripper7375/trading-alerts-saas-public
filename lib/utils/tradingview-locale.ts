/**
 * TradingView's embedded widgets use their own locale codes, distinct from
 * this app's language codes in a few places (Korean is "kr" not "ko",
 * Chinese is "zh_CN"/"zh_TW" not "zh"/"zh-TW") -- unmapped languages fall
 * back to 'en'. Shared by every TradingView widget embed (Economic Calendar,
 * Ticker Tape) so the mapping can't drift between them.
 */
const TRADINGVIEW_LOCALE_MAP: Record<string, string> = {
  'en-US': 'en',
  'en-GB': 'en',
  ar: 'ar',
  th: 'th',
  de: 'de',
  es: 'es',
  ja: 'ja',
  vi: 'vi',
  id: 'id',
  tr: 'tr',
  ur: 'ar',
  pt: 'pt',
  fr: 'fr',
  ko: 'kr',
  zh: 'zh_CN',
  'zh-TW': 'zh_TW',
};

export function resolveTradingViewLocale(language?: string): string {
  if (!language) return 'en';
  return TRADINGVIEW_LOCALE_MAP[language] ?? 'en';
}
