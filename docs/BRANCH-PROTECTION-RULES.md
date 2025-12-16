# Branch Protection Rules & Failure Protections

**Phase 3.5.7: Failure Protections**
**Last Updated:** 2025-11-24
**Purpose:** Configure GitHub branch protection to prevent broken code from merging

---

## 📋 Overview

Branch protection rules ensure that:

- ✅ All tests pass before merging
- ✅ Code is reviewed before merging
- ✅ Build succeeds before deployment
- ✅ No one can bypass the rules (including admins)

---

## 🛡️ Recommended Branch Protection Rules

### For `main` Branch

**Navigate to:**

```
GitHub Repo → Settings → Branches → Add rule
```

**Branch name pattern:** `main`

**Required Settings:**

#### ✅ 1. Require a pull request before merging

- [x] Require approvals: **1**
- [x] Dismiss stale pull request approvals when new commits are pushed
- [x] Require review from Code Owners (optional)

#### ✅ 2. Require status checks to pass before merging

- [x] Require branches to be up to date before merging

**Status checks that are required:**

- [x] `unit-and-component-tests`
- [x] `integration-tests`
- [x] `build-check`
- [x] `test-summary`

#### ✅ 3. Require conversation resolution before merging

- [x] All PR conversations must be resolved

#### ✅ 4. Require signed commits (optional but recommended)

- [x] Require signed commits

#### ✅ 5. Require linear history (optional)

- [x] Require linear history (no merge commits, only squash/rebase)

#### ✅ 6. Include administrators

- [x] Apply rules to administrators too (recommended)

#### ✅ 7. Restrict who can push

- [x] Restrict pushes to specific people/teams (optional)

#### ❌ 8. Allow force pushes

- [ ] DO NOT enable (dangerous!)

#### ❌ 9. Allow deletions

- [ ] DO NOT enable (dangerous!)

---

### For `develop` Branch

**Branch name pattern:** `develop`

**Similar rules but slightly relaxed:**

#### ✅ 1. Require a pull request before merging

- [x] Require approvals: **0-1** (more flexible for development)

#### ✅ 2. Require status checks to pass before merging

- [x] Require branches to be up to date before merging
- [x] Same status checks as `main`

#### ✅ 3. Do NOT include administrators

- [ ] Allows admins to push directly if needed

---

### For Feature Branches (`claude/**`, `feature/**`)

**No strict branch protection needed.**

These branches are temporary and will be merged via PR.

---

## 📊 Status Checks Configuration

### What Gets Checked

When you push to a PR, GitHub Actions runs:

```yaml
# .github/workflows/tests.yml
jobs:
  unit-and-component-tests: # ← Required status check
  integration-tests: # ← Required status check
  build-check: # ← Required status check
  test-summary: # ← Required status check
```

### How to Add Status Checks

1. Create PR
2. Wait for first workflow run
3. Go to Settings → Branches → Edit rule
4. Scroll to "Status checks that are required"
5. Search for status check names
6. Select all 4 checks

**GitHub will remember these and require them for all future PRs.**

---

## 🚫 What Happens When Tests Fail

### Scenario: PR with Failing Tests

```
┌─────────────────────────────────────┐
│  Pull Request #123                  │
│  "Add new feature"                  │
├─────────────────────────────────────┤
│  ❌ Unit Tests (FAILED)             │
│  ❌ Integration Tests (FAILED)      │
│  ✅ Build Check (PASSED)            │
│  ❌ Test Summary (FAILED)           │
├─────────────────────────────────────┤
│  🚫 Merge button DISABLED           │
│  Cannot merge until checks pass     │
└─────────────────────────────────────┘
```

**Developer must:**

1. Fix the failing tests
2. Push the fix
3. Wait for tests to pass
4. Then merge

**No one can bypass this** (if "Include administrators" is checked).

---

## 🔔 Failure Notifications

### Email Notifications

**By default, GitHub sends emails when:**

- ✅ Your push triggers a workflow
- ❌ Your workflow fails
- ✅ Someone requests your review

**To configure:**

1. Go to GitHub Settings → Notifications
2. Enable "Actions" under "Watching"
3. Choose email or web notifications

### Slack/Discord Notifications

**Add to `.github/workflows/tests.yml`:**

```yaml
- name: Notify on Failure
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
    payload: |
      {
        "text": "❌ Tests failed in ${{ github.repository }}",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "❌ *Tests Failed*\n\nBranch: `${{ github.ref }}`\nCommit: `${{ github.sha }}`\nAuthor: ${{ github.actor }}"
            }
          }
        ]
      }
```

---

## 🔒 Security: Preventing Bypasses

### Common Bypass Attempts (DON'T DO THESE!)

