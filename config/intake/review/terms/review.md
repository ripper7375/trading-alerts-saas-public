# Glossary review: the English term list

*Written by `python scripts/intake/glossary_tool.py record`; `check` compares it with a fresh run. Do not edit it.*

Glossary `glossary/1`, version `1.0.0-draft`: **73 terms**, of which 3 are never translated.

## What to check

1. Is each term one a gold trader would meet in a question about the chart, and is anything missing?
2. Is the one-sentence definition true, and in plain words?
3. Is the owner right? It is the sensor or the domain whose explanation the Explain intent fetches for the term.
4. Are the level names (UOEDT, LOEDT, baseline) the only terms that are never translated?
5. Are the other English wordings words a trader might leave in a translated question? The term-preservation check accepts them as the English term.

## Owners

| Owner | Meaning |
| --- | --- |
| D1 | domain D1, foundations (the chart, the channel, the data) |
| D4 | domain D4, the trade setup and sizing (Engine 4) |
| D5 | domain D5, governance and the words of data status |
| MCD1 | sensor MCD1 (M15 primary trend), explained by its playbook |
| MCD2 | sensor MCD2 (M5 trend and corridor), explained by its playbook |
| MCD3 | sensor MCD3 (consolidated trend and stochastic), explained by its playbook |
| SYN | the synthesis reading |

## The terms

