/**
 * The two corpora of build step 7 part 4, written by hand in the 17 languages of the 19 locales.
 *
 *  - PLANTED: for each language and each of the five "never" rows of architecture 5.9, a sentence a
 *    model could write that breaks the row (`bad`) and the same sentence made harmless (`ok`); and
 *    for the direction guard, a headline that names the wrong side for each of the four readings of
 *    the synthesis. The wording check must catch every `bad` and pass every `ok`.
 *  - GOOD: a whole reply (headline, two rationale lines, a watch line, a risk line) in each
 *    language, with `{id}` placeholders, plain trading vocabulary and small counts. The checks must
 *    flag NOTHING in any of them: this is the number that decides whether the checks can be used.
 *
 * The sentences are written to read like a model's output, not copied from the phrase lists, so a
 * list that misses the usual way to say a thing fails here. They are drafts like the lists
 * themselves: a native reader has not read them.
 */

export interface PlantedPair {
  bad: string;
  ok: string;
}

export interface DirectionCase {
  /** a headline that names the short side while the synthesis says LONG */
  longBiasBad: string;
  /** a headline that names the long side while the synthesis says SHORT */
  shortBiasBad: string;
  /** a headline that takes a side while the synthesis says STAND_ASIDE or NEUTRAL */
  standAsideBad: string;
  /** a headline that breaks no rule for any reading */
  ok: string;
}

export interface GoodReply {
  headline: string;
  rationale: [string, string];
  watch: [string];
  risks: [string];
}

export interface LanguageCorpus {
  /** the locales this language's text is written in (en: both, pt: both) */
  locales: string[];
  never: {
    ADVICE: PlantedPair;
    PROBABILITY: PlantedPair;
    GUARANTEE: PlantedPair;
    URGENCY: PlantedPair;
    UNLISTED_NEWS: PlantedPair;
  };
  direction: DirectionCase;
  good: GoodReply;
}

