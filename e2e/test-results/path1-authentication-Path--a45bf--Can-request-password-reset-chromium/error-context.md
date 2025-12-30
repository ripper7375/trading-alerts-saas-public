# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - heading "Trading Alerts" [level=1] [ref=e5]
      - paragraph [ref=e6]: Welcome to our secure trading platform
    - generic [ref=e8]:
      - generic [ref=e9]:
        - img [ref=e11]
        - heading "Check Your Email" [level=1] [ref=e14]
        - paragraph [ref=e15]: "We've sent password reset instructions to:"
        - paragraph [ref=e17]: free-test@trading-alerts.test
      - generic [ref=e18]:
        - heading "Next Steps:" [level=2] [ref=e19]
        - list [ref=e20]:
          - listitem [ref=e21]: Open the email from Trading Alerts
          - listitem [ref=e22]: Click the 'Reset Password' button
          - listitem [ref=e23]: Create your new password
      - generic [ref=e24]:
        - paragraph [ref=e25]: Didn't receive the email?
        - generic [ref=e26]:
          - button "Resend Email" [ref=e27] [cursor=pointer]
          - button "Try Another Email" [ref=e28] [cursor=pointer]
        - paragraph [ref=e29]: Check your spam folder
      - link "← Back to login" [ref=e30] [cursor=pointer]:
        - /url: /login
  - button "Open Next.js Dev Tools" [ref=e36] [cursor=pointer]:
    - img [ref=e37]
  - alert [ref=e40]
```