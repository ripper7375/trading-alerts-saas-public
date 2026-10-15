/**
 * @jest-environment node
 */

import {
  checkDirection,
  checkWording,
  emptyCategoryCounts,
  guardedWords,
  missingInvalidationLines,
  phraseOccurs,
  roleOfPath,
} from '@/lib/reply/checks/wording-check';
import type { ModelText, TextRole } from '@/lib/reply/checks/wording-check';
import { foldForMatching, WORDING } from '@/lib/reply/checks/wording-lists';
import type { MatchMode, Phrase } from '@/lib/reply/checks/wording-lists';
import { BIASES } from '@/lib/reply/contracts/intake';
import type { Bias } from '@/lib/reply/contracts/intake';
import { WORDING_CATEGORIES } from '@/lib/reply/contracts/trace-fields';

const phrase = (
  text: string,
  mode: MatchMode = 'word',
  except: string[] = [],
  language = 'en'
): Phrase => ({
  source: text,
  text: foldForMatching(text, language),
  mode,
  except: except.map((e) => foldForMatching(e, language)),
});

const occurs = (text: string, entry: Phrase, language = 'en'): boolean =>
  phraseOccurs(foldForMatching(text, language), entry);

describe('phraseOccurs', () => {
  describe('word', () => {
    const risk = phrase('risk free');
    it.each([
      ['it is risk free', true],
      ['risk free', true],
      ['Risk-Free!', true],
      ['(risk free)', true],
      ['risk free.', true],
      ['not risk freedom', false],
      ['a brisk free', false],
      ['risk freedom', false],
      ['riskfree', false],
      ['risk  free', true],
      ['risk free', true],
      ['risk free2', false],
      ['2risk free', false],
      ['unrisk free', false],
    ])('%j: %s', (text, expected) => {
      expect(occurs(text, risk)).toBe(expected);
    });

    it('finds the occurrence after one that fails the boundary', () => {
      expect(occurs('a brisk free day, then risk free', risk)).toBe(true);
      expect(occurs('xrisk free xrisk free', risk)).toBe(false);
    });

    it('does not read beyond the end of the text', () => {
      expect(occurs('risk', risk)).toBe(false);
      expect(occurs('', risk)).toBe(false);
      expect(occurs('free', risk)).toBe(false);
    });
  });

  describe('prefix', () => {
    const recommend = phrase('recommend', 'prefix');
    it.each([
      ['we recommend it', true],
      ['recommended', true],
      ['recommendation', true],
      ['recommends', true],
      ['Recommend', true],
      ['unrecommended', false],
      ['a,recommended', true],
      ['xrecommend', false],
      ['recommend2', true],
      ['1recommend', false],
    ])('%j: %s', (text, expected) => {
      expect(occurs(text, recommend)).toBe(expected);
    });
  });

  describe('substring', () => {
    const empfehl = phrase('empfehl', 'substring', [], 'de');
    it.each([
      ['Wir empfehlen', true],
      ['Kaufempfehlung', true],
      ['empfehl', true],
      ['Empfehlung', true],
      ['empfeh', false],
    ])('%j: %s', (text, expected) => {
      expect(occurs(text, empfehl, 'de')).toBe(expected);
    });
  });

  describe('letters that are not Latin', () => {
    it('bounds a word of Arabic, Hindi and Thai by the letters around it, marks included', () => {
      const advice = phrase('सलाह', 'word', [], 'hi');
      expect(occurs('यह मेरी सलाह है', advice, 'hi')).toBe(true);
      expect(occurs('सलाहकार', advice, 'hi')).toBe(false);
      expect(occurs('उसलाह', advice, 'hi')).toBe(false);
      const arabic = phrase('ضمان', 'word', [], 'ar');
      expect(occurs('هذا ضمان', arabic, 'ar')).toBe(true);
      expect(occurs('الضمان', arabic, 'ar')).toBe(false);
      const thai = phrase('รับประกัน', 'substring', [], 'th');
      expect(occurs('เรารับประกันผล', thai, 'th')).toBe(true);
    });

    it('does not bound a Chinese or Japanese substring', () => {
      const zh = phrase('稳赚', 'substring', [], 'zh');
      expect(occurs('这是稳赚的单', zh, 'zh')).toBe(true);
      const ja = phrase('保証', 'substring', [], 'ja');
      expect(occurs('結果は保証されます', ja, 'ja')).toBe(true);
    });

    it('treats a letter outside the basic plane as a letter', () => {
      const astral = String.fromCodePoint(0x1d42b); // mathematical bold r
      const word = phrase('risk free');
      // the folded text keeps the astral letter, so it is a neighbour that is a letter
      expect(phraseOccurs(`${astral}isk free`, phrase('isk free'))).toBe(false);
      expect(phraseOccurs(`${astral} risk free`, word)).toBe(true);
    });
  });

  describe('exceptions', () => {
    const sell = phrase('sell', 'word', ['sell off', 'sell-off']);
    it('does not count a match inside an exception', () => {
      expect(occurs('a sell off is coming', sell)).toBe(false);
      expect(occurs('a sell-off is coming', sell)).toBe(false);
      expect(occurs('sell here', sell)).toBe(true);
    });

    it('counts the match outside it when the text has both', () => {
      expect(occurs('a sell off, then sell here', sell)).toBe(true);
    });

    it('lines the exception up on the match, wherever the phrase sits in it', () => {
      const long = phrase('long', 'word', ['long term', 'a long term plan']);
      expect(occurs('a long term plan', long)).toBe(false);
      expect(occurs('a long position', long)).toBe(true);
      const twice = phrase('go', 'word', ['go go go']);
      expect(occurs('go go go', twice)).toBe(false);
      expect(occurs('go go', twice)).toBe(true);
    });
  });
});

