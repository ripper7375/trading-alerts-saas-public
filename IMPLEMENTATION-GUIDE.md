# Trading Alerts SaaS - Implementation Guide (V7 with MiniMax M2)

## Overview

This guide explains **how to build your Trading Alerts SaaS** using the **V7 workflow** with **Aider and MiniMax M2 API**. It's written for beginners who are new to SaaS development and AI-assisted coding.

**What is V7?** Version 7 of our development approach uses:

- **Policy-driven development** - AI follows written rules
- **Aider** - AI coding assistant that edits files
- **MiniMax M2 API** - Cost-effective AI model from Anthropic compatibility API
- **Autonomous building** - AI builds most code with minimal supervision

---

## 📖 Table of Contents

1. [The V7 Development Process](#the-v7-development-process)
2. [Policy-Driven Development](#policy-driven-development)
3. [Working with Aider (MiniMax M2)](#working-with-aider-minimax-m2)
4. [Handling Escalations](#handling-escalations)
5. [Building Each Part](#building-each-part)
6. [Testing Strategy](#testing-strategy)
7. [Troubleshooting](#troubleshooting)
8. [Tips for Success](#tips-for-success)

---

## 1. The V7 Development Process

### Timeline Overview

**Total Time:** 11 weeks (~67 hours)

| Phase          | Duration | What You Do                                   | What Aider Does                   |
| -------------- | -------- | --------------------------------------------- | --------------------------------- |
| **Week 1**     | 14 hours | Create policies, OpenAPI specs, documentation | Nothing (you're setting it up)    |
| **Week 2**     | 5 hours  | Setup Next.js project, Prisma, ENV files      | Nothing (manual setup)            |
| **Weeks 3-10** | 38 hours | Monitor, handle escalations, test             | Build all 170+ files autonomously |
| **Week 11**    | 6 hours  | Deploy to Vercel and Railway                  | Nothing (you deploy manually)     |
| **Week 12+**   | Ongoing  | Add features, fix bugs, maintain              | Help with new features            |

### Your Role in V7

**You are the architect, not the builder.** Think of it like building a house:

- **Phase 1 (Week 1):** You create the blueprints (policies, specs)
- **Phase 2 (Week 2):** You lay the foundation (project setup)
- **Phase 3 (Weeks 3-10):** Aider builds the house (writes code)
- **Phase 4 (Week 11):** You open for business (deploy)

**Your responsibilities:**

1. ✅ Create clear policies that guide Aider
2. ✅ Monitor Aider's progress
3. ✅ Handle escalations (when Aider asks for help)
4. ✅ Test the code Aider writes
5. ✅ Make final deployment decisions

**Aider's responsibilities:**

1. ✅ Read your policies and understand requirements
2. ✅ Write code that follows your standards
3. ✅ Auto-fix minor issues
4. ✅ Escalate when uncertain
5. ✅ Commit code when policies are satisfied

---

## 2. Policy-Driven Development

### What Are Policies?

**For Beginners:** Policies are like a "rulebook" for AI. They tell Aider:

- When to approve code and commit it
- When to fix issues automatically
- When to stop and ask you for help
- What "good code" looks like
- How to structure files

### Your 7 Policy Documents

You created these in Phase 1 (Milestone 1.1):

| Policy                        | Purpose                     | Aider Uses It To...               |
| ----------------------------- | --------------------------- | --------------------------------- |
| **00-tier-specifications.md** | Define FREE/PRO tier limits | Enforce tier restrictions in code |
| **01-approval-policies.md**   | Define approval conditions  | Decide when to commit             |
| **02-quality-standards.md**   | Define code quality         | Write clean, maintainable code    |
| **03-architecture-rules.md**  | Define system structure     | Put files in correct locations    |
| **04-escalation-triggers.md** | Define escalation rules     | Know when to ask you              |
| **05-coding-patterns.md**     | Provide code templates      | Copy proven patterns              |
| **06-aider-instructions.md**  | Define workflow             | Operate efficiently               |

### How Policies Guide Aider

**Example: Creating an API Route**

1. **Aider reads requirements** from `v5_part_X.md`
2. **Aider reads coding pattern** from `05-coding-patterns.md`
3. **Aider generates code** following the pattern
4. **Aider validates code** using Claude Code
5. **Aider checks approval conditions** from `01-approval-policies.md`
6. **Decision:**
   - ✅ All conditions met → **Auto-commit**
   - 🔧 Fixable issues → **Auto-fix and retry**
   - ⚠️ Uncertain/blocked → **Escalate to you**

### Policy Improvement Over Time

Policies aren't static! As you encounter new scenarios:

1. **Aider escalates** (e.g., "Should I use library X or Y?")
2. **You decide** (e.g., "Use library X")
3. **You update policy** (e.g., add "Use library X for feature Y" to policies)
4. **Aider learns** (next time it won't ask)

This means:

- **Early on:** More escalations (Aider is learning)
- **Later on:** Fewer escalations (policies cover more cases)

---

## 3. Working with Aider (MiniMax M2)

### What is Aider?

**Aider** is a command-line AI coding assistant that:

- Reads your files and understands context
- Edits files directly (no copy/paste!)
- Uses git to track changes
- Commits code automatically when ready

**What is MiniMax M2?**

- Cost-effective AI model compatible with Anthropic's API
- Good balance of quality and cost
- Works through OpenAI-compatible API

### Starting Aider

#### Prerequisites Check

Before starting Aider, ensure:

1. ✅ Python 3.11 is installed
2. ✅ Aider is installed (`pip install aider-chat`)
3. ✅ MiniMax M2 API key is in environment variables
4. ✅ You're in your project root directory

#### Start Command

```bash
cd /path/to/trading-alerts-saas-v7
py -3.11 -m aider --model anthropic/MiniMax-M2
```

**On startup, you should see:**

```
Aider v0.x.x
Model: anthropic/MiniMax-M2
Reading files...
✓ docs/policies/00-tier-specifications.md
✓ docs/policies/01-approval-policies.md
✓ docs/policies/02-quality-standards.md
✓ docs/policies/03-architecture-rules.md
✓ docs/policies/04-escalation-triggers.md
✓ docs/policies/05-coding-patterns.md
✓ docs/policies/06-aider-instructions.md
✓ docs/v5-structure-division.md
✓ docs/trading_alerts_openapi.yaml
✓ docs/flask_mt5_openapi.yaml
✓ PROGRESS.md

Ready! Type /help for commands.
```

**If files don't load:** Check your `.aider.conf.yml` configuration.

### Giving Commands to Aider

#### Command Format

Aider responds to natural language. Be clear and specific:

**Good commands:**

```
Build Part 5: Authentication from v5_part_e.md
Create the POST /api/alerts endpoint following the OpenAPI spec
Implement tier validation for symbol GBPUSD
Fix the TypeScript errors in app/api/alerts/route.ts
```

**Poor commands:**

```
Make the auth work
Do the thing
Fix it
```

#### Starting a Build Part

**Template:**

```
Build Part [NUMBER]: [PART NAME] from v5_part_[LETTER].md

Follow these steps:
1. Read v5_part_[LETTER].md for requirements
2. Read v5-structure-division.md for file locations
3. For each file, use patterns from 05-coding-patterns.md
4. Validate with Claude Code
5. Check approval conditions from 01-approval-policies.md
6. Commit when ready or escalate if uncertain

Notify me every 3 files completed.
```

**Example:**

```
Build Part 11: Alerts from v5_part_k.md

Follow these steps:
1. Read v5_part_k.md for requirements
2. Read v5-structure-division.md for file locations
3. For each file, use patterns from 05-coding-patterns.md
4. Validate with Claude Code
5. Check approval conditions from 01-approval-policies.md
6. Commit when ready or escalate if uncertain

Notify me every 3 files completed.
```

### Monitoring Progress

#### What to Watch For

Aider will output:

```
📖 Reading v5_part_k.md...
📂 Creating app/api/alerts/route.ts...
🔧 Generating code using Pattern 1 from 05-coding-patterns.md...
✅ Code generated (85 lines)
🧪 Validating with Claude Code...
📊 Validation: 0 Critical, 1 High, 2 Medium issues
🔨 Auto-fixing High issue: Missing error handling...
✅ Auto-fix applied
🧪 Re-validating...
📊 Validation: 0 Critical, 0 High, 2 Medium issues
✅ All approval conditions met!
💾 Committing: feat(alerts): add POST /api/alerts endpoint
```

#### Progress Notifications

Every 3 files, Aider will report:

```
📊 PROGRESS UPDATE
Part 11: Alerts
Files completed: 3/12
- ✅ app/api/alerts/route.ts
- ✅ app/api/alerts/[id]/route.ts
- ✅ components/alerts/alert-form.tsx
Escalations: 0
Next: components/alerts/alert-list.tsx
```

### Cost Monitoring

MiniMax M2 is cost-effective, but track usage:

**Estimated costs:**

- Per file: ~$0.02 - $0.05
- Per part (10-15 files): ~$0.30 - $0.75
- Full project (170 files): ~$5 - $10

**Track in PROGRESS.md:**

```markdown
## MiniMax M2 Cost Tracking

- Part 5 (Auth): $0.45
- Part 11 (Alerts): $0.62
- Part 12 (Dashboard): $0.58
- **Total so far: $1.65**
```

### Aider Commands

| Command        | What It Does             |
| -------------- | ------------------------ |
| `/help`        | Show all commands        |
| `/add <file>`  | Add file to context      |
| `/drop <file>` | Remove file from context |
| `/ls`          | List files in context    |
| `/commit`      | Manually trigger commit  |
| `/undo`        | Undo last change         |
| `/exit`        | Exit Aider               |

---

## 4. Handling Escalations

### What is an Escalation?

An **escalation** is when Aider stops and asks you for help. This happens when:

- Unclear requirements
- Multiple valid approaches
- Policy conflicts
- Critical security issues
- New dependencies needed
- Database schema changes

### Escalation Format

Aider will output:

```
⚠️ ESCALATION REQUIRED ⚠️

Issue Type: Architectural Decision
File: app/api/alerts/route.ts
Feature: Alert creation endpoint

Problem:
The OpenAPI spec doesn't specify whether to validate
alert conditions (RSI_OVERSOLD, MACD_CROSSOVER, etc.)
against a predefined list or accept any string.

Policy Gap:
02-quality-standards.md requires input validation,
but doesn't define how to validate enum-like strings
that aren't TypeScript enums.

Suggested Solutions:
1. Create a constants file with allowed conditions
2. Accept any string and validate later in business logic
3. Add a database table for valid conditions

Awaiting human decision...
```

### How to Handle an Escalation

**Step 1: Understand the Problem**

Read the escalation carefully:

- What is Aider trying to do?
- Why is it uncertain?
- What are the options?

**Step 2: Research (if needed)**

- Check the OpenAPI spec
- Review the policy documents
- Consult Claude Chat (this chat!) for advice
- Look at seed code examples

**Step 3: Make a Decision**

Choose the best approach. Example response:

```
Use Solution 1: Create a constants file.

Create lib/constants/alert-conditions.ts with:
- Enum-like TypeScript type: AlertCondition
- Array of allowed values: ALERT_CONDITIONS
- Validation function: isValidCondition(condition: string): boolean

Update 05-coding-patterns.md to include this pattern
for future reference.

Continue with the build.
```

**Step 4: Update Policies (if needed)**

If this is a new scenario, update the relevant policy:

```markdown
# In 05-coding-patterns.md

## PATTERN 7: Constants and Enums

For enum-like values (alert conditions, timeframes, etc.):

1. Create constants file in lib/constants/
2. Define TypeScript type
3. Export array of valid values
4. Export validation function

Example:
\`\`\`typescript
// lib/constants/alert-conditions.ts
export type AlertCondition =
| 'RSI_OVERSOLD'
| 'RSI_OVERBOUGHT'
| 'MACD_CROSSOVER'
| 'BB_BREAKOUT'

export const ALERT_CONDITIONS: AlertCondition[] = [
'RSI_OVERSOLD',
'RSI_OVERBOUGHT',
'MACD_CROSSOVER',
'BB_BREAKOUT',
]

export const isValidCondition = (condition: string): condition is AlertCondition => {
return ALERT_CONDITIONS.includes(condition as AlertCondition)
}
\`\`\`
```

**Step 5: Tell Aider to Continue**

```
Resume building Part 11 from where we left off.
```

### Escalation Log

Track escalations in `PROGRESS.md`:

```markdown
## Escalations Log

### Escalation #1

- Date: 2024-01-15
- Part: Part 11 (Alerts)
- Issue: Alert condition validation approach
- Resolution: Created constants file pattern
- Policy Updated: 05-coding-patterns.md (added Pattern 7)
- Time to resolve: 10 minutes
```

### Reducing Escalations Over Time

As your policies improve:

- **Week 3-4:** 5-10 escalations per part
- **Week 5-7:** 2-5 escalations per part
- **Week 8-10:** 0-2 escalations per part

This is normal! Aider is learning your preferences.

---

## 5. Building Each Part

### Part Build Workflow

For each part (Parts 1-16):

#### Before Starting

1. ✅ **Read the part spec** (`v5_part_X.md`)
2. ✅ **Understand requirements** (ask Claude Chat if unclear)
3. ✅ **Check dependencies** (does this part depend on others?)
4. ✅ **Estimate time** (10-15 files = 2-4 hours)

#### Start the Build

```bash
# Start Aider if not already running
py -3.11 -m aider --model anthropic/MiniMax-M2

# Give the build command
Build Part [N]: [Name] from v5_part_[X].md
```

#### During the Build

1. **Monitor output** - Watch for escalations
2. **Check notifications** - Every 3 files, review progress
3. **Stay available** - Be ready to handle escalations
4. **Take notes** - Document any issues in PROGRESS.md

#### After Completion

1. **Test in Postman** - Verify all endpoints work
2. **Manual testing** - Test in browser
3. **Review commits** - Check git log
4. **Update PROGRESS.md** - Mark part complete

#### Example Build Session

**Part 11: Alerts (14 files, ~3 hours)**

```
[You] Build Part 11: Alerts from v5_part_k.md

[Aider] 📖 Reading v5_part_k.md...
[Aider] 📂 Starting file 1/14: app/api/alerts/route.ts...
[Aider] ✅ File 1 complete, committed
[Aider] 📂 Starting file 2/14: app/api/alerts/[id]/route.ts...
[Aider] ✅ File 2 complete, committed
[Aider] 📂 Starting file 3/14: components/alerts/alert-form.tsx...
[Aider] ✅ File 3 complete, committed

[Aider] 📊 PROGRESS: 3/14 files complete. No escalations.

[Aider] 📂 Starting file 4/14: components/alerts/alert-list.tsx...
[Aider] ⚠️ ESCALATION: Should we implement pagination for alerts list?

[You] Yes, add pagination with 10 alerts per page.

[Aider] ✅ File 4 complete with pagination, committed
[Aider] 📂 Starting file 5/14: lib/db/alerts.ts...
[... continues ...]

[Aider] 🎉 Part 11 complete! All 14 files built and committed.

[You] /exit
```

**Now you test:**

1. Open Postman
2. Test POST /api/alerts
3. Test GET /api/alerts
4. Test tier restrictions
5. Test in browser UI

### Part Build Order

Build in this recommended order:

| Order | Part                     | Why                             |
| ----- | ------------------------ | ------------------------------- |
| 1     | Part 1-4: Foundation     | Core structure needed first     |
| 2     | Part 5: Auth             | Needed for all protected routes |
| 3     | Part 7: API Routes       | Backend before frontend         |
| 4     | Part 11: Alerts          | Core feature                    |
| 5     | Part 12: E-commerce      | Tier upgrades                   |
| 6     | Part 8-10: UI Components | Frontend after backend          |
| 7     | Part 6: Flask MT5        | External service                |
| 8     | Part 13-16: Polish       | Final touches                   |

---

## 6. Testing Strategy

### Three Types of Testing

#### 1. Postman Testing (After Each Part)

**Purpose:** Verify API endpoints work correctly

**How:**

1. Import Postman collection from OpenAPI spec
2. Test each new endpoint
3. Verify tier restrictions
4. Check error handling
5. Save successful responses

**Time:** 15-30 minutes per part

See `postman/TESTING-GUIDE.md` for detailed scenarios.

#### 2. Manual Browser Testing (After UI Parts)

**Purpose:** Verify UI works and looks good

**How:**

1. Start dev server: `npm run dev`
2. Open `http://localhost:3000`
3. Click through all pages
4. Test forms and interactions
5. Check responsive design
6. Test on different browsers

**Time:** 30-45 minutes per UI part

#### 3. Integration Testing (After Multiple Parts)

**Purpose:** Verify parts work together

**How:**

1. Test complete user flows (signup → login → create alert → dashboard)
2. Test tier upgrades (FREE → PRO → verify new access)
3. Test real-time features (alerts triggering, notifications)
4. Load testing (create many alerts, stress test)

**Time:** 2-3 hours total (after all parts done)

### Testing Checklist Template

For each part:

```markdown
## Part [N] Testing

### API Endpoints

- [ ] Endpoint 1: [name] - Status [✅/❌]
- [ ] Endpoint 2: [name] - Status [✅/❌]
- [ ] Endpoint 3: [name] - Status [✅/❌]

### UI Components

- [ ] Component 1: [name] - Status [✅/❌]
- [ ] Component 2: [name] - Status [✅/❌]

### Tier Restrictions

- [ ] FREE tier limits enforced
- [ ] PRO tier access granted

### Error Handling

- [ ] Missing auth token → 401
- [ ] Invalid input → 400 with message
- [ ] Tier violation → 403 with message

### Issues Found

1. [Issue description] - Fixed: [yes/no]
2. [Issue description] - Fixed: [yes/no]

### Overall Status: [✅ PASS / ❌ FAIL]
```

---

## 7. Troubleshooting

### Common Issues and Solutions

#### Issue: Aider won't start

**Symptoms:** Command not found, import errors

**Solutions:**

1. Verify Python 3.11: `py -3.11 --version`
2. Reinstall Aider: `py -3.11 -m pip install --upgrade aider-chat`
3. Check PATH environment variable
4. Try: `python3.11 -m aider` instead of `py -3.11 -m aider`

---

#### Issue: Aider doesn't load policy files

**Symptoms:** Files not listed on startup

**Solutions:**

1. Check `.aider.conf.yml` exists in project root
2. Verify file paths in config are correct
3. Ensure policy files exist in `docs/policies/`
4. Try starting Aider from project root directory

---

#### Issue: MiniMax M2 API errors

**Symptoms:** "API key invalid", "Model not found"

**Solutions:**

1. Check API key is set: `echo %MINIMAX_API_KEY%` (Windows) or `echo $MINIMAX_API_KEY` (Linux/Mac)
2. Verify API key format (should start with `sk-...`)
3. Test API key with curl:
   ```bash
   curl https://api.minimax.ai/v1/models \
     -H "Authorization: Bearer $MINIMAX_API_KEY"
   ```
4. Check API quota/billing status

See `MINIMAX-TROUBLESHOOTING.md` for detailed MiniMax M2 debugging.

---

#### Issue: Too many escalations

**Symptoms:** Aider escalates frequently, slows progress

**Solutions:**

1. **Review policies** - Are they clear and comprehensive?
2. **Add examples** - Update `05-coding-patterns.md` with more examples
3. **Document decisions** - Add escalation resolutions to policies
4. **Be specific** - Give Aider clearer commands
5. **Ask Claude Chat** - Get help refining policies

---

#### Issue: Code quality issues

**Symptoms:** TypeScript errors, missing validations, security issues

**Solutions:**

1. **Update quality standards** - Make `02-quality-standards.md` more specific
2. **Stricter approval conditions** - Update `01-approval-policies.md`
3. **Better patterns** - Improve examples in `05-coding-patterns.md`
4. **Manual review** - Review Aider's commits regularly
5. **Claude Code validation** - Check validation results in commit messages

---

#### Issue: Tier restrictions not working

**Symptoms:** FREE users can access PRO features

**Solutions:**

1. **Check policy** - Review `00-tier-specifications.md`
2. **Test validation** - Test tier validation functions
3. **Review code** - Check `lib/tier/validation.ts`
4. **Add tests** - Write unit tests for tier logic
5. **Manual testing** - Test with both FREE and PRO users

---

#### Issue: Build is slow

**Symptoms:** Each file takes 5-10 minutes

**Solutions:**

1. **Reduce context** - Remove unnecessary files from Aider context
2. **Simplify patterns** - Make patterns in `05-coding-patterns.md` more concise
3. **Batch operations** - Build multiple related files together
4. **Check API latency** - MiniMax M2 API might be slow
5. **Optimize policies** - Reduce policy document sizes

---

### Getting Help

#### Ask Claude Chat (This Chat!)

For any confusion:

```
I'm working on Part 11 and Aider escalated because [issue].
The policy says [X] but the requirement says [Y].
What should I do?
```

#### Check Documentation

- **Architecture:** `ARCHITECTURE.md`
- **Docker issues:** `DOCKER.md`
- **MiniMax M2 issues:** `MINIMAX-TROUBLESHOOTING.md`
- **Postman testing:** `postman/README.md`
- **Progress tracking:** `PROGRESS.md`

#### Community Resources

- **Aider GitHub:** https://github.com/paul-gauthier/aider
- **MiniMax Docs:** Check your MiniMax M2 API provider documentation
- **Next.js Docs:** https://nextjs.org/docs
- **Prisma Docs:** https://www.prisma.io/docs

---

## 8. Tips for Success

### Tip 1: Trust the Process

**Don't micromanage Aider.** Let it work autonomously. Your job is to:

- Set direction (policies, requirements)
- Handle escalations (decisions)
- Test output (quality assurance)

### Tip 2: Improve Policies Iteratively

**Policies will never be perfect on day 1.** That's okay! Each escalation is a chance to improve them.

Think of policies as a garden:

- **Week 1:** Plant seeds (create initial policies)
- **Weeks 3-10:** Water and prune (update based on escalations)
- **Future:** Harvest (use refined policies for new features)

### Tip 3: Test Early, Test Often

**Don't wait until the end to test.** Test each part immediately after it's built.

Bugs found early = easy to fix
Bugs found late = painful to untangle

### Tip 4: Document Everything

**Keep PROGRESS.md updated.** Document:

- Time spent on each part
- Escalations and resolutions
- Issues found and fixed
- Learnings and insights

This helps you:

- Track progress visually
- Learn from patterns
- Improve future projects

### Tip 5: Take Breaks

**You're managing, not coding.** But management requires focus too.

When handling escalations:

- Take your time
- Research options
- Ask Claude Chat for advice
- Don't rush decisions

A good decision now = less rework later.

### Tip 6: Celebrate Small Wins

**Each completed part is a victory!** 170 files is overwhelming, but 10-15 files at a time is manageable.

Track milestones:

- ✅ First endpoint works
- ✅ First UI component renders
- ✅ First tier restriction enforced
- ✅ First part complete
- ✅ Half the parts done
- ✅ All parts complete!

### Tip 7: Use MiniMax M2 Cost-Effectively

**Track costs as you go:**

- Set a budget (e.g., $20 for the whole project)
- Monitor spending in PROGRESS.md
- If costs are high, simplify policies or reduce context

MiniMax M2 should be very affordable (~$5-10 for full project).

### Tip 8: Learn as You Build

**You're not just building a SaaS, you're learning SaaS development.**

Take time to:

- Read the code Aider writes
- Understand the patterns
- Ask questions (to Claude Chat)
- Experiment with changes

By the end, you'll understand:

- Next.js architecture
- API design
- Database modeling
- Authentication flows
- Payment integration
- AI-assisted development

---

## 9. Quick Reference

### Starting a Build Session

```bash
cd /path/to/trading-alerts-saas-v7
py -3.11 -m aider --model anthropic/MiniMax-M2
```

### Building a Part

```
Build Part [N]: [Name] from v5_part_[X].md

Follow the V7 workflow:
1. Read requirements from v5_part_[X].md
2. Use patterns from 05-coding-patterns.md
3. Validate with Claude Code
4. Check approval conditions
5. Commit or escalate

Notify me every 3 files.
```

### Handling an Escalation

1. Read the escalation carefully
2. Research options
3. Make a decision
4. Update policies if needed
5. Tell Aider to continue

### Testing a Part

1. Test APIs in Postman
2. Test UI in browser
3. Test tier restrictions
4. Document results in PROGRESS.md

### Updating Policies

```bash
# Edit the policy file
code docs/policies/05-coding-patterns.md

# Commit the update
git add docs/policies/
git commit -m "docs: update coding patterns with new example"
git push

# Restart Aider to load updated policies
```

---

## 10. Summary

**What makes V7 powerful:**

- ✅ **Policies guide Aider** - No guessing, clear rules
- ✅ **Autonomous building** - Aider works while you monitor
- ✅ **Escalations for decisions** - You decide, Aider executes
- ✅ **Iterative improvement** - Policies get better over time
- ✅ **Cost-effective** - MiniMax M2 keeps costs low
- ✅ **Quality assurance** - Testing catches issues early

**Your journey:**

- **Week 1:** Create policies (hardest part!)
- **Week 2:** Setup foundation (manual work)
- **Weeks 3-10:** Guide Aider (monitor & decide)
- **Week 11:** Deploy (exciting finale!)
- **Future:** Maintain & add features (ongoing)

**Expected outcomes:**

- 🎯 170+ files of quality code
- 🎯 50+ API endpoints working
- 🎯 Full-featured SaaS application
- 🎯 Deep understanding of SaaS development
- 🎯 Cost ~$5-10 in AI API fees
- 🎯 Time ~67 hours total

---

## Need Help?

**If you're stuck:**

1. Read this guide again (answers are probably here!)
2. Check other documentation (ARCHITECTURE.md, DOCKER.md, etc.)
3. Ask Claude Chat for clarification
4. Review your policies (they might need updates)
5. Test incrementally (isolate the problem)

**Remember:** You're not alone! Claude Chat is here to help throughout the journey.

---

**💡 Final Beginner Insight:** Building a SaaS feels overwhelming, but V7 breaks it into manageable pieces. You create the rules (policies), Aider follows them, and together you build something amazing. Trust the process! 🚀

---

_Last Updated: 2024-01-15_
_V7 Implementation Guide for Trading Alerts SaaS with MiniMax M2_

---

## Phase 3: Automated Building & Validation

**Date:** 2025-11-24
**Status:** ✅ Setup Complete - Ready to Build

### Overview

Phase 3 uses Aider as an autonomous builder and validator to generate all 170+ files with automated quality assurance.

### Setup Status

#### ✅ Validation Tools Configured

1. **TypeScript** - Type checking
   - Configuration: `tsconfig.json`
   - Strict mode enabled
   - No implicit any
   - Command: `npm run validate:types`

2. **ESLint** - Code quality
   - Configuration: `.eslintrc.json`
   - Next.js + TypeScript rules
   - React hooks validation
   - Command: `npm run validate:lint`

3. **Prettier** - Formatting
   - Configuration: `.prettierrc`
   - Single quotes, semicolons
   - 80 character lines
   - Command: `npm run validate:format`

4. **Custom Policy Validator**
   - Implementation: `scripts/validate-file.js`
   - Checks: Auth, tier, security, error handling
   - Command: `npm run validate:policies`

#### ✅ Aider Configuration

- File: `.aider.conf.yml`
- Role: Autonomous builder & validator
- Policies: All 9 policy files loaded automatically
- Model: MiniMax M2

#### ✅ Package Scripts

```json
{
  "validate": "Run all validation layers",
  "validate:types": "TypeScript only",
  "validate:lint": "ESLint only",
  "validate:format": "Prettier only",
  "validate:policies": "Policy validator only",
  "fix": "Auto-fix ESLint + Prettier issues",
  "test": "Run Jest tests"
}
```

### Phase 3 Workflow

#### Step 1: Start Aider

```bash
# Navigate to project root
cd /home/user/trading-alerts-saas-v7

# Start Aider
aider

# Aider automatically loads:
# - 9 policy files
# - Compressed OpenAPI spec
# - Architecture documentation
# - Build order README
```

#### Step 2: Load Part Build Order

```bash
# Load build order for the part you want to build
> /read docs/build-orders/part-01-foundation.md

# Load implementation guide for business context
> /read docs/implementation-guides/v5_part_a.md

# Check token usage
> /tokens
```

#### Step 3: Build Files

```bash
# Tell Aider to build the part
> "Build Part 1 following the build order file-by-file"

# Aider will:
# 1. Read the build order
# 2. Build first file
# 3. Run validation automatically
# 4. Make decision (approve/fix/escalate)
# 5. Commit if approved
# 6. Move to next file
# 7. Repeat for all files in the part
```

#### Step 4: Validation Process (Automatic)

After generating each file, Aider runs:

```bash
npm run validate
```

This executes:

1. ✅ TypeScript type checking
2. ✅ ESLint code quality
3. ✅ Prettier formatting
4. ✅ Custom policy validation

**Results Example:**

```
🔍 Checking TypeScript types...
✅ 0 errors

🔍 Checking code quality...
✅ 0 errors, 0 warnings

🔍 Checking code formatting...
✅ All files formatted correctly

🔍 Checking policy compliance...
📊 VALIDATION REPORT
Files Checked: 1
Total Issues: 0
✅ All policy checks passed!
```

#### Step 5: Aider Decision

Based on validation results:

**Option A: APPROVE (85-92% of files)**

- All validation passed
- Aider commits automatically
- Moves to next file

**Option B: AUTO-FIX (6-12% of files)**

- Minor issues found (formatting, imports)
- Aider runs: `npm run fix`
- Re-validates
- If fixed → commits
- If not fixed after 3 attempts → escalates

**Option C: ESCALATE (2-5% of files)**

- Critical issues found
- Or >2 High issues
- Or architectural decision needed
- Aider stops and asks you for guidance

#### Step 6: Handle Escalations

When Aider escalates:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ESCALATION: Missing Authentication ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: app/api/alerts/route.ts
Severity: Critical

Problem:
Protected API route missing authentication check

Options:
1. Add getServerSession check
2. Make endpoint public
3. Use different auth method

Recommendation: Option 1

What should I do?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

You respond:

```
> "Add getServerSession check with 401 response if not authenticated"
```

Aider fixes and continues.

#### Step 7: Rotate to Next Part

When part is complete:

```bash
# Drop current part files to save tokens
> /drop docs/build-orders/part-01-foundation.md
> /drop docs/implementation-guides/v5_part_a.md

# Load next part
> /read docs/build-orders/part-02-database.md
> /read docs/implementation-guides/v5_part_b.md

# Build next part
> "Build Part 2 following the build order file-by-file"
```

#### Step 8: Repeat for All 18 Parts

Continue rotating through parts until complete.

### Testing After Each Part

After completing a part, test the functionality:

```bash
# Run validation
npm run validate

# Run tests
npm test

# Test in browser
npm run dev
# Visit http://localhost:3000
```

### Monitoring Progress

Aider updates `PROGRESS.md` after each file:

```markdown
### Part 1: Foundation - ✅ Complete

- Files: 12/12 (100%)
- Completed: 2025-11-24
- Escalations: 0
- Time: 2 hours

### Part 2: Database - ⏳ In Progress

- Files: 2/4 (50%)
- In Progress: prisma/schema.prisma
```

### Commands Reference

```bash
# Validation
npm run validate              # All validation
npm run validate:types        # TypeScript only
npm run validate:lint         # ESLint only
npm run validate:format       # Prettier only
npm run validate:policies     # Policy validator only

# Auto-fix
npm run fix                   # Fix ESLint + Prettier

# Tests
npm test                      # Run all tests
npm run test:watch            # Watch mode
npm run test:coverage         # With coverage

# Database
npm run db:generate           # Generate Prisma types
npm run db:push               # Push schema to database
npm run db:migrate            # Create migration
npm run db:studio             # Open Prisma Studio

# Development
npm run dev                   # Start dev server
npm run build                 # Build for production
```

### Troubleshooting

#### Issue: Validation Fails with TypeScript Errors

```bash
# Regenerate Prisma types
npm run db:generate

# Re-run validation
npm run validate:types
```

#### Issue: ESLint Warnings Exceed Maximum

```bash
# Auto-fix warnings
npm run lint:fix

# Re-validate
npm run validate:lint
```

#### Issue: Policy Validator Finds Issues

Review the policy validator output and:

1. Check if the issue is valid
2. Fix manually or ask Aider to fix
3. Re-run validation

#### Issue: Context Window Full in Aider

```bash
# Drop unnecessary files
> /drop [filename]

# Check token usage
> /tokens

# If still full, restart Aider with clean slate
> /exit
> aider
```

### Documentation

- **Complete Validation Guide:** `VALIDATION-SETUP-GUIDE.md`
- **Workflow Analysis:** `docs/CLAUDE-CODE-WORKFLOW-ANALYSIS.md`
- **Responsibility Checklist:** `docs/CLAUDE-CODE-VALIDATION-CHECKLIST.md`
- **Aider Instructions:** `docs/policies/06-aider-instructions.md`
- **Main Guide:** `CLAUDE.md`

### Success Criteria

Phase 3 is successful when:

✅ All 170+ files generated
✅ All validation passes
✅ No critical issues
✅ Tests pass
✅ Application builds successfully
✅ All features work in browser

### Next Steps

1. ✅ Setup complete (you are here)
2. Start building Part 1
3. Continue through all 18 parts
4. Test each part
5. Deploy to staging
6. Final testing
7. Deploy to production

---

**Phase 3 Status:** ✅ Ready to start building
**Estimated Time:** 40-60 hours of Aider autonomous work
**Your Time:** 2-5 hours (handling escalations)

**Start building:** `aider` → Load Part 1 → Build! 🚀
