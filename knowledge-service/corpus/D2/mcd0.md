---
id: d2-mcd0-playbook
domain: D2
mcd_id: MCD0
state_codes:
  - MCD0_ALL_QUALIFIED
  - MCD0_M5_DEFECT
  - MCD0_M15_DEFECT
  - MCD0_M5_M15_DEFECT
timeframe: null
version: 1.0.0
related:
  - d1-channels-and-corridors.terms-the-sensors-use
  - d1-mcd-architecture.mcd0-the-fit-gate
  - d1-channels-and-corridors.width-containment-and-refits
  - d1-data-statuses.what-makes-a-reading-cautionary
---

# MCD0 playbook: the channel fit gate

## What MCD0 checks

MCD0 is the quality gate of the channels. It asks whether each timeframe's active channel is fitted well enough to trust the channel sensors that read it. It judges the M5 channel and the M15 channel separately, every cycle, on four pillars: coverage, R-squared, the fit ratio and symmetry. Symmetry has two parts, the geo ratio and the skew. Two models are tested, Model A, which is built on the SSA crossings, and Model B, which is built on the close price.

A timeframe is either qualified or a defect. It is a defect when any pillar that applies fails, and a strong pillar cannot make up for a weak one. The state of MCD0 is the pair of verdicts, M5 and M15, which gives four states.

MCD0 gives no direction. Its bias is NEUTRAL in all four states, it gives no price level, and it takes no part in the synthesis vote. A defect is not a failure of MCD0: the reading is VALID and its state names the timeframe that missed a criterion. What a defect does is attach a caution to the channel sensors that read that timeframe.

MCD0 is meant to be explained when a trader asks about the quality of a channel. It is not used to read direction or entry timing.

## The pillars and their bounds

Coverage: the channel must cover at least 60 closed bars, which is at least five hours of M5 and fifteen hours of M15. The count leaves out the bar still forming.

R-squared: the share of the price movement that the regression line explains. Model A must reach at least 0.70 and Model B at least 0.65.

Fit ratio: half the height of the corridor divided by the typical size of the fit's error. It must lie from 1.50 to 3.20. Below the range the corridor is narrow for the size of the errors, an over-fitted channel that price often breaches. Above the range it is wide, an under-fitted channel. Each model uses its own error.

Geo ratio: the distance from the baseline up to UOEDT divided by the distance from the baseline down to LOEDT. It must lie from 0.60 to 1.65, so the corridor is not badly lopsided.

Skew: the lopsidedness of each model. Its absolute value must be at most 1.50.

All bounds include their end values, so a value exactly on a bound passes. These are starting values, and a change to one is a versioned decision. The pillars name the criterion in the commentary and not the model, so R2 stands for both models.

## What a skipped pillar means

Not every pillar applies to every channel. A skipped pillar is not a failed pillar, and it is listed as skipped in the reading.

A flat channel, one within five degrees of flat either way, has its R-squared pillars skipped. A flat line explains almost none of the price movement through its slope, so a low R-squared there says little about the quality of the fit. Above the five degree band R-squared is applied again.

The fractal channel has no Model A. For it the Model A pillars are skipped, which are R2 for A, the fit ratio for A and the skew for A, and the timeframe is judged on Model B, coverage and the geo ratio.

A pillar that is in neither the failed list nor the skipped list passed. When a timeframe is a defect, the reading names the criteria that failed: coverage, R2, fit ratio, geo ratio or skew.

Skipping is decided by the kind of channel, never by a missing number. A pillar is skipped because it does not apply to that channel. A required number that is missing or unusable makes the whole reading INVALID with the reason SANITY_FAILED instead, so a gap in the data is never mistaken for a pass.

## Both channels meet every fit criterion

**State code:** `MCD0_ALL_QUALIFIED`. No regime word. The sensor's own bias is NEUTRAL.

**What it says.** The active M5 channel and the active M15 channel both meet every fit criterion that applies to them. Pillars that were skipped do not count against either channel. MCD0 raises no caution in this cycle.

**What it does not say.** Qualified does not mean that the channels are right, that the corridor will contain price, or that a trade is sound. It says that the fit passes the tests. It gives no direction.

**With the other sensors.** The channel sensors keep whatever status their own checks gave them. This state adds no MCD0 caution to MCD1, MCD2 or MCD3.

**What to watch next.** Whether a later refit of either channel moves a pillar toward a bound, particularly R-squared, which has sat close to its bound on real channels.

