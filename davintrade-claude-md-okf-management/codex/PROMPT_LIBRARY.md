---
type: Concept/Template
status: active
updated_at: 2026-10-11
---

# Prompt library: assign and coordinate work

Use with the [operating manual](OPERATING_MANUAL.md). Davin copies one filled
common contract and one stage block into a single message to the chosen agent.
Include actual artifacts or accessible absolute paths. A stage block alone is
incomplete. Replace every `<...>` field; placeholders are not authorization,
revision evidence or ownership.

Proposed future stages are **DRAFT** and cannot execute before their stated
approval and entry gates hold. Any read-only preparation must itself be within
authorized scope. **READY** means authorization is recorded; the executor still
checks live entry conditions. Already authorized ad-hoc work needs no duplicate
approval. No template dispatches an agent or grants Git/production approval.

Write prompts/artifacts in English. Replies follow the
[language policy](../../docs/agent-collaboration/LANGUAGE-POLICY.md): normally
English, Thai when Davin writes Thai in that session unless explicitly overridden.
Thai chat alone keeps artifacts in English; product i18n is unchanged.

## 1. Common contract: attach to every executor stage

```text
TASK CONTRACT
Repository: D:/SaaS Project/trading-alerts-saas-public
Task/order ID and artifact path: <unique ID; accessible path>
Goal: <observable behavior or deliverable>
Participation: <Advisor + Claude / Advisor + Codex / direct Claude / direct Codex>
Mode: <single executor / build-and-review / parallel / handover>
Stage/status: <current stage; READY or DRAFT>
Authorization: <Davin's exact instruction or APPROVED order reference>
Authorized scope/stage: <precise boundary>
Pending decisions / explicit sign-offs: <None or actual gates>
Order mode: <numbered order or ad-hoc; phase/session unchanged for ad-hoc>
Entry gates: <source/runtime prerequisites and prior-stage artifacts>
Numbered orders require CONFIRMED after live code AND runtime checks.
Ad-hoc work uses the direct instruction and relevant live-source confirmation.
Advisor proposals and task records do not grant approval.

Implementer/current writable owner: <name>
Reviewer/independence requirement: <name/context or not required>
Integrator: <name>
Shared-state writer: <name and exact state scope, or handoff-only>
Dev/build/generator/mutation/external-test resource owners: <names or not used>

Worktree: <absolute path>
Branch: <actual branch or live entry check>
Base/source revision: <verified SHA or require capture before editing>
Prior handoff/snapshot: <absolute path; scoped diff/hashes if uncommitted>
Known dirty files/active owners: <actual paths; preserve others' work>
Allowed implementation writes: <files/directories, tests, generated outputs>
Allowed task/report/state writes: <unique artifacts; owned state only>
Excluded/frozen paths: <exact boundaries; seed-code/** is read-only>
Shared interfaces/dependency order: <agreed contract and owner>
Cross-worktree artifact transfer: <local path/scoped patch/authorized commit>
Uncommitted source and task documents do not travel automatically.

Acceptance criteria: <concrete behavior and checks>
Required verification: <checks/commands, cwd, prerequisites, resource coordination>
Return artifacts: <task, handoff or review report paths>
Next owner/stage and gate: <name, action, entry conditions>
Stop/transfer condition: <boundary and acknowledgment>
Commit/push/merge/deploy/flags authorization: <None unless explicitly granted>
Production migrations and entering login credentials remain prohibited.

Apply your root router, shared non-negotiables, nested instructions and live
source. Read relevant state/blockers, not all history. Preserve existing edits,
untracked files and deletions; never stash or broadly reset/restore/clean.
Return out-of-scope money/auth/grants/secrets/CORS and explicit sign-off gates
to Davin; continue independent authorized work. Write artifacts in English.
Report actual command/cwd/exit/pass-fail-skip evidence and unavailable checks.
```

When a revision is unknown, specify a live entry check and let the executor
record the actual value. Never invent a SHA/branch. The receiving worktree needs
an actual verified starting ref and access to the required source and artifacts.

## 2. Direct assignment to Codex

Attach the filled contract, then paste:

```text
You are Codex, the assigned implementer.
Read AGENTS.md, .claude/rules/non-negotiables.md, relevant nested instructions,
the Codex lifecycle and shared collaboration guide. Read the task/order, relevant
handoff, task-related state and blockers. Inspect checkout, branch, HEAD and
dirty target files. Verify authorization/source/entry gates before editing.

For DRAFT or unmet gates, perform only authorized preparation and report the
gate. For READY work, proceed without duplicate approval. For 3+ steps or shared
work, create a unique checklist using docs/codex/templates/task.md. Implement
only the contract scope and continue authorized, unblocked items through progress
updates and compaction. Coordinate shared-resource owners before writing checks.

Select verification from the change/package/order. Root tsc alone does not
type-check tests; UI changes need browser evidence. Read installed Next.js guides
before changing Next.js code. Record actual results and unavailable checks.
Publish the assigned handoff using docs/codex/templates/handoff.md with source
revision, uncommitted diff/hashes, paths, deviations and done criteria. Update
shared state or Codex continuity only if named writer. Complete required review
gates; otherwise name the exact next action and owner.
```

