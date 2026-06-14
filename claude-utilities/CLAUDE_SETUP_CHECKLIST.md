# Claude Code Setup Checklist for DavinTrade

## Quick Reference: 5 Commands to Master

```
/init          → Initialize Claude Code (one-time)
/config        → Set language, framework preferences (one-time)
/add-dir       → Tell Claude which files to index (once per session)
/memory        → Save project knowledge permanently (anytime)
/compact       → Reduce context when 80%+ full (anytime)
```

---

## Step-by-Step: Your First Setup

### ✅ Step 1: Initialize (Do Once)

```bash
/init
```

**Expected:** "Claude Code initialized at .claudecode/"

---

### ✅ Step 2: Create CLAUDE.md in Your Project Root

Copy the complete CLAUDE.md template (provided separately).

File path: `./CLAUDE.md`

**Content includes:**

- Tech stack overview
- NestJS folder structure
- Prisma schema models
- Python Celery pipeline stages
- Redis key patterns
- MQL5 EA constants
- Coding conventions
- Known TODOs

---

### ✅ Step 3: Configure Claude Code (Do Once)

```bash
/config
```

**Claude asks:**

```
1. Primary language?
   → Answer: TypeScript

2. Backend framework?
   → Answer: NestJS

3. Database?
   → Answer: PostgreSQL

4. Other languages used?
   → Answer: Python, MQL5
```

**Result:** Stored in `.claudecode/config.json`

---

### ✅ Step 4: Index Critical Files

```bash
/add-dir CLAUDE.md
/add-dir --exclude tests,__tests__,build,.next,dist,node_modules
```

**What this does:**

- Tells Claude to read CLAUDE.md
- Excludes test/build bloat from indexing

---

### ✅ Step 5: Save to Memory (Most Important!)

```bash
/memory
```

**Claude will ask for content. Then paste entire CLAUDE.md:**

```
# DavinTrade Project Context
## Tech Stack
[entire CLAUDE.md content here]
```

**Result:** Claude remembers your project **FOREVER** (across sessions, resets, everything)

---

## Common Scenarios

### Scenario A: Context fills up (86%)

```bash
/compact                # Removes comments, whitespace
/diff                   # Review what changed
# ✓ You now have 260–320k tokens free
```

### Scenario B: Context nearly gone (95%)

```bash
/memory                 # Save current state (takes 30 sec)
/clear                  # Clear all chat history
# Now type your next request
# Claude remembers your project from /memory
```

### Scenario C: Want to pause and come back later

```bash
/memory                 # Save
# Close Claude Code
# Next session:
/resume                 # Brings back files
# /memory already loaded automatically
```

### Scenario D: Made architecture changes

```bash
# Update CLAUDE.md with new decisions
/memory                 # Re-paste updated CLAUDE.md
# Claude's knowledge is now fresh
```

---

## Command Reference Table

| Command    | When                        | Outcome                         | Frequency      |
| ---------- | --------------------------- | ------------------------------- | -------------- |
| `/init`    | First time setting up       | Creates `.claudecode/`          | Once           |
| `/config`  | After /init                 | Stores language/framework prefs | Once           |
| `/add-dir` | After creating CLAUDE.md    | Indexes files + excludes bloat  | Once/session   |
| `/memory`  | Before context fills (80%+) | Permanent project knowledge     | Multiple times |
| `/compact` | Context 85%+                | Frees 15–20% context            | Multiple times |
| `/diff`    | After `/compact`            | Review changes                  | After /compact |
| `/clear`   | Context 95%+                | Reset chat (keeps /memory)      | Rare           |
| `/resume`  | New session, same project   | Restore files + loaded /memory  | As needed      |

---

## What Gets Saved Where

### In Your Project Folder

- `.claudecode/config.json` — your preferences
- `.claudecode/memory/` — Claude's learned context
- `CLAUDE.md` — your architecture docs (human-readable)

### In Claude Code Sessions

- Chat history (lost if `/clear`)
- File changes (preserved until `/compact` or `/clear`)
- Current token usage

### Permanently Preserved by `/memory`

- Architecture decisions
- Coding conventions
- Tech stack notes
- Any knowledge pasted into /memory

---

## Troubleshooting

### Problem: `/memory` says "Already exists"

**Solution:** Paste again. `/memory` replaces old content.

### Problem: `/compact` didn't free much space

**Solution:** Your codebase is lean (good!). Consider:

- Using `/branch` for next task (fresh context)
- Or `/model haiku` for lightweight edits

### Problem: Claude forgot my project context

**Solution:** Did you run `/memory`? If not:

- Create/update CLAUDE.md
- Run `/memory` and paste content
- Now Claude will remember

### Problem: "Context window exhausted" error

**Solution:** Act immediately:

```bash
/memory           # Save current state
/clear            # Reset chat
# Now continue — /memory will load automatically
```

---

## Best Practices

✅ **DO:**

- Update CLAUDE.md after major architecture changes
- Run `/memory` before context hits 75%
- Use `/diff` after `/compact` to verify
- Use `/add-dir --exclude` to keep context lean
- Comment "FIXME" sections for security review

❌ **DON'T:**

- Skip `/memory` setup (biggest regret later)
- Use `/clear` without `/memory` first
- Ignore `/compact` warnings
- Let context hit 100% (causes errors)
- Assume Claude remembers without `/memory`

---

## Example Workflow: Full Day of DavinTrade Work

```
Morning (Start Fresh)
├─ /init (if first time)
├─ /config (if first time)
├─ /add-dir CLAUDE.md
├─ /add-dir --exclude tests,build,.next
└─ Start coding tasks

Midday (Context 70%)
├─ /memory (save progress)
└─ Continue tasks

Afternoon (Context 85%)
├─ /compact
├─ /diff (verify)
└─ Continue tasks

Evening (Context 95%)
├─ /memory (save final state)
├─ /clear (reset chat)
└─ Close session

Next Day
├─ /resume (restore files)
├─ /memory automatically loads
├─ /add-dir CLAUDE.md
└─ Continue where you left off
```

---

## One-Liner Quick Start

If you're impatient, just do:

```bash
/init
/config
# [Create CLAUDE.md in your project root]
/add-dir CLAUDE.md
/memory
# [Paste CLAUDE.md]
```

Done! You're set up for life.

---

## Need More Help?

- **Schema/Database questions?** → Check `CLAUDE.md` Prisma section
- **Pipeline details?** → Check `CLAUDE.md` Celery Worker section
- **Coding style?** → Check `CLAUDE.md` Coding Conventions
- **Context overflow?** → Run `/compact` or `/memory` + `/clear`