describe('roleOfPath', () => {
  it.each([
    ['headline', 'HEADLINE'],
    ['rationale[0].text', 'RATIONALE'],
    ['rationale[5].text', 'RATIONALE'],
    ['watch[1].text', 'WATCH'],
    ['risks[2].text', 'RISKS'],
    ['text', 'ANSWER'],
    ['', 'ANSWER'],
  ])('%j is %s', (path, role) => {
    expect(roleOfPath(path)).toBe(role);
  });
});

describe('checkWording', () => {
  const at = (text: string, path = 'rationale[0].text'): ModelText[] => [
    { path, text },
  ];

  it('passes a text with none of the phrases', () => {
    const result = checkWording(
      at('Price holds above the baseline.'),
      'en-US',
      'LONG'
    );
    expect(result).toMatchObject({
      ok: true,
      violations: 0,
      findings: [],
      languages: ['en'],
      unsupportedLocale: false,
    });
    expect(result.categories).toEqual(emptyCategoryCounts());
  });

  it.each([
    ['ADVICE', 'We recommend that you wait.'],
    ['ADVICE', 'You should buy at the open.'],
    ['PROBABILITY', 'A high probability of a break.'],
    ['PROBABILITY', 'This is a grade A setup.'],
    ['GUARANTEE', 'A guaranteed target.'],
    ['GUARANTEE', 'This is risk-free.'],
    ['URGENCY', "Don't miss this."],
    ['URGENCY', 'Act now!'],
    ['UNLISTED_NEWS', 'Breaking news from the central bank.'],
    ['UNLISTED_NEWS', 'Rumours say a cut is coming.'],
  ] as const)('finds %s in %j', (category, text) => {
    const result = checkWording(at(text), 'en-US', 'LONG');
    expect(result.ok).toBe(false);
    expect(result.categories[category]).toBe(1);
    expect(result.findings[0]).toMatchObject({
      category,
      path: 'rationale[0].text',
      language: 'en',
    });
  });

  it('finds a phrase through case, hyphens, apostrophes and invisible characters', () => {
    for (const text of [
      'RISK-FREE',
      'risk‑free',
      're​com​mend this',
      "DON'T MISS",
      'dont miss',
      'Don’t   Miss',
    ]) {
      expect({ text, ok: checkWording(at(text), 'en-US', null).ok }).toEqual({
        text,
        ok: false,
      });
    }
  });

  it('counts a category once for a text, however many of its phrases it holds, and a concept once', () => {
    const result = checkWording(
      at(
        'We recommend it, I recommend it, my advice is to wait, you should buy'
      ),
      'en-US',
      'LONG'
    );
    expect(result.categories.ADVICE).toBe(3);
    expect(result.findings.map((f) => f.concept).sort()).toEqual([
      'advise',
      'recommend',
      'should_act',
    ]);
    expect(result.violations).toBe(3);
  });

  it('counts the same category in two texts twice', () => {
    const result = checkWording(
      [
        { path: 'headline', text: 'Risk free.' },
        { path: 'rationale[0].text', text: 'Also risk free.' },
      ],
      'en-US',
      'LONG'
    );
    expect(result.categories.GUARANTEE).toBe(2);
    expect(result.findings.map((f) => f.path)).toEqual([
      'headline',
      'rationale[0].text',
    ]);
  });

  it('adds up: the categories sum to the violations, and the keys are the six of the trace', () => {
    const result = checkWording(
      at(
        'We recommend a risk free grade A trade, act now, breaking news says a 100% accurate rally'
      ),
      'en-US',
      'SHORT'
    );
    expect(Object.keys(result.categories).sort()).toEqual(
      [...WORDING_CATEGORIES].sort()
    );
    expect(Object.values(result.categories).reduce((a, b) => a + b, 0)).toBe(
      result.violations
    );
    expect(result.violations).toBeGreaterThanOrEqual(5);
  });

  it('reads the language of the locale and English too', () => {
    const german = checkWording(
      at('Das ist garantiert und risk free.'),
      'de',
      'LONG'
    );
    expect(german.languages).toEqual(['de', 'en']);
    expect(german.findings.map((f) => f.language).sort()).toEqual(['de', 'en']);
    const english = checkWording(at('Das ist garantiert.'), 'en-US', 'LONG');
    expect(english.ok).toBe(true);
  });

  it('merges a phrase both lists find into one finding', () => {
    const result = checkWording(
      at('bullish momentum and a risk free trade'),
      'de',
      'SHORT'
    );
    const keys = result.findings.map(
      (f) => `${f.path}|${f.category}|${f.concept}`
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('reads only English for a value that is not one of the 19 locales', () => {
    const result = checkWording(at('This is risk free.'), 'xx', 'LONG');
    expect(result.unsupportedLocale).toBe(true);
    expect(result.languages).toEqual(['en']);
    expect(result.ok).toBe(false);
  });

  it('keeps the phrase the list holds, not the words of the text', () => {
    const result = checkWording(at('RECOMMENDED strongly'), 'en-US', null);
    expect(result.findings[0]?.phrase).toBe('recommend*');
  });

  it('does not mistake a harmless word for a phrase', () => {
    for (const text of [
      'The short-term rally meets a long-term trend.',
      'A sell-off could follow the release.',
      'Conditions are not recommended for new sizing questions.'.replace(
        'recommended',
        'ideal'
      ),
      'The probability of the corridor holding is not published.'.replace(
        'probability',
        'state'
      ),
      'Buyers and sellers are balanced.',
      'The advisory board did not meet.',
      'He is a guardian of the level.',
    ]) {
      expect({ text, ok: checkWording(at(text), 'en-US', 'LONG').ok }).toEqual({
        text,
        ok: true,
      });
    }
  });
});

describe('the direction guard', () => {
  const NAMES: Record<TextRole, string> = {
    HEADLINE: 'headline',
    RATIONALE: 'rationale[0].text',
    WATCH: 'watch[0].text',
    RISKS: 'risks[0].text',
    ANSWER: 'text',
  };
  const at = (role: TextRole, text: string): ModelText[] => [
    { path: NAMES[role], text },
  ];
  const violates = (role: TextRole, text: string, bias: Bias | null): boolean =>
    checkDirection(at(role, text), 'en-US', bias).length > 0;

  describe('with a LONG synthesis', () => {
    it.each([
      ['HEADLINE', 'Bearish drift into the close', true],
      ['HEADLINE', 'A short setup on the bounce', true],
      ['HEADLINE', 'Go short on the next bounce', true],
      ['HEADLINE', 'Bullish momentum builds', false],
      ['HEADLINE', 'A long setup on the dip', false],
      ['HEADLINE', 'Go long on the dip', false],
      ['RATIONALE', 'The M15 channel is bearish', false],
      ['RATIONALE', 'A short setup forms on M15', true],
      ['RATIONALE', 'Sell the rally here', true],
      ['RATIONALE', 'A long position is the reading', false],
      ['WATCH', 'A close below the level turns this bearish', false],
      ['WATCH', 'Go short only after a close below the level', false],
      ['RISKS', 'A short setup could develop', false],
      ['ANSWER', 'Go short here', true],
      ['ANSWER', 'A short setup is possible', false],
      ['ANSWER', 'The M15 channel is bearish', false],
    ] as const)('%s: %j violates: %s', (role, text, expected) => {
      expect(violates(role, text, 'LONG')).toBe(expected);
    });
  });

  describe('with a SHORT synthesis', () => {
    it.each([
      ['HEADLINE', 'Bullish momentum builds', true],
      ['HEADLINE', 'A long setup on the dip', true],
      ['HEADLINE', 'Go long on the dip', true],
      ['HEADLINE', 'Bearish drift into the close', false],
      ['HEADLINE', 'Go short on the bounce', false],
      ['RATIONALE', 'The M15 channel is bullish', false],
      ['RATIONALE', 'A long bias on M15', true],
      ['WATCH', 'A close above the level turns this bullish', false],
      ['RISKS', 'A long setup could develop', false],
      ['ANSWER', 'Buy here', true],
    ] as const)('%s: %j violates: %s', (role, text, expected) => {
      expect(violates(role, text, 'SHORT')).toBe(expected);
    });
  });

  describe.each(['NEUTRAL', 'STAND_ASIDE', null] as const)(
    'with a %s synthesis',
    (bias) => {
      it.each([
        ['HEADLINE', 'Go long now', true],
        ['HEADLINE', 'Go short now', true],
        ['HEADLINE', 'Buy here', true],
        ['HEADLINE', 'Sell the rally', true],
        ['RATIONALE', 'Enter long at the open', true],
        ['ANSWER', 'Open a short', true],
        ['HEADLINE', 'No clear long setup or short setup, stand aside', false],
        ['HEADLINE', 'Bullish and bearish signals cancel out', false],
        ['HEADLINE', 'Price sits in the middle of the corridor', false],
        ['WATCH', 'Go long only after a close above the level', false],
        ['RISKS', 'Sell the rally is a crowded idea', false],
      ] as const)('%s: %j violates: %s', (role, text, expected) => {
        expect(violates(role, text, bias)).toBe(expected);
      });
    }
  );

  it('reports the finding as a direction word with the side and the tier', () => {
    const [found] = checkDirection(
      at('HEADLINE', 'Go short on the bounce'),
      'en-US',
      'LONG'
    );
    expect(found).toMatchObject({
      path: 'headline',
      category: 'DIRECTION_WORD',
      concept: 'short.stance',
      phrase: 'go short',
      language: 'en',
    });
    const [view] = checkDirection(
      at('HEADLINE', 'A bearish tone'),
      'en-US',
      'LONG'
    );
    expect(view?.concept).toBe('short.view');
    const [label] = checkDirection(
      at('HEADLINE', 'A short setup'),
      'en-US',
      'LONG'
    );
    expect(label?.concept).toBe('short.label');
  });

  it('reads the language of the reply and English', () => {
    expect(
      checkDirection(at('HEADLINE', 'Ir en corto en el rebote'), 'es', 'LONG')
    ).toHaveLength(1);
    expect(
      checkDirection(
        at('HEADLINE', 'Ir en corto en el rebote'),
        'en-US',
        'LONG'
      )
    ).toHaveLength(0);
    expect(
      checkDirection(at('HEADLINE', 'Ir en corto, go short'), 'es', 'LONG')
        .map((f) => f.language)
        .sort()
    ).toEqual(['en', 'es']);
  });

  it('is part of the wording check, as the sixth category', () => {
    const result = checkWording(
      at('HEADLINE', 'Go short on the bounce'),
      'en-US',
      'LONG'
    );
    expect(result.categories.DIRECTION_WORD).toBe(1);
    expect(result.violations).toBe(1);
  });

  describe('guardedWords', () => {
    it('holds nothing for the watch and risk lines, whatever the reading', () => {
      for (const bias of [...BIASES, null]) {
        expect(guardedWords('WATCH', bias)).toEqual([]);
        expect(guardedWords('RISKS', bias)).toEqual([]);
      }
    });

    it('holds the opposite side, by role, with a side-taking reading', () => {
      expect(guardedWords('HEADLINE', 'LONG')).toEqual([
        { side: 'short', tier: 'stance' },
        { side: 'short', tier: 'label' },
        { side: 'short', tier: 'view' },
      ]);
      expect(guardedWords('RATIONALE', 'LONG')).toEqual([
        { side: 'short', tier: 'stance' },
        { side: 'short', tier: 'label' },
      ]);
      expect(guardedWords('ANSWER', 'SHORT')).toEqual([
        { side: 'long', tier: 'stance' },
      ]);
      expect(guardedWords('HEADLINE', 'SHORT')[0]?.side).toBe('long');
    });

    it('holds the stance of both sides with a reading that takes none', () => {
      for (const bias of ['NEUTRAL', 'STAND_ASIDE', null] as const) {
        for (const role of ['HEADLINE', 'RATIONALE', 'ANSWER'] as const) {
          expect(guardedWords(role, bias)).toEqual([
            { side: 'long', tier: 'stance' },
            { side: 'short', tier: 'stance' },
          ]);
        }
      }
    });
  });
});

describe('missingInvalidationLines (decision D12)', () => {
  const line = (text: string) => ({ text, cites: [] as string[] });

  it('names the chosen zones that no watch line gives the invalidation of', () => {
    expect(
      missingInvalidationLines(
        ['Z1', 'Z2'],
        [line('A close below {Z1.invalidation} cancels this view')]
      )
    ).toEqual(['Z2']);
    expect(missingInvalidationLines(['Z1', 'Z2'], [])).toEqual(['Z1', 'Z2']);
  });

  it('is satisfied by the placeholder in any watch line, in any language', () => {
    expect(
      missingInvalidationLines(
        ['Z1', 'Z2'],
        [
          line('Ein Schlusskurs unter {Z1.invalidation} hebt dies auf'),
          line('{Z2.invalidation} 以下收盘则失效'),
        ]
      )
    ).toEqual([]);
  });

  it('needs the invalidation, not any value of the zone', () => {
    expect(
      missingInvalidationLines(
        ['Z1'],
        [line('The zone spans {Z1.low} to {Z1.high}, reference {Z1.reference}')]
      )
    ).toEqual(['Z1']);
  });

  it('asks nothing when no zone was chosen', () => {
    expect(missingInvalidationLines([], [])).toEqual([]);
  });

  it('does not take a zone name in plain text for the placeholder', () => {
    expect(
      missingInvalidationLines(['Z1'], [line('Z1.invalidation is the line')])
    ).toEqual(['Z1']);
    expect(
      missingInvalidationLines(['Z1'], [line('{Z1.invalidation')])
    ).toEqual(['Z1']);
    expect(
      missingInvalidationLines(['Z1'], [line('{ Z1.invalidation }')])
    ).toEqual(['Z1']);
  });
});

describe('every language is read as it is written', () => {
  it('finds an English phrase the reply was not asked to avoid in any of the 19 locales', () => {
    for (const locale of ['en-US', 'es', 'de', 'ja', 'ar', 'zh-TW', 'th']) {
      const result = checkWording(
        [{ path: 'text', text: 'This is risk-free.' }],
        locale,
        null
      );
      expect({ locale, ok: result.ok }).toEqual({ locale, ok: false });
    }
  });

  it('holds a set of languages in the wording that the test can name', () => {
    expect(Object.keys(WORDING.languages)).toHaveLength(17);
  });
});

describe('letters outside the basic plane and lone surrogates, at the edges', () => {
  const hit = (before: string): boolean =>
    phraseOccurs(before + 'isk free', phrase('isk free'));

  it('treats a letter or a digit written with a pair of surrogates as part of the word', () => {
    expect(hit(String.fromCodePoint(0x1d42b))).toBe(false); // a letter, low surrogate in the middle
    expect(hit(String.fromCodePoint(0x10000))).toBe(false); // a letter whose low surrogate is the first of the range
    expect(hit(String.fromCodePoint(0x1d7ff))).toBe(false); // a digit whose low surrogate is the last of the range
    expect(hit(String.fromCodePoint(0x1f600))).toBe(true); // an emoji is not a letter
    expect(hit(String.fromCodePoint(0x1f600) + ' ')).toBe(true);
  });

  it('treats a lone surrogate as no letter, and does not borrow the letter before it', () => {
    expect(hit('x' + String.fromCharCode(0xdbff))).toBe(true);
    expect(hit('x' + String.fromCharCode(0xdc00))).toBe(true);
    expect(hit(String.fromCharCode(0xdc00))).toBe(true);
    expect(hit(String.fromCharCode(0xdfff))).toBe(true);
    expect(
      phraseOccurs(
        'risk free' + String.fromCharCode(0xd800),
        phrase('risk free')
      )
    ).toBe(true);
    expect(
      phraseOccurs(
        'risk free' + String.fromCodePoint(0x1d42b),
        phrase('risk free')
      )
    ).toBe(false);
    expect(
      phraseOccurs(
        'risk free' + String.fromCodePoint(0x1f600),
        phrase('risk free')
      )
    ).toBe(true);
  });

  it('reads the start and the end of the text as a boundary', () => {
    expect(phraseOccurs('risk free', phrase('risk free'))).toBe(true);
    expect(phraseOccurs('', phrase('risk free'))).toBe(false);
  });
});

describe('exceptions, offset by offset', () => {
  it('does not let an exception that sits earlier in the text than the match hide it', () => {
    const sell = phrase('sell', 'word', ['a sell off']);
    expect(phraseOccurs('sell off a sell off', sell)).toBe(true);
    expect(phraseOccurs('a sell off', sell)).toBe(false);
    expect(phraseOccurs('sell here a sell off', sell)).toBe(true);
  });

  it('finds the exception whichever occurrence of the phrase inside it the match is', () => {
    const go = phrase('go', 'word', ['go go go']);
    expect(phraseOccurs('go go go', go)).toBe(false);
    expect(phraseOccurs('x go go go', go)).toBe(false);
    expect(phraseOccurs('go go go x go', go)).toBe(true);
    const twice = phrase('go', 'substring', ['xgo go']);
    expect(phraseOccurs('xgo go', twice)).toBe(false);
  });

  it('finds a phrase after an occurrence that fails the boundary, wherever it is', () => {
    const risk = phrase('risk');
    expect(phraseOccurs('brisk risk', risk)).toBe(true);
    expect(phraseOccurs('brisk brisk', risk)).toBe(false);
    expect(phraseOccurs('xrisk riskx risk', risk)).toBe(true);
    const aa = phrase('aa', 'prefix');
    expect(phraseOccurs('baaa aa', aa)).toBe(true);
    expect(phraseOccurs('baaa', aa)).toBe(false);
  });

  it('reads a watch line twice over without a second finding for the same concept', () => {
    const result = checkWording(
      [{ path: 'headline', text: 'bullish and bullish momentum' }],
      'de',
      'SHORT'
    );
    const keys = result.findings.map(
      (f) => f.path + '|' + f.category + '|' + f.concept
    );
    expect(keys).toEqual(['headline|DIRECTION_WORD|long.view']);
    const both = checkWording(
      [{ path: 'headline', text: 'bullisch und bullish' }],
      'de',
      'SHORT'
    );
    expect(both.findings).toHaveLength(1);
    expect(both.languages).toEqual(['de', 'en']);
  });
});

describe('an exception whose copies of the phrase overlap', () => {
  it('covers the occurrence at every offset of the phrase inside the exception', () => {
    const aa = phrase('aa', 'substring', ['baaa']);
    expect(phraseOccurs('baaa', aa)).toBe(false);
    expect(phraseOccurs('baaa b', aa)).toBe(false);
    expect(phraseOccurs('baaaa', aa)).toBe(true);
  });

  it('reaches the second copy of the phrase inside the exception when the first copy lies before the text it is searched from', () => {
    // 'aaaa' holds 'aa' at 0 and 2; the search jumps from the first to the second, which only the exception's
    // copy one letter on (offset 1 of 'aaa') covers
    const aa = phrase('aa', 'substring', ['aaa']);
    expect(phraseOccurs('aaaa', aa)).toBe(false);
    expect(phraseOccurs('aaaab', aa)).toBe(false);
    expect(phraseOccurs('baaaa', aa)).toBe(false);
    expect(phraseOccurs('aaaaa', aa)).toBe(false);
    expect(phraseOccurs('aaaaaa', aa)).toBe(false);
    expect(phraseOccurs('aab', aa)).toBe(true);
  });
});