## 3. Direct assignment to Claude Code

Attach the filled contract, then paste:

```text
You are Claude Code, the assigned implementer.
Read CLAUDE.md, shared non-negotiables, the collaboration guide and applicable
Claude lifecycle/checklist/subagent rules. Read the task/order, relevant handoff,
state and blockers. Inspect live checkout, branch, HEAD and dirty target files.
Verify authorization and entry gates; numbered work requires CONFIRMED after
code/runtime checks. Direct ad-hoc scope needs no duplicate approval.

Record equivalent ownership in the approved order/build plan or assigned task;
do not take Codex's checklist. Implement allowed paths and maintain continuity.
Coordinate build/generator/test resources. Select checks from the change and
mandated order; root tsc excludes tests. UI changes need browser evidence and
Next.js edits require reading installed guides.

Publish the assigned stable handoff with authorization, revision, uncommitted
diff/hashes, paths, deviations, done criteria and actual check results. Update
canonical state/archive only if named writer; otherwise name the pending writer.
Respect required independent review and all contract gates.
```

## 4. Claude builds; Codex reviews

Send Claude the builder prompt first. After its stable handoff exists, attach
a filled review contract and paste into the selected Codex reviewer context:

```text
You are Codex, the independent reviewer of Claude Code's implementation.
Read AGENTS.md, shared rules, task/order and the actual builder handoff.
Validate base/head revision, uncommitted diff/file hashes and exact reviewed
paths against live source. Confirm the builder stabilized those paths. Required
P6/session B review uses a fresh context that did not help build the work.

Implementation, builder checklist and shared state are read-only. Write only
your assigned unique report. Check behavior/contracts/security against acceptance
criteria and independently run suitable checks when available and authorized.
Resource-writing checks require ownership or an isolated snapshot. Builder test
claims are attributed evidence, not checks you personally ran.

Report severity, file/line, trigger, consequence and correction for each verified
defect; distinguish suspicions and unavailable gates. Reconfirm snapshot stability
at close. Changed source invalidates affected evidence and needs rechecking.
Return findings to the builder through Davin's workflow; do not silently fix
implementation. A review pass does not satisfy separate owner/production gates.
```

## 5. Codex builds; Claude reviews

Send Codex the builder prompt first. After its stable handoff exists, attach
a filled review contract and paste into Claude's reviewer context:

```text
You are Claude Code, the independent reviewer of Codex's implementation.
Read CLAUDE.md, shared rules, task/order and the actual Codex handoff. Verify the
checkout, base/head revision, uncommitted diff/file hashes and exact paths.
Use a fresh context when required; prior builder participation cannot satisfy it.

Keep implementation, builder checklist and shared state read-only. Write only
your assigned report. Independently check behavior/contracts/security and done
criteria; coordinate resources or use an isolated snapshot for writing checks.
Do not claim the builder's tests as your own; root tsc does not type-check tests.
Report actual results, severity/file/line/trigger/consequence/correction for
defects, and separate suspicions or unavailable checks.

Reconfirm snapshot stability before closing; invalidate affected evidence if
changed. Return findings to the named builder through Davin. Do not silently fix
implementation or treat a pass as Git/production approval or explicit sign-off.
```

## 6. Parallel slice A, slice B and integration

Fill two contracts with disjoint paths and separate worktrees. Assign shared
contract/generated/state/resource owners in both. Send one block per executor.

```text
You are Claude Code, owner of parallel slice A.
Read CLAUDE.md, shared rules, collaboration and assigned task/interface artifacts.
Verify your actual worktree, branch, starting revision, ownership and entry gates.
Implement only slice A's runtime/test/generated/metadata paths. Codex owns slice B
in a separate worktree; shared resources belong to the named owners. Do not
invent pending interfaces or overwrite their outputs.

Verify required task/interface artifacts were explicitly transferred; uncommitted
files are not shared automatically. Maintain your checklist, verify slice A and
publish its stable handoff with source revision, diff/hashes, paths, actual checks
and next action. Supply outputs through the agreed artifact/patch/authorized-
commit route. The named integrator combines work after both slices' gates hold.
```

```text
You are Codex, owner of parallel slice B.
Read AGENTS.md, shared rules, collaboration and assigned task/interface artifacts.
Verify your separate worktree, branch, starting revision, ownership and entry gates.
Implement only slice B's runtime/test/generated/metadata paths. Claude owns slice A.
Shared contracts, lockfiles, state, generated outputs and external resources belong
to the named owners; coordinate writing checks and respect pending interfaces.

Verify transferred task/interface artifacts. Maintain a unique checklist and
verify slice B. Publish its stable handoff with revision, diff/hashes, paths,
command/cwd/exit/count evidence and next action. Use the agreed transfer route.
Only the named integrator combines outputs after both slices' gates hold.
```

After both handoffs exist, attach an authorized integration contract and paste:

