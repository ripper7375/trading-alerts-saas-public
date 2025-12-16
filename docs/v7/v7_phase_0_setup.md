## PHASE 0: LOCAL ENVIRONMENT SETUP

### Timeline: Week 1, Days 1-2 (4 hours)

### Goal: Install all tools

💡 BEGINNER TIP: This is like setting up your workshop before building.
Take your time, verify each step works!

---

### CORE TOOLS (4 essential installations)

☐ STEP 1: Create GitHub Account (10 minutes)
What: Online storage for your code
Why: Backup + deployment + collaboration
How:

1.  Go to github.com
2.  Click "Sign up"
3.  Follow prompts
4.  Enable 2FA (security)

Verify: You can log in to GitHub ✓

☐ STEP 2: Install Git (20 minutes)
What: Version control system
Why: Track changes, work with GitHub
How:

1.  Download from git-scm.com
2.  Run installer (keep defaults)
3.  Configure:
    ```
    git config --global user.name "Your Name"
    git config --global user.email "your-email@example.com"
    ```

Verify:

```
git --version
```

Should show: git version 2.x.x ✓

☐ STEP 3: Install Node.js 18.18+ (20 minutes)
What: JavaScript runtime (runs Next.js)
Why: Your frontend needs this
How:

1.  Go to nodejs.org
2.  Download LTS version (20.x or 22.x)
3.  Run installer
4.  npm installs automatically

⚠️ CRITICAL: Next.js 15 requires Node.js 18.18 or higher!

Verify:

```
node --version
```

Should show: v18.18+ or higher ✓

☐ STEP 4: Install Python 3.11+ (20 minutes)
What: Python runtime (runs Flask and Aider)
Why: Your backend and Aider need this
How:

1.  Go to python.org
2.  Download 3.11 or 3.12
3.  Run installer
4.  ✅ CHECK "Add Python to PATH"!

Verify:

```
python --version
```

Or:

```
py -3.11 --version
```

Should show: Python 3.11+ ✓

💡 BEGINNER TIP: If any verify command fails, restart your terminal and try again!

✅ CHECKPOINT: All 4 core tools installed and verified

---

### DEVELOPMENT ENVIRONMENT (6 installations)