| # | id | English term | Definition | Owners | Never translated | Other English wordings |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `buy` | buy | To open a position that gains when the price rises. | SYN |  | buys, buying, bought, long |
| 2 | `sell` | sell | To open a position that gains when the price falls. | SYN |  | sells, selling, sold, short |
| 3 | `stand_aside` | stand aside | To take no trade because the readings do not support one. | SYN |  | stand-aside, standing aside, sit out, stay out |
| 4 | `entry` | entry | The price at which a trade is opened. | D4 |  | entries, entry point, enter, entering |
| 5 | `entry_zone` | entry zone | A price band where entering the trade makes sense, built from the sensors' levels. | SYN |  | entry zones, entry area, zone |
| 6 | `stop_loss` | stop loss | The price at which a losing trade is closed to limit the loss. | D4 |  | stop-loss, stoploss, stop, stop losses |
| 7 | `take_profit` | take profit | The price at which a winning trade is closed to take the gain. | D4 |  | take-profit, takeprofit, take profits, tp |
| 8 | `target` | target | The price a trade aims to reach. | D4 |  | targets, price target, profit target |
| 9 | `lot_size` | lot size | How many lots a trade uses: the size of the position. | D4 |  | lot, lots, position size, lot sizes |
| 10 | `leverage` | leverage | How many times the account's money a position can control. | D4 |  | leveraged, gearing |
| 11 | `spread` | spread | The gap between the buying price and the selling price, which is a cost of every trade. | D4 |  | spreads, bid-ask spread, bid ask spread |
| 12 | `commission` | commission | The fee a broker charges for a trade. | D4 |  | commissions, fee, fees |
| 13 | `risk` | risk | How much of the account a trade can lose. | D4 |  | risks, risk per trade, risking |
| 14 | `risk_reward` | risk-reward ratio | How much a trade aims to gain for each unit it risks. | D4 |  | risk reward ratio, reward-to-risk, rrr, r:r, risk/reward |
| 15 | `equity` | equity | The money in the trader's account, from which the risk of a trade is taken. | D4 |  | account balance, balance, account size |
| 16 | `margin` | margin | The money a broker holds as security for a leveraged position. | D4 |  | margins, margin requirement |
| 17 | `broker` | broker | The company through which the trader places trades. | D5 |  | brokers, brokerage |
| 18 | `stop_distance` | stop distance | How far the stop loss is from the entry price. | D4 |  | stop-loss distance, distance to the stop, stop size |
| 19 | `reduced_risk` | reduced risk | Trading with less risk than usual, which Engine 4 proposes when a reading carries caution. | D4 |  | half risk, half-risk, lower risk, smaller size |
| 20 | `gold` | gold | The instrument DavinTrade covers: gold priced in US dollars (XAUUSD). | D1 |  | xau, xauusd |
| 21 | `chart` | chart | The picture of price over time that the trader looks at. | D1 |  | charts, graph, candlestick chart |
| 22 | `timeframe` | timeframe | The length of time one bar of the chart covers, such as M5 or M15. | D1 |  | time frame, timeframes, time frames |
| 23 | `candle` | candle | One bar of the chart with its open, high, low and close. | D1 |  | candles, candlestick, candlesticks, bar, bars |
| 24 | `closed_bar` | closed bar | A candle whose time is over, so its close can no longer change. | D1 |  | closed candle, last closed bar, closed bars, closed candles |
| 25 | `trend` | trend | The general direction the price has been moving over the period being looked at. | MCD1, MCD2, MCD3 |  | trends, trending |
| 26 | `uptrend` | uptrend | A trend in which the price is rising. | MCD1, MCD2 |  | up trend, upward trend, bullish trend, rising trend |
| 27 | `downtrend` | downtrend | A trend in which the price is falling. | MCD1, MCD2 |  | down trend, downward trend, bearish trend, falling trend |
| 28 | `sideways` | sideways | A flat trend: the price moves neither up nor down overall. | MCD1, MCD2, MCD3 |  | ranging, flat, range-bound, sideways market |
| 29 | `support` | support | A price level where falling prices have tended to stop. | SYN |  | support level, supports, floor |
| 30 | `resistance` | resistance | A price level where rising prices have tended to stop. | SYN |  | resistance level, resistances, ceiling |
| 31 | `breakout` | breakout | A move of the price out of its range or corridor upward. | MCD1 |  | break out, breaks out, breaking out, broke out, breakouts |
| 32 | `breakdown` | breakdown | A move of the price out of its range or corridor downward. | MCD1 |  | break down, breaks down, breaking down, broke down, breakdowns |
| 33 | `pullback` | pullback | A short move against the trend before the trend continues. | MCD2 |  | pull back, retracement, retrace, dip |
| 34 | `rally` | rally | A strong rise in the price, often a bounce inside a downtrend. | MCD2 |  | rallies, bounce, bounces, relief rally |
| 35 | `reversal` | reversal | A change of the trend from one direction to the other. | SYN |  | reverse, reverses, reversing, turnaround, trend reversal |
| 36 | `range` | range | A band inside which the price moves back and forth without a trend. | SYN |  | trading range, ranges, ranging |
| 37 | `volatility` | volatility | How much and how fast the price moves. | D1 |  | volatile, volatilities |
| 38 | `momentum` | momentum | The speed and strength with which the price is moving. | MCD3 |  | momentum indicator |
| 39 | `overbought` | overbought | A state in which the price has risen so far, so fast, that a pause or fall becomes more likely. | MCD3 |  | over-bought |
| 40 | `oversold` | oversold | A state in which the price has fallen so far, so fast, that a pause or rise becomes more likely. | MCD3 |  | over-sold |
| 41 | `channel` | channel | The sloping band around the price that the chart indicator draws, which the sensors read. | MCD1, MCD2, MCD3 |  | channels, regression channel, price channel |
| 42 | `corridor` | corridor | The band between the lower and the upper edge of a channel. | MCD1, MCD2, MCD3 |  | corridors, channel band, band |
| 43 | `uoedt` | UOEDT | The upper edge of the corridor of the active EDT channel, a level name that is never translated. | MCD1, MCD2, MCD3 | yes |  |
| 44 | `loedt` | LOEDT | The lower edge of the corridor of the active EDT channel, a level name that is never translated. | MCD1, MCD2, MCD3 | yes |  |
| 45 | `baseline` | baseline | The middle line of the active EDT channel, a level name that is never translated. | MCD1, MCD2, MCD3 | yes |  |
| 46 | `overextension` | overextension | A move of the price so far beyond its corridor that it tends to be pulled back. | MCD2 |  | overextended, over-extension, stretched |
| 47 | `reversion` | mean reversion | The tendency of a stretched price to return toward its average. | MCD2 |  | reversion, revert, reverts, reverting |
| 48 | `consolidated` | consolidated | Said of a trend that the M15 and M5 channels share: they slope the same way and the M5 corridor sits inside the M15 corridor. | MCD3 |  | consolidation, consolidating, consolidated trend |
| 49 | `equilibrium` | equilibrium | The middle of the corridor, where the price is neither cheap nor expensive within it. | MCD3 |  | equilibrium zone, balance, fair value, mid zone |
| 50 | `value_zone` | value zone | The lower part of the corridor, where the price is cheap within it. | MCD3 |  | discount zone, lower zone, cheap zone |
| 51 | `premium_zone` | premium zone | The upper part of the corridor, where the price is expensive within it. | MCD3 |  | upper zone, expensive zone |
| 52 | `trend_conflict` | trend conflict | A state in which the M15 and M5 trends point in different directions, so there is no consolidated trend. | MCD3 |  | conflicting trends, trends conflict, misaligned trends, trend misalignment |
| 53 | `stochastic` | stochastic | An oscillator that shows where the price stands inside its recent range. | MCD3 |  | stochastics, stochastic oscillator, edt stochastic |
| 54 | `synthesis` | synthesis | The reading that combines the sensors into one direction and one explanation for a trader type. | SYN |  | synthesis reading, syn, combined reading |
| 55 | `archetype` | archetype | One of the four basic kinds of market situation (A, B, C, D) that the synthesis recognises. | SYN |  | archetypes, setup type, pattern type |
| 56 | `continuation` | trend continuation | A situation in which the existing trend is expected to go on. | SYN |  | continuation, continues, continuing |
| 57 | `counter_trend` | counter-trend | Against the direction of the larger trend. | SYN |  | countertrend, counter trend, against the trend |
| 58 | `with_trend` | with-trend | In the direction of the larger trend. | SYN |  | with the trend, with trend, trend-following, trend following |
| 59 | `exhaustion` | exhaustion | A move that has run out of strength, which often ends in a sharp return. | SYN |  | exhausted, exhaustion move |
| 60 | `snapback` | snapback | A fast return of the price toward where it came from after an exhausted move. | SYN |  | snap back, snap-back, snaps back |
| 61 | `invalidation` | invalidation | The price at which an entry zone stops being a valid idea. | SYN |  | invalidated, invalidates, invalid level, invalidation level |
| 62 | `runway` | runway | The distance the price has to move before it meets the next level. | SYN |  | room, headroom, room to the next level |
| 63 | `cautionary` | cautionary | A status of a reading: it can be used, but something about it calls for care. | D5 |  | caution, cautious, with caution |
| 64 | `stale` | stale | A status: the data or the reading is too old to rely on. | D5 |  | stale data, out of date, outdated |
| 65 | `market_closed` | market closed | The market is not trading, for example at the weekend. | D5 |  | closed market, market is closed |
| 66 | `sensor` | sensor | One of the MCD readers (MCD1, MCD2, MCD3) that reads the chart and reports a state. | D1 |  | sensors, indicator, indicators |
| 67 | `reading` | reading | What a sensor reports for the latest cycle: its status, its state and what it says. | D1 |  | readings, sensor reading |
| 68 | `news_blackout` | news blackout | The minutes around a major news release in which no new setup is offered. | D5 |  | blackout, news window, blackout window, news freeze |
| 69 | `economic_calendar` | economic calendar | The schedule of economic news releases. | D5 |  | news calendar, economic events, calendar |
| 70 | `high_impact` | high-impact news | News that usually moves the gold price strongly. | D5 |  | high impact, major news, big news, high-impact event |
| 71 | `inflation` | inflation | The general rise of prices, a main driver of the gold price. | D1 |  | cpi, consumer prices, consumer price index |
| 72 | `interest_rate` | interest rate | The price of borrowing money, set by central banks; a main driver of the gold price. | D1 |  | interest rates, rate decision, rate hike, rate cut, fed rate, fed |
| 73 | `us_dollar` | US dollar | The currency gold is priced in, whose strength usually moves gold the other way. | D1 |  | dollar, usd, the dollar, dollar index, dxy |

