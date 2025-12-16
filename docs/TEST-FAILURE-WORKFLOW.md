# Test Failure Handling Workflow

**Purpose:** Quick reference for handling test failures in CI/CD
**Last Updated:** 2025-11-24
**For:** Trading Alerts SaaS V7

---

## ⚡ Quick Commands

### View Failed Test Run

```bash
# View latest run
gh run view --log-failed

# View specific run
gh run view <run-id> --log-failed

# Watch current run
gh run watch
```

### Download Test Artifacts

```bash
# Download test results and coverage
gh run download <run-id>

# List available artifacts
gh run view <run-id>
```

### Re-run Failed Tests

```bash
# Re-run failed jobs only
gh run rerun <run-id> --failed

# Re-run entire workflow
gh run rerun <run-id>
```

---

## 🔴 When You Get a Failure Notification

### Step 1: Identify the Failure

**Email/Notification will contain:**

- ❌ Which job failed (Unit Tests, Integration Tests, Build)
- 📄 Branch and commit
- 🔗 Link to GitHub Actions run

**Click the link or run:**

```bash
gh run view --log-failed
```

### Step 2: Read the Error Message

**Look for:**

```
FAIL __tests__/lib/tier-validation.test.ts
  ● validateTierAccess › should allow FREE tier to access XAUUSD

    expect(received).toBe(expected)

    Expected: true
    Received: false

      at Object.<anonymous> (__tests__/lib/tier-validation.test.ts:12:32)
```

**Key information:**

- 📁 File: `__tests__/lib/tier-validation.test.ts`
- 🧪 Test: `validateTierAccess › should allow FREE tier to access XAUUSD`
- 📍 Line: `12:32`
- ❌ Expected: `true`
- ❌ Received: `false`

---

## 🛠️ Aider Prompt Template

Copy this template and fill in the details:

```
GitHub Actions test failed.

Test: [test name from error]
File: [file:line from error]
Error: [error message]
Expected: [expected value]
Received: [received value]

Please fix this test failure. The issue is in [describe the likely cause].
```

**Example:**

```
GitHub Actions test failed.

Test: validateTierAccess › should allow FREE tier to access XAUUSD
File: __tests__/lib/tier-validation.test.ts:12
Error: Expected true but received false
Expected: true
Received: false

Please fix this test failure. The tier validation logic seems to be rejecting FREE users from XAUUSD.
```

---

## ✅ Local Verification Checklist

**Before pushing a fix, run locally:**

```bash
# 1. Run the specific failing test
npm test -- __tests__/lib/tier-validation.test.ts

# 2. Run all tests
npm test

# 3. Check coverage
npm run test:coverage

# 4. TypeScript check
npm run type-check

# 5. Lint check
npm run lint

# 6. Build check
npm run build
```

**All must pass ✅ before pushing!**

---

## 🚫 Never Do These Things

### ❌ Don't Push Without Local Verification

```bash
# Bad:
git add .
git commit -m "fix: hopefully fixes the test"
git push
```

```bash
# Good:
npm test  # ✅ All tests pass
git add .
git commit -m "fix: correct tier validation logic for FREE users"
git push
```

### ❌ Don't Skip Running Tests Locally

```bash
# Bad:
git commit -m "fix" --no-verify
```

### ❌ Don't Ignore Warning Signs

```
⚠️ Warning: Coverage decreased from 85% to 45%
```

This means you didn't write tests for new code!

### ❌ Don't Commit Broken Code "Temporarily"

```bash
# Bad:
git commit -m "WIP: broken code, will fix later"
```

---

## ✅ Always Do These Things

### ✅ Read the Full Error Message

Don't just skim! The error message contains:

- Exact file and line number
- Expected vs. received values
- Stack trace showing the call path

### ✅ Copy Exact Error Text to Aider

Aider works best with exact error messages:

```
TypeError: Cannot read property 'tier' of undefined
  at validateTierAccess (lib/tier-validation.ts:15:23)
```

### ✅ Verify Fix Locally Before Pushing

```bash
# Run the specific test that failed
npm test -- __tests__/lib/tier-validation.test.ts

# ✅ Should see: Tests: 1 passed, 1 total
```

### ✅ Monitor GitHub Actions After Push

```bash
# Watch the test run
gh run watch
```

Don't just push and forget!

---

## 📊 Common Failure Scenarios

### Scenario 1: Type Error

**Error:**

```
error TS2304: Cannot find name 'User'
```

**Fix:**

```bash
# Generate Prisma types
npm run db:generate

# Re-run tests
npm test
```

