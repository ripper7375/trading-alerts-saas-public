---
id: d4-profile-and-underflow
domain: D4
mcd_id: null
state_codes: []
timeframe: null
version: 1.0.0
related:
  - d4-position-sizing.the-lot-size-formula-in-words
  - d4-caution-sizing.the-trader-keeps-the-final-say-up-to-max-rpt
  - d4-structural-stops.room-to-the-next-opposing-level
  - d3-archetypes.trend-relation-with-the-trend-or-against-it
---

# The profile, the checks and lots below the minimum

## The eight profile metrics, first four

Engine 4 works from a trader profile of exactly eight metrics. Four describe the trader and the limits on risk.

1. Type of trader: Scalper, who holds a trade for less than 2 hours, or Day Trader, who holds for less than 12 hours. The default is Day Trader. The type picks the synthesis reading that is used, and the holding window for news warnings.
2. Trading style: Trend Following, Trend Countering or Both. The default is Trend Following. The style decides whether a setup's trend relation triggers a notice.
3. Max risk per trade, commission included: from 0.5% to 2.0% of equity, in steps of 0.25 percentage points. The default is 1.50%. This is Max RPT, the most the trader may risk on one setup.
4. Maximum leverage: presets from 1:1.0 to 1:3.0, or a custom figure, with a hard ceiling of 1:5.0. The default is 1:1.5.

The profile is the trader's own. A figure that is out of range is refused with the reason and is never silently changed.

## The eight profile metrics, last four

The other four are the numbers the sizing needs.

5. Target RRR, commission included: from 1.50x to 3.50x, and at most 2.50x for counter-trend styles and counter-trend setups. The default is 1.75x. This is the Normal scenario.
6. Current equity balance: the real balance in dollars. The default is $5,000. The modal pre-fills it from the profile.
7. Minimum stop-loss distance, Min SLD: in dollars. The default is $13.00. No stop may be nearer to the entry.
8. Round-trip commission: dollars per lot. The default is $4.00.

Each metric is a plain number with a unit, so it can be read back to the trader exactly as stored: percentages are percentages of equity, leverage is written 1:L, and distances, balances and commissions are dollars.

The contract size, the lot step and the smallest lot are not profile metrics. They come from the broker figures of the symbol. The profile has no setting for them, and no fixed lot size or margin figure is stored in it.

## How the profile is confirmed and used

The profile is confirmed at the start of every session and again after an edit in the middle of a session. Every version is kept in an append-only history, so a later audit can show which profile a setup was sized with. A change to the profile does not rewrite earlier setups. A consent is recorded only against the trader's own profile snapshot and against the profile that the setup was validated with. The current profile goes away with the account, while the history and the consent records keep a hashed user id.

The same eight metrics are used by the trade setup form and by a setup typed in chat. A figure typed in chat only pre-fills the form. The trader confirms each input, and nothing is calculated from free text alone.

Two of the metrics stay private. The equity balance and the commission are never sent to a model provider. The model sees the trader type, the style and the limits, and Engine 4, not the model, writes every number of Report 2.

## What the validator checks on every setup

One validator serves the form and chat, so the same setup gives the same result by either path. It runs eight checks. Check 0: the entry is within the range of the last day widened by half its height, and within 5% of the live price as a typing filter. Check 1: the risk percentage is not above Max RPT. Check 2: the stop is at least Min SLD, and structural or custom. Check 3: the target RRR is at most 2.50x when the setup is counter-trend. Check 4: the leverage used is not above Max leverage, and the lot is clamped to it. Check 5: no Tier-1 news release falls inside the window. Check 6: the setup is still valid and the data status allows it. Check 7: the lot reaches the broker's smallest lot, or the help for a lot below the minimum is shown.

A failed check says which one failed and why. A setup that fails is not sized into a recommendation.

## When the lot is below the broker minimum