☐ STEP 5: Install VSCode (20 minutes)
What: Code editor (where you'll see code)
Why: Best editor for web development
How:

1.  Go to code.visualstudio.com
2.  Download for your OS
3.  Run installer
4.  ✅ CHECK "Add to PATH"

Verify:

```
code --version
```

Shows version number ✓

☐ STEP 6: Install pnpm (5 minutes)
What: Package manager (installs JavaScript libraries)
Why: Faster than npm, saves disk space
How:

```
npm install -g pnpm
```

Verify:

```
pnpm --version
```

Shows version number ✓

☐ STEP 7: Verify pip (2 minutes)
What: Package manager (installs Python libraries)
Why: Comes with Python, need to verify
How: Already installed with Python

Verify:

```
pip --version
```

Or:

```
py -3.11 -m pip --version
```

Shows version number ✓

☐ STEP 8: Install PostgreSQL 15+ (30 minutes)
What: Database system
Why: Store user data, alerts, etc.
How:

1.  Go to postgresql.org/download
2.  Download 15 or 16
3.  Run installer
4.  Set password: WRITE IT DOWN! 📝
5.  Keep port: 5432

Verify:

```
psql --version
```

Shows psql 15.x or 16.x ✓

☐ STEP 9: Install Docker Desktop (30 minutes)
What: Container system
Why: Package Flask service
How:

1.  Go to docker.com/products/docker-desktop
2.  Download for your OS
3.  Run installer
4.  Restart computer
5.  Launch Docker Desktop

Verify:

```
docker --version
docker run hello-world
```

Both work without errors ✓

☐ STEP 10-15: Install VSCode Extensions (15 minutes)
What: VSCode addons
Why: Better coding experience
How: Open VSCode → Extensions (Ctrl+Shift+X) → Search → Install

Install these 6:

1.  Live Server (by Ritwick Dey)
2.  Prettier - Code formatter
3.  ESLint (by Microsoft)
4.  GitLens (by GitKraken)
5.  Prisma
6.  Thunder Client

Verify: Open Extensions panel, see all 6 enabled ✓

💡 BEGINNER TIP: Extensions make VSCode more powerful. Don't skip!

✅ CHECKPOINT: All development tools installed

---

### AI DEVELOPMENT TOOLS (2 installations)

☐ STEP 16: Install Aider with Python 3.11 (10 minutes)
What: AI coding assistant
Why: Your autonomous builder!
How:

```
py -3.11 -m pip install aider-chat
```

Verify:

```
py -3.11 -m aider --version
```

Shows version number ✓

💡 BEGINNER NOTE: Aider will use MiniMax M2 API (cost-effective!)

☐ STEP 17: Get MiniMax API Key (15 minutes)
What: API access for MiniMax M2
Why: Aider needs this to build code
How:

1.  Go to platform.minimaxi.com
2.  Create account or sign in
3.  Navigate to API Keys section
4.  Create new API key
5.  Copy the key (starts with something like "sk-...")
6.  Save it securely! 📝

💡 BEGINNER TIP: This is more affordable than Anthropic!

Verify: You have the API key saved ✓

☐ STEP 17.5: Get Resend API Key (10 minutes)
What: Email service for transactional emails
Why: Send verification emails, password resets, alert notifications
How:

1.  Go to resend.com
2.  Create account (free tier: 100 emails/day)
3.  Navigate to API Keys section
4.  Create new API key
5.  Copy the key (starts with "re\_...")
6.  Save it securely! 📝

💡 BEGINNER TIP: Resend is developer-friendly with great Next.js integration!

Verify: You have the API key saved ✓

☐ STEP 18: Set Environment Variables for MiniMax M2 (10 minutes)
What: Configure Aider to use MiniMax M2
Why: Tell Aider which API to use
How:

**Windows (PowerShell):**

```powershell
$env:ANTHROPIC_API_KEY="your-minimax-api-key-here"
$env:ANTHROPIC_API_BASE="https://api.minimaxi.com/v1"
```

**Windows (Command Prompt):**

```cmd
set ANTHROPIC_API_KEY=your-minimax-api-key-here
set ANTHROPIC_API_BASE=https://api.minimaxi.com/v1
```

**Mac/Linux:**

```bash
export ANTHROPIC_API_KEY="your-minimax-api-key-here"
export ANTHROPIC_API_BASE="https://api.minimaxi.com/v1"
```

**Make it Permanent (Optional):**

Windows: Add to System Environment Variables

1.  Search "Environment Variables" in Start Menu
2.  Click "Edit the system environment variables"
3.  Click "Environment Variables"
4.  Under "User variables", click "New"
5.  Add ANTHROPIC_API_KEY with your key
6.  Add ANTHROPIC_API_BASE with https://api.minimaxi.com/v1

Mac/Linux: Add to ~/.bashrc or ~/.zshrc:

```bash
echo 'export ANTHROPIC_API_KEY="your-minimax-api-key-here"' >> ~/.bashrc
echo 'export ANTHROPIC_API_BASE="https://api.minimaxi.com/v1"' >> ~/.bashrc
source ~/.bashrc
```

💡 BEGINNER TIP: Replace "your-minimax-api-key-here" with your actual key!

Verify:

```
echo %ANTHROPIC_API_KEY%    # Windows CMD
echo $env:ANTHROPIC_API_KEY # Windows PowerShell
echo $ANTHROPIC_API_KEY     # Mac/Linux
```

Should show your API key ✓

☐ STEP 19: Create Aider Configuration (10 minutes)
What: Configure Aider to use MiniMax M2 by default
Why: So you don't have to specify it every time
How:

Create file: `.aider.conf.yml` in your home directory

**Windows:** C:\Users\YourUsername\.aider.conf.yml
**Mac/Linux:** ~/.aider.conf.yml

Content:

```yaml
# Aider V7 Configuration - MiniMax M2

# Model to use
model: anthropic/MiniMax-M2

# Auto-commit when approved
auto-commits: true

# Run checks before commit
lint: true
```

💡 BEGINNER TIP: This tells Aider to always use MiniMax M2!

Verify: File exists in home directory ✓

☐ STEP 20: Test Aider Setup (5 minutes)
What: Verify Aider works with MiniMax M2
Why: Ensure everything is configured correctly
How:

```
py -3.11 -m aider --model anthropic/MiniMax-M2
```

You should see:

```
Aider v0.x.x
Model: anthropic/MiniMax-M2
Main model: MiniMax-M2 with Agentic API

Ready! Type /help for commands.
```

Test it:

```
You: What model are you?
Aider: I'm using the MiniMax-M2 model...
```

Exit: `/exit`

Verify: Aider responds correctly ✓

💡 BEGINNER TIP: From now on, always start Aider with:
`py -3.11 -m aider --model anthropic/MiniMax-M2`

✅ CHECKPOINT: Aider installed and configured with MiniMax M2!

---

### TOOL CONNECTIONS (3 configurations)

☐ STEP 21: Connect Aider to GitHub (15 minutes)
What: Link Aider to your GitHub account
Why: Aider can read/write to your repositories
How:

1.  Create GitHub Personal Access Token:
    - Go to GitHub → Settings → Developer settings
    - Personal access tokens → Tokens (classic)
    - Generate new token (classic)
    - Name: "Aider Access"
    - Select scopes:
      ✓ repo (all)
      ✓ workflow
      ✓ write:packages
    - Click "Generate token"
    - Copy token (SAVE IT! You won't see it again) 📝

2.  Set as environment variable:

**Windows (PowerShell):**

```powershell
$env:GITHUB_TOKEN="your-github-token-here"
```

**Mac/Linux:**

```bash
export GITHUB_TOKEN="your-github-token-here"
```

3.  Make it permanent (same way as Step 18)

Verify:

```
echo $env:GITHUB_TOKEN  # Windows PowerShell
echo $GITHUB_TOKEN      # Mac/Linux
```

Shows your token ✓

☐ STEP 22: Connect VSCode to GitHub (5 minutes)
What: Link VSCode to GitHub
Why: Push code from VSCode
How:

1.  Open VSCode
2.  Click Accounts icon (bottom-left)
3.  Sign in with GitHub
4.  Authorize VSCode

Verify: GitHub icon appears in VSCode status bar ✓

☐ STEP 23: Test Git Clone (2 minutes)
What: Verify Git works with GitHub
Why: Ensure connection is working
How:
Try cloning any public repo:

```
git clone https://github.com/some-user/some-repo
```

Verify: Clone works without password prompt ✓

✅ CHECKPOINT: All tools connected

---

### TRADING TOOLS (3 installations)

☐ STEP 24: Install MetaTrader 5 (20 minutes)
What: Trading platform
Why: Source of real-time market data
How:

1.  Download from your broker's website
2.  Run installer
3.  Launch MT5
4.  Login with credentials

💡 BEGINNER NOTE: You need a demo or real MT5 account

☐ STEP 25: Verify MQL5 Indicators (10 minutes)
What: Ensure custom indicators are compiled and running
Why: Flask service reads from these specific indicators
How:

1.  Open MetaTrader 5
2.  Navigate to: Navigator → Indicators → Custom
3.  Verify you see:
    - Fractal Horizontal Line_V5
    - Fractal Diagonal Line_V4
4.  If missing, compile from seed-code/mlq5-indicator/:
    - Open MetaEditor (F4 in MT5)
    - File → Open: Fractal Horizontal Line_V5.mq5
    - Click Compile (F7)
    - Repeat for Fractal Diagonal Line_V4.mq5
5.  Attach both indicators to a chart

⚠️ IMPORTANT: These run ONLY on YOUR MT5 terminal
💡 Users of your SaaS will NOT have MT5 access
💡 Users subscribe to view data from YOUR indicators

Verify: Indicators showing on chart ✓

☐ STEP 26: Document MT5 Credentials (5 minutes)
What: Save your login info
Why: You'll need for Flask service
How: Write down:

- Login: **\*\***\_\_\_**\*\***
- Password: **\*\***\_\_\_**\*\***
- Server: **\*\***\_\_\_**\*\***

💡 SECURITY: Keep these safe, never commit to GitHub!

✅ CHECKPOINT: MT5 ready

---

### ✅ PHASE 0 COMPLETION CHECKLIST

YOU ARE READY WHEN ALL CHECKED:

☐ GitHub account created and accessible
☐ Git installed (git --version works)
☐ Node.js 18.18+ installed (node --version shows 18.18+)
☐ Python 3.11+ installed (py -3.11 --version shows 3.11+)
☐ VSCode installed (code --version works)
☐ pnpm installed (pnpm --version works)
☐ pip verified (py -3.11 -m pip --version works)
☐ PostgreSQL 15+ installed (psql --version works)
☐ Docker Desktop installed (docker run hello-world works)
☐ 6 VSCode extensions installed and enabled
☐ Aider installed (py -3.11 -m aider --version works)
☐ MiniMax API key obtained and saved
☐ Environment variables set (ANTHROPIC_API_KEY, ANTHROPIC_API_BASE)
☐ Aider configuration file created (.aider.conf.yml)
☐ Aider tested with MiniMax M2 (responds correctly)
☐ GitHub token created and set
☐ VSCode connected to GitHub (icon visible)
☐ Git clone works
☐ MT5 terminal running
☐ MT5 indicators compiled

TOTAL CHECKBOXES: 19
TIME INVESTED: 4 hours
READINESS: Ready for Phase 1! 🚀

💡 BEGINNER TIP: Don't rush! Getting setup right saves hours later.

---
