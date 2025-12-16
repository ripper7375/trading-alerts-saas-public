# V5 Part N: Admin Dashboard - Implementation Guide

**For:** Trading Alerts SaaS V7
**Part:** 14 - Admin
**Total Files:** 9 files
**Complexity:** Medium
**Last Updated:** 2025-11-21

---

## Overview

Admin dashboard for system monitoring, user management, analytics, and system health tracking with focus on tier-based metrics.

### Key Features

- User management (list, search, filter by tier)
- Analytics (tier distribution, revenue, conversion rates)
- API usage monitoring (per tier)
- Error logs viewer
- System health dashboard

---

## Business Requirements

### 1. Access Control

**Admin Role:**

- Only users with `role: 'ADMIN'` in database can access admin routes
- Check role in middleware for all `/admin/*` routes
- Return 403 Forbidden if not admin

**Security:**

- Log all admin actions
- Track who accessed what and when
- Require re-authentication for sensitive operations

### 2. Dashboard Overview

**Key Metrics (Display at Top):**

- Total users (count)
- FREE tier users (count + percentage)
- PRO tier users (count + percentage)
- Monthly Recurring Revenue (MRR = PRO users × $29)
- Conversion rate (PRO / Total × 100%)
- New users this month
- Churned users this month

**Charts:**

- User growth over time (line chart, last 12 months)
- Tier distribution (pie chart)
- Revenue over time (bar chart, last 12 months)
- Conversion funnel

### 3. User Management

**User List:**

- Table with columns: Name, Email, Tier, Created Date, Last Login, Status
- Pagination: 50 users per page
- Search: By name or email
- Filter: By tier (ALL/FREE/PRO)
- Sort: By created date, name, tier

**User Actions:**

- View user details (click on row)
- Change user tier manually (admin override)
- Suspend/unsuspend user account
- Send email to user

**User Details Page:**

- Full profile information
- Subscription history
- Alert count and list
- API usage stats
- Recent activity log

### 4. Analytics Page

**Metrics to Display:**

**Tier Distribution:**

- FREE: {count} users ({percentage}%)
- PRO: {count} users ({percentage}%)

**Revenue Metrics:**

- Current MRR: ${PRO_count} × $29
- Annual Run Rate (ARR): MRR × 12
- Average Revenue Per User (ARPU): MRR / Total_users
- Lifetime Value (LTV) estimate

**Conversion Metrics:**

- FREE → PRO conversion rate
- Average time to convert (days)
- Churn rate (PRO → FREE)
- Net revenue retention

**Engagement Metrics:**

- Average alerts per user (by tier)
- Average watchlist size (by tier)
- Daily/weekly/monthly active users
- Feature adoption rates

### 5. API Usage Monitoring

**Track by Tier:**

- API calls per tier (FREE vs PRO)
- Average response time per tier
- Error rate per tier
- Most used endpoints

**Display:**

- Table: Endpoint, Calls (FREE), Calls (PRO), Avg Response Time, Error Rate
- Chart: API usage over time (split by tier)
- Alerts: If any endpoint has >5% error rate

### 6. Error Logs

**Display:**

- Table: Timestamp, Error Type, Message, User ID, Tier, Stack Trace
- Filter: By error type, tier, date range
- Export: Download logs as CSV
- Auto-refresh: Every 30 seconds

**Error Types:**

- API Errors (4xx, 5xx)
- Database Errors
- Authentication Errors
- Payment Errors
- MT5 Service Errors

---

## UI/UX Requirements

### Admin Layout

**Sidebar:**

- Dashboard (home)
- Users
- Analytics
- API Usage
- Error Logs
- Back to App (return to main dashboard)

**Top Bar:**

- Admin badge indicator
- Current admin user info
- Logout

### Dashboard Page

**Layout:**

- 4 metric cards at top (Total Users, FREE, PRO, MRR)
- 2 charts (User Growth, Tier Distribution)
- Recent activity feed
- Quick actions (e.g., "View latest errors", "Export user data")

### Users Page

**Table Layout:**

- Search bar at top
- Filter dropdown (ALL/FREE/PRO)
- Table with sortable columns
- Pagination controls at bottom

**Row Actions:**

- View button
- Tier badge (clickable to change)
- Status indicator (green dot = active, red = suspended)

---

## API Endpoints

### GET /api/admin/users

- Query params: `page`, `search`, `tier`, `sortBy`
- Return: Paginated user list

### GET /api/admin/users/[id]

- Return: Full user details

### PATCH /api/admin/users/[id]

- Update user tier or status
- Body: `{ tier: 'PRO', status: 'active' }`

### GET /api/admin/analytics

- Return: All analytics metrics

### GET /api/admin/api-usage

- Query params: `startDate`, `endDate`
- Return: API usage stats by tier

### GET /api/admin/error-logs

- Query params: `page`, `type`, `tier`, `startDate`, `endDate`
- Return: Paginated error logs

---

## Security Considerations

**Admin Middleware:**

```typescript
// middleware/admin-auth.ts
export function requireAdmin(req, res, next) {
  const session = await getServerSession();

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (session.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  // Log admin action
  await logAdminAction({
    adminId: session.user.id,
    action: req.method + ' ' + req.url,
    timestamp: new Date(),
  });

  next();
}
```

**Audit Log:**

- Log all admin actions to database
- Include: admin ID, action, timestamp, IP address
- Retain logs for 1 year

---

## Testing Requirements

**Manual Tests:**

- [ ] Non-admin user cannot access admin routes
- [ ] Admin can view all users
- [ ] Search and filter work correctly
- [ ] User tier can be changed manually
- [ ] Analytics display correct metrics
- [ ] Error logs display and filter correctly

---

## Summary

Admin dashboard provides system oversight and tier-based analytics:

1. ✅ **User Management** - List, search, modify users
2. ✅ **Tier Analytics** - FREE/PRO distribution and metrics
3. ✅ **Revenue Tracking** - MRR, ARR, conversion rates
4. ✅ **API Monitoring** - Usage by tier
5. ✅ **Error Tracking** - Real-time error logs

**Priority:** Low for MVP - Can build post-launch.

---

**Reference:** This guide works with `docs/build-orders/part-14-admin.md` for file-by-file build instructions.
