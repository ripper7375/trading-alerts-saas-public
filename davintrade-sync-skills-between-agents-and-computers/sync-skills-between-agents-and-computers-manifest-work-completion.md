# Sync Skills Between Agents and Computers: Architecture Design and Work-Completion Manifest

| Field          | Value                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Status         | Completed. Verified on both machines on 2026-11-20 and re-checked against the live system on 2026-11-21.                             |
| Version        | 1.0, written 2026-11-21                                                                                                              |
| Owner          | Davin                                                                                                                                |
| Built by       | Claude Code (Executor), on top of a baseline that Antigravity (Advisor) built on 2026-11-19                                          |
| Scope          | Per-user tooling on two Windows machines. No application code, database, deployment, secret or package file is touched.              |
| Audience       | Davin, the Advisor, and any agent that installs, updates or removes skills                                                           |
| Related skills | `install-skills-shared` (the rule agents follow, plus the safety-net scripts) and `sync-agy-to-claude` (describes the baseline sync) |

> **Public repository.** This folder is tracked in a public repository, so host names, user names, device IDs, Syncthing folder IDs and IP addresses are left out on purpose (`.claude/rules/non-negotiables.md`, rule 9). Paths use `~` for the user profile (`C:\Users\<user>`). The two computers are **Machine 1** (Antigravity is the main tool there) and **Machine 2** (Claude Code is the main tool there, and this work was run from it). Both machines have both tools. Times are local time (UTC+7).

## Contents

