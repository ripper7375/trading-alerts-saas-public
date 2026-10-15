/**
 * Sample text in the reply's own language for the development preview (build step 7 part 8).
 *
 * The recorded replies are in English, because the fixture model that made them writes English. A
 * reader of Arabic, German or Thai gets a reply written in their language, with prices inside it, and
 * that is where the layout can break: a price inside right-to-left text, a long German compound that
 * must wrap at 320 px, Thai with no spaces between words. So for those three the preview swaps the
 * model's WORDS for drafts of mine, written around the same engine figures, in the number style of the
 * language (the server's `NUMBER_STYLES`), isolated for direction the way the server isolates them.
 *
 * They are layout samples, not translations anyone has read. The preview says so on the page. Nothing
 * else of a reply changes: the direction, the levels, the zones, the stamp and the codes are the
 * recorded server answer.
 */

import { LRI, PDI, formatPrice } from '@/components/chat/format';
import type {
  IntakeRefusal,
  Locale,
  ReplyResult,
  ResolvedLine,
} from '@/components/chat/types';
import { INTAKE_TEXT, REFUSAL_TEXT_KEY } from '@/lib/intake/text';

interface Sample {
  headline: string;
  lines: string[];
  answer: string;
}

const SAMPLES: Readonly<Record<string, (n: (v: number) => string) => Sample>> =
  {
    ar: (n) => ({
      headline: `السعر قرب ${n(4331.58)} داخل نطاق اليوم من ${n(4310.91)} إلى ${n(4331.58)}`,
      lines: [
        `يبقى السعر أعلى قاعدة M5 عند ${n(4318.2)} بينما ما زال M15 هابطًا`,
        `إغلاق أسفل ${n(4350.42)} يلغي هذه القراءة`,
        `المساحة إلى المستوى التالي أقل من مسافة الوقف`,
        `تحذير: خبر عالي التأثير عند 13:30`,
      ],
      answer: `أقرب مستوى فوق السعر هو ${n(4350.42)} والمساحة إليه أقصر من مسافة الوقف، لذلك لا يفتح الإعداد إلا بوقف أبعد.`,
    }),
    de: (n) => ({
      headline: `Preis nahe ${n(4331.58)} innerhalb der Tagesspanne ${n(4310.91)} bis ${n(4331.58)}`,
      lines: [
        `Der Kurs hält sich über der M5-Basis bei ${n(4318.2)}, während M15 weiter fällt`,
        `Ein Schlusskurs unter ${n(4350.42)} hebt dieses Bild auf`,
        `Der Spielraum bis zum nächsten Niveau ist kleiner als der Stopp-Abstand`,
        `Vorsicht: eine Veröffentlichung mit hoher Wirkung um 13:30`,
      ],
      answer: `Das nächste Niveau über dem Kurs liegt bei ${n(4350.42)}; der Spielraum dorthin ist kürzer als der Stopp, daher ist ein weiterer Stopp nötig.`,
    }),
    th: (n) => ({
      headline: `ราคาใกล้ ${n(4331.58)} ภายในกรอบของวันตั้งแต่ ${n(4310.91)} ถึง ${n(4331.58)}`,
      lines: [
        `ราคายังอยู่เหนือฐาน M5 ที่ ${n(4318.2)} ขณะที่ M15 ยังคงลดลง`,
        `การปิดต่ำกว่า ${n(4350.42)} จะยกเลิกมุมมองนี้`,
        `พื้นที่ไปยังระดับถัดไปน้อยกว่าระยะหยุดขาดทุน`,
        `ระวัง: มีข่าวผลกระทบสูงเวลา 13:30`,
      ],
      answer: `ระดับถัดไปเหนือราคาคือ ${n(4350.42)} และพื้นที่ไปถึงสั้นกว่าระยะหยุดขาดทุน จึงต้องใช้จุดหยุดที่ไกลขึ้น`,
    }),
  };

/** The languages the preview has sample text for. */
export const SAMPLE_LANGUAGES: readonly string[] = Object.keys(SAMPLES);

const isolated = (language: string) => (value: number) => {
  const text = formatPrice(value, language);
  return language === 'ar' ? `${LRI}${text}${PDI}` : text;
};

function reline(
  lines: readonly ResolvedLine[],
  texts: string[]
): ResolvedLine[] {
  return lines.map((line, index) => ({
    ...line,
    text: texts[index % texts.length] as string,
  }));
}

/** The reply with its words swapped for the sample of `language`; the reply as it is for any other. */
export function localizeResult(
  result: ReplyResult,
  language: string
): ReplyResult {
  const make = SAMPLES[language];
  if (make === undefined) return result;
  const sample = make(isolated(language));
  const reply_locale = language as Locale;
  switch (result.kind) {
    case 'REPORT1':
      return {
        ...result,
        reply_locale,
        report: {
          ...result.report,
          headline: sample.headline,
          alignment: {
            ...result.report.alignment,
            lines: reline(
              result.report.alignment.lines,
              sample.lines.slice(0, 2)
            ),
          },
          watch: reline(result.report.watch, sample.lines.slice(1, 2)),
          risks: reline(result.report.risks, sample.lines.slice(2)),
        },
      };
    case 'ANSWER':
      return {
        ...result,
        reply_locale,
        answer: { ...result.answer, text: sample.answer },
      };
    default:
      return { ...result, reply_locale };
  }
}

/**
 * The server's fixed reply to a refusal, in the language of the interface. The server writes it from
 * the same ten texts the interface dictionaries carry (the `intake.refusal.*` keys), so the preview
 * reads it from the dictionary instead of keeping the recorded English.
 */
export function localizeRefusal(
  refusal: IntakeRefusal,
  language: string,
  t: (key: string, fallback?: string) => string
): IntakeRefusal {
  const key = REFUSAL_TEXT_KEY[refusal.code];
  return {
    ...refusal,
    reply_locale: language as Locale,
    reply: t(key, INTAKE_TEXT[key]),
  };
}
