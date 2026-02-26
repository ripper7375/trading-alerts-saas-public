# Quick Reference: Using Claude Code Prompt Template

**For:** Backend Stack B (Parts 10, 11, 15, 20-23)
**Created:** 2026-01-18

---

## 🎯 One-Page Cheat Sheet

### Step 1: Prepare Documents

Before starting Claude Code conversation, gather:

✅ `backend-stack-b/openapi/{{PART_NAME}}-api.yaml`
✅ `backend-stack-b/IMPLEMENTATION-GUIDE.md`
✅ Your architecture document
✅ Your implementation plan

### Step 2: Fill Template

Copy `CLAUDE-CODE-PROMPT-TEMPLATE.md` and replace:

#### Quick Fill Guide:

| Part | {{PART_NAME}}             | {{PART_NUMBER}} | {{OPENAPI_FILE_NAME}} | {{MODULE_NAME}} |
| ---- | ------------------------- | --------------- | --------------------- | --------------- |
| 10   | Watchlist System          | 10              | watchlist-api         | watchlist       |
| 11   | Alerts System             | 11              | alerts-api            | alerts          |
| 15   | Notifications & Real-time | 15              | notifications-api     | notifications   |
| 22   | Confluence Scores         | 22              | analytics-api         | confluence      |
| 23   | Leader Board              | 23              | analytics-api         | leaderboard     |

#### Entity Names by Part:

**Part 10 (Watchlist):**

- `{{ENTITY_NAME}}`: WatchlistItem
- `{{ENTITY_LIST}}`: WatchlistItem, WatchlistOrder

**Part 11 (Alerts):**

- `{{ENTITY_NAME}}`: Alert
- `{{ENTITY_LIST}}`: Alert, AlertTrigger, AlertHistory

**Part 15 (Notifications):**

- `{{ENTITY_NAME}}`: Notification
- `{{ENTITY_LIST}}`: Notification, NotificationPreference, PushSubscription

**Part 22 (Confluence):**

- `{{ENTITY_NAME}}`: ConfluenceScore
- `{{ENTITY_LIST}}`: ConfluenceScore, ConfluenceHistory

**Part 23 (Leaderboard):**

- `{{ENTITY_NAME}}`: LeaderBoardEntry
- `{{ENTITY_LIST}}`: LeaderBoardEntry, LeaderBoardSnapshot

### Step 3: Attach Files to Claude Code

In Claude Code (web):

1. Click attachment icon
2. Upload these files:
   - OpenAPI spec (`.yaml` file)
   - Implementation guide
   - Architecture doc
   - Implementation plan

### Step 4: Submit Prompt

Paste filled template into Claude Code conversation.

### Step 5: Review & Iterate

Claude Code will build files. Review and request changes if needed.

---

## 📋 Example Fill-Out (Part 10)

### Minimal Required Placeholders:

```markdown
# Build Backend Stack B - Watchlist System (Part 10)

## Context

You are building Backend Stack B - Watchlist System which handles async watchlist
management with real-time updates and tier-based access control.

## Attached Documents

1. OpenAPI Contract: watchlist-api.yaml
2. Implementation Guide: IMPLEMENTATION-GUIDE.md
3. Architecture Design: backend-stack-b-architecture.md
4. Implementation Plan: part-10-watchlist-build-plan.md

## Module: watchlist

Entities:

- WatchlistItem (id, userId, symbol, timeframe, order, notes, createdAt, updatedAt)

Key Features:

- Add/remove symbols from watchlist
- Reorder watchlist items
- Tier validation (Free: 5, Pro: 50, Premium: unlimited)
- Bulk operations

Background Jobs:

- sync-watchlist-to-cache (every 5 min)
- cleanup-old-items (every 24h)

Cache Keys:

- watchlist:list:{userId} (TTL: 300s)
- watchlist:item:{id} (TTL: 600s)

Database Tables:

- watchlist_items

Environment Variables:
DATABASE_B_URL=postgresql://localhost:5432/stackb
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret
PORT=3002

[Include rest of template...]
```

---

## ⚡ Super Quick Fill (Copy-Paste Ready)

### Part 10: Watchlist

```bash
PART_NAME="Watchlist System"
PART_NUMBER="10"
MODULE_NAME="watchlist"
ENTITY_NAME="WatchlistItem"
OPENAPI_FILE="watchlist-api.yaml"
```

### Part 11: Alerts

```bash
PART_NAME="Alerts System"
PART_NUMBER="11"
MODULE_NAME="alerts"
ENTITY_NAME="Alert"
OPENAPI_FILE="alerts-api.yaml"
```

### Part 15: Notifications

```bash
PART_NAME="Notifications & Real-time"
PART_NUMBER="15"
MODULE_NAME="notifications"
ENTITY_NAME="Notification"
OPENAPI_FILE="notifications-api.yaml"
```

### Parts 22-23: Analytics

```bash
PART_NAME="Analytics & Leader Board"
PART_NUMBER="22-23"
MODULE_NAME="analytics"
ENTITY_NAME="ConfluenceScore"
OPENAPI_FILE="analytics-api.yaml"
```

---

## 🎯 Expected Timeline Per Part

- **Prepare documents**: 5 min
- **Fill template**: 10 min
- **Claude Code builds**: 30-60 min
- **Review & test**: 20-30 min
- **Fixes & iterations**: 10-20 min

**Total per part**: ~1.5-2 hours

---

## ✅ Quality Checklist

After Claude Code finishes, verify:

- [ ] All OpenAPI endpoints implemented ✅
- [ ] TypeScript compiles with no errors
- [ ] ESLint passes
- [ ] Unit tests pass (>80% coverage)
- [ ] Integration tests pass
- [ ] Can run `npm run build`
- [ ] Can run `npm run start:dev`
- [ ] Swagger docs accessible
- [ ] All environment variables documented

---

## 💡 Pro Tips

1. **Start with Part 10** (simplest) to test the workflow
2. **Attach large files** - Claude Code handles them well
3. **Be specific** in custom requirements
4. **Iterate** - Ask for improvements if needed
5. **Test incrementally** - Don't wait until all parts done

---

## 🚨 Common Issues & Solutions

### Issue: "Not all endpoints implemented"

**Fix**: Check if OpenAPI file was attached correctly

### Issue: "TypeScript errors"

**Fix**: Ask Claude Code to fix strict mode violations

### Issue: "Tests failing"

**Fix**: Ask Claude Code to update tests with correct mocks

### Issue: "Missing Prisma schema"

**Fix**: Provide explicit database schema or ask Claude Code to infer from entities

---

## 📞 Support

If stuck, refer to:

- Full template: `CLAUDE-CODE-PROMPT-TEMPLATE.md`
- Implementation guide: `IMPLEMENTATION-GUIDE.md`
- OpenAPI specs: `openapi/*.yaml`

**Happy Building!** 🚀