1. [Summary](#1-summary)
2. [Background and problem](#2-background-and-problem)
3. [Goals, non-goals and constraints](#3-goals-non-goals-and-constraints)
4. [Design principles](#4-design-principles)
5. [Architecture](#5-architecture)
6. [Components](#6-components)
7. [Behaviour](#7-behaviour)
8. [Design decisions](#8-design-decisions)
9. [Completion manifest](#9-completion-manifest)
10. [Operations runbook](#10-operations-runbook)
11. [Security and privacy](#11-security-and-privacy)
12. [Limitations and open items](#12-limitations-and-open-items)
13. [Possible future work](#13-possible-future-work)
14. [Glossary](#14-glossary)

## 1. Summary

Every skill (a folder with a `SKILL.md`) now lives in one folder per machine, the **hub**: `~/.agent-shared/skills`. Claude Code and Antigravity both read the hub, and Syncthing mirrors it between the two machines. A script moves skills that were installed in the wrong place into the hub, so the result no longer depends on an agent picking the right folder.

What this gives you:

- **One install, four readers.** Claude Code and Antigravity, on Machine 1 and Machine 2.
- **Nine skills in the hub today:** the six `nestjs*` skills, `security-audit`, `sync-agy-to-claude` and `install-skills-shared`. `~/.claude/skills` holds 26 links on each machine: 9 to the hub and 17 to the skills of active Antigravity plugins.
- **Self-healing installs.** A skill installed in a tool's own folder (`~/.claude/skills` or `~/.gemini/config/skills`) is moved into the hub within about 2 to 7 minutes and then follows the normal path.
- **Unattended.** One Windows Scheduled Task runs at logon and every 5 minutes. On Machine 2 the last check (2026-11-21 09:11) showed result 0 and a current heartbeat, more than 10 hours after the final wiring.

| Question                                         | Answer                                                                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Where do I install a skill?                      | `~/.agent-shared/skills`, nowhere else                                                                                        |
| How does Claude Code see it?                     | A directory junction `~/.claude/skills/<skill>`, made by `sync-agy-to-claude.ps1`                                             |
| How does Antigravity see it?                     | An entry in `~/.gemini/config/skills.json` with an absolute path to the hub                                                   |
| How does the other machine get it?               | Syncthing folder `agent-shared-skills` (send-receive, the `skills` folder only)                                               |
| What if a skill is installed in the wrong place? | `adopt-skills.ps1` moves it into the hub (every 5 minutes, after 2 quiet minutes). Conflicts are reported, never overwritten. |
| What runs the automation?                        | Scheduled Task `AntigravityToClaudeAutoSync`, which starts `run-sync-hidden.vbs`, which runs the adopter and then the sync    |
| How do I switch it off?                          | Restore `run-sync-hidden.vbs.bak` (adopter off) or disable the Task (everything off). See section 10.8.                       |

## 2. Background and problem

Two agents on two machines are four readers that all need the same skills, and each agent reads skills from its own folders:

| Location                                               | Read by                                                                          | Mirrored to the other machine? |
| ------------------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------ |
| `~/.claude/skills/<skill>`                             | Claude Code                                                                      | No                             |
| `~/.gemini/config/skills/<skill>`                      | Antigravity (loose global skills)                                                | No                             |
| `~/.gemini/config/plugins/<plugin>/skills/<skill>`     | Antigravity (plugins)                                                            | No                             |
| `~/.agent-shared/skills/<skill>` (the hub)             | Before this work: only the baseline sync script, which links it into Claude Code | No                             |
| `<project>/.claude/skills`, `<project>/.agents/skills` | One agent in one project                                                         | With the project               |

**Baseline (2026-11-19, built by Antigravity at the owner's request).** `sync-agy-to-claude.ps1` links the skills of active Antigravity plugins and the hub into `~/.claude/skills`, and mirrors some MCP servers. The direction is one way: Antigravity to Claude Code. A Scheduled Task runs it every 5 minutes, a Claude Code hook runs it at session start, and an Antigravity plugin (`dev-stack-bridge`) runs it at Antigravity session start. Syncthing already mirrored the project working tree between the two machines.

**Problems found on 2026-11-20 while installing the NestJS skills** (<https://github.com/nestjs/agent-skills>):

1. The usual install command (`npx @nestjs/skills add --agent claude --global`) wrote real copies into `~/.claude/skills`. Antigravity never reads that folder and Syncthing did not watch it, so the skills existed in one tool on one machine. The first install had to be undone and redone.
2. Antigravity could not read the hub. `~/.gemini/config/skills.json` already listed the hub, but as `~/.agent-shared/skills`. Antigravity on Windows does not expand `~` and rejected the entry ("must be an absolute path", 28 errors in its language server log).
3. The hub was not mirrored between the machines. Only the project tree was.
4. Nothing prevented the next wrong-place install. Which folder an agent picks for a plain "install this skill" is unpredictable, so an instruction alone is not a guarantee.

## 3. Goals, non-goals and constraints

**Goals**

- **G1.** One install reaches both agents on both machines.
- **G2.** After setup there is no manual step except waiting, and it survives a reboot.
- **G3.** Wrong-place installs correct themselves without depending on agent behaviour.
- **G4.** Non-destructive: never overwrite, never settle a conflict silently, always reversible.
- **G5.** Share skills only. Machine state (logs, manifests, absolute paths) stays on its machine.
- **G6.** The same files on both machines, with no hard-coded user names where the platform allows.

**Non-goals**

- Project-level skills (`<project>/.claude/skills`, `<project>/.agents/skills`). They travel with the repository.
- Claude-native plugins, and the Antigravity plugin marketplace as a transport. Install a plugin on each machine.
- MCP servers. The baseline mirrors some from Antigravity to Claude Code; that is unchanged.
- Trust, signing or review of skill content (see section 11).
- macOS, Linux, or a third machine (section 10.7 lists what a third machine needs).

**Constraints and what they forced**

| Constraint                                                                           | Consequence                                                                                                                                                     |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows 11, Windows PowerShell 5.1, no administrator rights                          | Junctions (no privilege needed) instead of symlinks. Scripts are PowerShell 5.1 safe and ASCII only. The Task runs as the interactive user with limited rights. |
| Antigravity rejects `~` in `skills.json` on Windows                                  | An absolute, forward-slash path on each machine. The file stays per machine.                                                                                    |
| `Remove-Item -Recurse` on a junction can delete the target's files in PowerShell 5.1 | Links are removed only with `[System.IO.Directory]::Delete(path, $false)`.                                                                                      |
| Syncthing is the only cross-machine transport                                        | Mirroring happens only while Syncthing runs and both machines are online.                                                                                       |
| The Task stops a run after 2 minutes                                                 | Both scripts must finish well inside that. The sync script has a fast exit, and the adopter hashes a folder only when a name clash needs it.                    |
| A byte-order mark breaks JSON read by Go (Antigravity)                               | `skills.json` is written without a BOM.                                                                                                                         |
| Scheduled runs are hidden (no console window)                                        | Failures are silent unless logged, hence the heartbeat and logs.                                                                                                |

## 4. Design principles

1. **One source of truth.** The hub is canonical. Every other copy is derived from it.
2. **Real in the hub, links elsewhere.** Hub entries are real folders, so Syncthing ships content. Per-tool folders hold junctions that point at them.
3. **Adapt the reader, not the data.** Claude Code and Antigravity are pointed at the hub. Skills are never copied per tool.
4. **Share skills, not state.** Only `skills` is mirrored. Manifests, logs, the heartbeat and `skills.json` stay per machine.
5. **Guarantee by code, advise by instruction.** The `install-skills-shared` skill tells agents the rule. The adopter enforces the outcome.
6. **Non-destructive by default.** A report-only mode exists. The adopter moves (renames) but never copies over, never overwrites the hub and never touches a conflict.
7. **Idempotent and exclusive.** Any run can be repeated safely, and one named mutex keeps the sync, the adopter and the hooks from overlapping.
8. **Observable.** Every unattended action leaves a trace: the heartbeat, `adopt.log`, `sync.log` and the manifest.

## 5. Architecture

### 5.1 Topology

```text
            MACHINE 1                                          MACHINE 2
+---------------------------------+                +---------------------------------+
| HUB  ~/.agent-shared/skills     |   Syncthing    | HUB  ~/.agent-shared/skills     |
| one real folder per skill       | <------------> | one real folder per skill       |
+---------+-----------------+-----+  (skills only) +---------+-----------------+-----+
          |                 |                                |                 |
          | junctions       | skills.json                    | junctions       | skills.json
          v                 v (absolute path)                v                 v (absolute path)
  ~/.claude/skills    Antigravity                    ~/.claude/skills    Antigravity
  (Claude Code)       (global skills)                (Claude Code)       (global skills)
```

### 5.2 Where a skill ends up

| Install route                                                                                          | Lands in                                                 | Seen by                                                                          | Reaches the other machine?          | What happens                                     |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------ |
| Installer with `--dir` pointing at the hub, a hand copy, or a clone copied into the hub (**the rule**) | The hub                                                  | Claude Code (junction) and Antigravity (`skills.json`)                           | Yes, through Syncthing              | Nothing more to do                               |
| The installer's Claude route (`--agent claude`, `--global`)                                            | `~/.claude/skills/<skill>` as a real folder              | Claude Code on this machine only                                                 | No                                  | The adopter moves it into the hub                |
| An Antigravity loose global skill                                                                      | `~/.gemini/config/skills/<skill>`                        | Antigravity on this machine only                                                 | No                                  | The adopter moves it into the hub                |
| An Antigravity marketplace plugin                                                                      | `~/.gemini/config/plugins/<plugin>/skills/<skill>`       | Antigravity, and Claude Code on this machine through links the sync script makes | No (plugin folders are per machine) | Out of scope: install the plugin on each machine |
| A Claude plugin                                                                                        | Claude's plugin store                                    | Claude Code only                                                                 | No                                  | Out of scope                                     |
| A project-level skill                                                                                  | `<project>/.claude/skills` or `<project>/.agents/skills` | One agent in that project                                                        | With the project                    | Out of scope                                     |

### 5.3 Stray adoption path

```text
A skill lands in a tool's own folder:
  ~/.claude/skills/<skill> (real folder)    or    ~/.gemini/config/skills/<skill>
        |
        v
adopter, every 5 minutes: eligible?
  (SKILL.md present, name matches the folder, no .git, no links inside, quiet for 2 minutes)
        |
        +-- hub has no <skill> ............ ADOPT      move it into the hub
        +-- hub has an identical one ...... SYNC-OWNS  Claude copy: the sync script turns it into a link
        |                                   DROP-DUP   Antigravity copy: removed
        +-- hub has a different one ....... CONFLICT   leave both, write to adopt.log
        |
        v
sync script links hub/<skill> into ~/.claude/skills  ->  Antigravity reads the hub
  ->  Syncthing mirrors the hub  ->  the other machine links it within 5 minutes
```

### 5.4 What runs when

| Trigger                   | What runs                                              | Notes                                                                                           |
| ------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Windows logon             | Task: runner, which runs the adopter and then the sync | Task trigger 1                                                                                  |
| Every 5 minutes           | Task: runner, which runs the adopter and then the sync | Task trigger 2 (repeats for 3,650 days)                                                         |
| Claude Code session start | Sync only                                              | User hook in `~/.claude/settings.json`, 15 second timeout, `-Silent`                            |
| Antigravity session start | Sync only                                              | Hook in the `dev-stack-bridge` plugin (`hooks.json`), 15 second timeout, `-AgyHook` prints `{}` |
| By hand                   | Either script                                          | The adopter reports only unless `-Apply` is given                                               |

## 6. Components

### 6.1 The hub

- **Path:** `~/.agent-shared/skills`. One real folder per skill: `<skill>/SKILL.md` plus any `references/` and `scripts/`. Never links.
- **Rules for an entry:** the folder name equals the `name:` in the frontmatter, `description:` is present, there is no `.git` folder and there are no secrets.
- **`.stfolder`:** Syncthing's marker sits in the hub. It is harmless because it has no `SKILL.md`, so nothing treats it as a skill. No `.stignore` exists.

| Skill                                                                                           | Origin                                                                      | Notes                                                      |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `nestjs`, `nestjs-auth`, `nestjs-data`, `nestjs-feature`, `nestjs-production`, `nestjs-testing` | `@nestjs/skills` 0.1.1, installed with `--dir`                              | The original request of this work                          |
| `install-skills-shared`                                                                         | Written in this work                                                        | The rule for agents, the adopter and the portable runner   |
| `security-audit`                                                                                | Adopted by the adopter from Antigravity's loose global folder on 2026-11-20 | 20 files, same content signature before and after the move |
| `sync-agy-to-claude`                                                                            | Baseline, written by Antigravity on 2026-11-19                              | Describes the sync script                                  |

### 6.2 Claude Code consumer

- `~/.claude/skills/<skill>` is a directory junction to the hub folder (or to an Antigravity plugin skill folder).
- Only `sync-agy-to-claude.ps1` creates and removes these links. It removes only links it created, which the per-machine manifest lists.
- Claude Code lists skills when a session starts, so a new link needs a new session.

### 6.3 Antigravity consumer

`~/.gemini/config/skills.json` carries one entry for the hub:

```json
{
  "entries": [{ "path": "C:/Users/<user>/.agent-shared/skills" }]
}
```

- The path must be absolute with forward slashes. The documented `~/` form fails on Windows.
- The file is per machine, because the path holds the user name. It is written without a BOM. When editing it, keep any other entries.
- `~/.gemini/config/config.json` is never edited by hand.
- Antigravity lists hub skills as Global on its Customizations page. A new chat or a restart picks up changes.

### 6.4 Transport: Syncthing

- **Folder:** label `agent-shared-skills`, path = the hub on each machine, type send-receive on both sides.
- **Settings read on Machine 2:** filesystem watcher on, full rescan every 3,600 seconds, no versioning, no `.stignore`, two devices.
- **Devices:** the same two devices that already mirror the project tree (a separate Syncthing folder with the label `SaaS`). No new pairing was needed.
- **Version and start:** v2.1.7 on Machine 2, started at logon by a Startup-folder shortcut. It is not a Windows service, so mirroring runs only while the user is logged on. Machine 1 was not checked for this.
- **Conflict rule:** if both sides change the same file between syncs, the newer file wins and the other is kept as `*.sync-conflict-*`.

### 6.5 The sync script

- **Path:** `~/.agent-shared/sync-agy-to-claude.ps1` (434 lines). Baseline script, unchanged by this work. It lives on each machine and is **not** shipped by Syncthing.
- **Flags:** `-DryRun`, `-SkipMcp`, `-Force` (skip the fast exit), `-Silent`, `-AgyHook`.
- **State:** `~/.agent-shared/.sync-manifest.json` (links it manages, last fingerprint) and `sync.log` (last 100 lines).
- **Job:** keep `~/.claude/skills` in step with the hub and with active Antigravity plugins. Steps are in section 7.2.

### 6.6 The adopter

- **Path:** `~/.agent-shared/skills/install-skills-shared/scripts/adopt-skills.ps1` (320 lines). It sits inside the hub, so Syncthing ships it and both machines run the same version.
- **Parameters:** `-Apply` (without it the script only reports), `-Silent`, `-MinAgeMinutes` (default 2), and overrides for the folders, the log, the heartbeat file and the mutex name.
- **State:** `~/.agent-shared/adopt.last` (heartbeat) and `adopt.log`, both per machine.
- **Job:** move wrong-place skill folders into the hub. It scans only `~/.claude/skills` and `~/.gemini/config/skills`, never the hub, and never follows a link. Rules are in section 7.3.

### 6.7 Runner and Scheduled Task

| Property  | Value (read on Machine 2)                                                                                                                                                                                                                                                              |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task name | `AntigravityToClaudeAutoSync`                                                                                                                                                                                                                                                          |
| Triggers  | At logon, and a time trigger that repeats every 5 minutes for 3,650 days                                                                                                                                                                                                               |
| Action    | `wscript.exe //B //Nologo "<profile>\.agent-shared\run-sync-hidden.vbs"`                                                                                                                                                                                                               |
| Principal | The interactive user, limited (not elevated)                                                                                                                                                                                                                                           |
| Settings  | Ignore a new start while one runs. Start when available, so a missed run happens after wake or logon. Stop after 2 minutes. No battery restrictions.                                                                                                                                   |
| Runner    | `run-sync-hidden.vbs` (12 lines). Runs the adopter with `-Apply -Silent` and waits, then the sync with `-Silent` without waiting. `On Error Resume Next` surrounds the adopter so its failure never blocks the sync. It uses `%USERPROFILE%`, so the same file works on both machines. |

The runner keeps the baseline's `wscript //B` plus window style 0, so no console window appears. The Task registration itself holds a user-specific path to the runner, so it is created per machine.

### 6.8 Instruction layer

- **Skill `install-skills-shared`** (in the hub, so both agents on both machines load it). It tells an agent to install into the hub, how to check the hub and `skills.json` first, how to make both tools see the skill, how to run the adopter, how to remove a skill, and what to report. Its description is written so an agent loads it when asked to install, update, remove or share a skill.
- **Claude auto-memory on Machine 2** records the same rule (`reference-shared-skills-hub`). Memory is per machine, which is why the rule also ships as a skill.

## 7. Behaviour

### 7.1 One scheduled tick

```text
Task Scheduler (at logon, then every 5 minutes; stops after 2 minutes; skips if still running)
  `-- wscript.exe //B run-sync-hidden.vbs                         (no window)
        |-- 1. powershell adopt-skills.ps1 -Apply -Silent         (the runner waits)
        |       take mutex -> scan ~/.claude/skills and ~/.gemini/config/skills
        |       -> move strays into the hub -> write adopt.last and adopt.log
        `-- 2. powershell sync-agy-to-claude.ps1 -Silent          (the runner does not wait)
                take mutex (exit quietly if busy) -> fingerprint unchanged? exit
                -> link hub skills and active plugin skills into ~/.claude/skills
                -> remove stale links -> MCP step -> manifest and sync.log
```

### 7.2 Sync script, step by step

1. Take the named mutex `Local\AntigravityToClaudeAutoSyncMutex` without waiting. If another run holds it, exit quietly (in hook mode print `{}`).
2. Build a fingerprint from Antigravity's `config.json` (time and size), each plugin's name, `plugin.json` and `mcp_config.json` stamps and skill folder names, and the hub's skill folder names. If it equals the fingerprint in the manifest, and neither `-Force` nor `-DryRun` is set, exit. The script's own comment puts this at about 100 ms. The fingerprint covers folder names, not file contents, so editing a skill in place needs no relink: the junction already points at the live folder.
3. Work out the active Antigravity plugins: every folder under `~/.gemini/config/plugins` with a `plugin.json`. A plugin is enabled by default, `plugin.json` can disable it (`disabled: true`), and an `enabled` value for that plugin in `config.json` overrides both. `config.json` is read and never written.
4. Build the desired skill map: first every hub folder that has a `SKILL.md`, then the skills of each active plugin. It skips the plugin `vercel-plugin` and any skill named `frontend-design`, which Claude provides natively. The hub wins a name clash.
5. For each desired skill, look at `~/.claude/skills/<name>`:
   - missing: create a junction to the source;
   - a junction to the right target: keep it;
   - a junction to another target: delete the link (never its contents) and recreate it;
   - a real folder whose `SKILL.md` has the same SHA-256 as the source's: delete the real folder and create the junction (`CONVERTED COPY`);
   - a real folder with a different `SKILL.md`: leave it (`SKIPPED CUSTOM`).
6. Remove links that an earlier run created (names in the manifest) and that are no longer wanted, but only if the path is still a link.
7. MCP step (skipped with `-SkipMcp`): add local (stdio) servers, and servers on an allow-listed public HTTP host, from the active plugins' `mcp_config.json` to Claude Code with `claude mcp add --scope user`. It skips servers Claude already gets natively, removes ones it added earlier that are gone, and only reports remote servers that need OAuth. This is not part of the skills design and this work did not change it.
8. Save the manifest (`lastSyncUtc`, `lastFingerprint`, `managedSkills`, `managedMcps`) and append one summary line to `sync.log`.

### 7.3 Adopter rules

The adopter checks each real folder in its two source folders in this order. The first rule that matches decides.

| Condition                                                                | Result                          | With `-Apply`                                                                                                  |
| ------------------------------------------------------------------------ | ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| The entry is a junction or symlink                                       | Not scanned (counted as a link) | Nothing                                                                                                        |
| The name starts with `.`                                                 | SKIP (hidden)                   | Nothing                                                                                                        |
| No `SKILL.md`                                                            | SKIP (not a skill)              | Nothing                                                                                                        |
| The folder holds a file named `.local-only`                              | SKIP                            | Nothing                                                                                                        |
| The folder has a `.git` folder or a link inside                          | SKIP                            | Nothing                                                                                                        |
| The frontmatter `name` differs from the folder name                      | SKIP                            | Nothing                                                                                                        |
| Something inside changed less than `-MinAgeMinutes` (2) ago              | WAIT                            | Nothing, checked again next run                                                                                |
| The same name is already being adopted from the other source in this run | WAIT                            | Nothing, checked again next run                                                                                |
| The hub has no entry with this name                                      | ADOPT                           | Move the folder into the hub                                                                                   |
| The hub entry is not a plain folder                                      | CONFLICT                        | Nothing, logged                                                                                                |
| The hub entry is identical and the source is the Claude folder           | SYNC-OWNS                       | Nothing. The sync script turns the copy into a link.                                                           |
| The hub entry is identical and the source is the Antigravity folder      | DROP-DUP                        | Delete the loose copy, because it would shadow the hub copy, and only if the hub copy still has its `SKILL.md` |
| The hub entry exists with different content                              | CONFLICT                        | Nothing, logged once per change                                                                                |

Details:

- **Signature.** One SHA-256 over every file's relative path and content hash. Equal means the same files with the same bytes. Timestamps are ignored.
- **Quiet period.** The newest change time anywhere inside the folder (files and subfolders) must be at least `-MinAgeMinutes` old, so an installer that is still writing is left alone.
- **Move.** `Directory.Move`, a rename on the same volume. All three folders are under the user profile, so there is never a half-copied hub entry. Right before moving, it checks again that the source is still a real folder and that the hub name is still free.
- **Report-only by default.** Without `-Apply` it prints what it would do and changes nothing. `-Apply` takes the mutex.
- **Heartbeat.** Each `-Apply` run overwrites `adopt.last`. Line 1 is the time and the counts (`moved`, `adopt`, `drop-duplicate`, `conflict`, `waiting`, `skipped`). Line 2 is `conflicts=` plus the first 16 hex digits of a hash of the conflict lines. `E3B0C44298FC1C14` means there are none (it is the hash of an empty text).
- **Log.** `adopt.log` records `ADOPTED`, `DROPPED duplicate`, `FAILED`, and `CONFLICTS changed` or `CONFLICTS cleared`, once per change and not once per run. It rotates to `adopt.log.old` at 256 KB.

### 7.4 Concurrency and ordering

- One mutex, `Local\AntigravityToClaudeAutoSyncMutex`, is shared by the sync script and the adopter (`-Apply`). `Local\` means one logon session, which fits the per-user Task, the hooks and manual runs. Both scripts try once and exit quietly if it is taken. An abandoned mutex counts as acquired.
- The runner runs the adopter first and waits for it, then starts the sync without waiting. A skill moved into the hub is therefore linked in the same tick, and a failing adopter never blocks the sync.
- The Claude Code and Antigravity session hooks run only the sync script, under the same mutex. They never adopt.
- The Task ignores a new start while a run is still going and stops a run after 2 minutes.

### 7.5 Timing

| Step                                                | Delay                                                                    | Why                                                                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Stray into the hub                                  | 2 to 7 minutes after the last write                                      | 2 quiet minutes, then the next 5-minute tick. The worst case is a tick that lands just before the 2 minutes pass. |
| Hub skill to a Claude Code link on the same machine | Up to 5 minutes, sooner if a session starts                              | Task tick, or the session hook                                                                                    |
| Hub to Antigravity                                  | None, but a new chat or restart is needed                                | Antigravity reads the folder directly                                                                             |
| Hub to the other machine                            | Seconds to about a minute (about a minute in the create and delete test) | Syncthing filesystem watcher, with an hourly rescan as fallback                                                   |
| Link on the other machine                           | Up to 5 minutes                                                          | Its own Task tick                                                                                                 |

Worst case for a stray to be usable by Claude Code on the other machine: 7 + 1 + 5 = 13 minutes. This is arithmetic from the settings, not a measurement.

### 7.6 Failure handling

| Failure                                        | What happens                                                                        | Where you see it                               | Recovery                                     |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------- |
| Another run holds the mutex                    | The run exits quietly                                                               | Nowhere                                        | The next tick does the work                  |
| A move fails (file in use, volume mismatch)    | `FAILED <source>/<name>` is logged and the source stays where it was                | `adopt.log`                                    | Fix the cause. The next tick retries.        |
| The adopter cannot start or crashes            | The runner carries on with the sync                                                 | A stale heartbeat                              | Run the adopter by hand to see the error     |
| Same name, different content                   | Nothing changes (CONFLICT)                                                          | `adopt.log`, and `conflict=N` in the heartbeat | Decide by hand (section 10.4)                |
| Syncthing offline or paused                    | Changes queue on each side, nothing is lost                                         | Syncthing GUI                                  | Resume. It catches up.                       |
| The same file changed on both sides            | Newer file wins, the other becomes `*.sync-conflict-*`                              | A file in the hub                              | Keep the right one, delete the other         |
| The hub folder is deleted on one machine       | Syncthing deletes it on the other, and the next sync there removes the link it made | `sync.log`                                     | Restore from a backup (no versioning exists) |
| `skills.json` missing, relative or has a BOM   | Antigravity ignores the hub and logs an error. Claude Code is unaffected.           | `language_server.log`                          | Fix the file (section 6.3)                   |
| Task disabled, user logged off, machine asleep | No runs. After wake, one missed run happens.                                        | A stale heartbeat                              | Check the Task state                         |

## 8. Design decisions

| ID  | Decision                                                                                                                                                          | Reason                                                                                                    | Alternative not taken                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| D1  | One hub per machine at `~/.agent-shared/skills`, real folders only                                                                                                | It was already the baseline's shared skills folder. Real folders are what Syncthing can ship.             | Sharing `~/.claude/skills` (Antigravity cannot read it)                                 |
| D2  | Claude Code reads the hub through directory junctions made by the baseline sync script                                                                            | No privilege needed, one copy of the data, and the script and its manifest already existed                | Copies per tool (they drift and are not shared), or symlinks (need privilege)           |
| D3  | Antigravity reads the hub through `skills.json` with an absolute, forward-slash path                                                                              | `skills.json` already listed the hub. Only the path form was wrong.                                       | The `~/` form (rejected by Antigravity on Windows), or a new bridge plugin (not needed) |
| D4  | Syncthing shares only `skills`, as its own folder, over the existing device pair                                                                                  | The manifest, logs, heartbeat and `skills.json` are per machine and would conflict or mislead             | Sharing the whole `.agent-shared` folder                                                |
| D5  | On the first sync, move a differing same-name folder aside before accepting the share                                                                             | When both sides differ, Syncthing keeps the newer file and writes `.sync-conflict` copies                 | Accept first and clean up afterwards                                                    |
| D6  | `skills.json` stays per machine                                                                                                                                   | It holds a machine-specific absolute path                                                                 | Syncing it                                                                              |
| D7  | Enforce the rule with a script (the adopter), not only with instructions                                                                                          | Where an agent installs a skill is unpredictable. The first install of this work went to the wrong place. | Relying on the `install-skills-shared` skill alone                                      |
| D8  | The adopter is report-only by default, and was wired in only after sandbox tests and one manual real run                                                          | A script that moves folders needs proof before it runs unattended                                         | Wiring it in untested                                                                   |
| D9  | The adopter never overwrites the hub and never settles a conflict. An identical Claude copy is left to the sync script. An identical Antigravity copy is removed. | Conflicts need a human. A loose Antigravity copy would shadow the hub copy.                               | Last writer wins, or deleting conflicting copies                                        |
| D10 | A 2-minute quiet period before adopting                                                                                                                           | An installer may still be writing                                                                         | Adopting at once                                                                        |
| D11 | Move by rename, never copy then delete                                                                                                                            | There is no moment when both copies exist or one is half written                                          | Copy and delete                                                                         |
| D12 | Runner order: adopter first, then sync. A failed adopter does not block the sync.                                                                                 | A moved skill is linked in the same tick. The baseline link job must keep working whatever happens.       | Sync first (the new skill waits one tick), or two Tasks                                 |
| D13 | Reuse the baseline Task and mutex, and change only the runner file                                                                                                | No new registration, and rollback is one file copy                                                        | A second Task                                                                           |
| D14 | Keep the baseline's 5-minute polling                                                                                                                              | Simple, and the latency is acceptable (section 7.5)                                                       | A file watcher                                                                          |
| D15 | Make the runner portable with `%USERPROFILE%` and ship a copy inside the hub skill                                                                                | The same file works on both machines                                                                      | Hard-coded user paths (the original runner)                                             |

## 9. Completion manifest

### 9.1 Deliverables

| ID  | Deliverable                                                    | Machine 1                                                              | Machine 2                                               |
| --- | -------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------- |
| W1  | Six NestJS skills in the hub (`@nestjs/skills` 0.1.1, `--dir`) | Arrived by Syncthing, linked, listed as Global in Antigravity          | Installed, linked, listed as Global in Antigravity      |
| W2  | `skills.json` points at the hub with an absolute path          | Done (merged, other entries kept)                                      | Done                                                    |
| W3  | Syncthing folder `agent-shared-skills`                         | Accepted                                                               | Created                                                 |
| W4  | Skill `install-skills-shared`                                  | Arrived, linked, listed in Antigravity                                 | Created, linked                                         |
| W5  | Adopter `adopt-skills.ps1`                                     | Arrived with the hub, same hash                                        | Created, sandbox-tested, used once for `security-audit` |
| W6  | Portable runner, adopter before sync                           | Installed, original kept as `.bak`                                     | Installed, original kept as `.bak`                      |
| W7  | Claude auto-memory entry for the rule                          | Not applicable (memory is per machine, and the skill carries the rule) | Written                                                 |
| W8  | This document                                                  | Arrives with the project tree (Syncthing folder `SaaS`)                | Written here                                            |

### 9.2 Changes by machine

| Item                            | Path                                                    | Change                                                                                | Shared by Syncthing? | Rollback                                                            |
| ------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------- |
| Six NestJS skills               | `~/.agent-shared/skills/nestjs*`                        | Created by the installer                                                              | Yes                  | Delete the folders (this propagates)                                |
| Rule skill                      | `~/.agent-shared/skills/install-skills-shared/SKILL.md` | Created                                                                               | Yes                  | Delete the folder (this propagates)                                 |
| Adopter                         | `.../install-skills-shared/scripts/adopt-skills.ps1`    | Created                                                                               | Yes                  | Restore the old runner, then delete the file                        |
| Portable runner copy            | `.../install-skills-shared/scripts/run-sync-hidden.vbs` | Created                                                                               | Yes                  | Delete the file                                                     |
| `security-audit`                | `~/.agent-shared/skills/security-audit`                 | Moved in from `~/.gemini/config/skills` by the adopter (Machine 2)                    | Yes                  | Move it back                                                        |
| Live runner                     | `~/.agent-shared/run-sync-hidden.vbs`                   | Replaced (2 lines became 12, portable, adopter first)                                 | No                   | Copy `run-sync-hidden.vbs.bak` over it                              |
| Original runner                 | `~/.agent-shared/run-sync-hidden.vbs.bak`               | Created (the original 2-line runner with a hard-coded user path)                      | No                   | Delete when no longer needed                                        |
| Adopter state                   | `~/.agent-shared/adopt.last`, `adopt.log`               | Created at run time                                                                   | No                   | Safe to delete                                                      |
| `skills.json`                   | `~/.gemini/config/skills.json`                          | Entry changed from `~/.agent-shared/skills` to the absolute path                      | No                   | Restore the old value (the hub then stops loading)                  |
| Claude links                    | `~/.claude/skills/<hub skill>`                          | Junctions created by the sync script                                                  | No                   | Delete each link with `[System.IO.Directory]::Delete(path, $false)` |
| Wrong-place copies              | `~/.claude/skills/nestjs*` (Machine 2)                  | The first install's real copies removed with the installer's own remove command       | No                   | Not needed                                                          |
| Syncthing folder                | Syncthing configuration                                 | Folder `agent-shared-skills` added (Machine 2) and accepted (Machine 1)               | Not applicable       | Remove the folder in the Syncthing GUI (files stay)                 |
| Memory entry                    | Claude auto-memory (Machine 2)                          | `reference-shared-skills-hub` plus an index line                                      | No                   | Delete the entry                                                    |
| Backup of the older skill       | `~/.agent-shared/sync-agy-to-claude.backup` (Machine 1) | Machine 1's differing copy of `sync-agy-to-claude`, moved aside before the first sync | No                   | Safe to delete after review                                         |
| Loose Antigravity skills folder | `~/.gemini/config/skills` (Machine 2)                   | `security-audit` left it, so it is now empty                                          | No                   | Not needed                                                          |

No file of the Davintrade application changed. The only repository change of this work is this document.

### 9.3 Verification

| Check                                       | Result                                                                                                                                                                                                                                                                                                                             | How it was checked                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Antigravity lists the hub skills            | The six NestJS skills show as Global on both machines. `install-skills-shared` also shows on Machine 1.                                                                                                                                                                                                                            | Customizations page, confirmed by the owner                                   |
| Claude Code links                           | Machine 2: 26 entries, 9 to the hub, 17 to plugin skills. Machine 1: 26 entries.                                                                                                                                                                                                                                                   | Directory listing on Machine 2, and output pasted by the owner from Machine 1 |
| Antigravity log after the `skills.json` fix | No new errors and no `.stfolder` warning                                                                                                                                                                                                                                                                                           | Language server log on Machine 2                                              |
| Syncthing in both directions                | A throwaway folder (no `SKILL.md`) created and deleted on each side appeared and disappeared on the other within about a minute, with no `.sync-conflict`                                                                                                                                                                          | Directory listings on both machines                                           |
| First sync                                  | No `.sync-conflict` files                                                                                                                                                                                                                                                                                                          | Listing on Machine 2                                                          |
| Adopter in a sandbox                        | Report-only changed nothing. Junction targets stayed untouched. A second run did nothing. The mutex was respected. The heartbeat and log were written once per change. One bug was found (a skill present in both tool folders in one run was logged twice as a conflict) and fixed by making it WAIT. The re-test had 0 failures. | Test run on a copy of the folder layout                                       |
| Adopter on a real stray                     | `security-audit` moved from Antigravity's loose folder into the hub: 20 files, same content signature before and after. The sync script linked it at 22:23:55 (26 links).                                                                                                                                                          | `adopt.log`, `sync.log`                                                       |
| Task chain                                  | A real Task start launched the adopter and then the sync, result 0, on both machines                                                                                                                                                                                                                                               | Task info and logs                                                            |
| Cadence on Machine 1                        | Heartbeat 23:07:30, Task last run 23:07:07, next run 23:12:12, result 0                                                                                                                                                                                                                                                            | Output pasted by the owner                                                    |
| Soak on Machine 2                           | Task last run 2026-11-21 09:11:11 and heartbeat 09:11:13, result 0, more than 10 hours after the wiring. `adopt.log` holds the one `ADOPTED` line and no errors.                                                                                                                                                                   | Live check on 2026-11-21                                                      |
| Script parity                               | The sync script, the adopter and the runner have the same hash on both machines                                                                                                                                                                                                                                                    | Hash check (section 9.6)                                                      |

### 9.4 Deviations from the original requests

| Request                                                     | What was done                                                                                | Why                                                                                       |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Install the NestJS skills for Claude Code                   | Installed into the hub. The first install's wrong-place copies were removed.                 | The Claude route is invisible to Antigravity and to Syncthing                             |
| Create an Antigravity bridge plugin (approved by the owner) | No plugin. The `skills.json` path was fixed instead.                                         | `skills.json` already pointed at the hub, so one value fixed it. A plugin was not needed. |
| Share skills between the machines                           | Only `skills` is shared, as its own Syncthing folder                                         | The rest of `.agent-shared` is per-machine state                                          |
| (Added) a safety net for wrong-place installs               | The adopter, built after the owner pointed out that agent behaviour is unpredictable         | Guarantee by code (decision D7)                                                           |
| First sync on Machine 1                                     | Machine 1's differing `sync-agy-to-claude` folder was moved aside before accepting the share | Avoids `.sync-conflict` copies (decision D5)                                              |

### 9.5 Timeline

| When                      | Event                                                                                                | Evidence                                         |
| ------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 2026-11-19 10:23 to 10:51 | Baseline in place: first sync (+10 links, 18 in total), 2 MCP servers added, runner and Task created | `sync.log`, file and Task timestamps (Machine 2) |
| 2026-11-20 19:56          | Six NestJS skills linked from the hub (24 links)                                                     | `sync.log`                                       |
| 2026-11-20 20:07          | `skills.json` set to the absolute path (Machine 2)                                                   | File timestamp                                   |
| 2026-11-20 20:47          | `agent-shared-skills` shared with the other device, no `.sync-conflict`                              | Syncthing check on Machine 2                     |
| 2026-11-20 21:18          | `install-skills-shared` linked (25 links)                                                            | `sync.log`                                       |
| 2026-11-20 22:23          | `security-audit` adopted (22:23:53) and linked (22:23:55, 26 links)                                  | `adopt.log`, `sync.log`                          |
| 2026-11-20 22:32 to 22:35 | Heartbeat added to the adopter, runner rewritten (22:33), skill text updated (22:35)                 | File timestamps                                  |
| 2026-11-20 23:07          | Machine 1 cadence confirmed                                                                          | Output pasted by the owner                       |
| 2026-11-21 09:11          | Machine 2 still running: result 0, heartbeat 09:11:13                                                | Live check                                       |

### 9.6 Integrity snapshot (Machine 2, 2026-11-21)

Hash = the first 16 hex digits of the SHA-256 of the file's bytes (`Get-FileHash`). Use it to spot drift. It is valid only for the date shown.

| File                                                 | Size     | Lines | Hash               | Note                                              |
| ---------------------------------------------------- | -------- | ----- | ------------------ | ------------------------------------------------- |
| `~/.agent-shared/sync-agy-to-claude.ps1`             | 15,950 B | 434   | `93E6D870387D31DF` | Baseline script. Same on Machine 1.               |
| `.../install-skills-shared/scripts/adopt-skills.ps1` | 14,317 B | 320   | `681ABFF624E629E9` | Same on Machine 1                                 |
| `~/.agent-shared/run-sync-hidden.vbs`                | 885 B    | 12    | `0823F0D0DABD19B4` | Same as the copy in the skill. Same on Machine 1. |
| `~/.agent-shared/run-sync-hidden.vbs.bak`            | 222 B    | 2     | `2C5FE4336DD42A3E` | Machine 2's original runner. Per machine.         |
| `.../install-skills-shared/SKILL.md`                 | 6,409 B  | 61    | `80099816A5095A43` | Shipped by Syncthing                              |
| `~/.gemini/config/skills.json`                       | 162 B    | 7     | `2C6DB897B86663B6` | Per machine (absolute path)                       |

### 9.7 How this document was checked

On 2026-11-21 the following were read on Machine 2: the sync script, the adopter and the runner in full; the Scheduled Task definition and its last result; the Claude Code hook in `~/.claude/settings.json`; the Antigravity hook file of `dev-stack-bridge`; the Syncthing folder settings (device and folder IDs are not recorded here); the listings of the hub, `~/.claude/skills` and the Antigravity config folder; and the heartbeat, the logs and the manifest. Statements about Machine 1 come from output the owner pasted during the work.

## 10. Operations runbook

### 10.1 Rules for any agent

1. Install skills only into `~/.agent-shared/skills`. Never into `~/.claude/skills`, `~/.gemini/config/skills`, `.claude/skills` or `.agents/skills`, and never with `--agent claude` or `--global`.
2. Keep each skill folder whole (`SKILL.md` plus `references/`, `scripts/` and so on). The folder name equals the `name:` in the frontmatter.
3. Never edit `~/.gemini/config/config.json`. In `skills.json`, change only the hub entry.
4. Never remove a junction with `Remove-Item -Recurse`. Use `[System.IO.Directory]::Delete(path, $false)`.
5. Never settle an adopter `CONFLICT` yourself. Show it to the owner.
6. Deleting a hub folder deletes it on the other machine too. Ask first.
7. To keep a skill on one machine or one tool, leave it where that tool reads it and add an empty file named `.local-only` in its folder. The adopter then ignores it. Say that it will not be shared.

### 10.2 Install or update a skill

```powershell
# NestJS skills: the same command installs and updates them
npx -y @nestjs/skills@latest add --dir "$HOME\.agent-shared\skills"
```

For any other source, download or clone into a scratch folder and copy each skill folder (the one that holds `SKILL.md`, whole) into the hub.

1. Check each skill: the folder name equals the frontmatter `name`, `description` is present, and there is no `.git` folder or secret inside.
2. Check for a name clash. An update replaces the hub folder of the same name. A same-named skill elsewhere (a plugin, a workspace `.agents/skills`) can hide the hub copy in Antigravity.
3. Claude Code: wait up to 5 minutes, or run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$HOME\.agent-shared\sync-agy-to-claude.ps1" -Force`, then start a new session.
4. Antigravity: open a new chat and look at Customizations. The skill shows as Global.
5. Other machine: wait for Syncthing to show Up to Date. Its Task links the skill within 5 minutes.

### 10.3 Check health

```powershell
# Task: last run, result (0 is good) and next run
Get-ScheduledTaskInfo -TaskName AntigravityToClaudeAutoSync | Select-Object LastRunTime, LastTaskResult, NextRunTime

# Adopter heartbeat (younger than about 6 minutes) and its log
Get-Content "$HOME\.agent-shared\adopt.last"
Get-Content "$HOME\.agent-shared\adopt.log" -Tail 20

# Sync log, number of entries in ~/.claude/skills, and the hub
Get-Content "$HOME\.agent-shared\sync.log" -Tail 5
(Get-ChildItem "$HOME\.claude\skills" -Force).Count
Get-ChildItem "$HOME\.agent-shared\skills" -Directory | Select-Object -ExpandProperty Name
```

Healthy means: result 0, a heartbeat younger than about 6 minutes, `conflicts=E3B0C44298FC1C14` (none), and every hub skill present as a link in `~/.claude/skills`.

### 10.4 Handle a CONFLICT

A `CONFLICT` means a tool's own folder holds a skill with the same name as a hub entry, with different content. The adopter leaves both alone.

```powershell
# Report only: shows ADOPT, DROP-DUP and CONFLICT lines and changes nothing
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$HOME\.agent-shared\skills\install-skills-shared\scripts\adopt-skills.ps1"
```

Compare the two folders, then ask the owner which copy is right:

- **Keep the hub copy:** delete the loose folder.
- **Keep the loose copy:** replace the hub folder with it (a hub change reaches the other machine), then delete the loose folder.
- **Keep both:** rename one skill (folder name and frontmatter `name`), or add `.local-only` to the loose one.

### 10.5 Remove a skill

Confirm with the owner first, because this deletes the skill on the other machine too.

```powershell
# 1. The link only
[System.IO.Directory]::Delete("$HOME\.claude\skills\<skill>", $false)
# 2. The hub folder (a real folder, so a recursive delete is safe here)
Remove-Item -LiteralPath "$HOME\.agent-shared\skills\<skill>" -Recurse
```

The other machine's sync removes its own link at its next run.

### 10.6 Update a skill that was adopted

Run the installer with `--dir` into the hub, which updates the hub folder in place. If an installer instead replaced the junction in `~/.claude/skills` with a real folder of newer content, the adopter reports a `CONFLICT`. Copy the newer content over the hub folder, then delete the loose folder.

### 10.7 Add a third machine

A third machine needs the following. The sync script and the Task are not shipped by Syncthing.

1. Create `~/.agent-shared/skills` and join the Syncthing folder `agent-shared-skills` into that path. If same-named skills already exist and differ, move them aside first.
2. Copy `sync-agy-to-claude.ps1` from an existing machine to `~/.agent-shared`. Copy `install-skills-shared/scripts/run-sync-hidden.vbs` from the hub to `~/.agent-shared/run-sync-hidden.vbs`.
3. Register the Task with the properties in section 6.7, pointing the action at that user's runner. Exporting the existing Task with `Export-ScheduledTask` and editing the user and path is one way to do it.
4. Add the Claude Code session hook (section 5.4). Add the `dev-stack-bridge` hook if Antigravity is used there. The Task alone also works.
5. Set the hub entry in `skills.json` to that user's absolute, forward-slash path, with no BOM.
6. Run the sync script once with `-Force`, then open Antigravity's Customizations page.

### 10.8 Roll back or switch off

| Goal                              | Action                                                                                                                                                                                                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adopter off, the rest stays       | Copy `~/.agent-shared/run-sync-hidden.vbs.bak` over `run-sync-hidden.vbs`. This restores the original 2-line runner, which holds that machine's user path. Each machine has its own `.bak`. Wrong-place installs then stay where they are, and nothing breaks. |
| Everything unattended off         | `Disable-ScheduledTask -TaskName AntigravityToClaudeAutoSync`. The session hooks still run the sync.                                                                                                                                                           |
| Stop mirroring                    | Pause the Syncthing folder, or remove it in the GUI (the files stay)                                                                                                                                                                                           |
| Antigravity stops reading the hub | Remove the entry from `skills.json` or restore the old value                                                                                                                                                                                                   |
| Remove all Claude links           | Disable the Task first, then delete each link listed in `managedSkills` of `~/.agent-shared/.sync-manifest.json` with `[System.IO.Directory]::Delete(path, $false)`                                                                                            |

### 10.9 Troubleshooting

| Symptom                                   | Likely cause                                                                                              | Check or fix                                                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Antigravity lists no hub skills           | `skills.json` missing, relative, or has a BOM                                                             | Look for "must be an absolute path" in `%APPDATA%\Antigravity\logs\language_server.log`. Fix the entry and open a new chat. |
| Claude Code does not list a new hub skill | The link is not made yet, or the session is old                                                           | Run the sync script with `-Force`, then start a new session                                                                 |
| A skill did not reach the other machine   | Syncthing is stopped, paused or offline, or the user is logged off                                        | Open the Syncthing GUI and look for Up to Date. Check that both machines are logged on.                                     |
| `*.sync-conflict-*` files in the hub      | The same file changed on both sides                                                                       | Keep the right file and delete the other                                                                                    |
| `CONFLICT` in `adopt.log`                 | A loose skill has the hub's name with different content                                                   | Section 10.4                                                                                                                |
| Heartbeat older than about 10 minutes     | Task disabled, machine asleep, user logged off, or the adopter fails to start                             | `Get-ScheduledTaskInfo`, then run the adopter by hand without `-Apply`                                                      |
| `[SKIPPED CUSTOM]` in the sync output     | A real folder in `~/.claude/skills` has the same name as a hub or plugin skill but a different `SKILL.md` | Run the adopter report. Decide by hand.                                                                                     |
| `LastTaskResult` is not 0                 | The runner could not start, or the 2-minute limit was hit                                                 | Run `wscript.exe "$HOME\.agent-shared\run-sync-hidden.vbs"` by hand, then each script on its own                            |

## 11. Security and privacy

1. **The hub is a code-execution boundary.** Skills are instructions that agents follow with the user's rights, and the adopter script and the runner copy live inside the hub. What reaches the hub on one machine reaches the other within minutes, and the adopter runs from the hub every 5 minutes with `-ExecutionPolicy Bypass`. Anyone who can write to the hub, or who is paired in Syncthing, can change what both machines run. Today the folder is shared with exactly one other device, the owner's other machine, and Syncthing requires each device to approve the other.
2. **No Syncthing rollback.** No versioning is configured, so a bad or deleted skill is replaced on the other machine and no copy is kept (see section 13).
3. **The adopter does not run skill content.** It reads the frontmatter of `SKILL.md` and file hashes, renames folders, and never follows a link.
4. **No secrets in skills.** A skill folder is plain text, mirrored between machines and read by agents. Credentials do not belong in it, and `install-skills-shared` tells agents to check. Syncthing encrypts transfers between paired devices, but files are plain text on disk.
5. **Unpinned installer.** `npx -y @nestjs/skills@latest` fetches whatever is published at install time. Pin the version when reproducibility matters, and review what an installer writes before it reaches the hub.
6. **Execution policy and hidden runs.** Scripts run with a per-process `-ExecutionPolicy Bypass`. The system policy was not changed. Runs have no console window, so the heartbeat and logs are the only error channel.
7. **Least privilege.** The Task runs as the interactive user, not elevated, and junctions need no elevation. Nothing in this design needs administrator rights.
8. **Public repository hygiene.** This document leaves out host names, user names, device IDs, folder IDs and IP addresses.

## 12. Limitations and open items

### 12.1 Limitations

- **L1. Scope.** Project-level skills and Claude-native plugins are not covered.
- **L2. Plugin skills stay on their machine.** Antigravity plugin skills reach Claude Code on the same machine only, because plugin folders are not mirrored.
- **L3. Per-machine setup.** The sync script, the Task registration, the Antigravity hook path and `skills.json` hold user-specific paths and are not shipped by Syncthing. A new machine needs manual setup (section 10.7). The live runner is also a manual copy, while the adopter updates itself through the hub.
- **L4. Installer updates.** If an installer replaces an adopted skill's junction with a real folder of new content, the adopter reports a `CONFLICT` and does not overwrite the hub. The cure is the `--dir` route (section 10.6).
- **L5. A baseline quirk that can lose files.** The sync script turns a real folder in `~/.claude/skills` into a junction when its `SKILL.md` has the same hash as the hub's, comparing only that one file. If the folder also holds other files that differ, they are deleted. The adopter compares whole folders and reports such a folder as a `CONFLICT`, but it cannot stop the sync script from converting it. This behaviour was already in the baseline script.
- **L6. Latency.** A stray takes 2 to 7 minutes to reach the hub, and up to about 13 minutes to be usable by Claude Code on the other machine (section 7.5).
- **L7. Availability.** Nothing runs while a machine is off or asleep or the user is logged off. After wake, the Task runs once for a missed slot, and Syncthing catches up when both machines are online.
- **L8. Same-volume assumption.** The adopter renames folders, which needs the source and the hub on the same volume. All three folders are under the user profile today.
- **L9. Name clashes across sources.** In Antigravity, a same-named skill in a higher-priority place can hide the hub copy. In the sync script the hub wins over a plugin skill of the same name.
- **L10. No alerting.** A stale heartbeat is the only sign of a stuck job, and nothing watches it.

### 12.2 Not verified yet

- **O1.** No real stray has been adopted on Machine 1. The script is identical and was sandbox-tested and used once on Machine 2. The first real event there will show as an `ADOPTED` line in its `adopt.log`.
- **O2.** `security-audit` has not been confirmed on Antigravity's Customizations page on either machine. The mechanism is the same as for the hub skills that were confirmed.
- **O3.** An agent choosing the hub by itself, from the `install-skills-shared` skill and without being told, has not been tested. By design the adopter covers a miss.
- **O4.** Machine 1's `sync-agy-to-claude.backup` was never compared with the version that arrived. It can be deleted after a review.
- **O5.** The Task properties and the Syncthing autostart were read on Machine 2 only.

## 13. Possible future work

These are suggestions, not commitments.

1. Ship the sync script, the runner and a Task registration script inside the hub as one bootstrap, so a new machine needs one command.
2. Turn on Syncthing file versioning for the hub (the trash-can or staggered type) so a bad or deleted skill can be restored.
3. Make the sync script compare whole-folder signatures before it replaces a copy with a junction (limitation L5).
4. Warn at session start when `adopt.last` is older than about 15 minutes (limitation L10).
5. Record where each skill came from (source, version, date), for example in a small file beside `SKILL.md`.
6. Pin installer versions in the runbook.

## 14. Glossary

| Term                 | Meaning                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| Hub                  | The folder `~/.agent-shared/skills`: one real folder per skill, mirrored between machines                       |
| Skill                | A folder with a `SKILL.md` (frontmatter `name` and `description`) and optional `references/` and `scripts/`     |
| Stray                | A real skill folder in a tool's own folder (`~/.claude/skills` or `~/.gemini/config/skills`) instead of the hub |
| Adopter              | `adopt-skills.ps1`, which moves strays into the hub                                                             |
| Sync script          | `sync-agy-to-claude.ps1`, which links the hub and active Antigravity plugin skills into `~/.claude/skills`      |
| Junction             | A Windows directory link that needs no administrator rights. Removing it must not remove the target.            |
| Runner               | `run-sync-hidden.vbs`, which starts the adopter and the sync without a console window                           |
| Tick                 | One run of the Scheduled Task (at logon or every 5 minutes)                                                     |
| Heartbeat            | `~/.agent-shared/adopt.last`, rewritten at each adopter run                                                     |
| Mutex                | The named lock `Local\AntigravityToClaudeAutoSyncMutex` that keeps the scripts from running at once             |
| Machine 1, Machine 2 | The two Windows computers. Antigravity is the main tool on Machine 1 and Claude Code on Machine 2.              |
