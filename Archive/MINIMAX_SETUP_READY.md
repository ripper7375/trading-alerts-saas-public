# ✅ MiniMax M2 Configuration Complete

---

## ⚠️ **LEGACY DOCUMENT WARNING** ⚠️

**This document has been superseded by `MINIMAX-TROUBLESHOOTING.md`.**

This file is kept for historical reference but contains **redundant information**. The information below has been **updated with correct configuration**, but for the most current and comprehensive troubleshooting guide, please refer to:

**➡️ See: `MINIMAX-TROUBLESHOOTING.md` (recommended)**

Key improvements in the new guide:

- ✅ Uses Anthropic-compatible endpoint (the only working configuration)
- ✅ Includes test scripts for API connectivity verification
- ✅ Troubleshooting for connection errors and free trial expiration
- ✅ Complete cost estimation and token usage tracking
- ✅ Updated for November 2025

---

**Status:** All files configured for MiniMax M2 API
**Date:** 2025-11-10
**Branch:** `claude/aider-setup-testing-011CUwomNS5nvK7YYUcyykVb`

---

## What's Been Configured

### ✅ Configuration Files

| File                   | Status            | Purpose                                     |
| ---------------------- | ----------------- | ------------------------------------------- |
| `.aider.conf.yml`      | ✅ MiniMax M2     | Main Aider configuration (production)       |
| `.aider.minimal.yml`   | ✅ Model-agnostic | Debugging/testing config (minimal features) |
| `AIDER_SETUP_GUIDE.md` | ✅ MiniMax M2     | Complete setup instructions                 |
| All policy docs        | ✅ MiniMax M2     | Already reference MiniMax M2 workflow       |

### ❌ Removed Files

| File              | Reason                                |
| ----------------- | ------------------------------------- |
| `.aider.test.yml` | Was for Anthropic Claude testing only |

---

## Configuration Details

### Correct Configuration (Anthropic-Compatible):

**Environment Variables:**

```bash
ANTHROPIC_API_KEY=your_minimax_api_key_here
ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic
```

**Aider Command:**

```bash
# Windows
start-aider-anthropic.bat

# Mac/Linux
aider --model anthropic/MiniMax-M2
```

**Model Settings:**

```yaml
# Model Configuration (Anthropic-compatible)
model: anthropic/MiniMax-M2
editor-model: anthropic/MiniMax-M2
weak-model: anthropic/MiniMax-M2

# Auto-Commits
auto-commits: false # Set to true for autonomous building

# Disabled (not needed/supported)
lint: false
use-ctags: false

# Policy Documents (Auto-loaded)
read:
  - docs/policies/01-approval-policies.md
  - docs/policies/02-quality-standards.md
  - docs/policies/03-architecture-rules.md
  - docs/policies/04-escalation-triggers.md
  - docs/policies/05-coding-patterns.md
  - docs/policies/06-aider-instructions.md
  - ARCHITECTURE.md
  - README.md
  - PROGRESS.md
```

---

## Next Steps for You

### Step 1: Top Up MiniMax Credit

1. Go to **MiniMax console/dashboard**
2. Add credit to your account
3. Ensure **MiniMax M2** model access is enabled

### Step 2: Get Your API Credentials

You need **your API key** from MiniMax:

1. **API Key** - Looks like: `eyJhbGciOiJSUzI1NiIs...`
2. Get it from: https://platform.minimax.io
3. **Important:** Ensure you have credits (free trial ended Nov 7, 2025)

**API Base URL** is fixed: `https://api.minimax.io/anthropic` (Anthropic-compatible endpoint)

### Step 3: Pull All Changes to Local Machine

On your **Windows machine**:

```cmd
cd "D:\SaaS Project\trading-alerts-saas-v7"
git pull
```

### Step 4: Edit start-aider-anthropic.bat

**Recommended approach:** Edit the startup script with your API key.

1. Open `start-aider-anthropic.bat` in Notepad
2. Find line 21: `set ANTHROPIC_API_KEY=YOUR_MINIMAX_API_KEY_HERE`
3. Replace with your actual MiniMax API key
4. Save the file

**Alternative:** Set environment variables in Command Prompt:

```cmd
set ANTHROPIC_API_KEY=your_minimax_api_key_here
set ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic
```

### Step 5: Run Aider!

```cmd
start-aider-anthropic.bat
```

**Or with environment variables set:**

```cmd
py -3.11 -m aider --model anthropic/MiniMax-M2
```

---

## Expected Behavior

When you run `start-aider-anthropic.bat`, you should see:

```
========================================
  Starting Aider with MiniMax M2
  (Anthropic-Compatible Endpoint)
========================================

Environment variables set:
  ANTHROPIC_API_KEY: eyJhbGciOiJSUzI1NiIs...
  ANTHROPIC_BASE_URL: https://api.minimax.io/anthropic

Starting Aider with Anthropic-compatible model: anthropic/MiniMax-M2

──────────────────────────────────────────────────────────────────
Aider v0.86.1
Main model: anthropic/MiniMax-M2 with diff edit format, infinite output
Weak model: anthropic/MiniMax-M2
Git repo: .git with 309 files
Repo-map: using 2048 tokens, auto refresh
Added docs\policies\01-approval-policies.md to the chat (read-only).
Added docs\policies\02-quality-standards.md to the chat (read-only).
...
──────────────────────────────────────────────────────────────────
>                                                    ← Interactive prompt
```

---

## Cost Savings with MiniMax M2

**Why MiniMax M2?**

- ✅ **~80% cheaper** than GPT-4
- ✅ **Good quality** for code generation
- ✅ **Cost-effective** for building 170+ files
- ✅ **OpenAI-compatible API** (works with Aider)

**Estimated Cost:**

- Building 170 files with GPT-4: ~$50-100
- Building 170 files with MiniMax M2: ~$10-20
- **Savings: ~80%**

---

## Testing Aider with MiniMax M2

Once Aider starts, test it:

### Test 1: Simple Question

```
> What are the AUTO-APPROVE conditions?
```

Aider should respond with details from `docs/policies/01-approval-policies.md`.

### Test 2: Generate Simple Code

```
> Create a simple type definition in types/index.ts for a User with id, email, and name fields. Follow our quality standards.
```

Aider should:

1. Create the file
2. Use proper TypeScript types
3. Add JSDoc comments
4. Show you the code
5. Ask if you want to commit

---

## Troubleshooting

### Issue: "Model not found" or Connection Errors

**Solution:**

- Check `ANTHROPIC_API_KEY` is set: `echo %ANTHROPIC_API_KEY%`
- Check `ANTHROPIC_BASE_URL` is set: `echo %ANTHROPIC_BASE_URL%`
- Verify API key is valid in MiniMax dashboard
- **Important:** Check you have credits (free trial ended Nov 7, 2025)
- See MINIMAX-TROUBLESHOOTING.md for detailed debugging steps

### Issue: "Rate limit error"

**Solution:**

- MiniMax M2 has usage limits
- Wait a minute and try again
- Check your credit balance in MiniMax dashboard

### Issue: Aider exits immediately

**Solution:**

- Make sure you're using: `start-aider-anthropic.bat`
- Or add a file to edit: `py -3.11 -m aider --model anthropic/MiniMax-M2 README.md`
- This gives Aider something to work on

### Issue: "Service Unavailable" or Connection Errors

**Solution:**

- Use `test-minimax-api.bat` to verify API connectivity
- Check MiniMax API status at https://platform.minimax.io
- Verify `ANTHROPIC_BASE_URL` is correct: `https://api.minimax.io/anthropic`
- Ensure you have credits in your account
- See MINIMAX-TROUBLESHOOTING.md for step-by-step debugging

---

## Files Summary

### ✅ Ready for MiniMax M2

1. `.aider.conf.yml` - Production config
2. `.aider.minimal.yml` - Debugging config
3. All 6 policy documents
4. `AIDER_SETUP_GUIDE.md`
5. `ARCHITECTURE.md`
6. `README.md`
7. All documentation

### 🎯 What You Need to Do

1. ✅ Top up MiniMax credit (free trial ended Nov 7, 2025)
2. ✅ Get API key from https://platform.minimax.io
3. ✅ Pull changes: `git pull origin claude/debug-minimax-api-errors-011CUz3tNHzC6QgvfVcnYDEH`
4. ✅ Edit `start-aider-anthropic.bat` with your API key (line 21)
5. ✅ Run: `start-aider-anthropic.bat`
6. ✅ Use `test-minimax-api.bat` if you encounter connection issues

---

## After You're Up and Running

Once Aider works with MiniMax M2:

### 1. Start Building

```
> Let's start building Part 1: Foundation & Root Configuration.
  Follow the 7-step workflow from 06-aider-instructions.md.
```

### 2. Enable Auto-Commits (Optional)

For autonomous building, edit `.aider.conf.yml`:

```yaml
auto-commits: true # Change from false to true
```

### 3. Monitor Progress

```cmd
# Check what Aider is doing
git log --oneline

# Review PROGRESS.md
type PROGRESS.md

# See latest commit
git show HEAD
```

---

## Support

- **Aider Docs:** https://aider.chat/docs/
- **MiniMax Docs:** (Check their platform)
- **Your Policies:** `docs/policies/`

---

**🚀 You're all set! Get your MiniMax credit and let's build!**