## The fixed English texts

These are the English of the `intake.*` keys (`lib/intake/text.ts`). Each locale's own review shows its translation next to them.

| Key | English |
| --- | --- |
| intake.refusal.not_signed_in | Please sign in to ask the AI analyst. |
| intake.refusal.tier_required | The AI analyst is part of the Pro plan. |
| intake.refusal.thread_invalid | This conversation is not available. Start a new one about gold (XAUUSD). |
| intake.refusal.profile_not_set | Confirm your trading profile first. |
| intake.refusal.quota_insufficient | Your AI analyst allowance is used up for now. Please try again later. |
| intake.refusal.feature_unavailable | The AI analyst is not available yet. |
| intake.refusal.question_empty | Type a question about gold (XAUUSD) first. |
| intake.refusal.question_too_long | Your question is too long. Please keep it to {limit} characters or fewer. |
| intake.refusal.understanding_failed | That question could not be read just now. Please try again. |
| intake.refusal.out_of_scope | This analyst covers gold (XAUUSD) on the M5 and M15 charts only. Ask about those. |
| intake.instant.m5 | Explain the current M5 chart |
| intake.instant.m15 | Explain the current M15 chart |
| intake.reason.data_stale | The market data is out of date, so this sensor has no usable reading. |
| intake.reason.retuning | The chart indicator is being re-tuned, so this reading is less reliable for now. |
| intake.reason.no_setting | No indicator setting is available for this timeframe, so this sensor cannot read it. |
| intake.reason.detection_mismatch | The indicator found in the data does not match its setting, so treat this reading with caution. |
| intake.reason.no_stats_at_slot | The statistics for this moment are not available yet, so this reading is out of date. |
| intake.reason.containment_low | The price is not staying inside the channel well enough for a reliable reading. |
| intake.reason.insufficient_bars | There are not enough closed bars yet for a reliable reading. |
| intake.reason.discontinuity | The bars have gaps or are out of order, so this reading cannot be trusted. |
| intake.reason.sanity_failed | The channel values are impossible, so this reading cannot be trusted. |
| intake.reason.upstream_cautionary | {sensor} is cautionary, so this reading is cautionary too. |
| intake.reason.upstream_unavailable | {sensor} has no valid reading, so this one is unavailable. |
| intake.reason.upstream_stale | {sensor} is out of date, so this one is too. |
| intake.reason.mcd0_defect_m5 | The M5 channel does not fit the price well enough, so readings that use it are cautionary. |
| intake.reason.mcd0_defect_m15 | The M15 channel does not fit the price well enough, so readings that use it are cautionary. |
| intake.reason.evaluator_error | This sensor hit an unexpected error and has no reading right now. |
| intake.reason.modifier_caution | Another sensor adds caution to this reading: {state}. |

## Sign-off

Read the tables above, then edit `approval.json` in this folder: set `status` to `APPROVED`, `approved_by` to your name and `approved_on` to the date (YYYY-MM-DD). It holds the SHA-256 of the content you read, so a later change to it puts this area back to PENDING (`python scripts/intake/glossary_tool.py record`). Then run `record` once more so the forms of the English term list are marked `approved` in the glossary.
