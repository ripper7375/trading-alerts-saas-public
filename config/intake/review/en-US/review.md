# Glossary review: English (US) (`en-US`)

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
| 1 | `buy` | buy | buy | buys · buying · bought |
| 2 | `sell` | sell | sell | sells · selling · sold |
| 3 | `stand_aside` | stand aside | stand aside | stand-aside · standing aside · stands aside |
| 4 | `entry` | entry | Entry | entry point · entries |
| 5 | `entry_zone` | entry zone | entry zone | entry zones · entry area |
| 6 | `stop_loss` | stop loss | Stop loss | stop-loss · stop losses |
| 7 | `take_profit` | take profit | take profit | take-profit · take profits |
| 8 | `target` | target | target | targets · price target · profit target |
| 9 | `lot_size` | lot size | Lot size | lot sizes · position size |
| 10 | `leverage` | leverage | Leverage | leveraged |
| 11 | `spread` | spread | spread | spreads · bid-ask spread |
| 12 | `commission` | commission | commission | commissions · fees |
| 13 | `risk` | risk | risk | risks · risk per trade |
| 14 | `risk_reward` | risk-reward ratio | risk-reward ratio | risk reward ratio · reward-to-risk · RRR |
| 15 | `equity` | equity | Equity | account balance · account size |
| 16 | `margin` | margin | margin | margins · margin requirement |
| 17 | `broker` | broker | broker | brokers · brokerage |
| 18 | `stop_distance` | stop distance | Stop distance | stop-loss distance · distance to the stop |
| 19 | `reduced_risk` | reduced risk | reduced risk | half risk · half-risk · lower risk |
| 20 | `gold` | gold | gold |  |
| 21 | `chart` | chart | chart | charts · candlestick chart |
| 22 | `timeframe` | timeframe | timeframe | time frame · timeframes |
| 23 | `candle` | candle | candle | candles · candlestick · candlesticks |
| 24 | `closed_bar` | closed bar | closed bar | closed candle · last closed bar · closed bars |
| 25 | `trend` | trend | trend | trends |
| 26 | `uptrend` | uptrend | uptrend | up trend · upward trend · bullish trend |
| 27 | `downtrend` | downtrend | downtrend | down trend · downward trend · bearish trend |
| 28 | `sideways` | sideways | sideways | sideways market · range-bound |
| 29 | `support` | support | support | support level · supports |
| 30 | `resistance` | resistance | resistance | resistance level · resistances |
| 31 | `breakout` | breakout | breakout | break out · breakouts |
| 32 | `breakdown` | breakdown | breakdown | break down · breakdowns |
| 33 | `pullback` | pullback | pullback | pull back · retracement · dip |
| 34 | `rally` | rally | rally | rallies · bounce |
| 35 | `reversal` | reversal | reversal | reversals · turnaround · trend reversal |
| 36 | `range` | range | range | trading range · ranges |
| 37 | `volatility` | volatility | volatility | volatilities · volatile |
| 38 | `momentum` | momentum | momentum |  |
| 39 | `overbought` | overbought | overbought | over-bought |
| 40 | `oversold` | oversold | oversold | over-sold |
| 41 | `channel` | channel | channel | channels · regression channel |
| 42 | `corridor` | corridor | corridor | corridors · channel band |
| 43 | `uoedt` | UOEDT | UOEDT |  |
| 44 | `loedt` | LOEDT | LOEDT |  |
| 45 | `baseline` | baseline | baseline |  |
| 46 | `overextension` | overextension | overextension | overextended · over-extension |
| 47 | `reversion` | mean reversion | mean reversion | reversion · reverts to the mean |
| 48 | `consolidated` | consolidated | consolidated | consolidated trend · consolidation |
| 49 | `equilibrium` | equilibrium | equilibrium | equilibrium zone · mid zone |
| 50 | `value_zone` | value zone | value zone | discount zone · lower zone |
| 51 | `premium_zone` | premium zone | premium zone | upper zone · expensive zone |
| 52 | `trend_conflict` | trend conflict | trend conflict | conflicting trends · trends conflict · misaligned trends |
| 53 | `stochastic` | stochastic | stochastic | stochastics · stochastic oscillator |
| 54 | `synthesis` | synthesis | synthesis | synthesis reading |
| 55 | `archetype` | archetype | archetype | archetypes · setup type |
| 56 | `continuation` | trend continuation | trend continuation | continuation |
| 57 | `counter_trend` | counter-trend | counter-trend | countertrend · counter trend · against the trend |
| 58 | `with_trend` | with-trend | with-trend | with the trend · with trend · trend-following |
| 59 | `exhaustion` | exhaustion | exhaustion | exhausted · exhaustion move |
| 60 | `snapback` | snapback | snapback | snap back · snap-back |
| 61 | `invalidation` | invalidation | invalidation | invalidated · invalidation level |
| 62 | `runway` | runway | runway | room to the next level · headroom |
| 63 | `cautionary` | cautionary | cautionary | caution · cautious · with caution |
| 64 | `stale` | stale | stale | stale data · out of date · outdated |
| 65 | `market_closed` | market closed | market closed | closed market · market is closed |
| 66 | `sensor` | sensor | sensor | sensors |
| 67 | `reading` | reading | reading | readings · sensor reading |
| 68 | `news_blackout` | news blackout | news blackout | blackout · blackout window |
| 69 | `economic_calendar` | economic calendar | economic calendar | news calendar · economic events |
| 70 | `high_impact` | high-impact news | high-impact news | high impact news · major news |
| 71 | `inflation` | inflation | inflation | cpi · consumer price index |
| 72 | `interest_rate` | interest rate | interest rate | interest rates · rate decision · rate hike · rate cut |
| 73 | `us_dollar` | US dollar | US dollar | the dollar · dollar index · dollar |

