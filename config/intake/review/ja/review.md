# Glossary review: Japanese (`ja`)

*Written by `python scripts/intake/glossary_tool.py record`; `check` compares it with a fresh run. Do not edit it.*

Glossary version `1.0.0-draft`. These are DRAFTS until you approve them.

## What to check

1. Is the canonical form the word a trader of this language really uses for the term?
2. Are the other accepted spellings words a trader would also type (a short form, a plural, a verb form)? A question that contains any of them is recognised as containing the term.
3. Does any spelling also mean something else in this language? It would mark an unrelated question.
4. Do the texts below read naturally, say what the English says, and keep each `{name}` placeholder?

## Terms

| # | id | English term | Canonical form | Other accepted spellings |
| --- | --- | --- | --- | --- |
| 1 | `buy` | buy | 買い | 買う · 購入 · ロング |
| 2 | `sell` | sell | 売り | 売る · 売却 · ショート |
| 3 | `stand_aside` | stand aside | 見送り | 様子見 · 静観 |
| 4 | `entry` | entry | エントリー | エントリーポイント · 新規エントリー |
| 5 | `entry_zone` | entry zone | エントリーゾーン | エントリー価格帯 · エントリーエリア |
| 6 | `stop_loss` | stop loss | 損切り | ストップロス · ロスカット |
| 7 | `take_profit` | take profit | 利確 | テイクプロフィット · 利益確定 · 利食い |
| 8 | `target` | target | ターゲット | 目標 · 目標値 · 利益目標 |
| 9 | `lot_size` | lot size | ロットサイズ | ロット · ポジションサイズ · 取引数量 |
| 10 | `leverage` | leverage | レバレッジ | レバ · 証拠金倍率 |
| 11 | `spread` | spread | スプレッド | 買値と売値の差 |
| 12 | `commission` | commission | 手数料 | コミッション · 取引手数料 |
| 13 | `risk` | risk | リスク | 取引ごとのリスク |
| 14 | `risk_reward` | risk-reward ratio | リスクリワード | リスクリワード比 · RRR · 損益比 |
| 15 | `equity` | equity | 資金 | 口座残高 · 有効証拠金 |
| 16 | `margin` | margin | 証拠金 | マージン · 必要証拠金 |
| 17 | `broker` | broker | ブローカー | 証券会社 · 業者 |
| 18 | `stop_distance` | stop distance | 損切り幅 | ストップ幅 · ストップまでの距離 |
| 19 | `reduced_risk` | reduced risk | リスク軽減 | ハーフリスク · リスクを半分に |
| 20 | `gold` | gold | ゴールド | 金相場 · 金価格 |
| 21 | `chart` | chart | チャート | チャート画面 |
| 22 | `timeframe` | timeframe | 時間足 | タイムフレーム · 時間軸 |
| 23 | `candle` | candle | ローソク足 | ローソク · キャンドル |
| 24 | `closed_bar` | closed bar | 確定足 | 終値確定足 · 確定したローソク足 |
| 25 | `trend` | trend | トレンド | 傾向 · 相場の方向 |
| 26 | `uptrend` | uptrend | 上昇トレンド | 上昇傾向 · アップトレンド |
| 27 | `downtrend` | downtrend | 下降トレンド | 下落傾向 · ダウントレンド |
| 28 | `sideways` | sideways | 横ばい | 横這い · もみ合い |
| 29 | `support` | support | サポート | サポートライン · 下値支持線 |
| 30 | `resistance` | resistance | レジスタンス | レジスタンスライン · 上値抵抗線 |
| 31 | `breakout` | breakout | ブレイクアウト | 上抜け · 上放れ |
| 32 | `breakdown` | breakdown | ブレイクダウン | 下抜け · 下放れ |
| 33 | `pullback` | pullback | 押し目 | プルバック · 調整 |
| 34 | `rally` | rally | 反発 | リバウンド · ラリー |
| 35 | `reversal` | reversal | 反転 | トレンド転換 · リバーサル · 転換 |
| 36 | `range` | range | レンジ | レンジ相場 · ボックス圏 |
| 37 | `volatility` | volatility | ボラティリティ | 変動率 · 値動きの大きさ |
| 38 | `momentum` | momentum | モメンタム | 勢い · 相場の勢い |
| 39 | `overbought` | overbought | 買われすぎ | 買われ過ぎ · オーバーボート |
| 40 | `oversold` | oversold | 売られすぎ | 売られ過ぎ · オーバーソールド |
| 41 | `channel` | channel | チャネル | チャネルライン · 回帰チャネル |
| 42 | `corridor` | corridor | コリドー | 回廊 · チャネル帯 |
| 43 | `uoedt` | UOEDT | UOEDT |  |
| 44 | `loedt` | LOEDT | LOEDT |  |
| 45 | `baseline` | baseline | baseline |  |
| 46 | `overextension` | overextension | 行き過ぎ | 過度な伸び · オーバーエクステンション |
| 47 | `reversion` | mean reversion | 平均回帰 | 平均への回帰 · リバージョン |
| 48 | `consolidated` | consolidated | 統合 | 統合トレンド · コンソリデーション |
| 49 | `equilibrium` | equilibrium | 均衡 | 均衡ゾーン · イクイリブリアム |
| 50 | `value_zone` | value zone | バリューゾーン | 割安ゾーン · 下限ゾーン |
| 51 | `premium_zone` | premium zone | プレミアムゾーン | 割高ゾーン · 上限ゾーン |
| 52 | `trend_conflict` | trend conflict | トレンドの対立 | トレンド不一致 · 逆行するトレンド |
| 53 | `stochastic` | stochastic | ストキャスティクス | ストキャスティック |
| 54 | `synthesis` | synthesis | 総合判断 | シンセシス · 統合判定 |
| 55 | `archetype` | archetype | アーキタイプ | 典型パターン · セットアップの型 |
| 56 | `continuation` | trend continuation | トレンド継続 | 継続 · トレンドの継続 |
| 57 | `counter_trend` | counter-trend | 逆張り | 逆行 · カウンタートレンド |
| 58 | `with_trend` | with-trend | 順張り | トレンドフォロー · 順行 |
| 59 | `exhaustion` | exhaustion | 息切れ | 勢いの枯渇 · エグゾースチョン |
| 60 | `snapback` | snapback | スナップバック | 急反転 · 急な戻り |
| 61 | `invalidation` | invalidation | 無効化 | 無効化ライン · シナリオ崩れ |
| 62 | `runway` | runway | 余地 | 次のレベルまでの余地 · 値幅の余裕 |
| 63 | `cautionary` | cautionary | 注意 | 警戒 · 慎重 |
| 64 | `stale` | stale | 古いデータ | データが古い · 更新されていない |
| 65 | `market_closed` | market closed | 市場休場 | 市場クローズ · 取引時間外 |
| 66 | `sensor` | sensor | センサー | センサ · インジケーター |
| 67 | `reading` | reading | 読み取り結果 | 読み値 · リーディング |
| 68 | `news_blackout` | news blackout | ニュースブラックアウト | ニュース前後の制限 · ブラックアウト |
| 69 | `economic_calendar` | economic calendar | 経済指標カレンダー | 経済カレンダー · 経済イベント |
| 70 | `high_impact` | high-impact news | 重要指標 | 高インパクト · 重要ニュース |
| 71 | `inflation` | inflation | インフレ | インフレーション · 物価上昇 |
| 72 | `interest_rate` | interest rate | 金利 | 政策金利 · 利上げ · 利下げ |
| 73 | `us_dollar` | US dollar | 米ドル | ドル · ドルインデックス |

