Please implement the Mobile UI development for DavinTrade Trading Alerts SaaS strictly following the architectural blueprint in:
📁 `D:\SaaS Project\trading-alerts-saas-public\docs\MOBILE_UI_SPECIFICATION.md`

### 🎯 Key Instructions & Codebase Context:

1. Target Codebase to Modify:
   `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment`
2. Mobile Reference Seed (for layout, touch gestures, bottom nav, and drawers):
   `D:\SaaS Project\trading-alerts-saas-public\seed-code\lovable-mobile-app`
3. Shared Backend Connection:
   `D:\SaaS Project\trading-alerts-saas-public`

### 📋 Scope & Rules:

- Implement mobile-responsive views across all 5 external roles (Non-Login, Free, Pro, Affiliate+Free, Affiliate+Pro).
- Strictly EXCLUDE all Admin role pages (`/admin/*`) and peripheral pages (`/about`, `/blog`, `/careers`, `/changelog`, `/docs`, `/test-api`).
- Adapt the 4-panel `/terminal` into a mobile chart view with a sliding Conversational AI chat drawer (`vaul`).
- Integrate mobile touch primitives (`BottomNavigation`, `SwipeableItem`, `usePullToRefresh`, safe-area insets, `100dvh`).
- Set up Capacitor configuration for Android `.apk` distribution and Firebase Cloud Messaging (FCM) high-priority push notifications with custom alert chime.

Please read `docs/MOBILE_UI_SPECIFICATION.md` and start executing Phase 1 of the implementation roadmap.