## Fixed replies, instant prompts and reason texts

| Key | English | English (US) |
| --- | --- | --- |
| intake.refusal.not_signed_in | Please sign in to ask the AI analyst. | Please sign in to ask the AI analyst. |
| intake.refusal.tier_required | The AI analyst is part of the Pro plan. | The AI analyst is part of the Pro plan. |
| intake.refusal.thread_invalid | This conversation is not available. Start a new one about gold (XAUUSD). | This conversation is not available. Start a new one about gold (XAUUSD). |
| intake.refusal.profile_not_set | Confirm your trading profile first. | Confirm your trading profile first. |
| intake.refusal.quota_insufficient | Your AI analyst allowance is used up for now. Please try again later. | Your AI analyst allowance is used up for now. Please try again later. |
| intake.refusal.feature_unavailable | The AI analyst is not available yet. | The AI analyst is not available yet. |
| intake.refusal.question_empty | Type a question about gold (XAUUSD) first. | Type a question about gold (XAUUSD) first. |
| intake.refusal.question_too_long | Your question is too long. Please keep it to {limit} characters or fewer. | Your question is too long. Please keep it to {limit} characters or fewer. |
| intake.refusal.understanding_failed | That question could not be read just now. Please try again. | That question could not be read just now. Please try again. |
| intake.refusal.out_of_scope | This analyst covers gold (XAUUSD) on the M5 and M15 charts only. Ask about those. | This analyst covers gold (XAUUSD) on the M5 and M15 charts only. Ask about those. |
| intake.instant.m5 | Explain the current M5 chart | Explain the current M5 chart |
| intake.instant.m15 | Explain the current M15 chart | Explain the current M15 chart |
| intake.reason.data_stale | The market data is out of date, so this sensor has no usable reading. | The market data is out of date, so this sensor has no usable reading. |
| intake.reason.retuning | The chart indicator is being re-tuned, so this reading is less reliable for now. | The chart indicator is being re-tuned, so this reading is less reliable for now. |
| intake.reason.no_setting | No indicator setting is available for this timeframe, so this sensor cannot read it. | No indicator setting is available for this timeframe, so this sensor cannot read it. |
| intake.reason.detection_mismatch | The indicator found in the data does not match its setting, so treat this reading with caution. | The indicator found in the data does not match its setting, so treat this reading with caution. |
| intake.reason.no_stats_at_slot | The statistics for this moment are not available yet, so this reading is out of date. | The statistics for this moment are not available yet, so this reading is out of date. |
| intake.reason.containment_low | The price is not staying inside the channel well enough for a reliable reading. | The price is not staying inside the channel well enough for a reliable reading. |
| intake.reason.insufficient_bars | There are not enough closed bars yet for a reliable reading. | There are not enough closed bars yet for a reliable reading. |
| intake.reason.discontinuity | The bars have gaps or are out of order, so this reading cannot be trusted. | The bars have gaps or are out of order, so this reading cannot be trusted. |
| intake.reason.sanity_failed | The channel values are impossible, so this reading cannot be trusted. | The channel values are impossible, so this reading cannot be trusted. |
| intake.reason.upstream_cautionary | {sensor} is cautionary, so this reading is cautionary too. | {sensor} is cautionary, so this reading is cautionary too. |
| intake.reason.upstream_unavailable | {sensor} has no valid reading, so this one is unavailable. | {sensor} has no valid reading, so this one is unavailable. |
| intake.reason.upstream_stale | {sensor} is out of date, so this one is too. | {sensor} is out of date, so this one is too. |
| intake.reason.mcd0_defect_m5 | The M5 channel does not fit the price well enough, so readings that use it are cautionary. | The M5 channel does not fit the price well enough, so readings that use it are cautionary. |
| intake.reason.mcd0_defect_m15 | The M15 channel does not fit the price well enough, so readings that use it are cautionary. | The M15 channel does not fit the price well enough, so readings that use it are cautionary. |
| intake.reason.evaluator_error | This sensor hit an unexpected error and has no reading right now. | This sensor hit an unexpected error and has no reading right now. |
| intake.reason.modifier_caution | Another sensor adds caution to this reading: {state}. | Another sensor adds caution to this reading: {state}. |

## Sign-off

Read the tables above, then edit `approval.json` in this folder: set `status` to `APPROVED`, `approved_by` to your name and `approved_on` to the date (YYYY-MM-DD). It holds the SHA-256 of the content you read, so a later change to it puts this area back to PENDING (`python scripts/intake/glossary_tool.py record`). Then run `record` once more so the forms of English (US) are marked `approved` in the glossary.
