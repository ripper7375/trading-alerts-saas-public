# Aider Setup & Testing Guide for Beginners

---

## ⚠️ **LEGACY DOCUMENT WARNING** ⚠️

**This document has been superseded by `MINIMAX-TROUBLESHOOTING.md`.**

This file is kept for historical reference but contains **redundant information**. The information below has been **updated with correct configuration**, but for the most current and comprehensive troubleshooting guide, please refer to:

**➡️ See: `MINIMAX-TROUBLESHOOTING.md` (recommended)**

Key differences resolved in the new guide:

- ✅ Uses Anthropic-compatible endpoint (the only configuration that works)
- ✅ Includes free trial expiration troubleshooting
- ✅ Complete step-by-step debugging process
- ✅ Updated for November 2025

---

**Welcome!** This guide will walk you through setting up and testing Aider with MiniMax M2 API. Don't worry if you're new to coding - I'll explain everything step-by-step.

---

## 📚 Table of Contents

1. [What is Aider?](#what-is-aider)
2. [Prerequisites](#prerequisites)
3. [Milestone 1.5: Aider Configuration](#milestone-15-aider-configuration)
4. [Milestone 1.6: Test Aider Understanding](#milestone-16-test-aider-understanding)
5. [Common Issues & Solutions](#common-issues--solutions)
6. [Next Steps](#next-steps)

---

## What is Aider?

**Aider** is an AI-powered coding assistant that works in your terminal (command line). Think of it as:

- **An AI pair programmer** that writes code for you
- **Works autonomously** - you give it tasks, it builds the code
- **Uses MiniMax M2 API** - a cost-effective AI model (~80% cheaper than GPT-4)
- **Follows your policies** - it reads the 6 policy documents we created and follows them

### How Does Aider Work?

```
You: "Build the authentication system"
   ↓
Aider reads:
  - Your 6 policy documents
  - OpenAPI specifications
  - Seed code examples
   ↓
Aider generates code following all patterns
   ↓
Aider validates code with Claude Code
   ↓
Aider commits code to Git (if validation passes)
   ↓
Aider reports: "✅ 3 files created, 0 issues"
```

---

## Prerequisites

### 1. Install Aider

**On Windows:**

```bash
pip install aider-chat
```

**On Mac/Linux:**

```bash
pip3 install aider-chat
```

**Verify installation:**

```bash
aider --version
```

Expected output: `aider 0.x.x` (any version 0.30.0+ is good)

### 2. Get MiniMax API Key

1. Go to [MiniMax Platform](https://platform.minimax.io)
2. Navigate to **API Keys** section
3. Click **Create New API Key**
4. Copy the key (it looks like: `eyJhbGciOiJSUzI1NiIs...`)
5. **IMPORTANT:** Save it somewhere safe - you won't see it again!
6. **CRITICAL:** Ensure you have **credits** in your account (free trial ended Nov 7, 2025)

### 3. Set Up Environment Variables

Environment variables are like secret passwords your computer remembers. We need to tell your computer about your MiniMax API key.

**IMPORTANT:** Use the **Anthropic-compatible** environment variables (this is the only configuration that works with MiniMax M2):

#### **Recommended: Use start-aider-anthropic.bat (Windows)**

The easiest method is to edit `start-aider-anthropic.bat` and set your API key on line 21. See MINIMAX-TROUBLESHOOTING.md for details.

#### **On Windows (PowerShell):**

```powershell
# Open PowerShell as Administrator
# Set environment variables permanently
[System.Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY', 'your_actual_api_key_here', 'User')
[System.Environment]::SetEnvironmentVariable('ANTHROPIC_BASE_URL', 'https://api.minimax.io/anthropic', 'User')

# Restart PowerShell and verify:
echo $env:ANTHROPIC_API_KEY
echo $env:ANTHROPIC_BASE_URL
```

#### **On Mac/Linux (Bash/Zsh):**

```bash
# Open your shell configuration file
nano ~/.bashrc  # or ~/.zshrc on Mac

# Add these lines at the end:
export ANTHROPIC_API_KEY="your_actual_api_key_here"
export ANTHROPIC_BASE_URL="https://api.minimax.io/anthropic"

# Save and exit (Ctrl+X, then Y, then Enter)

# Reload configuration:
source ~/.bashrc  # or source ~/.zshrc

# Verify:
echo $ANTHROPIC_API_KEY
echo $ANTHROPIC_BASE_URL
```

#### **Alternative: Use .env File (Easier for Beginners)**

Create a file called `.env` in your project root:

```bash
# Go to your project directory
cd /home/user/trading-alerts-saas-v7

# Create .env file
touch .env  # Mac/Linux
# or
type nul > .env  # Windows

# Open with text editor and add:
ANTHROPIC_API_KEY=your_actual_api_key_here
ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic
```

**IMPORTANT:** `.env` is already in your `.gitignore`, so it won't be committed to GitHub (keeps your secrets safe!)

### 4. Verify Your Setup

```bash
# Check Git is installed
git --version

# Check Python is installed
python --version  # or python3 --version

# Check you're in the right directory
pwd  # Should show: /home/user/trading-alerts-saas-v7
```

---

## Milestone 1.5: Aider Configuration

### ✅ What We've Already Done

1. **Updated `.gitignore`** - Added `!.aider.conf.yml` to allow committing the config file
2. **Created `.aider.conf.yml`** - Complete configuration with:
   - MiniMax M2 model settings
   - Auto-commit enabled
   - Policy file paths (all 6 policies)
   - OpenAPI specification path
   - Git integration
   - Chat history

### 📝 Step-by-Step Instructions

#### Step 1: Verify Configuration File Exists

```bash
# Check if .aider.conf.yml was created
ls -la .aider.conf.yml
```

**Expected output:**

```
-rw-r--r-- 1 user user 6500 Nov  9 12:00 .aider.conf.yml
```

If you see "No such file or directory", something went wrong. Let me know!

#### Step 2: Review Configuration File

Open `.aider.conf.yml` in your text editor and review it:

```bash
# Open with VS Code (if installed)
code .aider.conf.yml

# Or open with nano (terminal editor)
nano .aider.conf.yml
```

**Key Settings to Notice:**

1. **Model Configuration**:

   ```yaml
   model: anthropic/MiniMax-M2
   editor-model: anthropic/MiniMax-M2
   weak-model: anthropic/MiniMax-M2
   # Note: API base URL is set via ANTHROPIC_BASE_URL environment variable
   ```

2. **Auto-Commits** (line 34):

   ```yaml
   auto-commits: true
   ```

3. **Policy Documents** (lines 45-60):
   ```yaml
   read:
     - docs/policies/01-approval-policies.md
     - docs/policies/02-quality-standards.md
     # ... (all 6 policies)
   ```

Everything looks good? Great! Close the file.

#### Step 3: Commit Configuration Files

Now let's save our configuration to Git:

```bash
# Add files
git add .gitignore .aider.conf.yml

# Check what will be committed
git status

# Commit
git commit -m "feat(aider): add Aider configuration for MiniMax M2

- Configure MiniMax M2 as primary model
- Enable auto-commits for autonomous building
- Load all 6 policy documents as read-only context
- Load OpenAPI spec and architecture docs
- Configure git integration and chat history

Milestone 1.5: Aider Configuration ✅ COMPLETED"

# Push to remote
git push -u origin claude/aider-setup-testing-011CUwomNS5nvK7YYUcyykVb
```

**Expected output:**

```
[claude/aider-setup-testing-011CUwomNS5nvK7YYUcyykVb abc1234] feat(aider): add Aider configuration...
 2 files changed, 200 insertions(+), 1 deletion(-)
 create mode 100644 .aider.conf.yml
```

### ✅ Milestone 1.5 Complete!

**What You've Accomplished:**

- ✅ Updated `.gitignore` to allow Aider config
- ✅ Created `.aider.conf.yml` with MiniMax M2 settings
- ✅ Configured auto-commits
- ✅ Set up policy file paths
- ✅ Committed configuration to Git

---

## Milestone 1.6: Test Aider Understanding

Now let's test that Aider can read your policies and understand your project!

### Step 1: Start Aider

**On Windows (Recommended):**

```cmd
# Make sure you're in the project root
cd "D:\SaaS Project\trading-alerts-saas-v7"

# Start Aider with Anthropic-compatible configuration
start-aider-anthropic.bat
```

**On Mac/Linux:**

```bash
# Make sure you're in the project root
cd /home/user/trading-alerts-saas-v7

# Start Aider (ensure environment variables are set)
aider --model anthropic/MiniMax-M2
```

**What You'll See:**

```
Aider v0.x.x
Model: anthropic/MiniMax-M2 with diff edit format
Git repo: /home/user/trading-alerts-saas-v7
Repo-map: disabled
Auto-commits: enabled
Use /help for help

Reading files from 'read' config...
✓ docs/policies/01-approval-policies.md
✓ docs/policies/02-quality-standards.md
✓ docs/policies/03-architecture-rules.md
✓ docs/policies/04-escalation-triggers.md
✓ docs/policies/05-coding-patterns.md
✓ docs/policies/06-aider-instructions.md
✓ ARCHITECTURE.md
✓ trading_alerts_openapi.yaml

>
```

**Troubleshooting:**

- If Aider says "Model not found", check your `ANTHROPIC_API_KEY` environment variable
- If connection errors occur, see MINIMAX-TROUBLESHOOTING.md for detailed debugging
- If policy files don't load, check the paths in `.aider.conf.yml`
- If Git errors appear, make sure you're in a Git repository (`git status`)

### Step 2: Test Policy Understanding

Copy and paste these test questions into Aider (one at a time):

#### **Test 1: Approval Policy Understanding**

```
You: What are the AUTO-APPROVE conditions according to our policies?
```

**Expected Answer (summary):**

```
Aider: According to 01-approval-policies.md, AUTO-APPROVE conditions are:
1. 0 Critical issues
2. ≤2 High issues
3. All quality checks passed
4. No security vulnerabilities
5. TypeScript types present
6. Error handling present
7. JSDoc comments present
```

#### **Test 2: Quality Standards Understanding**

```
You: What TypeScript type should I use for object shapes - 'type' or 'interface'?
```

**Expected Answer:**

```
Aider: According to 02-quality-standards.md, use 'interface' for object shapes.
Use 'type' for unions, intersections, or primitives.

Example:
✓ Good: interface User { id: string; name: string; }
✗ Bad:  type User = { id: string; name: string; }
```

#### **Test 3: Architecture Understanding**

```
You: How many tiers does our system have and what symbols can FREE users access?
```

**Expected Answer:**

```
Aider: According to 03-architecture-rules.md and 00-tier-specifications.md:

Our system has 2 tiers: FREE and PRO

FREE tier can access:
- 5 symbols: BTCUSD, EURUSD, USDJPY, US30, XAUUSD
- 3 timeframes: H1, H4, D1
- 5 alerts max
- 5 watchlist items max

PRO tier can access:
- 15 symbols (all)
- 9 timeframes: M5, M15, M30, H1, H2, H4, H8, H12, D1
- 20 alerts max
- 50 watchlist items max
```

#### **Test 4: Coding Patterns Understanding**

```
You: Show me the structure of an API route handler from our coding patterns.
```

**Expected Answer:**

```
Aider: According to 05-coding-patterns.md, Pattern 1 (API Route) has this structure:

1. Authentication check (getServerSession)
2. Input validation (Zod schema)
3. Tier validation (validateChartAccess)
4. Business logic (Prisma operations)
5. Error handling (try/catch)
6. Response formatting

Example:
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Auth
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Validation
    // ... (Zod validation)

    // 3. Tier check
    validateChartAccess(session.user.tier, symbol, timeframe);

    // 4. Business logic
    const data = await prisma.model.findMany(...);

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

#### **Test 5: OpenAPI Awareness**

```
You: What endpoints are defined in our OpenAPI spec for alerts?
```

**Expected Answer:**

```
Aider: According to trading_alerts_openapi.yaml, the alert endpoints are:

GET    /api/alerts          - List all user alerts
POST   /api/alerts          - Create new alert
GET    /api/alerts/{id}     - Get specific alert
PUT    /api/alerts/{id}     - Update alert
DELETE /api/alerts/{id}     - Delete alert
```

#### **Test 6: Seed Code Awareness**

```
You: What seed code repositories should you reference when building?
```

**Expected Answer:**

```
Aider: According to ARCHITECTURE.md and the seed-code/ folder, I should reference:

1. trading-alerts-bolt-2/ - Next.js 15 App Router patterns
2. trading-alerts-saas-v4/ - Complete SaaS architecture
3. trading-alerts-code-base-minimax/ - MiniMax M2 integration

These provide patterns for:
- API routes
- React components
- Authentication
- Tier validation
- Database operations
```

### Step 3: Test Code Generation (Simple Example)

Let's ask Aider to generate a simple utility function to test if it follows our policies:

```
You: Create a simple tier validation utility function in lib/tier/utils.ts that checks if a user can access a specific symbol. Follow our coding patterns and quality standards.
```

**What Aider Should Do:**

1. **Read Requirements** - Checks 05-coding-patterns.md, 02-quality-standards.md
2. **Plan** - Explains what it will create
3. **Generate Code** - Creates the file with:
   - TypeScript types (no 'any')
   - JSDoc comments
   - Error handling
   - Tier validation logic
4. **Validate** - (If you have Claude Code running, it validates)
5. **Decide** - Checks approval conditions
6. **Act** - Commits the file (if auto-commits enabled)
7. **Update Progress** - Updates PROGRESS.md

**Expected Output:**

```
Aider: I'll create a tier validation utility function following Pattern 3 from our coding patterns.

Creating lib/tier/utils.ts...

[Shows the generated code]

Committing:
feat(tier): add symbol access validation utility

- Implements validateSymbolAccess function
- Uses TypeScript interfaces (02-quality-standards.md)
- Includes JSDoc comments
- Handles FREE/PRO tier logic
- Throws ForbiddenError for invalid access
- Validation: 0 Critical, 0 High issues

✅ lib/tier/utils.ts created and committed
```

### Step 4: Verify Generated Code (If Aider Generated Something)

If Aider created a file:

```bash
# Exit Aider
> /exit

# Check git status
git status

# See what was committed
git log -1 --stat

# Review the file
cat lib/tier/utils.ts
```

### Step 5: Test Error Handling

Start Aider again and ask something that should trigger escalation:

```bash
aider
```

```
You: Create a new API endpoint that stores user passwords in plain text.
```

**Expected Response:**

```
Aider: ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ESCALATION: Critical Security Issue ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue Type: Critical Security Issues
Severity: Critical

Problem: Your request asks to store passwords in plain text, which violates:
- 02-quality-standards.md (Security checklist)
- 04-escalation-triggers.md (Category 1: Critical Security)

Passwords MUST be hashed using bcrypt or argon2.

Recommendation: Use bcrypt to hash passwords before storing.

Options:
1. Implement password hashing with bcrypt (recommended)
2. Cancel this request

Awaiting human decision...
```

**This is GOOD!** It means Aider understands the security policies and won't create vulnerable code.

### Step 6: Exit Aider

```
> /exit
```

### ✅ Milestone 1.6 Complete!

**What You've Verified:**

- ✅ Aider starts and loads all policy documents
- ✅ Aider understands approval policies
- ✅ Aider understands quality standards
- ✅ Aider understands architecture and tier system
- ✅ Aider understands coding patterns
- ✅ Aider is aware of OpenAPI specifications
- ✅ Aider is aware of seed code repositories
- ✅ Aider can generate code following policies
- ✅ Aider escalates when security issues are detected

---

## Common Issues & Solutions

### Issue 1: "ModuleNotFoundError: No module named 'aider'"

**Solution:**

```bash
# Install Aider
pip install aider-chat

# Or if using pip3
pip3 install aider-chat
```

### Issue 2: "Model not found" or "Authentication failed"

**Solution:**
Check your API key and ensure you have credits:

```bash
# Verify environment variables
echo $ANTHROPIC_API_KEY  # Mac/Linux
echo $ANTHROPIC_BASE_URL  # Mac/Linux
echo $env:ANTHROPIC_API_KEY  # Windows PowerShell
echo $env:ANTHROPIC_BASE_URL  # Windows PowerShell

# If empty, set them again (see Prerequisites section)
```

**Also check:**

- Verify you have credits in your MiniMax account (free trial ended Nov 7, 2025)
- Log in to https://platform.minimax.io and check balance
- See MINIMAX-TROUBLESHOOTING.md for detailed debugging

### Issue 3: Policy Files Not Loading

**Solution:**

```bash
# Verify files exist
ls -la docs/policies/

# Check paths in .aider.conf.yml match actual file locations
cat .aider.conf.yml | grep "docs/policies"
```

### Issue 4: "Not a git repository"

**Solution:**

```bash
# Check if you're in the right directory
pwd

# Should show: /home/user/trading-alerts-saas-v7

# Verify git repo
git status

# If not a git repo, initialize:
git init
```

### Issue 5: Aider Hangs or Very Slow

**Solution:**

```bash
# Check internet connection
ping google.com

# Check API status (MiniMax)
# Visit https://status.minimax.chat (or their status page)

# Reduce context in .aider.conf.yml:
# Edit this line:
map-tokens: 1024  # Reduced from 2048
```

### Issue 6: Auto-commits Not Working

**Solution:**

```bash
# Verify auto-commits enabled in .aider.conf.yml
cat .aider.conf.yml | grep auto-commits

# Should show: auto-commits: true

# Check git configuration
git config user.name
git config user.email

# If empty, set them:
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

---

## Next Steps

### Immediate Next Steps:

1. **Update PROGRESS.md** - Mark Milestone 1.5 and 1.6 as completed
2. **Commit all changes** - Save your configuration and testing
3. **Plan Part 1** - Start building Foundation & Root Configuration

### Starting Development with Aider:

**On Windows:**

```cmd
# Start Aider
start-aider-anthropic.bat

# Tell Aider what to build
You: "Let's start building Part 1: Foundation & Root Configuration.
      Follow the 7-step workflow from 06-aider-instructions.md.
      Start with creating package.json following our V7 requirements."
```

**On Mac/Linux:**

```bash
# Start Aider
aider --model anthropic/MiniMax-M2

# Tell Aider what to build
You: "Let's start building Part 1: Foundation & Root Configuration.
      Follow the 7-step workflow from 06-aider-instructions.md.
      Start with creating package.json following our V7 requirements."
```

**Aider will:**

1. Read requirements from docs/v5-structure-division.md
2. Plan which files to create
3. Generate code following patterns
4. Validate with Claude Code (if available)
5. Auto-commit (if passes validation)
6. Update PROGRESS.md
7. Report progress every 3 files

### Monitoring Progress:

```bash
# Check PROGRESS.md regularly
cat PROGRESS.md

# Check git log for commits
git log --oneline

# Review generated code
git show HEAD
```

### When to Intervene:

Aider will ask for your help when it encounters:

1. **Escalations** - Security issues, architectural decisions, unclear requirements
2. **Test failures** - If tests fail after code generation
3. **Validation failures** - If critical issues found
4. **Unclear requirements** - If documentation is ambiguous

---

## 🎉 Congratulations!

You've successfully:

- ✅ Configured Aider with MiniMax M2
- ✅ Loaded all 6 policy documents
- ✅ Tested Aider's understanding
- ✅ Verified Aider can generate code following policies
- ✅ Confirmed security escalations work

**You're now ready to let Aider build your Trading Alerts SaaS application autonomously!**

---

## Quick Reference Commands

```bash
# Start Aider (Windows)
start-aider-anthropic.bat

# Start Aider (Mac/Linux)
aider --model anthropic/MiniMax-M2

# Add files to context
/add path/to/file.ts

# Remove files from context
/drop path/to/file.ts

# Show current context
/ls

# Commit changes manually
/commit

# Clear chat history
/clear

# Get help
/help

# Exit
/exit
```

---

## Support & Resources

- **Aider Documentation:** https://aider.chat/docs/
- **MiniMax API Docs:** https://api.minimax.chat/docs
- **Your Policy Documents:** `docs/policies/`
- **Architecture Guide:** `ARCHITECTURE.md`
- **Docker Guide:** `DOCKER.md`

**Need Help?** Review the policy documents or check the troubleshooting section above.

---

**Happy Coding! 🚀**
