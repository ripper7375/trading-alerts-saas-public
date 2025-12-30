# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - heading "Trading Alerts" [level=1] [ref=e5]
      - paragraph [ref=e6]: Welcome to our secure trading platform
    - generic [ref=e7]:
      - generic [ref=e8]:
        - heading "Set new password" [level=2] [ref=e9]
        - paragraph [ref=e10]: Please enter your new password below.
      - generic [ref=e11]:
        - generic [ref=e12]:
          - generic [ref=e13]:
            - generic [ref=e14]: New Password
            - generic [ref=e15]:
              - textbox "New Password" [ref=e16]
              - button [ref=e17] [cursor=pointer]:
                - img [ref=e18]
          - generic [ref=e21]:
            - generic [ref=e22]: Confirm Password
            - textbox "Confirm Password" [ref=e23]:
              - /placeholder: Confirm New Password
        - button "Reset Password" [ref=e25] [cursor=pointer]
  - button "Open Next.js Dev Tools" [ref=e31] [cursor=pointer]:
    - img [ref=e32]
  - alert [ref=e35]
```