## The M5 channel misses a fit criterion

**State code:** `MCD0_M5_DEFECT`. No regime word. The sensor's own bias is NEUTRAL.

**What it says.** The active M5 channel misses at least one criterion that applies to it, and the active M15 channel meets every one. The reading names the criteria that failed on M5.

**What it does not say.** It does not say that the M5 channel is useless or that the market is unusual. It says that the M5 fit is weaker than the tests expect.

**With the other sensors.** The sensors that read M5 become CAUTIONARY with the reason MCD0_DEFECT_M5: MCD2 and MCD3. MCD1 reads only M15 and is not marked by this state. A trade setup then pre-sets half the risk, with the reason shown, and the trader may change it.

**What to watch next.** Whether the next refit of the M5 channel clears the failed criteria, and whether the angle crosses the five degree band, since that changes whether R-squared is applied.

## The M15 channel misses a fit criterion

**State code:** `MCD0_M15_DEFECT`. No regime word. The sensor's own bias is NEUTRAL.

**What it says.** The active M15 channel misses at least one criterion that applies to it, and the active M5 channel meets every one. The reading names the criteria that failed on M15.

**What it does not say.** It does not say that the M15 trend is wrong or that the market is unusual. It says that the M15 fit is weaker than the tests expect, and the M15 channel is the base of the primary structure for a Day Trader.

**With the other sensors.** The sensors that read M15 become CAUTIONARY with the reason MCD0_DEFECT_M15: MCD1 and MCD3. MCD2 reads only M5 and is not marked by this state. The pre-set risk for a trade setup is halved, with the reason.

**What to watch next.** Whether the next refit of the M15 channel clears the failed criteria, particularly coverage, the one criterion that is a plain count of bars.

## Both channels miss a fit criterion

**State code:** `MCD0_M5_M15_DEFECT`. No regime word. The sensor's own bias is NEUTRAL.

**What it says.** Both the active M5 channel and the active M15 channel miss at least one criterion that applies to them. The reading names the failed criteria for each timeframe.

**What it does not say.** It does not say that the market cannot be read, and it does not say which channel is closer to the truth. Both fits are weaker than the tests expect in this cycle.

**With the other sensors.** MCD1, MCD2 and MCD3 all become CAUTIONARY, each with the reasons of the timeframes it reads. The sensors still give their states, and the caution shows beside each of them. A trade setup pre-sets half the risk.

**What to watch next.** Whether either channel clears its failed criteria on the next refit, and whether the caution keeps showing across several cycles, which says that the fit is persistently weak.

## How to read a defect

A defect is a caution about the fit, not a verdict on the market and not a signal. The channel sensors still report their states when MCD0 flags a timeframe. The caution tells the reader that the corridor and slope behind those states come from a fit that missed a test.

How often MCD0 flags a channel on live data is still being measured in the shadow period. Until that is known, a defect should not be read as a rare alarm, and its absence does not make a channel sound. What the flag changes in practice is small and explicit: the reason appears next to each marked sensor, and a trade setup starts from half the risk.

Why a defect is described by criteria matters too. The failed criteria are named so a reader can see whether the problem is coverage, which time will fix, or the shape of the corridor, which a refit may change.

Because the verdict is per timeframe, a defect on one timeframe leaves the sensors of the other timeframe without the MCD0 caution. During an M5 defect MCD1 is not cautioned, while MCD2 and MCD3 are. A question about M15 alone is read with that in mind.

## When MCD0 gives no verdict

MCD0 has one status for the whole reading. If either timeframe cannot be read, the reading as a whole is STALE or INVALID, and the two timeframes are checked in that order, M5 first, at each step.

It is STALE with NO_STATS_AT_SLOT when the statistics row for the slot is missing on either timeframe, and with DATA_STALE when the cycle itself is stale. It is INVALID with NO_SETTING when a timeframe has no active indicator set, and with SANITY_FAILED when a required statistic is not a usable number. In every case the whole reading is unavailable. The worker then marks no sensor that cycle, because a gate that cannot read gives no defect to pass on. An unavailable MCD0 does not say that the channels are sound. The channel sensors on the same timeframe usually need the same statistics row, so they are unavailable too, and the board lists them as unavailable rather than cautioned.

MCD0 reads no bars. It judges statistics that the indicator has already computed, so the closed-bar rule has nothing to cut for it.

A RETUNING cycle makes the MCD0 reading CAUTIONARY, with that reason, and the state is kept.