## Fixed replies, instant prompts and reason texts

| Key | English | Japanese |
| --- | --- | --- |
| intake.refusal.not_signed_in | Please sign in to ask the AI analyst. | AIアナリストに質問するにはサインインしてください。 |
| intake.refusal.tier_required | The AI analyst is part of the Pro plan. | AIアナリストはProプランの機能です。 |
| intake.refusal.thread_invalid | This conversation is not available. Start a new one about gold (XAUUSD). | この会話は利用できません。ゴールド（XAUUSD）について新しい会話を始めてください。 |
| intake.refusal.profile_not_set | Confirm your trading profile first. | 先にトレードプロフィールを確認してください。 |
| intake.refusal.quota_insufficient | Your AI analyst allowance is used up for now. Please try again later. | AIアナリストの利用枠は現在使い切っています。しばらくしてからもう一度お試しください。 |
| intake.refusal.feature_unavailable | The AI analyst is not available yet. | AIアナリストはまだご利用いただけません。 |
| intake.refusal.question_empty | Type a question about gold (XAUUSD) first. | まずゴールド（XAUUSD）についての質問を入力してください。 |
| intake.refusal.question_too_long | Your question is too long. Please keep it to {limit} characters or fewer. | 質問が長すぎます。{limit}文字以内にしてください。 |
| intake.refusal.understanding_failed | That question could not be read just now. Please try again. | 質問を読み取れませんでした。もう一度お試しください。 |
| intake.refusal.out_of_scope | This analyst covers gold (XAUUSD) on the M5 and M15 charts only. Ask about those. | このアナリストが対応するのは、M5とM15チャートのゴールド（XAUUSD）だけです。それについて質問してください。 |
| intake.instant.m5 | Explain the current M5 chart | 現在のM5チャートを説明してください |
| intake.instant.m15 | Explain the current M15 chart | 現在のM15チャートを説明してください |
| intake.reason.data_stale | The market data is out of date, so this sensor has no usable reading. | 市場データが古いため、このセンサーには使える読み取り結果がありません。 |
| intake.reason.retuning | The chart indicator is being re-tuned, so this reading is less reliable for now. | チャートのインジケーターを再調整中のため、この読み取り結果は今のところ信頼度が下がります。 |
| intake.reason.no_setting | No indicator setting is available for this timeframe, so this sensor cannot read it. | この時間足にはインジケーターの設定がないため、このセンサーは読み取れません。 |
| intake.reason.detection_mismatch | The indicator found in the data does not match its setting, so treat this reading with caution. | データで見つかったインジケーターが設定と一致しないため、この読み取り結果は注意して扱ってください。 |
| intake.reason.no_stats_at_slot | The statistics for this moment are not available yet, so this reading is out of date. | この時点の統計がまだないため、この読み取り結果は古い状態です。 |
| intake.reason.containment_low | The price is not staying inside the channel well enough for a reliable reading. | 価格がチャネル内に十分にとどまっておらず、信頼できる読み取りができません。 |
| intake.reason.insufficient_bars | There are not enough closed bars yet for a reliable reading. | 信頼できる読み取りに必要な確定足がまだ足りません。 |
| intake.reason.discontinuity | The bars have gaps or are out of order, so this reading cannot be trusted. | ローソク足に欠けや順序の乱れがあるため、この読み取り結果は信頼できません。 |
| intake.reason.sanity_failed | The channel values are impossible, so this reading cannot be trusted. | チャネルの値がありえない値のため、この読み取り結果は信頼できません。 |
| intake.reason.upstream_cautionary | {sensor} is cautionary, so this reading is cautionary too. | {sensor}が要注意のため、この読み取り結果も要注意です。 |
| intake.reason.upstream_unavailable | {sensor} has no valid reading, so this one is unavailable. | {sensor}に有効な読み取り結果がないため、この読み取り結果も利用できません。 |
| intake.reason.upstream_stale | {sensor} is out of date, so this one is too. | {sensor}が古いため、この読み取り結果も古い状態です。 |
| intake.reason.mcd0_defect_m5 | The M5 channel does not fit the price well enough, so readings that use it are cautionary. | M5のチャネルが価格に十分に合っていないため、それを使う読み取り結果は要注意です。 |
| intake.reason.mcd0_defect_m15 | The M15 channel does not fit the price well enough, so readings that use it are cautionary. | M15のチャネルが価格に十分に合っていないため、それを使う読み取り結果は要注意です。 |
| intake.reason.evaluator_error | This sensor hit an unexpected error and has no reading right now. | このセンサーで予期しないエラーが発生し、現在は読み取り結果がありません。 |
| intake.reason.modifier_caution | Another sensor adds caution to this reading: {state}. | 別のセンサーがこの読み取り結果に注意を加えています：{state} |

## Sign-off

Read the tables above, then edit `approval.json` in this folder: set `status` to `APPROVED`, `approved_by` to your name and `approved_on` to the date (YYYY-MM-DD). It holds the SHA-256 of the content you read, so a later change to it puts this area back to PENDING (`python scripts/intake/glossary_tool.py record`). Then run `record` once more so the forms of Japanese are marked `approved` in the glossary.
