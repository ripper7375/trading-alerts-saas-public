Based on D:\SaaS Project\trading-alerts-saas-public\docs\files-completion-list\ui-pages-replication.xlsx

There are 2 frontend UI codebases. One is Codebase 1 (column E to K) another is Codebase 2 (column L to R)

Codebase 1 is old frontend UI design development and also full-fledged build for both frontend UI and backend stacks

Codebase 2 is new frontend design development but partial build for frontend UI and have no backend stacks

NL1Codebase 1 (cell G2) to AD95Codebase 1 (cell K96) represent all pages of codebase 1 that could be accessible by different types of login (Non-Login, Free user account login, Pro user account login, Unified Affilite+Free user login, Unified Affiliate+Pro user login, Admin+Pro login)

NL1Codebase 2 (cell N2) to AD95Codebase 2 (cell R96) represent all pages of codebase 2 that could be accessible by different types of login (Non-Login, Free user account login, Pro user account login, Unified Affilite+Free user login, Unified Affiliate+Pro user login, Admin+Pro login)

I want you to thoroughly study UI Components & Layouts, Pages & Routes, Real Backend Connection, and all operational logic of frontend UI of codebase 1 ---> This is called condition A

I want you to thoroughly study Design System & Theme and Media Assets (logos, AI mascot icons, preview banners, DavinTrade Brand) of codebase 2 ---> This is called condition B

Note : codebase 1 uses "Trading Alerts" as product brand while codebase 2 uses "DavinTrade" as product brand

I want you to build ALL pages for codebase 2 in compliance of both condition A and B. (So, codebase 2 would have all pages from NL1Codebase 2 (cell N2) to AD95Codebase 2 (cell R96) that are under both condition A and B

Except : Both condition A and B are not applied to the 6 pages below in codebase 2 [These 6 pages must not be modified in completion of pages for codebase 2]

https://trading-conversational-ai-ui-pages.vercel.app/
https://trading-conversational-ai-ui-pages.vercel.app/terminal
https://trading-conversational-ai-ui-pages.vercel.app/free
https://trading-conversational-ai-ui-pages.vercel.app/dashboard
https://trading-conversational-ai-ui-pages.vercel.app/settings/appearance
https://trading-conversational-ai-ui-pages.vercel.app/settings/help

These 3 pages below are retired in codebase 2

Trading Chart Workspace (XAUUSD M5)
Trading Chart Workspace (XAUUSD M15)
Charts Workspace Overview

These 2 pages below are newly added to codebase 2 (in replace of the 3 pages retired)

https://trading-conversational-ai-ui-pages.vercel.app/terminal
https://trading-conversational-ai-ui-pages.vercel.app/free

All frontend UI engine and working logic in codebase 2 e.g. appearance settings, web chat must be included in building of all pages of codebase 2

ALL URLs (routes) of codebase 2 must be exactly the same as codebase 1 for all types of user login (If there was inconsistent in URL between codebase 1 and codebase 2 ---> you are required to align URLs of codebase 2 with URLs of codebase 1. [This is because I will replace frontend UI of codebase 1 with frontend UI of codebase 2 which would allow frontend UI of codebase 2 to directly connect with backend stacks of codebase 1]

Ensure page layout and components in Pre-existing Pages in codebase 2 (/login, /register, /settings/\*, /admin/users, /alerts, etc.) (25 pages in total) are same as their counterparts in codebase 1

You are allowed to modify code inside D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment (codebase 2) only [code outside D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment strictly prohibit to modify!!!]

Please use your installed Frontend & UI Design Skills + Next.js and React Skills for implementation in building ALL pages for codebase 2 as per all instructions described above.
