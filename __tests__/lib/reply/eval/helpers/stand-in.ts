/**
 * The fixture model's replies for the evaluation suite (build step 7 part 10).
 *
 * THIS IS THE STAND-IN. Nothing here is a model. A good reply is a `report1.v1` (or `answer.v1`) the
 * harness writes from the packet: every figure is an id, every chosen zone has its invalidation
 * line, every cite is in the packet, and the sentences are short drafts in the 17 languages.
 * A planted reply is a good one with one thing broken on purpose, so the checks have something to
 * catch. A STAND-IN run made from these replies shows that the mechanism works end to end; it says
 * nothing about what a model would write, and the headlines below are my drafts, read by nobody.
 *
 * The text of the rationale and risk lines is language-neutral on purpose (`MCD2 · MCD2_X`): the
 * stand-in does not pretend to translate a sensor's meaning.
 */

import type { ValueDictionary } from '@/lib/reply/checks/value-dictionary';
import type { IntakePacket, Locale } from '@/lib/reply/contracts/intake';
import { familyOfLocale } from '@/lib/reply/contracts/intake';
import type { AnswerModel } from '@/lib/reply/contracts/answer';
import type { Report1Model } from '@/lib/reply/contracts/report1';
import { badJson, plantLiteral } from '@/lib/reply/gateway/fixture';
import { INVALIDATION_LINES } from '@/lib/reply/report1/invalidation-line';

import { CORPUS } from '../../checks/helpers/corpus';

interface Headlines {
  plain: string;
  ranged: string;
}

/** "Price near {LAST_PRICE}", without and with the day's range, in each language. */
const HEADLINES: Readonly<Record<string, Headlines>> = {
  en: {
    plain: 'Price near {LAST_PRICE}',
    ranged:
      'Price near {LAST_PRICE}, inside the day range {DAY.low} to {DAY.high}',
  },
  es: {
    plain: 'Precio cerca de {LAST_PRICE}',
    ranged:
      'Precio cerca de {LAST_PRICE}, dentro del rango del día de {DAY.low} a {DAY.high}',
  },
  de: {
    plain: 'Preis nahe {LAST_PRICE}',
    ranged:
      'Preis nahe {LAST_PRICE}, innerhalb der Tagesspanne von {DAY.low} bis {DAY.high}',
  },
  pt: {
    plain: 'Preço perto de {LAST_PRICE}',
    ranged:
      'Preço perto de {LAST_PRICE}, dentro da faixa do dia de {DAY.low} a {DAY.high}',
  },
  it: {
    plain: 'Prezzo vicino a {LAST_PRICE}',
    ranged:
      "Prezzo vicino a {LAST_PRICE}, dentro l'intervallo del giorno da {DAY.low} a {DAY.high}",
  },
  ja: {
    plain: '価格は{LAST_PRICE}付近',
    ranged:
      '価格は{LAST_PRICE}付近で、本日の値幅{DAY.low}から{DAY.high}の範囲内',
  },
  ar: {
    plain: 'السعر قرب {LAST_PRICE}',
    ranged: 'السعر قرب {LAST_PRICE} ضمن نطاق اليوم من {DAY.low} إلى {DAY.high}',
  },
  fr: {
    plain: 'Prix proche de {LAST_PRICE}',
    ranged:
      'Prix proche de {LAST_PRICE}, dans la fourchette du jour de {DAY.low} à {DAY.high}',
  },
  ko: {
    plain: '가격은 {LAST_PRICE} 부근',
    ranged:
      '가격은 {LAST_PRICE} 부근이며 오늘의 범위 {DAY.low}에서 {DAY.high} 안에 있다',
  },
  zh: {
    plain: '价格在{LAST_PRICE}附近',
    ranged: '价格在{LAST_PRICE}附近，处于今日区间{DAY.low}至{DAY.high}之内',
  },
  'zh-TW': {
    plain: '價格在{LAST_PRICE}附近',
    ranged: '價格在{LAST_PRICE}附近，處於今日區間{DAY.low}至{DAY.high}之內',
  },
  ur: {
    plain: 'قیمت {LAST_PRICE} کے قریب ہے',
    ranged:
      'قیمت {LAST_PRICE} کے قریب ہے اور آج کی حد {DAY.low} سے {DAY.high} کے اندر ہے',
  },
  hi: {
    plain: 'कीमत {LAST_PRICE} के पास है',
    ranged:
      'कीमत {LAST_PRICE} के पास है और आज की सीमा {DAY.low} से {DAY.high} के भीतर है',
  },
  vi: {
    plain: 'Giá gần {LAST_PRICE}',
    ranged:
      'Giá gần {LAST_PRICE}, trong biên độ ngày từ {DAY.low} đến {DAY.high}',
  },
  id: {
    plain: 'Harga di dekat {LAST_PRICE}',
    ranged:
      'Harga di dekat {LAST_PRICE}, di dalam kisaran hari ini dari {DAY.low} hingga {DAY.high}',
  },
  th: {
    plain: 'ราคาอยู่ใกล้ {LAST_PRICE}',
    ranged:
      'ราคาอยู่ใกล้ {LAST_PRICE} ภายในช่วงราคาของวันตั้งแต่ {DAY.low} ถึง {DAY.high}',
  },
  tr: {
    plain: 'Fiyat {LAST_PRICE} civarında',
    ranged:
      'Fiyat {LAST_PRICE} civarında, günün {DAY.low} ile {DAY.high} aralığında',
  },
};

