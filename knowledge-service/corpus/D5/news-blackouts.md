---
id: d5-news-blackouts
domain: D5
mcd_id: null
state_codes: []
timeframe: null
version: 1.0.0
related:
  - d4-profile-and-underflow.what-the-validator-checks-on-every-setup
  - d1-data-statuses.when-the-status-is-unknown-or-retuning
  - d5-system-invariants.fail-closed
---

# News blackouts

## Tier-1 releases and the blackout window

Some economic releases can move gold within seconds. The system keeps a short list of Tier-1 releases: US CPI, Core PCE, the FOMC rate decision and non-farm payrolls (NFP). The list is a versioned configuration file that names each release by its calendar event id from the trading terminal, and never by its name, because names change and ids do not.

Around each of these releases Report 2 is blacked out. No trade setup is offered from 15 minutes before the release to 15 minutes after it. The window is inclusive at both ends: at exactly 15 minutes before or after, the blackout still holds, and one second further away it no longer does. A release at 16 minutes away leaves the setup allowed, one at 14 minutes blocks it, and the same is true after the release.

The window is measured in UTC. The calendar is exported from the broker's terminal, converted from the broker's server time to UTC and stored append-only, and the newest observation of each release is its state. When a window applies, the reply names the release and says when the window ends, so the trader knows when a setup can be offered again.

## When the release time is approximate

Not every release has an exact time. A calendar entry can carry only an approximate time, when its time mode is not zero. The blackout then widens: no trade setup is offered from 60 minutes before to 60 minutes after the stated time.

The wider window exists because an approximate time cannot say when the number will arrive. A release listed at a given hour may come earlier or later than the stated time, so a narrow window around the stated time could miss it. The system uses the wide window for the whole of that uncertainty, and the narrow one only when the time is exact. An approximate time is not a missing release. The release is still on the list and still blocks. The window of 15 minutes is the narrower case and holds when the calendar gives an exact time.

Both windows are tested at their edges, one second inside and one second outside, so a change to either figure is caught by a test.

The window is still inclusive at the edges: at exactly 60 minutes the blackout holds and one second beyond it does not. The same Tier-1 list and the same rule apply, and the reply still names the release and says when the window ends.

## Releases inside the holding window: a warning, not a block

A release outside the Tier-1 list can still matter to a position that is open when it arrives. Other high-impact US dollar releases that fall inside the trader's holding window are therefore shown as a warning. The holding window is 2 hours for a Scalper and 12 hours for a Day Trader, matching how long each type expects to hold a trade.

A warning is not a block. The trade setup is still offered, and the report lists the releases that fall inside the window. The decision is left with the trader, who knows how long the intended trade will be open.

The difference between the two is the proximity and the list. A Tier-1 release within the blackout window stops the offer, because the risk to the setup is immediate and well defined. A high-impact release hours ahead is information. A trader with a long holding plan sees more warnings than one with a short plan. A Tier-1 release that lies inside the holding window but outside its own blackout is also listed as a warning, and it becomes a block only when its own 15-minute window begins.

## Why entry recommendations are withheld during a blackout

A setup built for Report 2 rests on structure and on a stop placed behind it. Around a Tier-1 release, price can move quickly through levels and the spread can widen. The distance to the stop and the lot worked out from it describe the market before the number, not the market the order would meet. That is why a setup is not offered in the window and not merely labelled.

The rule is also about consistency. The system works out the risk exactly and states it side by side, declared and actual. During a release those figures would be precise and unreliable at once. Withholding the offer is the plain way to avoid presenting a precise figure that the market may not honour.

Withholding the setup is not a prediction about the release. Nothing in the blackout says whether gold will rise or fall, and a quiet release does not shorten the window. The rule is fixed in advance, applies to everyone, and has no exception for a setup that looks strong. It applies on both sides of a release, because the minutes before the number carry the risk that an order is filled as it lands, and the minutes after it are a time when the market is still adjusting to it.

## When the calendar is late, empty or unreadable

The blackout depends on knowing the calendar. If the calendar has not been exported for 45 minutes, the blackout still applies from the last known schedule, and the age of the calendar is reported with the answer. A late calendar does not lift a blackout.

The calendar is exported from the broker's terminal every 15 minutes, and a row is stored only when something about a release changes. The age of the calendar therefore means the age of its newest observation, so a quiet calendar can look old while the export is running. The limit of 45 minutes is read with that in mind, and that is why a late calendar keeps the last known blackout and never drops it.

If the system cannot tell, it does not offer. A Tier-1 list that is missing, unreadable or incomplete, a calendar that cannot be read or holds no rows, all give the answer unknown and the trade setup is not offered. An unavailable calendar is never read as no news. It is said aloud, so that the trader knows the check could not be made.

Only the trade setup is affected. The sensors keep running, the sensor board and the explanations stay available, and questions about the market are still answered. A blackout withholds an entry recommendation and nothing else.