```text
You are the named integrator for this parallel task.
Read your root router, shared rules, both tasks/handoffs and agreed interface.
Integration is gated on accessible matching source snapshots and required slice
checks. Verify destination HEAD, dirty files and ownership; preserve unrelated work.

Combine only scoped outputs through the agreed transfer method. Coordinate shared
contract/generated/resource owners. Run relevant combined producer/consumer and
acceptance checks; changed source invalidates affected earlier evidence. Resolve
in-scope conflicts and record deviations; return out-of-scope decisions to Davin.

Publish one integration handoff with both input snapshots, combined revision/
diff/hashes, checks and unresolved gates. Only the designated writer updates
canonical status. Git/production actions retain their separate authorization.
```

If the integration prompt is prepared earlier, mark it DRAFT and include those
entry gates. Slice completion alone does not authorize merge or deployment.

## 7. Sender closeout and receiver takeover

Davin assigns both stages. Attach each agent's filled contract; an unfinished
checklist alone never grants ownership.

```text
You are the sending owner of the assigned handover scope.
Read your root router, shared rules and current task. Stop all implementation
writes BEFORE capturing its stable snapshot and publishing the handoff. Remain
stopped afterward. Assigned handoff/task closeout writes are allowed without
changing the source represented by that snapshot.

Publish authorization, worktree/branch/base/head revision, uncommitted diff/hashes,
new/changed/deleted paths, complete/remaining steps, exact verification, blockers,
resources and next owner. Explain how source/task artifacts reach the receiver.
Record released/awaiting acknowledgment; do not claim receiver acceptance. If
rejected, explicitly restore the prior owner before that owner resumes writes.
```

```text
You are the receiving owner of the assigned handover scope.
Read your root router, shared rules, task and sender's actual handoff. Before
implementation writes, verify authorization, sender freeze, source snapshot,
artifact transfer, remaining steps and resource ownership. An unfinished
checklist or silence is not permission to take over.

Accept only the stated scope. Record acknowledgment and ownership transfer in
your assigned task/acceptance artifact BEFORE implementation writes. Confirm the
sender stays stopped. If evidence or ownership is inconsistent, record the exact
blocker and do not pretend acceptance occurred.

After acceptance, revalidate relevant source/checks and finish authorized work.
Use your assigned checklist; edit a transferred record only if its ownership was
explicitly transferred. Publish new verification/handoff and owned state only.
```

## 8. Fix findings and recheck

Attach a builder fix contract referencing the actual findings:

```text
You are the builder assigned to fix the linked review findings.
Read your root router, task and actual report. Check the reviewed snapshot against
current source. Fix verified in-scope findings in allowed paths, preserving
unrelated work. Return out-of-scope decisions to Davin while completing independent
fixes. Record each correction and verify affected behavior. Publish a new stable
snapshot/handoff with exact checks for the named reviewer. Do not claim that
reviewer rechecked it or expand this assignment into unrelated work.
```

Attach a reviewer recheck contract:

```text
You are the independent reviewer rechecking the fixes.
Read your root router, task, original findings and actual fix handoff. Verify the
new snapshot. Keep implementation and builder/shared state read-only; write only
your report. Check corrections, regressions and remaining acceptance gates.
Mark each finding fixed/open/unconfirmed with actual evidence. Identify invalidated
earlier evidence and reconfirm snapshot stability. Do not approve untested changes
or substitute your pass for owner/production authorization.
```

## 9. Continue after resume or compaction

Attach the current contract and latest durable records:

```text
Resume the attached task; do not start unrelated work. Read your root router,
shared rules, current task, latest handoff and latest user steering. Inspect live
checkout, HEAD and diff. Reconcile checklist with source and current ownership.
Continue authorized, unblocked work through verification and required review.

Do not repeat completed steps solely because context reset, request already
granted scope approval or reopen settled choices without new evidence. Explicit
sign-off and unapproved future scope remain gated. A transferred scope needs
receiver acceptance before writing. Record blockers accurately and publish the
required final handoff and owned state.
```

## 10. Ask Antigravity to choose the next stage

First use this package's [opening prompt](OPENING_PROMPT_TO_ANTIGRAVITY.md).
This later-task prompt supplements onboarding:

```text
Act as Advisor under the repository Advisor protocol.
Davin's goal/policy: <actual goal/policy>
Participation preference: <actual setup or recommendation requested>
Evidence: <accessible current task/order/handoff and relevant state>

Read supplied evidence; list files actually read and access limitations.
Distinguish proposals, Davin's decisions and verified facts. Recommend a single
executor or one of the three joint modes with dependency/ownership/review reasons.
Prepare one English current-stage prompt using a filled contract and stage block.
Name scopes, entry snapshot checks, reviewer/integrator/state/resource owners,
acceptance checks, return artifacts and stop/transfer conditions.

Davin decides and forwards prompts. Mark unapproved/future stages DRAFT with exact
execution gates. Recognize existing ad-hoc authorization without duplicate approval.
Do not dispatch agents, implement code, invent a SHA/approval or treat a review pass
as production permission or explicit owner sign-off.
```

For missing gates or stale snapshots, see
[maintenance and troubleshooting](MAINTENANCE_AND_TROUBLESHOOTING.md).