const NO_PRICE: Readonly<Record<string, string>> = {
  en: 'No price is available for this cycle',
  es: 'No hay precio disponible para este ciclo',
  de: 'Für diesen Zyklus liegt kein Preis vor',
  pt: 'Não há preço disponível para este ciclo',
  it: 'Nessun prezzo disponibile per questo ciclo',
  ja: 'このサイクルには価格がありません',
  ar: 'لا يوجد سعر متاح لهذه الدورة',
  fr: "Aucun prix n'est disponible pour ce cycle",
  ko: '이 주기에는 사용할 수 있는 가격이 없다',
  zh: '本周期没有可用的价格',
  'zh-TW': '本週期沒有可用的價格',
  ur: 'اس دور کے لیے کوئی قیمت دستیاب نہیں',
  hi: 'इस चक्र के लिए कोई कीमत उपलब्ध नहीं है',
  vi: 'Không có giá cho chu kỳ này',
  id: 'Tidak ada harga untuk siklus ini',
  th: 'ไม่มีราคาสำหรับรอบนี้',
  tr: 'Bu döngü için fiyat yok',
};

const languageOf = (locale: Locale): string => familyOfLocale(locale);

/** The invalidation sentence a model would write for a zone, with the placeholders the resolver fills. */
function watchLine(locale: Locale, zoneId: string): string {
  const template =
    INVALIDATION_LINES.lines[languageOf(locale)] ??
    (INVALIDATION_LINES.lines['en'] as string);
  return template
    .split('{price}')
    .join(`{${zoneId}.invalidation}`)
    .split('{zone}')
    .join(zoneId);
}

/** A well-formed `report1.v1` for any golden cycle, in a locale. */
export function standInReport(
  packet: IntakePacket,
  dictionary: ValueDictionary,
  locale: Locale
): Report1Model {
  const language = languageOf(locale);
  const headlines = HEADLINES[language] as Headlines;
  const synthesis = packet.readings.synthesis;
  const zones = (synthesis?.zones ?? []).map((zone) => String(zone['zone_id']));
  const hasLast = dictionary.byId.has('LAST_PRICE');
  const hasDay =
    dictionary.byId.has('DAY.high') && dictionary.byId.has('DAY.low');
  const sensors = packet.board.sensors.filter(
    (line) => line.state_code !== null
  );

  const rationale = sensors.slice(0, 3).map((line) => ({
    text: `${line.mcd_id} · ${line.state_code as string}`,
    cites: [line.mcd_id],
  }));
  if (rationale.length === 0) {
    rationale.push({
      text: 'SYN · ' + (synthesis?.reading['rule_id'] as string),
      cites: ['SYN'],
    });
  }
  const watch = zones.map((zone) => ({
    text: watchLine(locale, zone),
    cites: [zone],
  }));
  if (watch.length === 0) {
    watch.push({
      text: `${sensors[0]?.mcd_id ?? 'SYN'} · ${sensors[0]?.state_code ?? 'NO_MATCH'}`,
      cites: [sensors[0]?.mcd_id ?? 'SYN'],
    });
  }
  return {
    headline: hasLast
      ? hasDay
        ? headlines.ranged
        : headlines.plain
      : ((NO_PRICE[language] ?? NO_PRICE['en']) as string),
    zones,
    rationale,
    watch: watch.slice(0, 4),
    risks: sensors
      .filter((line) => line.status !== 'VALID')
      .slice(0, 2)
      .map((line) => ({
        text: `${line.mcd_id} · ${line.status}`,
        cites: [line.mcd_id],
      })),
  };
}

/** A well-formed `answer.v1`, in a locale: the sensors' state codes, nothing more. */
export function standInAnswer(
  packet: IntakePacket,
  locale: Locale
): AnswerModel {
  const sensors = packet.board.sensors.filter(
    (line) => line.state_code !== null
  );
  const first = sensors[0];
  return {
    locale,
    text:
      first === undefined
        ? 'SYN · NO_MATCH'
        : `${first.mcd_id} · ${first.state_code as string}`,
    cites: [first?.mcd_id ?? 'SYN'],
    action: null,
  };
}

export const asJson = (value: unknown): string => JSON.stringify(value);

// ---------------------------------------------------------------------------
// Planted errors
// ---------------------------------------------------------------------------

/** A price no cycle holds, typed where the model should have written an id. */
export const WRONG_PRICE = '1234.56';

/** A good reply whose headline types a wrong price instead of writing `{LAST_PRICE}`. */
export function withWrongPrice(good: Report1Model): string {
  const text = asJson(good);
  if (text.includes('{LAST_PRICE}')) {
    return plantLiteral(text, '{LAST_PRICE}', WRONG_PRICE);
  }
  // a cycle with no price: plant it in the first rationale line
  return plantLiteral(
    text,
    good.rationale[0]?.text as string,
    `${good.rationale[0]?.text as string} ${WRONG_PRICE}`
  );
}

/** The ADVICE sentence of the planted corpus in a locale's language. */
export function adviceSentence(locale: Locale): string {
  const entry = CORPUS[languageOf(locale)];
  if (entry === undefined) throw new Error(`no planted corpus for ${locale}`);
  return entry.never.ADVICE.bad;
}

/** A good reply with a listed phrase in its first rationale line. */
export function withBannedPhrase(good: Report1Model, locale: Locale): string {
  const first = good.rationale[0] as { text: string; cites: string[] };
  return asJson({
    ...good,
    rationale: [
      { ...first, text: `${first.text}. ${adviceSentence(locale)}` },
      ...good.rationale.slice(1),
    ],
  });
}

/** A good reply cut in half: not JSON. */
export const withBadJson = (good: Report1Model): string =>
  badJson(asJson(good));

/** A good reply that chooses a zone the cycle does not have. */
export function withBadZone(good: Report1Model, unknownZone: string): string {
  return asJson({ ...good, zones: [...good.zones, unknownZone] });
}