The broker allows no lot below its smallest lot, normally 0.01. When the lot that the risk and leverage limits allow is smaller, the result is an underflow, and Engine 4 never rounds up to the minimum, because one minimum lot could lose several times the risk the trader chose.

The example is a $500.00 account at 0.50% risk, so $2.50 of risk, with a $15.00 stop, a $4 commission and a buy at 2,545.00. The lot at the stop is $2.50 / $1,504, about 0.0017 lot. One minimum lot of 0.01 would lose $15.04 at the stop, which is 3.01% of the equity. The report states this and offers no lot.

The underflow is shown in the report as what it is. There is no lot to place, no target profit is claimed, and the declared risk, the stop and the target distances are still shown, so the trader sees the whole picture.

## What help is offered, and what never is

The help stays inside the trader's own limits. Raising the risk is offered only if the risk that one minimum lot needs is at or under Max RPT. In the $500.00 example it needs 3.01%, which is above a Max RPT of 2.00%, so it is not offered. A nearer structural stop is offered only if it is at or beyond Min SLD, never an arbitrary tightening. Decline is always offered. When a raised risk is offered, it is rounded up to the next 0.01% so that the figure the trader enters really buys a minimum lot. Each nearer stop is sized again, so the lot and the actual risk shown for it are what would happen. When none of these is inside the limits, Decline alone is the correct outcome.

The system never offers a different equity. The fact is stated instead: this setup needs at least $3,008.00 of equity at 0.50% risk, rounded up to the cent because it is a minimum. It is a fact and not a button, and the report never suggests entering a balance that is not real. It never suggests more leverage either.

## Two causes: the risk limit and the leverage limit

A lot below the minimum can come from the risk limit, from the leverage limit, or from both, and the report names every cause that applies. When both apply, both facts are shown together, the risk cause first and the leverage cause second. The risk cause states how much equity the risk limit needs. The leverage cause states how much equity the leverage limit needs: the smallest lot x 100 x the fill price, divided by Max leverage.

The $500.00 account is both. At the 1:5 ceiling one minimum lot at 2,545.00 needs $509.00 of equity, and the risk needs $3,008.00 at 0.50%. Raising the risk would not change the leverage lot, and a nearer stop would not either. When the leverage cause applies, only Decline is offered. The facts are shown and no remedy that would exceed the trader's limits is suggested. The equity figures are stated for information and are not a suggestion to change the account or to add funds.

## The badge in Report 2

The badge is a label on one of the three scenarios, Conservative, Normal or Aggressive. It comes from the synthesis reading and from the room to the next opposing level, by a fixed table, and no model chooses it. It is not a grade and not a measure of how likely a trade is to work.

The table names the highest badge a setup can have. A counter-trend setup, or one with a conflict between the timeframes, can reach Conservative. A setup with the trend, with room for the Normal ratio, can reach Normal. A setup with the trend on both M5 and M15, with room for the Aggressive ratio, can reach Aggressive. A badge goes only to a scenario whose target lies strictly before the next opposing level. When none fits there is no badge, and Report 2 says so and names the blocking level. There is also no badge when no scenario exists at or below the cap. A counter-trend setup whose target ratio is already the 1.50x minimum has no Conservative scenario, and then the report says that no allowed scenario fits the style of the setup.

## Declared risk, actual risk and the notices of Report 2

Report 2 is a fixed template. Every number comes from Engine 4, and the labels and the disclaimer are reviewed texts in the trader's language. It shows the declared risk and the actual risk side by side, and when the leverage limit set the lot it says so, so that the gap is understood.

Every report carries the single-order notice, that it covers one order only and does not manage the account or open positions, and the notice that the trader places the order with the broker. Other notices appear when they apply: a counter-trend setup for a trend-following trader, a delayed feed with the time of its data, a cautionary cycle with the halved risk, and a newer cycle that changed the picture.

The report describes itself as a calculation tool and not a suitability assessment or personal recommendation, and it asks the trader to check every figure before trading. The three actions are Accept setup, Modify and Decline, and each one is recorded.