### Scenario 2: Import Error

**Error:**

```
Cannot find module '@/lib/utils'
```

**Fix:**
Check `jest.config.js` has correct module mapping:

```javascript
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/$1',
}
```

### Scenario 3: Test Timeout

**Error:**

```
Timeout - Async callback was not invoked within the 5000 ms timeout
```

**Fix:**
Increase timeout or fix async test:

```typescript
// Option 1: Increase timeout
jest.setTimeout(10000);

// Option 2: Use proper async/await
it('should wait for promise', async () => {
  await expect(asyncFunction()).resolves.toBe('value');
});
```

### Scenario 4: Coverage Threshold Not Met

**Error:**

```
Jest: "global" coverage threshold for branches (60%) not met: 45%
```

**Fix:**
Write more tests to cover branches:

```typescript
// Test both branches
it('should handle true condition', () => {
  expect(fn(true)).toBe('yes');
});

it('should handle false condition', () => {
  expect(fn(false)).toBe('no');
});
```

### Scenario 5: Build Failure

**Error:**

```
Error: Build failed with 3 type errors
```

**Fix:**

```bash
# Check TypeScript errors
npm run type-check

# Fix errors, then rebuild
npm run build
```

---

## 🔄 Workflow: From Failure to Fix

```
1. ❌ Test fails in GitHub Actions
         ↓
2. 📧 You receive notification
         ↓
3. 🔍 Run: gh run view --log-failed
         ↓
4. 📋 Copy error details
         ↓
5. 🤖 Give to Aider with template
         ↓
6. ✅ Aider fixes the code
         ↓
7. 🧪 Run tests locally
         ↓
8. ✅ All tests pass locally
         ↓
9. 📤 Commit and push
         ↓
10. 👀 Monitor: gh run watch
         ↓
11. ✅ Tests pass in CI
         ↓
12. 🎉 Done!
```

---

## 🎯 Success Metrics

### Good Testing Hygiene

- ✅ **<5 minutes** from failure to understanding issue
- ✅ **<15 minutes** from failure to fix
- ✅ **0 failures** pushed without local testing
- ✅ **100%** of failures have root cause identified

### Red Flags

- 🚩 Multiple commits with "fix tests"
- 🚩 Pushing without running tests locally
- 🚩 Tests that "sometimes fail"
- 🚩 Coverage dropping below 60%

---

## 📱 Notification Setup

### GitHub Email Notifications

1. Go to GitHub Settings
2. Navigate to Notifications
3. Enable "Actions" notifications
4. Choose "Send notifications for failed workflows only"

### GitHub Mobile App

1. Install GitHub mobile app
2. Enable push notifications
3. Get instant alerts when tests fail

### Slack/Discord (Optional)

Add webhook to `.github/workflows/tests.yml`:

```yaml
- name: Notify Slack on Failure
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "Tests failed in ${{ github.repository }}"
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 🎓 Learning from Failures

### Keep a Failure Log

When a test fails, document:

- What failed
- Why it failed
- How it was fixed
- How to prevent it

### Common Patterns

After a few failures, you'll notice patterns:

- Certain tests fail after certain changes
- Specific files are error-prone
- Timing issues in async tests

Use this knowledge to:

- Write better tests upfront
- Add more assertions
- Improve error messages

---

## 🆘 Getting Help

### Stuck on a Failure?

1. **Check the logs** - 90% of issues are in the error message
2. **Search the error** - Someone else probably had this issue
3. **Check docs** - Jest, RTL, and Postman docs are excellent
4. **Ask Aider** - Give it the full error message

### Resources

- [Jest Troubleshooting](https://jestjs.io/docs/troubleshooting)
- [Testing Library Common Mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [GitHub Actions Debugging](https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows/enabling-debug-logging)

---

## ✅ Final Checklist

Before considering a test failure "resolved":

- [ ] Understand why the test failed
- [ ] Fix passes all tests locally
- [ ] Coverage hasn't decreased
- [ ] TypeScript compiles
- [ ] ESLint passes
- [ ] Build succeeds
- [ ] GitHub Actions passes
- [ ] No "TODO" comments left in code

---

## 🎉 Summary

**When tests fail:**

1. Don't panic
2. Read the error message carefully
3. Use the Aider template
4. Test locally before pushing
5. Monitor the fix in CI

**Remember:** Test failures are good! They catch bugs before production. 🐛

---

**Last Updated:** 2025-11-24
**Version:** 1.0.0
**Status:** ✅ Complete
