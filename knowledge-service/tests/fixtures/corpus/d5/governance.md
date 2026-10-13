---
id: t.d5.governance
domain: D5
version: 1.0.0
---

# TEST ONLY: governance

## News blackout window

TEST ONLY. Around a scheduled release of the highest importance the service treats the market as closed to new setups. The blackout begins fifteen minutes before the release and ends fifteen minutes after it, and it widens to an hour on each side when the time of the release is only approximate. During the blackout the service still answers questions and explains what is happening, and it will not build a new trade setup. A trade that is already open is outside the scope of this rule, and the service warns the trader when their holding window would run into a release. The fixture text says all of this without naming a real release, because the list of releases that count is configuration and not prose. A reader asking whether it is safe to enter just before a release should be told the blackout rule, the window, and that the calendar they are looking at has an age which the answer must state. The fixture adds that the blackout is a rule about building new setups and not about answering questions, so a trader can always ask what a release is or when the next one is due.

## Decision support and what the service does not do

TEST ONLY. The service supports a trader's own decision. It describes the sensors, explains the rules and works out figures from the trader's inputs. It does not place orders, hold funds or watch an account after a setup is made. A setup covers one order, and the service says so wherever a setup is shown. Every answer carries the data status and its time, so a reader can tell fresh data from stale. When a number appears it is either a figure from the stored reading, a figure computed by the risk engine, or a figure the trader typed, and the answer says which. The fixture text closes with the plain statement that no reading carries a measured probability, and that the service therefore does not quote one. A last fixture sentence says that the service keeps no record of a trader's account between requests, and that any figure which depends on the account comes from the profile the trader confirmed.