#### ❌ Force Push to Main

```bash
# This should be blocked by branch protection
git push --force origin main
```

#### ❌ Commit Directly to Main

```bash
# This should be blocked by branch protection
git checkout main
git commit -m "quick fix"
git push origin main
```

#### ❌ Merge Without PR

```bash
# This should be blocked by branch protection
git checkout main
git merge feature-branch
git push origin main
```

#### ❌ Skip CI with [skip ci]

```bash
# DON'T DO THIS!
git commit -m "fix [skip ci]"
```

### ✅ Correct Workflow

```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Make changes and test locally
npm test
npm run build

# 3. Commit and push
git commit -m "feat: add new feature"
git push -u origin feature/my-feature

# 4. Create PR on GitHub

# 5. Wait for tests to pass

# 6. Request review

# 7. Merge after approval + passing tests
```

---

## 📈 Monitoring & Metrics

### Track Test Failures

**GitHub Insights:**

- Go to Insights → Actions
- See workflow success rate
- Identify failing patterns

**What to track:**

- Test success rate (target: >95%)
- Time to fix failures (target: <15 min)
- Number of reverted commits (target: 0)

### Red Flags

🚩 **High failure rate** (>10% of runs fail)

- Tests might be flaky
- Need better test stability

🚩 **Long time to fix** (>1 hour average)

- Developers skipping local testing
- Need better error messages

🚩 **Frequent reverts**

- Tests not catching bugs
- Need more comprehensive tests

---

## 🎓 Training Team Members

### New Developer Onboarding

**Share these documents:**

1. `TESTING-GUIDE.md` - How to run tests
2. `TEST-FAILURE-WORKFLOW.md` - How to handle failures
3. `BRANCH-PROTECTION-RULES.md` - This document

**Key points to emphasize:**

- ✅ Always run tests locally before pushing
- ✅ Never force push to main/develop
- ✅ Fix test failures immediately
- ✅ Ask for help if stuck >30 minutes

---

## 🔧 Troubleshooting

### "I can't merge even though tests pass"

**Check:**

1. Are all required status checks present?
2. Did you get required approvals?
3. Are all conversations resolved?
4. Is branch up to date with base?

### "Admin wants to bypass protection"

**DON'T DO IT!**

If there's an emergency:

1. Temporarily disable branch protection
2. Make the fix
3. **IMMEDIATELY** re-enable protection
4. Document what happened and why

**Better approach:**

1. Create hotfix branch
2. Make minimal fix
3. Run tests locally
4. Create PR with "urgent" label
5. Get quick review
6. Merge after tests pass

### "Status checks not showing up"

**Fix:**

1. Ensure workflow file is on the target branch
2. Push a commit to trigger workflow
3. Wait for workflow to complete
4. Then add status checks to branch protection

---

## 📋 Setup Checklist

### Initial Setup

- [ ] Create `.github/workflows/tests.yml`
- [ ] Push workflow to main branch
- [ ] Verify workflow runs successfully
- [ ] Configure branch protection for `main`
- [ ] Configure branch protection for `develop`
- [ ] Add required status checks
- [ ] Test with a dummy PR
- [ ] Verify merge is blocked when tests fail
- [ ] Verify merge is allowed when tests pass
- [ ] Configure failure notifications
- [ ] Document rules for team

### Ongoing Maintenance

- [ ] Review protection rules quarterly
- [ ] Update status checks when adding new jobs
- [ ] Monitor test success rate
- [ ] Improve flaky tests
- [ ] Keep documentation updated

---

## 🎯 Success Criteria

**You'll know branch protection is working when:**

✅ **No broken code in main**

- Last 30 days: 0 incidents

✅ **Fast feedback loop**

- Tests run in <5 minutes
- Failures caught before merge

✅ **High confidence deployments**

- Can deploy main at any time
- No "hope it works" moments

✅ **Team compliance**

- 100% of changes via PR
- 0 force pushes to main

---

## 📚 Additional Resources

### GitHub Documentation

- [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)
- [Managing a branch protection rule](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/managing-a-branch-protection-rule)

### Best Practices

- [Trunk-based development](https://trunkbaseddevelopment.com/)
- [Git workflow strategies](https://www.atlassian.com/git/tutorials/comparing-workflows)

---

## 🎉 Summary

Branch protection + automated testing = **production safety net**

**What we've achieved:**

- ❌ Broken code cannot reach main
- ✅ All code is tested before merge
- ✅ Build failures caught immediately
- ✅ Team can deploy confidently

**Remember:** These rules exist to help you ship faster with confidence!

---

**Last Updated:** 2025-11-24
**Version:** 1.0.0
**Phase:** 3.5.7
**Status:** ✅ Complete
