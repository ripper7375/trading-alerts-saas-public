# Stack D decision log

One file per decision. The architecture itself is in [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md); these files record what was decided, the alternative not chosen, and why.

- **Settled:** decided by Davin. **Proposed:** adopted provisionally, awaiting confirmation (none at present; ADR-015, the last one, was settled on 2026-10-01).
- Numbers 001–097 belong to the Stack D series. To change a decision, add a new file that names the one it replaces and mark the old one "Superseded by ADR-nnn".
- 001–007 were made before the section series; 008–081 come from the seven section decks (`davintrade-stack-d-and-e/STACK-D-REVISED-ARCHITECTURE-01…07`); 082 and 083 came after, and 084 to 092 record the decisions of build step 4 (synthesis and entry zones), approved on 2026-10-04 and written down on 2026-10-09; 093 to 097 record the decisions of build step 5 (Engine 4 and Report 2), approved on 2026-10-09 and 2026-10-10 in the plan and the part hand-offs and written down in part 8.
- "File A" to "file I" and "the review" in these entries are the earlier documents, now in
  [`davintrade-stack-d-and-e/archive/`](../../davintrade-stack-d-and-e/archive/):

| Letter | Archived file                                                                                                                                                                       |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A      | [`STACK-D-OKF-CONVERSATIONAL-AI-ARCHITECTURE-V2.md`](../../davintrade-stack-d-and-e/archive/STACK-D-OKF-CONVERSATIONAL-AI-ARCHITECTURE-V2.md)                                       |
| C      | [`STACK-D-ENGINE-1.5A-1.5B-1.5C-ARCHITECTURE-PLAN.md`](../../davintrade-stack-d-and-e/archive/STACK-D-ENGINE-1.5A-1.5B-1.5C-ARCHITECTURE-PLAN.md)                                   |
| D      | [`STACK-D-CONVERSATIONAL-AI-CHART-ANALYSIS-ARCHITECTURE-V2.md`](../../davintrade-stack-d-and-e/archive/STACK-D-CONVERSATIONAL-AI-CHART-ANALYSIS-ARCHITECTURE-V2.md)                 |
| E      | [`ENGINE-4-USER-CONSTRAINTS-AND-PREFERENCES-ARCHITECTURE.md`](../../davintrade-stack-d-and-e/archive/ENGINE-4-USER-CONSTRAINTS-AND-PREFERENCES-ARCHITECTURE.md)                     |
| F      | [`STACK-D-MASTER-MODIFICATION-PLAN.md`](../../davintrade-stack-d-and-e/archive/STACK-D-MASTER-MODIFICATION-PLAN.md)                                                                 |
| G      | [`STACK-D-WORKFLOW-AND-WORK-PROCESS-IN-CREATING-TRADE-SETUP-REPORT.md`](../../davintrade-stack-d-and-e/archive/STACK-D-WORKFLOW-AND-WORK-PROCESS-IN-CREATING-TRADE-SETUP-REPORT.md) |
| I      | [`STACK-D-EXECUTIVE-PRESENTATION-DECK.md`](../../davintrade-stack-d-and-e/archive/STACK-D-EXECUTIVE-PRESENTATION-DECK.md)                                                           |
| Review | [`STACK-D-ARCHITECTURE-REVIEW-AND-RECOMMENDATIONS.md`](../../davintrade-stack-d-and-e/archive/STACK-D-ARCHITECTURE-REVIEW-AND-RECOMMENDATIONS.md)                                   |