export const CORPUS: Readonly<Record<string, LanguageCorpus>> = {
  en: {
    locales: ['en-US', 'en-GB'],
    never: {
      ADVICE: {
        bad: 'We recommend buying here before the corridor breaks.',
        ok: 'The corridor holds while price stays above the lower edge.',
      },
      PROBABILITY: {
        bad: 'There is a high probability that price reaches the upper edge.',
        ok: 'Price sits between the lower edge and the upper edge.',
      },
      GUARANTEE: {
        bad: 'This setup is guaranteed to reach the target.',
        ok: 'This setup depends on the lower edge holding.',
      },
      URGENCY: {
        bad: 'Act now, because the move will not wait for anyone.',
        ok: 'Wait for a close above the baseline before anything else.',
      },
      UNLISTED_NEWS: {
        bad: 'According to sources, the central bank will cut rates tonight.',
        ok: 'The calendar lists a data release this afternoon.',
      },
    },
    direction: {
      longBiasBad: 'Go short on the next bounce into the corridor',
      shortBiasBad: 'Bullish momentum argues for a long setup here',
      standAsideBad: 'Go long now while price sits in the middle',
      ok: 'No clear setup: price is in the middle of the corridor',
    },
    good: {
      headline: 'Counter-trend rally inside the M5 corridor; M15 still falling',
      rationale: [
        'The M5 channel holds above {MCD2.baseline} with 2 closes in a row.',
        'The M15 channel is bearish, so a short-term rally is against the larger move.',
      ],
      watch: ['A close below {Z1.invalidation} cancels this view.'],
      risks: [
        'Sellers could return after a sell-off, and the long-term trend is down.',
      ],
    },
  },
  es: {
    locales: ['es'],
    never: {
      ADVICE: {
        bad: 'Le recomendamos comprar aquí antes de que se rompa el canal.',
        ok: 'El canal se mantiene mientras el precio siga sobre el borde inferior.',
      },
      PROBABILITY: {
        bad: 'Hay una alta probabilidad de que el precio llegue al borde superior.',
        ok: 'El precio está entre el borde inferior y el borde superior.',
      },
      GUARANTEE: {
        bad: 'Este escenario está garantizado hasta el objetivo.',
        ok: 'Este escenario depende de que el borde inferior aguante.',
      },
      URGENCY: {
        bad: 'Actúa ya, el movimiento no espera a nadie.',
        ok: 'Espera un cierre por encima de la línea base antes de nada.',
      },
      UNLISTED_NEWS: {
        bad: 'Según fuentes, el banco central bajará los tipos esta noche.',
        ok: 'El calendario lista un dato de empleo esta tarde.',
      },
    },
    direction: {
      longBiasBad: 'Ir en corto en el próximo rebote hacia el canal',
      shortBiasBad: 'El impulso alcista apoya una posición larga aquí',
      standAsideBad: 'Comprar aquí ahora mientras el precio está en el medio',
      ok: 'Sin configuración clara: el precio está en el medio del canal',
    },
    good: {
      headline:
        'Rebote contra la tendencia dentro del canal M5; M15 sigue cayendo',
      rationale: [
        'El canal M5 se mantiene sobre {MCD2.baseline} con 2 cierres seguidos.',
        'El canal M15 es bajista, así que el rebote de corto plazo va contra el movimiento mayor.',
      ],
      watch: [
        'Un cierre por debajo de {Z1.invalidation} cancela esta lectura.',
      ],
      risks: [
        'Los vendedores pueden volver tras una caída fuerte y la tendencia de largo plazo es bajista.',
      ],
    },
  },
  de: {
    locales: ['de'],
    never: {
      ADVICE: {
        bad: 'Wir empfehlen, hier zu kaufen, bevor der Kanal bricht.',
        ok: 'Der Kanal hält, solange der Preis über der unteren Kante bleibt.',
      },
      PROBABILITY: {
        bad: 'Mit hoher Wahrscheinlichkeit erreicht der Preis die obere Kante.',
        ok: 'Der Preis liegt zwischen der unteren und der oberen Kante.',
      },
      GUARANTEE: {
        bad: 'Dieses Szenario ist garantiert bis zum Ziel gültig.',
        ok: 'Dieses Szenario hängt davon ab, dass die untere Kante hält.',
      },
      URGENCY: {
        bad: 'Handeln Sie jetzt, die Bewegung wartet auf niemanden.',
        ok: 'Warten Sie auf einen Schlusskurs über der Basislinie.',
      },
      UNLISTED_NEWS: {
        bad: 'Laut Berichten senkt die Zentralbank heute Nacht die Zinsen.',
        ok: 'Der Kalender nennt heute Nachmittag eine Datenveröffentlichung.',
      },
    },
    direction: {
      longBiasBad: 'Beim nächsten Anstieg short gehen und den Kanal verlassen',
      shortBiasBad: 'Bullisches Momentum spricht hier für ein Long Setup',
      standAsideBad: 'Jetzt long gehen, obwohl der Preis in der Mitte liegt',
      ok: 'Kein klares Setup: Der Preis liegt in der Mitte des Kanals',
    },
    good: {
      headline: 'Gegentrend-Anstieg im M5-Kanal; M15 fällt weiter',
      rationale: [
        'Der M5-Kanal hält sich über {MCD2.baseline} mit 2 Schlusskursen in Folge.',
        'Der M15-Kanal ist bärisch, daher läuft der kurzfristige Anstieg gegen die größere Bewegung.',
      ],
      watch: ['Ein Schlusskurs unter {Z1.invalidation} hebt diese Sicht auf.'],
      risks: [
        'Verkäufer können nach einem Ausverkauf zurückkehren, und der langfristige Trend zeigt nach unten.',
      ],
    },
  },
  pt: {
    locales: ['pt', 'pt-BR'],
    never: {
      ADVICE: {
        bad: 'Recomendamos comprar aqui antes que o canal se rompa.',
        ok: 'O canal se mantém enquanto o preço ficar acima da borda inferior.',
      },
      PROBABILITY: {
        bad: 'Há uma alta probabilidade de o preço chegar à borda superior.',
        ok: 'O preço está entre a borda inferior e a borda superior.',
      },
      GUARANTEE: {
        bad: 'Este cenário é garantido até o alvo.',
        ok: 'Este cenário depende de a borda inferior aguentar.',
      },
      URGENCY: {
        bad: 'Aja agora, o movimento não espera ninguém.',
        ok: 'Espere um fechamento acima da linha base antes de tudo.',
      },
      UNLISTED_NEWS: {
        bad: 'Segundo fontes, o banco central vai cortar os juros esta noite.',
        ok: 'O calendário lista um dado de emprego esta tarde.',
      },
    },
    direction: {
      longBiasBad: 'Entrar vendido na próxima alta até o canal',
      shortBiasBad: 'O impulso altista favorece uma posição comprada aqui',
      standAsideBad: 'Comprar aqui agora enquanto o preço está no meio',
      ok: 'Sem configuração clara: o preço está no meio do canal',
    },
    good: {
      headline: 'Alta contra a tendência dentro do canal M5; M15 segue caindo',
      rationale: [
        'O canal M5 se mantém acima de {MCD2.baseline} com 2 fechamentos seguidos.',
        'O canal M15 é baixista, então a alta de curto prazo vai contra o movimento maior.',
      ],
      watch: [
        'Um fechamento abaixo de {Z1.invalidation} cancela esta leitura.',
      ],
      risks: [
        'Os vendedores podem voltar depois de uma queda forte e a tendência de longo prazo é de baixa.',
      ],
    },
  },
  it: {
    locales: ['it'],
    never: {
      ADVICE: {
        bad: 'Ti consigliamo di comprare qui prima che il canale si rompa.',
        ok: 'Il canale regge finché il prezzo resta sopra il bordo inferiore.',
      },
      PROBABILITY: {
        bad: "C'è un'alta probabilità che il prezzo raggiunga il bordo superiore.",
        ok: 'Il prezzo si trova tra il bordo inferiore e il bordo superiore.',
      },
      GUARANTEE: {
        bad: "Questo scenario è garantito fino all'obiettivo.",
        ok: 'Questo scenario dipende dalla tenuta del bordo inferiore.',
      },
      URGENCY: {
        bad: 'Agisci subito, il movimento non aspetta nessuno.',
        ok: 'Attendi una chiusura sopra la linea base prima di tutto.',
      },
      UNLISTED_NEWS: {
        bad: 'Secondo fonti, la banca centrale taglierà i tassi stanotte.',
        ok: "Il calendario elenca un dato sull'occupazione nel pomeriggio.",
      },
    },
    direction: {
      longBiasBad: 'Andare short sul prossimo rimbalzo verso il canale',
      shortBiasBad: 'Lo slancio rialzista sostiene un setup di acquisto qui',
      standAsideBad: 'Comprare qui adesso mentre il prezzo è a metà canale',
      ok: 'Nessun setup chiaro: il prezzo è a metà del canale',
    },
    good: {
      headline:
        'Rimbalzo contro tendenza dentro il canale M5; M15 ancora in calo',
      rationale: [
        'Il canale M5 tiene sopra {MCD2.baseline} con 2 chiusure di fila.',
        'Il canale M15 è ribassista, quindi il rimbalzo di breve periodo va contro il movimento maggiore.',
      ],
      watch: ['Una chiusura sotto {Z1.invalidation} annulla questa lettura.'],
      risks: [
        'I venditori possono tornare dopo una forte discesa e il trend di lungo periodo è al ribasso.',
      ],
    },
  },
  ja: {
    locales: ['ja'],
    never: {
      ADVICE: {
        bad: 'チャネルが崩れる前にここで買うことをおすすめします。',
        ok: '価格が下限の上にある限り、チャネルは維持されます。',
      },
      PROBABILITY: {
        bad: '価格が上限に届く確率は高いです。',
        ok: '価格は下限と上限の間にあります。',
      },
      GUARANTEE: {
        bad: 'このシナリオは目標まで保証されています。',
        ok: 'このシナリオは下限が維持されるかどうかにかかっています。',
      },
      URGENCY: {
        bad: '今すぐ動いてください。相場は誰も待ちません。',
        ok: 'まず基準線の上での終値を待ちます。',
      },
      UNLISTED_NEWS: {
        bad: '報道によると、中央銀行は今夜利下げする見込みです。',
        ok: 'カレンダーには午後に指標発表が載っています。',
      },
    },
    direction: {
      longBiasBad: '次の戻りでショートで入る',
      shortBiasBad: '強気の勢いがここでのロング優勢を支えている',
      standAsideBad: '価格が中間にあるのに今ロングエントリーする',
      ok: '明確な形はなく、価格はチャネルの中間にある',
    },
    good: {
      headline: 'M5チャネル内の逆トレンドの上昇。M15はまだ下落中',
      rationale: [
        'M5チャネルは{MCD2.baseline}の上で維持され、2本連続で終値が上にある。',
        'M15チャネルは下向きなので、短期の上昇は大きな動きに逆らっている。',
      ],
      watch: ['{Z1.invalidation}を下回る終値でこの見方は無効になる。'],
      risks: [
        '急落のあとに売り手が戻る可能性があり、長期の流れは下向きである。',
      ],
    },
  },
  ar: {
    locales: ['ar'],
    never: {
      ADVICE: {
        bad: 'نوصيك بالشراء هنا قبل أن تنكسر القناة.',
        ok: 'تبقى القناة قائمة ما دام السعر فوق الحد السفلي.',
      },
      PROBABILITY: {
        bad: 'هناك احتمال كبير أن يصل السعر إلى الحد العلوي.',
        ok: 'يقع السعر بين الحد السفلي والحد العلوي.',
      },
      GUARANTEE: {
        bad: 'هذا السيناريو مضمون حتى الهدف.',
        ok: 'يعتمد هذا السيناريو على ثبات الحد السفلي.',
      },
      URGENCY: {
        bad: 'تصرف الآن فالحركة لا تنتظر أحدا.',
        ok: 'انتظر إغلاقا فوق خط الأساس قبل أي شيء.',
      },
      UNLISTED_NEWS: {
        bad: 'وفقا لمصادر سيخفض البنك المركزي الفائدة الليلة.',
        ok: 'يعرض التقويم بيانات اقتصادية هذا المساء.',
      },
    },
    direction: {
      longBiasBad: 'ادخل بيع عند الارتداد القادم نحو القناة',
      shortBiasBad: 'الزخم الصعودي يدعم إشارة شراء هنا',
      standAsideBad: 'اشتر هنا الآن بينما السعر في المنتصف',
      ok: 'لا توجد صورة واضحة: السعر في منتصف القناة',
    },
    good: {
      headline: 'ارتفاع عكس الاتجاه داخل قناة M5 بينما M15 ما زالت تهبط',
      rationale: [
        'تبقى قناة M5 فوق {MCD2.baseline} مع إغلاقين متتاليين.',
        'قناة M15 هابطة، لذلك يسير الارتفاع القصير ضد الحركة الأكبر.',
      ],
      watch: ['إغلاق تحت {Z1.invalidation} يلغي هذه القراءة.'],
      risks: ['قد يعود البائعون بعد هبوط حاد والاتجاه الطويل هابط.'],
    },
  },
  fr: {
    locales: ['fr'],
    never: {
      ADVICE: {
        bad: "Nous recommandons d'acheter ici avant la cassure du canal.",
        ok: 'Le canal tient tant que le prix reste au-dessus du bord inférieur.',
      },
      PROBABILITY: {
        bad: 'Il y a une forte probabilité que le prix atteigne le bord supérieur.',
        ok: 'Le prix se trouve entre le bord inférieur et le bord supérieur.',
      },
      GUARANTEE: {
        bad: "Ce scénario est garanti jusqu'à l'objectif.",
        ok: 'Ce scénario dépend de la tenue du bord inférieur.',
      },
      URGENCY: {
        bad: "Agissez maintenant, le mouvement n'attend personne.",
        ok: 'Attendez une clôture au-dessus de la ligne de base avant tout.',
      },
      UNLISTED_NEWS: {
        bad: 'Selon des sources, la banque centrale baissera ses taux cette nuit.',
        ok: 'Le calendrier indique une publication de données cet après-midi.',
      },
    },
    direction: {
      longBiasBad: 'Passer short sur le prochain rebond vers le canal',
      shortBiasBad: "L'élan haussier appuie une position longue ici",
      standAsideBad: 'Acheter ici maintenant alors que le prix est au milieu',
      ok: 'Pas de configuration claire : le prix est au milieu du canal',
    },
    good: {
      headline:
        'Rebond contre la tendance dans le canal M5 ; M15 continue de baisser',
      rationale: [
        'Le canal M5 tient au-dessus de {MCD2.baseline} avec 2 clôtures de suite.',
        'Le canal M15 est baissier, donc le rebond de court terme va contre le mouvement plus large.',
      ],
      watch: ['Une clôture sous {Z1.invalidation} annule cette lecture.'],
      risks: [
        'Les vendeurs peuvent revenir après une forte baisse et la tendance de long terme est baissière.',
      ],
    },
  },
  ko: {
    locales: ['ko'],
    never: {
      ADVICE: {
        bad: '채널이 깨지기 전에 여기서 매수하시기를 추천합니다.',
        ok: '가격이 하단 위에 머무는 동안 채널은 유지됩니다.',
      },
      PROBABILITY: {
        bad: '가격이 상단에 도달할 확률이 높습니다.',
        ok: '가격은 하단과 상단 사이에 있습니다.',
      },
      GUARANTEE: {
        bad: '이 시나리오는 목표까지 보장됩니다.',
        ok: '이 시나리오는 하단이 유지되는지에 달려 있습니다.',
      },
      URGENCY: {
        bad: '지금 바로 움직이세요. 시장은 아무도 기다리지 않습니다.',
        ok: '먼저 기준선 위에서의 종가를 기다립니다.',
      },
      UNLISTED_NEWS: {
        bad: '보도에 따르면 중앙은행이 오늘 밤 금리를 내릴 예정입니다.',
        ok: '캘린더에는 오후에 지표 발표가 올라와 있습니다.',
      },
    },
    direction: {
      longBiasBad: '다음 반등에서 숏으로 진입한다',
      shortBiasBad: '강세 흐름이 여기서의 롱 우위를 뒷받침한다',
      standAsideBad: '가격이 중간에 있는데 지금 롱 진입한다',
      ok: '뚜렷한 형태가 없고 가격은 채널 중간에 있다',
    },
    good: {
      headline: 'M5 채널 안의 추세 역행 상승; M15는 여전히 하락 중',
      rationale: [
        'M5 채널은 {MCD2.baseline} 위에서 유지되며 2번 연속 종가가 위에 있다.',
        'M15 채널은 아래를 향하므로 단기 상승은 더 큰 움직임에 역행한다.',
      ],
      watch: ['{Z1.invalidation} 아래 종가는 이 시각을 무효로 만든다.'],
      risks: [
        '급락 뒤에 매도 세력이 돌아올 수 있고 장기 흐름은 아래를 향한다.',
      ],
    },
  },
  zh: {
    locales: ['zh'],
    never: {
      ADVICE: {
        bad: '我们建议在通道被突破之前在此买入。',
        ok: '只要价格留在下沿之上，通道就保持有效。',
      },
      PROBABILITY: {
        bad: '价格到达上沿的概率很高。',
        ok: '价格处在下沿与上沿之间。',
      },
      GUARANTEE: {
        bad: '这个情景在目标之前是有保证的。',
        ok: '这个情景取决于下沿能否守住。',
      },
      URGENCY: {
        bad: '立即行动，行情不会等任何人。',
        ok: '先等待收盘价站上基准线。',
      },
      UNLISTED_NEWS: {
        bad: '据报道，央行今晚将会降息。',
        ok: '日历显示下午有一项数据公布。',
      },
    },
    direction: {
      longBiasBad: '下一次反弹时入场做空',
      shortBiasBad: '看涨的动能支持这里的做多信号',
      standAsideBad: '价格在中间位置却现在做多',
      ok: '没有清晰的形态，价格处在通道中间',
    },
    good: {
      headline: 'M5通道内的逆势反弹；M15仍在下跌',
      rationale: [
        'M5通道守在{MCD2.baseline}之上，连续2根收盘价在其上方。',
        'M15通道向下，所以短期反弹是在逆着更大的走势。',
      ],
      watch: ['收盘价跌破{Z1.invalidation}会使这一判断失效。'],
      risks: ['急跌之后卖方可能回来，长期走势向下。'],
    },
  },
  'zh-TW': {
    locales: ['zh-TW'],
    never: {
      ADVICE: {
        bad: '我們建議在通道被突破之前在此買入。',
        ok: '只要價格留在下沿之上，通道就保持有效。',
      },
      PROBABILITY: {
        bad: '價格到達上沿的機率很高。',
        ok: '價格處在下沿與上沿之間。',
      },
      GUARANTEE: {
        bad: '這個情境在目標之前是有保證的。',
        ok: '這個情境取決於下沿能否守住。',
      },
      URGENCY: {
        bad: '立即行動，行情不會等任何人。',
        ok: '先等待收盤價站上基準線。',
      },
      UNLISTED_NEWS: {
        bad: '據報導，央行今晚將會降息。',
        ok: '日曆顯示下午有一項數據公布。',
      },
    },
    direction: {
      longBiasBad: '下一次反彈時入場做空',
      shortBiasBad: '看漲的動能支持這裡的做多訊號',
      standAsideBad: '價格在中間位置卻現在做多',
      ok: '沒有清晰的形態，價格處在通道中間',
    },
    good: {
      headline: 'M5通道內的逆勢反彈；M15仍在下跌',
      rationale: [
        'M5通道守在{MCD2.baseline}之上，連續2根收盤價在其上方。',
        'M15通道向下，所以短期反彈是在逆著更大的走勢。',
      ],
      watch: ['收盤價跌破{Z1.invalidation}會使這一判斷失效。'],
      risks: ['急跌之後賣方可能回來，長期走勢向下。'],
    },
  },
  ur: {
    locales: ['ur'],
    never: {
      ADVICE: {
        bad: 'ہم سفارش کرتے ہیں کہ چینل ٹوٹنے سے پہلے یہاں خریدیں۔',
        ok: 'جب تک قیمت نچلی حد کے اوپر رہے چینل قائم رہتا ہے۔',
      },
      PROBABILITY: {
        bad: 'قیمت کے بالائی حد تک پہنچنے کا امکان بہت زیادہ ہے۔',
        ok: 'قیمت نچلی حد اور بالائی حد کے درمیان ہے۔',
      },
      GUARANTEE: {
        bad: 'یہ منظرنامہ ہدف تک گارنٹی شدہ ہے۔',
        ok: 'یہ منظرنامہ اس پر منحصر ہے کہ نچلی حد قائم رہے۔',
      },
      URGENCY: {
        bad: 'ابھی عمل کریں، مارکیٹ کسی کا انتظار نہیں کرتی۔',
        ok: 'پہلے بنیادی لکیر کے اوپر بند ہونے کا انتظار کریں۔',
      },
      UNLISTED_NEWS: {
        bad: 'ذرائع کے مطابق مرکزی بینک آج رات شرح سود کم کرے گا۔',
        ok: 'کیلنڈر میں آج دوپہر ایک ڈیٹا ریلیز درج ہے۔',
      },
    },
    direction: {
      longBiasBad: 'اگلی اچھال پر شارٹ میں داخل ہوں',
      shortBiasBad: 'تیزی کا رجحان یہاں لانگ پوزیشن کی حمایت کرتا ہے',
      standAsideBad: 'قیمت درمیان میں ہے مگر ابھی لانگ لیں',
      ok: 'کوئی واضح صورت نہیں، قیمت چینل کے درمیان ہے',
    },
    good: {
      headline: 'M5 چینل کے اندر رجحان کے خلاف اچھال؛ M15 ابھی بھی گر رہا ہے',
      rationale: [
        'M5 چینل {MCD2.baseline} کے اوپر قائم ہے اور 2 مسلسل بند اس کے اوپر ہیں۔',
        'M15 چینل نیچے کی طرف ہے اس لیے مختصر مدت کا اچھال بڑی حرکت کے خلاف ہے۔',
      ],
      watch: [
        '{Z1.invalidation} کے نیچے بند ہونا اس نقطہ نظر کو ختم کر دیتا ہے۔',
      ],
      risks: [
        'تیز گراوٹ کے بعد بیچنے والے لوٹ سکتے ہیں اور طویل مدت کا رجحان نیچے ہے۔',
      ],
    },
  },
  hi: {
    locales: ['hi'],
    never: {
      ADVICE: {
        bad: 'हमारी सलाह है कि चैनल टूटने से पहले यहाँ खरीदें।',
        ok: 'जब तक कीमत निचली सीमा के ऊपर रहती है चैनल बना रहता है।',
      },
      PROBABILITY: {
        bad: 'कीमत के ऊपरी सीमा तक पहुँचने की संभावना बहुत ज़्यादा है।',
        ok: 'कीमत निचली सीमा और ऊपरी सीमा के बीच है।',
      },
      GUARANTEE: {
        bad: 'यह परिदृश्य लक्ष्य तक गारंटी वाला है।',
        ok: 'यह परिदृश्य इस पर निर्भर है कि निचली सीमा टिकी रहे।',
      },
      URGENCY: {
        bad: 'अभी खरीदें, बाज़ार किसी का इंतज़ार नहीं करता।',
        ok: 'पहले आधार रेखा के ऊपर क्लोज़ का इंतज़ार करें।',
      },
      UNLISTED_NEWS: {
        bad: 'सूत्रों के अनुसार केंद्रीय बैंक आज रात दरें घटाएगा।',
        ok: 'कैलेंडर में आज दोपहर एक डेटा रिलीज़ दर्ज है।',
      },
    },
    direction: {
      longBiasBad: 'अगले उछाल पर शॉर्ट में एंट्री लें',
      shortBiasBad: 'बुलिश गति यहाँ लॉन्ग सेटअप का समर्थन करती है',
      standAsideBad: 'कीमत बीच में है फिर भी अभी लॉन्ग लें',
      ok: 'कोई साफ़ सेटअप नहीं, कीमत चैनल के बीच में है',
    },
    good: {
      headline: 'M5 चैनल के भीतर रुझान के विपरीत उछाल; M15 अभी भी गिर रहा है',
      rationale: [
        'M5 चैनल {MCD2.baseline} के ऊपर टिका है और लगातार 2 क्लोज़ इसके ऊपर हैं।',
        'M15 चैनल नीचे की ओर है इसलिए छोटी अवधि का उछाल बड़ी चाल के विपरीत है।',
      ],
      watch: ['{Z1.invalidation} के नीचे क्लोज़ इस नज़रिए को रद्द कर देता है।'],
      risks: [
        'तेज़ गिरावट के बाद बिकवाल लौट सकते हैं और लंबी अवधि का रुझान नीचे है।',
      ],
    },
  },
  vi: {
    locales: ['vi'],
    never: {
      ADVICE: {
        bad: 'Chúng tôi khuyên bạn mua ở đây trước khi kênh bị phá vỡ.',
        ok: 'Kênh vẫn giữ miễn là giá còn nằm trên cạnh dưới.',
      },
      PROBABILITY: {
        bad: 'Xác suất giá chạm cạnh trên là rất cao.',
        ok: 'Giá nằm giữa cạnh dưới và cạnh trên.',
      },
      GUARANTEE: {
        bad: 'Kịch bản này được đảm bảo đến mục tiêu.',
        ok: 'Kịch bản này phụ thuộc vào việc cạnh dưới giữ vững.',
      },
      URGENCY: {
        bad: 'Hành động ngay, thị trường không chờ ai.',
        ok: 'Hãy chờ một nến đóng cửa trên đường cơ sở trước đã.',
      },
      UNLISTED_NEWS: {
        bad: 'Theo nguồn tin, ngân hàng trung ương sẽ giảm lãi suất tối nay.',
        ok: 'Lịch có một số liệu được công bố vào chiều nay.',
      },
    },
    direction: {
      longBiasBad: 'Vào lệnh bán ở nhịp hồi tiếp theo về phía kênh',
      shortBiasBad: 'Đà bullish ủng hộ thiết lập mua ở đây',
      standAsideBad: 'Mua tại đây ngay bây giờ khi giá đang ở giữa',
      ok: 'Chưa có thiết lập rõ ràng, giá đang ở giữa kênh',
    },
    good: {
      headline: 'Nhịp hồi ngược xu hướng trong kênh M5; M15 vẫn đang giảm',
      rationale: [
        'Kênh M5 giữ trên {MCD2.baseline} với 2 nến đóng cửa liên tiếp.',
        'Kênh M15 đang đi xuống, nên nhịp hồi ngắn hạn đi ngược chuyển động lớn hơn.',
      ],
      watch: [
        'Một nến đóng cửa dưới {Z1.invalidation} làm vô hiệu nhận định này.',
      ],
      risks: [
        'Phe bán có thể quay lại sau một đợt giảm mạnh và xu hướng dài hạn đang đi xuống.',
      ],
    },
  },
  id: {
    locales: ['id'],
    never: {
      ADVICE: {
        bad: 'Kami merekomendasikan membeli di sini sebelum kanal patah.',
        ok: 'Kanal bertahan selama harga tetap di atas batas bawah.',
      },
      PROBABILITY: {
        bad: 'Ada probabilitas tinggi harga mencapai batas atas.',
        ok: 'Harga berada di antara batas bawah dan batas atas.',
      },
      GUARANTEE: {
        bad: 'Skenario ini dijamin sampai target.',
        ok: 'Skenario ini bergantung pada batas bawah yang bertahan.',
      },
      URGENCY: {
        bad: 'Bertindak sekarang, pasar tidak menunggu siapa pun.',
        ok: 'Tunggu penutupan di atas garis dasar lebih dulu.',
      },
      UNLISTED_NEWS: {
        bad: 'Menurut sumber, bank sentral akan memangkas suku bunga malam ini.',
        ok: 'Kalender mencantumkan rilis data sore ini.',
      },
    },
    direction: {
      longBiasBad: 'Masuk short pada pantulan berikutnya menuju kanal',
      shortBiasBad: 'Momentum bullish mendukung setup beli di sini',
      standAsideBad: 'Beli di sini sekarang padahal harga di tengah',
      ok: 'Belum ada setup yang jelas, harga di tengah kanal',
    },
    good: {
      headline: 'Reli melawan tren di dalam kanal M5; M15 masih turun',
      rationale: [
        'Kanal M5 bertahan di atas {MCD2.baseline} dengan 2 penutupan berturut-turut.',
        'Kanal M15 menurun, jadi reli jangka pendek melawan gerakan yang lebih besar.',
      ],
      watch: [
        'Penutupan di bawah {Z1.invalidation} membatalkan pandangan ini.',
      ],
      risks: [
        'Penjual bisa kembali setelah penurunan tajam dan tren jangka panjang menurun.',
      ],
    },
  },
  th: {
    locales: ['th'],
    never: {
      ADVICE: {
        bad: 'เราแนะนำให้ซื้อตรงนี้ก่อนที่ช่องราคาจะแตก',
        ok: 'ช่องราคายังอยู่ตราบเท่าที่ราคายังอยู่เหนือขอบล่าง',
      },
      PROBABILITY: {
        bad: 'ความน่าจะเป็นที่ราคาจะถึงขอบบนนั้นสูงมาก',
        ok: 'ราคาอยู่ระหว่างขอบล่างและขอบบน',
      },
      GUARANTEE: {
        bad: 'สถานการณ์นี้รับประกันถึงเป้าหมาย',
        ok: 'สถานการณ์นี้ขึ้นอยู่กับว่าขอบล่างจะยืนได้หรือไม่',
      },
      URGENCY: {
        bad: 'ซื้อเดี๋ยวนี้ ตลาดไม่รอใคร',
        ok: 'รอการปิดเหนือเส้นฐานก่อน',
      },
      UNLISTED_NEWS: {
        bad: 'ตามแหล่งข่าว ธนาคารกลางจะลดอัตราดอกเบี้ยคืนนี้',
        ok: 'ปฏิทินแสดงการประกาศข้อมูลช่วงบ่ายนี้',
      },
    },
    direction: {
      longBiasBad: 'เข้าชอร์ตเมื่อราคาเด้งครั้งถัดไป',
      shortBiasBad: 'โมเมนตัมบูลลิชสนับสนุนสัญญาณซื้อตรงนี้',
      standAsideBad: 'เปิดสถานะซื้อตอนนี้ทั้งที่ราคาอยู่ตรงกลาง',
      ok: 'ยังไม่มีรูปแบบที่ชัดเจน ราคาอยู่กลางช่อง',
    },
    good: {
      headline: 'การเด้งสวนแนวโน้มในช่อง M5 ส่วน M15 ยังลดลงอยู่',
      rationale: [
        'ช่อง M5 ยืนอยู่เหนือ {MCD2.baseline} โดยปิดต่อเนื่อง 2 แท่ง',
        'ช่อง M15 ลาดลง ดังนั้นการเด้งระยะสั้นสวนกับการเคลื่อนไหวที่ใหญ่กว่า',
      ],
      watch: ['การปิดต่ำกว่า {Z1.invalidation} ทำให้มุมมองนี้ใช้ไม่ได้'],
      risks: ['ผู้ขายอาจกลับมาหลังการลงแรงและแนวโน้มระยะยาวชี้ลง'],
    },
  },
  tr: {
    locales: ['tr'],
    never: {
      ADVICE: {
        bad: 'Kanal kırılmadan önce burada almanızı tavsiye ederiz.',
        ok: 'Fiyat alt kenarın üzerinde kaldığı sürece kanal geçerlidir.',
      },
      PROBABILITY: {
        bad: 'Fiyatın üst kenara ulaşma olasılığı çok yüksek.',
        ok: 'Fiyat alt kenar ile üst kenar arasında.',
      },
      GUARANTEE: {
        bad: 'Bu senaryo hedefe kadar garanti edilmiştir.',
        ok: 'Bu senaryo alt kenarın tutmasına bağlıdır.',
      },
      URGENCY: {
        bad: 'Hemen harekete geçin, piyasa kimseyi beklemez.',
        ok: 'Önce taban çizgisinin üzerinde bir kapanış bekleyin.',
      },
      UNLISTED_NEWS: {
        bad: 'Kaynaklara göre merkez bankası bu gece faizi indirecek.',
        ok: 'Takvimde bu öğleden sonra bir veri açıklaması var.',
      },
    },
    direction: {
      longBiasBad: 'Bir sonraki tepkide short pozisyon aç',
      shortBiasBad: 'Bullish ivme burada bir long kurulumu destekliyor',
      standAsideBad: 'Fiyat ortadayken şimdi long aç',
      ok: 'Net bir kurulum yok, fiyat kanalın ortasında',
    },
    good: {
      headline: 'M5 kanalı içinde trende karşı yükseliş; M15 hâlâ düşüyor',
      rationale: [
        'M5 kanalı {MCD2.baseline} üzerinde tutunuyor ve üst üste 2 kapanış var.',
        'M15 kanalı aşağı eğimli, bu yüzden kısa vadeli yükseliş daha büyük hareketin tersine.',
      ],
      watch: [
        '{Z1.invalidation} altında bir kapanış bu görüşü geçersiz kılar.',
      ],
      risks: [
        'Sert düşüşten sonra satıcılar geri dönebilir ve uzun vadeli trend aşağı.',
      ],
    },
  },
};

export const CORPUS_LANGUAGES = Object.keys(CORPUS);

/** Every locale with the corpus of its language: the 19 cases. */
export const CORPUS_LOCALES: readonly { locale: string; language: string }[] =
  CORPUS_LANGUAGES.flatMap((language) =>
    (CORPUS[language] as LanguageCorpus).locales.map((locale) => ({
      locale,
      language,
    }))
  );