| #   | Decision                                                                                                                             | Section                         | Status  | Date       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- | ------- | ---------- |
| 001 | [Retire Engine 1.5C (WACS54)](001-retire-engine-1-5c-wacs54.md)                                                                      | Before the section series       | Settled | 2026-09-29 |
| 002 | [Remove JSONB54 and FREQ54](002-remove-jsonb54-and-freq54.md)                                                                        | Before the section series       | Settled | 2026-09-29 |
| 003 | [Per-MCD windows and 1 day of OHLC instead of the 54-bar rule](003-per-mcd-windows-and-1-day-of-ohlc-instead-of-the-54-bar-rule.md)  | Before the section series       | Settled | 2026-09-29 |
| 004 | [Two-panel chart in private R2](004-two-panel-chart-in-private-r2.md)                                                                | Before the section series       | Settled | 2026-09-11 |
| 005 | [Knowledge index as local txtai files](005-knowledge-index-as-local-txtai-files.md)                                                  | Before the section series       | Settled | 2026-09-29 |
| 006 | [Charts rendered on a schedule](006-charts-rendered-on-a-schedule.md)                                                                | Before the section series       | Settled | 2026-09-11 |
| 007 | [Finalise the architecture section by section](007-finalise-the-architecture-section-by-section.md)                                  | Before the section series       | Settled | 2026-09-29 |
| 008 | [Cycle key is the 5-minute slot time](008-cycle-key-is-the-5-minute-slot-time.md)                                                    | 1 · Market data & chart         | Settled | 2026-09-29 |
| 009 | [Cycle manifest and ready signal](009-cycle-manifest-and-ready-signal.md)                                                            | 1 · Market data & chart         | Settled | 2026-09-29 |
| 010 | [Active-indicator setting per timeframe](010-active-indicator-setting-per-timeframe.md)                                              | 1 · Market data & chart         | Settled | 2026-09-29 |
| 011 | [Still-open bar kept out of sensors and OHLC](011-still-open-bar-kept-out-of-sensors-and-ohlc.md)                                    | 1 · Market data & chart         | Settled | 2026-09-29 |
| 012 | [Freshness thresholds](012-freshness-thresholds.md)                                                                                  | 1 · Market data & chart         | Settled | 2026-09-29 |
| 013 | [Newest bars pushed first](013-newest-bars-pushed-first.md)                                                                          | 1 · Market data & chart         | Settled | 2026-09-29 |
| 014 | [Chart rendered on the VPS, stamped and kept](014-chart-rendered-on-the-vps-stamped-and-kept.md)                                     | 1 · Market data & chart         | Settled | 2026-09-29 |
| 015 | [Retuning during a promote](015-retuning-during-a-promote.md)                                                                        | 1 · Market data & chart         | Settled | 2026-10-01 |
| 016 | [Sensor worker on Railway](016-sensor-worker-on-railway.md)                                                                          | 2 · Sensors                     | Settled | 2026-09-29 |
| 017 | [MCD output envelope v1](017-mcd-output-envelope-v1.md)                                                                              | 2 · Sensors                     | Settled | 2026-09-29 |
| 018 | [Quality gate becomes MCD0](018-quality-gate-becomes-mcd0.md)                                                                        | 2 · Sensors                     | Settled | 2026-09-29 |
| 019 | [R-squared threshold per model](019-r-squared-threshold-per-model.md)                                                                | 2 · Sensors                     | Settled | 2026-09-29 |
| 020 | [Live readings vs certification history](020-live-readings-vs-certification-history.md)                                              | 2 · Sensors                     | Settled | 2026-09-29 |
| 021 | [MCD3 reads MCD1 and MCD2 readings](021-mcd3-reads-mcd1-and-mcd2-readings.md)                                                        | 2 · Sensors                     | Settled | 2026-09-29 |
| 022 | [Minimum sample before quoting a number](022-minimum-sample-before-quoting-a-number.md)                                              | 2 · Sensors                     | Settled | 2026-09-29 |
| 023 | [MCD1 same-slope breakout on the latest bar](023-mcd1-same-slope-breakout-on-the-latest-bar.md)                                      | 2 · Sensors                     | Settled | 2026-09-29 |
| 024 | [Neutral state names](024-neutral-state-names.md)                                                                                    | 2 · Sensors                     | Settled | 2026-09-29 |
| 025 | [Rules decide direction](025-rules-decide-direction.md)                                                                              | 3 · Synthesis & entry zones     | Settled | 2026-09-29 |
| 026 | [Rules file format](026-rules-file-format.md)                                                                                        | 3 · Synthesis & entry zones     | Settled | 2026-09-29 |
| 027 | [Synthesis runs in the sensor worker](027-synthesis-runs-in-the-sensor-worker.md)                                                    | 3 · Synthesis & entry zones     | Settled | 2026-09-29 |
| 028 | [Two trader-type readings per cycle](028-two-trader-type-readings-per-cycle.md)                                                      | 3 · Synthesis & entry zones     | Settled | 2026-09-29 |
| 029 | [Precedence ladder](029-precedence-ladder.md)                                                                                        | 3 · Synthesis & entry zones     | Settled | 2026-09-29 |
| 030 | [Support and resistance as context levels](030-support-and-resistance-as-context-levels.md)                                          | 3 · Synthesis & entry zones     | Settled | 2026-09-29 |
| 031 | [Zone half-width](031-zone-half-width.md)                                                                                            | 3 · Synthesis & entry zones     | Settled | 2026-09-29 |
| 032 | [Invalidation price](032-invalidation-price.md)                                                                                      | 3 · Synthesis & entry zones     | Settled | 2026-09-29 |
| 033 | [Modal price pills from zones](033-modal-price-pills-from-zones.md)                                                                  | 3 · Synthesis & entry zones     | Settled | 2026-09-29 |
| 034 | [Custom entry bound](034-custom-entry-bound.md)                                                                                      | 3 · Synthesis & entry zones     | Settled | 2026-09-29 |
| 035 | [No confidence grades](035-no-confidence-grades.md)                                                                                  | 3 · Synthesis & entry zones     | Settled | 2026-09-29 |
| 036 | [Routing v1 is a dispatch matrix](036-routing-v1-is-a-dispatch-matrix.md)                                                            | 4 · Intake, routing & knowledge | Settled | 2026-09-29 |
| 037 | [Eight intent labels](037-eight-intent-labels.md)                                                                                    | 4 · Intake, routing & knowledge | Settled | 2026-09-29 |
| 038 | [English pivot for 16 languages](038-english-pivot-for-16-languages.md)                                                              | 4 · Intake, routing & knowledge | Settled | 2026-09-29 |
| 039 | [One small model call to understand the question](039-one-small-model-call-to-understand-the-question.md)                            | 4 · Intake, routing & knowledge | Settled | 2026-09-29 |
| 040 | [Sensor board on every request](040-sensor-board-on-every-request.md)                                                                | 4 · Intake, routing & knowledge | Settled | 2026-09-29 |
| 041 | [Warnings and the primary sensor always in full](041-warnings-and-the-primary-sensor-always-in-full.md)                              | 4 · Intake, routing & knowledge | Settled | 2026-09-29 |
| 042 | [Knowledge corpus authorship](042-knowledge-corpus-authorship.md)                                                                    | 4 · Intake, routing & knowledge | Settled | 2026-09-29 |
| 043 | [Retrieval query built from context](043-retrieval-query-built-from-context.md)                                                      | 4 · Intake, routing & knowledge | Settled | 2026-09-29 |
| 044 | [Routing and retrieval test thresholds](044-routing-and-retrieval-test-thresholds.md)                                                | 4 · Intake, routing & knowledge | Settled | 2026-09-29 |
| 045 | [Embedding model](045-embedding-model.md)                                                                                            | 4 · Intake, routing & knowledge | Settled | 2026-09-29 |
| 046 | [Deterministic out-of-scope check](046-deterministic-out-of-scope-check.md)                                                          | 4 · Intake, routing & knowledge | Settled | 2026-09-29 |
| 047 | [One day of OHLC in compact form](047-one-day-of-ohlc-in-compact-form.md)                                                            | 5 · Prompt & AI reply           | Settled | 2026-09-29 |
| 048 | [Context caps and cut order](048-context-caps-and-cut-order.md)                                                                      | 5 · Prompt & AI reply           | Settled | 2026-09-29 |
| 049 | [Prompt order for caching](049-prompt-order-for-caching.md)                                                                          | 5 · Prompt & AI reply           | Settled | 2026-09-29 |
| 050 | [Metering from actual cost](050-metering-from-actual-cost.md)                                                                        | 5 · Prompt & AI reply           | Settled | 2026-09-29 |
| 051 | [Answer gate by data status](051-answer-gate-by-data-status.md)                                                                      | 5 · Prompt & AI reply           | Settled | 2026-09-29 |
| 052 | [Report 1 as structured JSON](052-report-1-as-structured-json.md)                                                                    | 5 · Prompt & AI reply           | Settled | 2026-09-29 |
| 053 | [Number check on every reply](053-number-check-on-every-reply.md)                                                                    | 5 · Prompt & AI reply           | Settled | 2026-09-29 |
| 054 | [Replies shown after their checks](054-replies-shown-after-their-checks.md)                                                          | 5 · Prompt & AI reply           | Settled | 2026-09-29 |
| 055 | [Models at launch](055-models-at-launch.md)                                                                                          | 5 · Prompt & AI reply           | Settled | 2026-09-29 |
| 056 | [Wording guide in 16 languages](056-wording-guide-in-16-languages.md)                                                                | 5 · Prompt & AI reply           | Settled | 2026-09-29 |
| 057 | [Follow-ups and chat history](057-follow-ups-and-chat-history.md)                                                                    | 5 · Prompt & AI reply           | Settled | 2026-09-29 |
| 058 | [When Report 2 is offered](058-when-report-2-is-offered.md)                                                                          | 6 · Engine 4 & Report 2         | Settled | 2026-09-30 |
| 059 | [Setup pinned to its cycle](059-setup-pinned-to-its-cycle.md)                                                                        | 6 · Engine 4 & Report 2         | Settled | 2026-09-30 |
| 060 | [News blackout](060-news-blackout.md)                                                                                                | 6 · Engine 4 & Report 2         | Settled | 2026-09-30 |
| 061 | [Defect flag halves the pre-set risk](061-defect-flag-halves-the-pre-set-risk.md)                                                    | 6 · Engine 4 & Report 2         | Settled | 2026-09-30 |
| 062 | [Structural stop options](062-structural-stop-options.md)                                                                            | 6 · Engine 4 & Report 2         | Settled | 2026-09-30 |
| 063 | [Badge from synthesis and room](063-badge-from-synthesis-and-room.md)                                                                | 6 · Engine 4 & Report 2         | Settled | 2026-09-30 |
| 064 | [Counter-trend caps follow the setup](064-counter-trend-caps-follow-the-setup.md)                                                    | 6 · Engine 4 & Report 2         | Settled | 2026-09-30 |
| 065 | [RRR definition](065-rrr-definition.md)                                                                                              | 6 · Engine 4 & Report 2         | Settled | 2026-09-30 |
| 066 | [Broker figures from MT5](066-broker-figures-from-mt5.md)                                                                            | 6 · Engine 4 & Report 2         | Settled | 2026-09-30 |
| 067 | [Chat-typed setups pre-fill the modal](067-chat-typed-setups-pre-fill-the-modal.md)                                                  | 6 · Engine 4 & Report 2         | Settled | 2026-09-30 |
| 068 | [Report 2 is a fixed template](068-report-2-is-a-fixed-template.md)                                                                  | 6 · Engine 4 & Report 2         | Settled | 2026-09-30 |
| 069 | [Consent record](069-consent-record.md)                                                                                              | 6 · Engine 4 & Report 2         | Settled | 2026-09-30 |
| 070 | [One architecture document and decision log](070-one-architecture-document-and-decision-log.md)                                      | 7 · Platform & governance       | Settled | 2026-09-30 |
| 071 | [Engines named by function](071-engines-named-by-function.md)                                                                        | 7 · Platform & governance       | Settled | 2026-09-30 |
| 072 | [Free tier](072-free-tier.md)                                                                                                        | 7 · Platform & governance       | Settled | 2026-09-30 |
| 073 | [Pro quota method](073-pro-quota-method.md)                                                                                          | 7 · Platform & governance       | Settled | 2026-09-30 |
| 074 | [One entitlement table](074-one-entitlement-table.md)                                                                                | 7 · Platform & governance       | Settled | 2026-09-30 |
| 075 | [One trace per answer](075-one-trace-per-answer.md)                                                                                  | 7 · Platform & governance       | Settled | 2026-09-30 |
| 076 | [Retention](076-retention.md)                                                                                                        | 7 · Platform & governance       | Settled | 2026-09-30 |
| 077 | [Prompt privacy](077-prompt-privacy.md)                                                                                              | 7 · Platform & governance       | Settled | 2026-09-30 |
| 078 | [Degraded modes](078-degraded-modes.md)                                                                                              | 7 · Platform & governance       | Settled | 2026-09-30 |
| 079 | [Golden scenarios](079-golden-scenarios.md)                                                                                          | 7 · Platform & governance       | Settled | 2026-09-30 |
| 080 | [Operations dashboard and alerts](080-operations-dashboard-and-alerts.md)                                                            | 7 · Platform & governance       | Settled | 2026-09-30 |
| 081 | [Safety texts in all 16 languages](081-safety-texts-in-all-16-languages.md)                                                          | 7 · Platform & governance       | Settled | 2026-09-30 |
| 082 | [MCD development standard](082-mcd-development-standard.md)                                                                          | 2 · Sensors (MCDs)              | Settled | 2026-09-30 |
| 083 | [MCD1 and MCD2 windows count the channel's closed bars](083-mcd1-and-mcd2-windows-count-the-channels-closed-bars.md)                 | 2 · Sensors (MCDs)              | Settled | 2026-10-01 |
| 084 | [Rules version draft-1 reads the draft table where it is silent](084-draft-1-reads-the-draft-table-where-it-is-silent.md)            | 3 · Synthesis & entry zones     | Settled | 2026-10-04 |
| 085 | [Caution is inherited from the sensors a rule read](085-caution-is-inherited-from-the-sensors-a-rule-read.md)                        | 3 · Synthesis & entry zones     | Settled | 2026-10-04 |
| 086 | [The reference price is the close of the last closed M5 bar](086-the-reference-price-is-the-last-closed-m5-close.md)                 | 3 · Synthesis & entry zones     | Settled | 2026-10-04 |
| 087 | [Support and resistance levels are structure, not zone sources](087-support-and-resistance-levels-are-structure-not-zone-sources.md) | 3 · Synthesis & entry zones     | Settled | 2026-10-04 |
| 088 | [Zone sources are the M5 channel levels](088-zone-sources-are-the-m5-channel-levels.md)                                              | 3 · Synthesis & entry zones     | Settled | 2026-10-04 |
| 089 | [Zone edge cases](089-zone-edge-cases.md)                                                                                            | 3 · Synthesis & entry zones     | Settled | 2026-10-04 |
| 090 | [The support and resistance levels travel in the cycle bundle](090-the-support-and-resistance-levels-travel-in-the-cycle-bundle.md)  | 2 · Sensors (MCDs)              | Settled | 2026-10-04 |
| 091 | [SYN readings and entry zones have their own tables](091-syn-readings-and-zones-have-their-own-tables.md)                            | 3 · Synthesis & entry zones     | Settled | 2026-10-04 |
| 092 | [The SYN flag](092-the-syn-flag.md)                                                                                                  | 3 · Synthesis & entry zones     | Settled | 2026-10-04 |
| 093 | [Exact rational arithmetic for the money maths](093-exact-rational-arithmetic-for-the-money-maths.md)                                | 6 · Engine 4 & Report 2         | Settled | 2026-10-09 |
| 094 | [The spread and the fill price in the sizing](094-spread-and-the-fill-price-in-the-sizing.md)                                        | 6 · Engine 4 & Report 2         | Settled | 2026-10-09 |
| 095 | [Stop options come from the stored readings and the cycle bundle](095-stop-options-from-the-stored-readings-and-the-cycle-bundle.md) | 6 · Engine 4 & Report 2         | Settled | 2026-10-09 |
| 096 | [Profile history and consent are append-only; the audit hash is keyed](096-profile-history-and-the-keyed-audit-hash.md)              | 6 · Engine 4 & Report 2         | Settled | 2026-10-10 |
| 097 | [Report 2 is a fixed template over one validated setup](097-report-2-is-a-fixed-template-over-one-validated-setup.md)                | 6 · Engine 4 & Report 2         | Settled | 2026-10-10 |
