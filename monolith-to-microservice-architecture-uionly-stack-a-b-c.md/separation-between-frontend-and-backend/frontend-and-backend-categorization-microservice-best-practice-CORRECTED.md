# Frontend and Backend Categorization - CORRECTED Version

## Change Summary

| Change Type | Count | Description |
|-------------|-------|-------------|
| BACKEND → FRONTEND | 22 | `__tests__/api/**/*.test.ts` (API route tests follow their FRONTEND endpoints) |
| TEST → BACKEND | 46 | `__tests__/lib/**/*.test.ts` (per methodology: lib tests → BACKEND) |
| TEST → FRONTEND | 2 | `__tests__/hooks/**/*.test.ts` (hooks are FRONTEND) |
| BACKEND → FRONTEND | 1 | `lib/websocket/use-mt5-websocket.ts` (React hook) |
| FRONTEND → BACKEND | 4 | `emails/*.tsx` (server-side email rendering) |
| FRONTEND → BACKEND | 5 | `lib/email/templates/affiliate/*.tsx` (server-side templates) |
| (none) → SHARING | 1 | `scripts/verify-auth-config.js` |

**Total changes: 81 files**

---

## Corrected Categorization Table (Pipe-Delimited for Excel)

```
NO.|PATH & FILENAME|ORIGINAL|CORRECTED|CHANGED
1|__tests__/api/admin.test.ts|BACKEND|FRONTEND|YES
2|__tests__/api/admin-affiliates.test.ts|BACKEND|FRONTEND|YES
3|__tests__/api/admin-reports.test.ts|BACKEND|FRONTEND|YES
4|__tests__/api/affiliate-conversion.test.ts|BACKEND|FRONTEND|YES
5|__tests__/api/affiliate-dashboard.test.ts|BACKEND|FRONTEND|YES
6|__tests__/api/affiliate-registration.test.ts|BACKEND|FRONTEND|YES
7|__tests__/api/alerts.test.ts|BACKEND|FRONTEND|YES
8|__tests__/api/cron/process-pending.test.ts|BACKEND|FRONTEND|YES
9|__tests__/api/cron-jobs.test.ts|BACKEND|FRONTEND|YES
10|__tests__/api/disbursement/affiliates.test.ts|BACKEND|FRONTEND|YES
11|__tests__/api/disbursement/audit.test.ts|BACKEND|FRONTEND|YES
12|__tests__/api/disbursement/batches.test.ts|BACKEND|FRONTEND|YES
13|__tests__/api/disbursement/execute.test.ts|BACKEND|FRONTEND|YES
14|__tests__/api/disbursement/health.test.ts|BACKEND|FRONTEND|YES
15|__tests__/api/disbursement/pay.test.ts|BACKEND|FRONTEND|YES
16|__tests__/api/disbursement/reports.test.ts|BACKEND|FRONTEND|YES
17|__tests__/api/notifications.test.ts|BACKEND|FRONTEND|YES
18|__tests__/api/tier.test.ts|BACKEND|FRONTEND|YES
19|__tests__/api/user.test.ts|BACKEND|FRONTEND|YES
20|__tests__/api/watchlist.test.ts|BACKEND|FRONTEND|YES
21|__tests__/api/webhooks/dlocal/route.test.ts|BACKEND|FRONTEND|YES
22|__tests__/api/webhooks/riseworks.test.ts|BACKEND|FRONTEND|YES
23|__tests__/components/admin/affiliate-filters.test.tsx|FRONTEND|FRONTEND|NO
24|__tests__/components/admin/affiliate-stats-banner.test.tsx|FRONTEND|FRONTEND|NO
25|__tests__/components/admin/code-inventory-chart.test.tsx|FRONTEND|FRONTEND|NO
26|__tests__/components/admin/fraud-alert-card.test.tsx|FRONTEND|FRONTEND|NO
27|__tests__/components/admin/fraud-pattern-badge.test.tsx|FRONTEND|FRONTEND|NO
28|__tests__/components/admin/pnl-breakdown-table.test.tsx|FRONTEND|FRONTEND|NO
29|__tests__/components/admin/pnl-summary-cards.test.tsx|FRONTEND|FRONTEND|NO
30|__tests__/components/admin/sales-performance-table.test.tsx|FRONTEND|FRONTEND|NO
31|__tests__/components/affiliate/code-table.test.tsx|FRONTEND|FRONTEND|NO
32|__tests__/components/affiliate/commission-table.test.tsx|FRONTEND|FRONTEND|NO
33|__tests__/components/affiliate/stats-card.test.tsx|FRONTEND|FRONTEND|NO
34|__tests__/components/charts/indicator-toggles.test.tsx|FRONTEND|FRONTEND|NO
35|__tests__/components/charts/pro-indicator-overlay.test.tsx|FRONTEND|FRONTEND|NO
36|__tests__/components/charts/trading-chart.test.tsx|FRONTEND|FRONTEND|NO
37|__tests__/components/dashboard/recent-alerts.test.tsx|FRONTEND|FRONTEND|NO
38|__tests__/components/dashboard/stats-card.test.tsx|FRONTEND|FRONTEND|NO
39|__tests__/components/dashboard/watchlist-widget.test.tsx|FRONTEND|FRONTEND|NO
40|__tests__/components/layout/header.test.tsx|FRONTEND|FRONTEND|NO
41|__tests__/components/payments/PlanSelector.test.tsx|FRONTEND|FRONTEND|NO
42|__tests__/components/payments/PriceDisplay.test.tsx|FRONTEND|FRONTEND|NO
43|__tests__/components/ui/button.test.tsx|FRONTEND|FRONTEND|NO
44|__tests__/components/ui/card.test.tsx|FRONTEND|FRONTEND|NO
45|__tests__/e2e/dlocal-payment-flow.test.ts|TEST|TEST|NO
46|__tests__/example.test.ts|TEST|TEST|NO
47|__tests__/helpers/supertest-setup.ts|TEST|TEST|NO
48|__tests__/hooks/use-toast.test.ts|TEST|FRONTEND|YES
49|__tests__/hooks/use-websocket.test.ts|TEST|FRONTEND|YES
50|__tests__/integration/api-client-workflow.test.ts|TEST|TEST|NO
51|__tests__/integration/auth-email-flow.test.ts|TEST|TEST|NO
52|__tests__/integration/payment-creation.test.ts|TEST|TEST|NO
53|__tests__/integration/tier1-workflows.test.ts|TEST|TEST|NO
54|__tests__/integration/tier2-workflows.test.ts|TEST|TEST|NO
55|__tests__/integration/user-registration-flow.test.ts|TEST|TEST|NO
56|__tests__/integration/watchlist-management-flow.test.ts|TEST|TEST|NO
57|__tests__/lib/admin/affiliate-management.test.ts|TEST|BACKEND|YES
58|__tests__/lib/admin/code-distribution.test.ts|TEST|BACKEND|YES
59|__tests__/lib/admin/pnl-calculator.test.ts|TEST|BACKEND|YES
60|__tests__/lib/affiliate/code-generator.test.ts|TEST|BACKEND|YES
61|__tests__/lib/affiliate/commission-calculator.test.ts|TEST|BACKEND|YES
62|__tests__/lib/affiliate/registration.test.ts|TEST|BACKEND|YES
63|__tests__/lib/api/stack-a-client.test.ts|BACKEND|BACKEND|NO
64|__tests__/lib/api/stack-b-client.test.ts|BACKEND|BACKEND|NO
65|__tests__/lib/auth/errors.test.ts|TEST|BACKEND|YES
66|__tests__/lib/auth/permissions.test.ts|TEST|BACKEND|YES
67|__tests__/lib/auth/session.test.ts|TEST|BACKEND|YES
68|__tests__/lib/cron/check-expiring-subscriptions.test.ts|TEST|BACKEND|YES
69|__tests__/lib/cron/downgrade-expired-subscriptions.test.ts|TEST|BACKEND|YES
70|__tests__/lib/cron/monthly-distribution.test.ts|TEST|BACKEND|YES
71|__tests__/lib/db/prisma.test.ts|TEST|BACKEND|YES
72|__tests__/lib/db/seed.test.ts|TEST|BACKEND|YES
73|__tests__/lib/disbursement/constants.test.ts|TEST|BACKEND|YES
74|__tests__/lib/disbursement/providers/factory.test.ts|TEST|BACKEND|YES
75|__tests__/lib/disbursement/providers/mock.test.ts|TEST|BACKEND|YES
76|__tests__/lib/disbursement/providers/rise/webhook.test.ts|TEST|BACKEND|YES
77|__tests__/lib/disbursement/services/aggregator.test.ts|TEST|BACKEND|YES
78|__tests__/lib/disbursement/services/batch.test.ts|TEST|BACKEND|YES
79|__tests__/lib/disbursement/services/orchestrator.test.ts|TEST|BACKEND|YES
80|__tests__/lib/dlocal/constants.test.ts|TEST|BACKEND|YES
81|__tests__/lib/dlocal/currency-converter.test.ts|TEST|BACKEND|YES
82|__tests__/lib/dlocal/dlocal-payment.test.ts|TEST|BACKEND|YES
83|__tests__/lib/dlocal/payment-methods.test.ts|TEST|BACKEND|YES
84|__tests__/lib/dlocal/three-day-validator.test.ts|TEST|BACKEND|YES
85|__tests__/lib/email/email.test.ts|TEST|BACKEND|YES
86|__tests__/lib/errors/api-error.test.ts|TEST|BACKEND|YES
87|__tests__/lib/errors/error-handler.test.ts|TEST|BACKEND|YES
88|__tests__/lib/geo/detect-country.test.ts|TEST|BACKEND|YES
89|__tests__/lib/jobs/alert-checker.test.ts|TEST|BACKEND|YES
90|__tests__/lib/rate-limit.test.ts|TEST|BACKEND|YES
91|__tests__/lib/stripe/stripe.test.ts|TEST|BACKEND|YES
92|__tests__/lib/stripe/webhook-handlers.test.ts|TEST|BACKEND|YES
93|__tests__/lib/tier-config.test.ts|TEST|BACKEND|YES
94|__tests__/lib/tier-helpers.test.ts|TEST|BACKEND|YES
95|__tests__/lib/tier-validation.test.ts|TEST|BACKEND|YES
96|__tests__/lib/tokens.test.ts|TEST|BACKEND|YES
97|__tests__/lib/utils.test.ts|TEST|BACKEND|YES
98|__tests__/lib/utils/constants.test.ts|TEST|BACKEND|YES
99|__tests__/lib/utils/formatters.test.ts|TEST|BACKEND|YES
100|__tests__/lib/utils/helpers.test.ts|TEST|BACKEND|YES
101|__tests__/lib/validations/alert.test.ts|TEST|BACKEND|YES
102|__tests__/lib/validations/auth.test.ts|TEST|BACKEND|YES
103|__tests__/setup.ts|TEST|TEST|NO
104|__tests__/types/disbursement.test.ts|TEST|TEST|NO
105|__tests__/types/dlocal.test.ts|TEST|TEST|NO
106|__tests__/types/types.test.ts|TEST|TEST|NO
107|app/(auth)/forgot-password/page.tsx|FRONTEND|FRONTEND|NO
108|app/(auth)/layout.tsx|FRONTEND|FRONTEND|NO
109|app/(auth)/loading.tsx|FRONTEND|FRONTEND|NO
110|app/(auth)/login/page.tsx|FRONTEND|FRONTEND|NO
111|app/(auth)/register/page.tsx|FRONTEND|FRONTEND|NO
112|app/(auth)/reset-password/page.tsx|FRONTEND|FRONTEND|NO
113|app/(auth)/verify-2fa/page.tsx|FRONTEND|FRONTEND|NO
114|app/(auth)/verify-email/page.tsx|FRONTEND|FRONTEND|NO
115|app/(auth)/verify-email/pending/page.tsx|FRONTEND|FRONTEND|NO
116|app/(dashboard)/admin/api-usage/page.tsx|FRONTEND|FRONTEND|NO
117|app/(dashboard)/admin/disbursement/accounts/page.tsx|FRONTEND|FRONTEND|NO
118|app/(dashboard)/admin/disbursement/affiliates/page.tsx|FRONTEND|FRONTEND|NO
119|app/(dashboard)/admin/disbursement/audit/page.tsx|FRONTEND|FRONTEND|NO
120|app/(dashboard)/admin/disbursement/batches/[batchId]/page.tsx|FRONTEND|FRONTEND|NO
121|app/(dashboard)/admin/disbursement/batches/page.tsx|FRONTEND|FRONTEND|NO
122|app/(dashboard)/admin/disbursement/config/page.tsx|FRONTEND|FRONTEND|NO
123|app/(dashboard)/admin/disbursement/layout.tsx|FRONTEND|FRONTEND|NO
124|app/(dashboard)/admin/disbursement/page.tsx|FRONTEND|FRONTEND|NO
125|app/(dashboard)/admin/disbursement/transactions/page.tsx|FRONTEND|FRONTEND|NO
126|app/(dashboard)/admin/errors/page.tsx|FRONTEND|FRONTEND|NO
127|app/(dashboard)/admin/fraud-alerts/[id]/page.tsx|FRONTEND|FRONTEND|NO
128|app/(dashboard)/admin/fraud-alerts/page.tsx|FRONTEND|FRONTEND|NO
129|app/(dashboard)/admin/layout.tsx|FRONTEND|FRONTEND|NO
130|app/(dashboard)/admin/loading.tsx|FRONTEND|FRONTEND|NO
131|app/(dashboard)/admin/page.tsx|FRONTEND|FRONTEND|NO
132|app/(dashboard)/admin/users/page.tsx|FRONTEND|FRONTEND|NO
133|app/(dashboard)/alerts/alerts-client.tsx|FRONTEND|FRONTEND|NO
134|app/(dashboard)/alerts/loading.tsx|FRONTEND|FRONTEND|NO
135|app/(dashboard)/alerts/new/create-alert-client.tsx|FRONTEND|FRONTEND|NO
136|app/(dashboard)/alerts/new/page.tsx|FRONTEND|FRONTEND|NO
137|app/(dashboard)/alerts/page.tsx|FRONTEND|FRONTEND|NO
138|app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx|FRONTEND|FRONTEND|NO
139|app/(dashboard)/charts/[symbol]/[timeframe]/trading-chart-client.tsx|FRONTEND|FRONTEND|NO
140|app/(dashboard)/charts/loading.tsx|FRONTEND|FRONTEND|NO
141|app/(dashboard)/charts/page.tsx|FRONTEND|FRONTEND|NO
142|app/(dashboard)/dashboard/loading.tsx|FRONTEND|FRONTEND|NO
143|app/(dashboard)/dashboard/page.tsx|FRONTEND|FRONTEND|NO
144|app/(dashboard)/layout.tsx|FRONTEND|FRONTEND|NO
145|app/(dashboard)/settings/account/page.tsx|FRONTEND|FRONTEND|NO
146|app/(dashboard)/settings/appearance/page.tsx|FRONTEND|FRONTEND|NO
147|app/(dashboard)/settings/billing/page.tsx|FRONTEND|FRONTEND|NO
148|app/(dashboard)/settings/help/page.tsx|FRONTEND|FRONTEND|NO
149|app/(dashboard)/settings/language/page.tsx|FRONTEND|FRONTEND|NO
150|app/(dashboard)/settings/layout.tsx|FRONTEND|FRONTEND|NO
151|app/(dashboard)/settings/loading.tsx|FRONTEND|FRONTEND|NO
152|app/(dashboard)/settings/page.tsx|FRONTEND|FRONTEND|NO
153|app/(dashboard)/settings/privacy/page.tsx|FRONTEND|FRONTEND|NO
154|app/(dashboard)/settings/profile/page.tsx|FRONTEND|FRONTEND|NO
155|app/(dashboard)/settings/security/page.tsx|FRONTEND|FRONTEND|NO
156|app/(dashboard)/settings/terms/page.tsx|FRONTEND|FRONTEND|NO
157|app/(dashboard)/watchlist/page.tsx|FRONTEND|FRONTEND|NO
158|app/(dashboard)/watchlist/watchlist-client.tsx|FRONTEND|FRONTEND|NO
159|app/(marketing)/landing-content.tsx|FRONTEND|FRONTEND|NO
160|app/(marketing)/layout.tsx|FRONTEND|FRONTEND|NO
161|app/(marketing)/page.tsx|FRONTEND|FRONTEND|NO
162|app/(marketing)/pricing/page.tsx|FRONTEND|FRONTEND|NO
163|app/admin/affiliates/[id]/page.tsx|FRONTEND|FRONTEND|NO
164|app/admin/affiliates/page.tsx|FRONTEND|FRONTEND|NO
165|app/admin/affiliates/reports/code-inventory/page.tsx|FRONTEND|FRONTEND|NO
166|app/admin/affiliates/reports/commission-owings/page.tsx|FRONTEND|FRONTEND|NO
167|app/admin/affiliates/reports/profit-loss/page.tsx|FRONTEND|FRONTEND|NO
168|app/admin/affiliates/reports/sales-performance/page.tsx|FRONTEND|FRONTEND|NO
169|app/admin/login/page.tsx|FRONTEND|FRONTEND|NO
170|app/admin/settings/affiliate/page.tsx|FRONTEND|FRONTEND|NO
171|app/affiliate/dashboard/codes/page.tsx|FRONTEND|FRONTEND|NO
172|app/affiliate/dashboard/commissions/page.tsx|FRONTEND|FRONTEND|NO
173|app/affiliate/dashboard/layout.tsx|FRONTEND|FRONTEND|NO
174|app/affiliate/dashboard/page.tsx|FRONTEND|FRONTEND|NO
175|app/affiliate/dashboard/profile/page.tsx|FRONTEND|FRONTEND|NO
176|app/affiliate/dashboard/profile/payment/page.tsx|FRONTEND|FRONTEND|NO
177|app/affiliate/layout.tsx|FRONTEND|FRONTEND|NO
178|app/affiliate/register/layout.tsx|FRONTEND|FRONTEND|NO
179|app/affiliate/register/page.tsx|FRONTEND|FRONTEND|NO
180|app/affiliate/verify/layout.tsx|FRONTEND|FRONTEND|NO
181|app/affiliate/verify/page.tsx|FRONTEND|FRONTEND|NO
182|app/api/admin/affiliates/[id]/distribute-codes/route.ts|FRONTEND|FRONTEND|NO
183|app/api/admin/affiliates/[id]/reactivate/route.ts|FRONTEND|FRONTEND|NO
184|app/api/admin/affiliates/[id]/route.ts|FRONTEND|FRONTEND|NO
185|app/api/admin/affiliates/[id]/suspend/route.ts|FRONTEND|FRONTEND|NO
186|app/api/admin/affiliates/reports/code-inventory/route.ts|FRONTEND|FRONTEND|NO
187|app/api/admin/affiliates/reports/commission-owings/route.ts|FRONTEND|FRONTEND|NO
188|app/api/admin/affiliates/reports/profit-loss/route.ts|FRONTEND|FRONTEND|NO
189|app/api/admin/affiliates/reports/sales-performance/route.ts|FRONTEND|FRONTEND|NO
190|app/api/admin/affiliates/route.ts|FRONTEND|FRONTEND|NO
191|app/api/admin/analytics/route.ts|FRONTEND|FRONTEND|NO
192|app/api/admin/api-usage/route.ts|FRONTEND|FRONTEND|NO
193|app/api/admin/codes/[code]/cancel/route.ts|FRONTEND|FRONTEND|NO
194|app/api/admin/commissions/pay/route.ts|FRONTEND|FRONTEND|NO
195|app/api/admin/error-logs/route.ts|FRONTEND|FRONTEND|NO
196|app/api/admin/fraud-alerts/[id]/route.ts|FRONTEND|FRONTEND|NO
197|app/api/admin/fraud-alerts/route.ts|FRONTEND|FRONTEND|NO
198|app/api/admin/settings/affiliate/route.ts|FRONTEND|FRONTEND|NO
199|app/api/admin/users/route.ts|FRONTEND|FRONTEND|NO
200|app/api/affiliate/auth/register/route.ts|FRONTEND|FRONTEND|NO
201|app/api/affiliate/auth/verify-email/route.ts|FRONTEND|FRONTEND|NO
202|app/api/affiliate/dashboard/code-inventory/route.ts|FRONTEND|FRONTEND|NO
203|app/api/affiliate/dashboard/codes/route.ts|FRONTEND|FRONTEND|NO
204|app/api/affiliate/dashboard/commission-report/route.ts|FRONTEND|FRONTEND|NO
205|app/api/affiliate/dashboard/stats/route.ts|FRONTEND|FRONTEND|NO
206|app/api/affiliate/profile/payment/route.ts|FRONTEND|FRONTEND|NO
207|app/api/affiliate/profile/route.ts|FRONTEND|FRONTEND|NO
208|app/api/alerts/[id]/route.ts|FRONTEND|FRONTEND|NO
209|app/api/alerts/route.ts|FRONTEND|FRONTEND|NO
210|app/api/auth/[...nextauth]/route.ts|FRONTEND|FRONTEND|NO
211|app/api/auth/forgot-password/route.ts|FRONTEND|FRONTEND|NO
212|app/api/auth/register/route.ts|FRONTEND|FRONTEND|NO
213|app/api/auth/resend-verification/route.ts|FRONTEND|FRONTEND|NO
214|app/api/auth/reset-password/route.ts|FRONTEND|FRONTEND|NO
215|app/api/auth/track-login/route.ts|FRONTEND|FRONTEND|NO
216|app/api/auth/verify-email/route.ts|FRONTEND|FRONTEND|NO
217|app/api/candles/[symbol]/route.ts|FRONTEND|FRONTEND|NO
218|app/api/checkout/route.ts|FRONTEND|FRONTEND|NO
219|app/api/checkout/validate-code/route.ts|FRONTEND|FRONTEND|NO
220|app/api/config/affiliate/route.ts|FRONTEND|FRONTEND|NO
221|app/api/cron/check-expiring-subscriptions/route.ts|FRONTEND|FRONTEND|NO
222|app/api/cron/daily-maintenance/route.ts|FRONTEND|FRONTEND|NO
223|app/api/cron/distribute-codes/route.ts|FRONTEND|FRONTEND|NO
224|app/api/cron/downgrade-expired-subscriptions/route.ts|FRONTEND|FRONTEND|NO
225|app/api/cron/expire-codes/route.ts|FRONTEND|FRONTEND|NO
226|app/api/cron/process-pending-disbursements/route.ts|FRONTEND|FRONTEND|NO
227|app/api/cron/send-monthly-reports/route.ts|FRONTEND|FRONTEND|NO
228|app/api/cron/sync-riseworks-accounts/route.ts|FRONTEND|FRONTEND|NO
229|app/api/disbursement/affiliates/[affiliateId]/commissions/route.ts|FRONTEND|FRONTEND|NO
230|app/api/disbursement/affiliates/[affiliateId]/route.ts|FRONTEND|FRONTEND|NO
231|app/api/disbursement/affiliates/payable/route.ts|FRONTEND|FRONTEND|NO
232|app/api/disbursement/audit-logs/route.ts|FRONTEND|FRONTEND|NO
233|app/api/disbursement/batches/[batchId]/execute/route.ts|FRONTEND|FRONTEND|NO
234|app/api/disbursement/batches/[batchId]/route.ts|FRONTEND|FRONTEND|NO
235|app/api/disbursement/batches/preview/route.ts|FRONTEND|FRONTEND|NO
236|app/api/disbursement/batches/route.ts|FRONTEND|FRONTEND|NO
237|app/api/disbursement/config/route.ts|FRONTEND|FRONTEND|NO
238|app/api/disbursement/health/route.ts|FRONTEND|FRONTEND|NO
239|app/api/disbursement/pay/route.ts|FRONTEND|FRONTEND|NO
240|app/api/disbursement/reports/affiliate/[affiliateId]/route.ts|FRONTEND|FRONTEND|NO
241|app/api/disbursement/reports/summary/route.ts|FRONTEND|FRONTEND|NO
242|app/api/disbursement/riseworks/accounts/route.ts|FRONTEND|FRONTEND|NO
243|app/api/disbursement/riseworks/sync/route.ts|FRONTEND|FRONTEND|NO
244|app/api/disbursement/transactions/route.ts|FRONTEND|FRONTEND|NO
245|app/api/invoices/route.ts|FRONTEND|FRONTEND|NO
246|app/api/notifications/[id]/read/route.ts|FRONTEND|FRONTEND|NO
247|app/api/notifications/[id]/route.ts|FRONTEND|FRONTEND|NO
248|app/api/notifications/route.ts|FRONTEND|FRONTEND|NO
249|app/api/payments/dlocal/[paymentId]/route.ts|FRONTEND|FRONTEND|NO
250|app/api/payments/dlocal/check-three-day-eligibility/route.ts|FRONTEND|FRONTEND|NO
251|app/api/payments/dlocal/convert/route.ts|FRONTEND|FRONTEND|NO
252|app/api/payments/dlocal/create/route.ts|FRONTEND|FRONTEND|NO
253|app/api/payments/dlocal/exchange-rate/route.ts|FRONTEND|FRONTEND|NO
254|app/api/payments/dlocal/methods/route.ts|FRONTEND|FRONTEND|NO
255|app/api/payments/dlocal/validate-discount/route.ts|FRONTEND|FRONTEND|NO
256|app/api/subscription/cancel/route.ts|FRONTEND|FRONTEND|NO
257|app/api/subscription/route.ts|FRONTEND|FRONTEND|NO
258|app/api/test/seed/route.ts|FRONTEND|FRONTEND|NO
259|app/api/tier/check/[symbol]/route.ts|FRONTEND|FRONTEND|NO
260|app/api/tier/combinations/route.ts|FRONTEND|FRONTEND|NO
261|app/api/tier/symbols/route.ts|FRONTEND|FRONTEND|NO
262|app/api/user/2fa/backup-codes/route.ts|FRONTEND|FRONTEND|NO
263|app/api/user/2fa/disable/route.ts|FRONTEND|FRONTEND|NO
264|app/api/user/2fa/setup/route.ts|FRONTEND|FRONTEND|NO
265|app/api/user/2fa/verify/route.ts|FRONTEND|FRONTEND|NO
266|app/api/user/2fa/verify-setup/route.ts|FRONTEND|FRONTEND|NO
267|app/api/user/account/deletion-cancel/route.ts|FRONTEND|FRONTEND|NO
268|app/api/user/account/deletion-confirm/route.ts|FRONTEND|FRONTEND|NO
269|app/api/user/account/deletion-request/route.ts|FRONTEND|FRONTEND|NO
270|app/api/user/login-history/route.ts|FRONTEND|FRONTEND|NO
271|app/api/user/password/route.ts|FRONTEND|FRONTEND|NO
272|app/api/user/preferences/route.ts|FRONTEND|FRONTEND|NO
273|app/api/user/profile/route.ts|FRONTEND|FRONTEND|NO
274|app/api/user/sessions/[id]/route.ts|FRONTEND|FRONTEND|NO
275|app/api/user/sessions/route.ts|FRONTEND|FRONTEND|NO
276|app/api/watchlist/[id]/route.ts|FRONTEND|FRONTEND|NO
277|app/api/watchlist/reorder/route.ts|FRONTEND|FRONTEND|NO
278|app/api/watchlist/route.ts|FRONTEND|FRONTEND|NO
279|app/api/webhooks/dlocal/route.ts|FRONTEND|FRONTEND|NO
280|app/api/webhooks/riseworks/route.ts|FRONTEND|FRONTEND|NO
281|app/api/webhooks/stripe/route.ts|FRONTEND|FRONTEND|NO
282|app/api-test/page.tsx|FRONTEND|FRONTEND|NO
283|app/checkout/page.tsx|FRONTEND|FRONTEND|NO
284|app/error.tsx|FRONTEND|FRONTEND|NO
285|app/globals.css|FRONTEND|FRONTEND|NO
286|app/layout.tsx|FRONTEND|FRONTEND|NO
287|app/providers.tsx|FRONTEND|FRONTEND|NO
288|app/test-api/page.tsx|FRONTEND|FRONTEND|NO
289|components/admin/affiliate-filters.tsx|FRONTEND|FRONTEND|NO
290|components/admin/affiliate-stats-banner.tsx|FRONTEND|FRONTEND|NO
291|components/admin/affiliate-table.tsx|FRONTEND|FRONTEND|NO
292|components/admin/code-inventory-chart.tsx|FRONTEND|FRONTEND|NO
293|components/admin/commission-owings-table.tsx|FRONTEND|FRONTEND|NO
294|components/admin/distribute-codes-modal.tsx|FRONTEND|FRONTEND|NO
295|components/admin/FraudAlertCard.tsx|FRONTEND|FRONTEND|NO
296|components/admin/FraudPatternBadge.tsx|FRONTEND|FRONTEND|NO
297|components/admin/pay-commission-modal.tsx|FRONTEND|FRONTEND|NO
298|components/admin/pnl-breakdown-table.tsx|FRONTEND|FRONTEND|NO
299|components/admin/pnl-summary-cards.tsx|FRONTEND|FRONTEND|NO
300|components/admin/pnl-trend-chart.tsx|FRONTEND|FRONTEND|NO
301|components/admin/sales-performance-table.tsx|FRONTEND|FRONTEND|NO
302|components/admin/suspend-affiliate-modal.tsx|FRONTEND|FRONTEND|NO
303|components/affiliate/code-table.tsx|FRONTEND|FRONTEND|NO
304|components/affiliate/commission-table.tsx|FRONTEND|FRONTEND|NO
305|components/affiliate/index.ts|FRONTEND|FRONTEND|NO
306|components/affiliate/stats-card.tsx|FRONTEND|FRONTEND|NO
307|components/alerts/alert-card.tsx|FRONTEND|FRONTEND|NO
308|components/alerts/alert-form.tsx|FRONTEND|FRONTEND|NO
309|components/alerts/alert-list.tsx|FRONTEND|FRONTEND|NO
310|components/auth/login-form.tsx|FRONTEND|FRONTEND|NO
311|components/auth/login-tracker.tsx|FRONTEND|FRONTEND|NO
312|components/auth/register-form.tsx|FRONTEND|FRONTEND|NO
313|components/auth/social-auth-buttons.tsx|FRONTEND|FRONTEND|NO
314|components/billing/invoice-list.tsx|FRONTEND|FRONTEND|NO
315|components/billing/subscription-card.tsx|FRONTEND|FRONTEND|NO
316|components/charts/chart-controls.tsx|FRONTEND|FRONTEND|NO
317|components/charts/indicator-toggles.tsx|FRONTEND|FRONTEND|NO
318|components/charts/pro-indicator-overlay.tsx|FRONTEND|FRONTEND|NO
319|components/charts/timeframe-selector.tsx|FRONTEND|FRONTEND|NO
320|components/charts/trading-chart.tsx|FRONTEND|FRONTEND|NO
321|components/dashboard/recent-alerts.tsx|FRONTEND|FRONTEND|NO
322|components/dashboard/stats-card.tsx|FRONTEND|FRONTEND|NO
323|components/dashboard/upgrade-prompt.tsx|FRONTEND|FRONTEND|NO
324|components/dashboard/watchlist-widget.tsx|FRONTEND|FRONTEND|NO
325|components/indicators/indicator-selector.tsx|FRONTEND|FRONTEND|NO
326|components/layout/footer.tsx|FRONTEND|FRONTEND|NO
327|components/layout/header.tsx|FRONTEND|FRONTEND|NO
328|components/layout/mobile-nav.tsx|FRONTEND|FRONTEND|NO
329|components/layout/sidebar.tsx|FRONTEND|FRONTEND|NO
330|components/notifications/notification-bell.tsx|FRONTEND|FRONTEND|NO
331|components/notifications/notification-list.tsx|FRONTEND|FRONTEND|NO
332|components/payments/CountrySelector.tsx|FRONTEND|FRONTEND|NO
333|components/payments/DiscountCodeInput.tsx|FRONTEND|FRONTEND|NO
334|components/payments/index.ts|FRONTEND|FRONTEND|NO
335|components/payments/PaymentButton.tsx|FRONTEND|FRONTEND|NO
336|components/payments/PaymentMethodSelector.tsx|FRONTEND|FRONTEND|NO
337|components/payments/PlanSelector.tsx|FRONTEND|FRONTEND|NO
338|components/payments/PriceDisplay.tsx|FRONTEND|FRONTEND|NO
339|components/pricing/tier-comparison.tsx|FRONTEND|FRONTEND|NO
340|components/providers/theme-provider.tsx|FRONTEND|FRONTEND|NO
341|components/providers/websocket-provider.tsx|FRONTEND|FRONTEND|NO
342|components/theme-toggle.tsx|FRONTEND|FRONTEND|NO
343|components/ui/alert-dialog.tsx|FRONTEND|FRONTEND|NO
344|components/ui/avatar.tsx|FRONTEND|FRONTEND|NO
345|components/ui/badge.tsx|FRONTEND|FRONTEND|NO
346|components/ui/breadcrumb.tsx|FRONTEND|FRONTEND|NO
347|components/ui/button.tsx|FRONTEND|FRONTEND|NO
348|components/ui/card.tsx|FRONTEND|FRONTEND|NO
349|components/ui/dialog.tsx|FRONTEND|FRONTEND|NO
350|components/ui/dropdown-menu.tsx|FRONTEND|FRONTEND|NO
351|components/ui/input.tsx|FRONTEND|FRONTEND|NO
352|components/ui/label.tsx|FRONTEND|FRONTEND|NO
353|components/ui/pagination.tsx|FRONTEND|FRONTEND|NO
354|components/ui/popover.tsx|FRONTEND|FRONTEND|NO
355|components/ui/progress.tsx|FRONTEND|FRONTEND|NO
356|components/ui/scroll-area.tsx|FRONTEND|FRONTEND|NO
357|components/ui/select.tsx|FRONTEND|FRONTEND|NO
358|components/ui/separator.tsx|FRONTEND|FRONTEND|NO
359|components/ui/sheet.tsx|FRONTEND|FRONTEND|NO
360|components/ui/skeleton.tsx|FRONTEND|FRONTEND|NO
361|components/ui/switch.tsx|FRONTEND|FRONTEND|NO
362|components/ui/tabs.tsx|FRONTEND|FRONTEND|NO
363|components/ui/toast-container.tsx|FRONTEND|FRONTEND|NO
364|components/ui/upgrade-button.tsx|FRONTEND|FRONTEND|NO
365|components/watchlist/symbol-selector.tsx|FRONTEND|FRONTEND|NO
366|components/watchlist/timeframe-grid.tsx|FRONTEND|FRONTEND|NO
367|components/watchlist/watchlist-item.tsx|FRONTEND|FRONTEND|NO
368|emails/index.ts|BACKEND|BACKEND|NO
369|emails/payment-confirmation.tsx|FRONTEND|BACKEND|YES
370|emails/payment-failure.tsx|FRONTEND|BACKEND|YES
371|emails/renewal-reminder.tsx|FRONTEND|BACKEND|YES
372|emails/subscription-expired.tsx|FRONTEND|BACKEND|YES
373|hooks/use-alerts.ts|FRONTEND|FRONTEND|NO
374|hooks/use-auth.ts|FRONTEND|FRONTEND|NO
375|hooks/use-indicators.ts|FRONTEND|FRONTEND|NO
376|hooks/use-login-tracking.ts|FRONTEND|FRONTEND|NO
377|hooks/use-optimistic-mutation.ts|FRONTEND|FRONTEND|NO
378|hooks/use-toast.ts|FRONTEND|FRONTEND|NO
379|hooks/use-watchlist.ts|FRONTEND|FRONTEND|NO
380|hooks/use-websocket.ts|FRONTEND|FRONTEND|NO
381|lib/admin/affiliate-management.ts|BACKEND|BACKEND|NO
382|lib/admin/code-distribution.ts|BACKEND|BACKEND|NO
383|lib/admin/pnl-calculator.ts|BACKEND|BACKEND|NO
384|lib/affiliate/code-generator.ts|BACKEND|BACKEND|NO
385|lib/affiliate/commission-calculator.ts|BACKEND|BACKEND|NO
386|lib/affiliate/constants.ts|BACKEND|BACKEND|NO
387|lib/affiliate/registration.ts|BACKEND|BACKEND|NO
388|lib/affiliate/report-builder.ts|BACKEND|BACKEND|NO
389|lib/affiliate/types.ts|BACKEND|BACKEND|NO
390|lib/affiliate/validators.ts|BACKEND|BACKEND|NO
391|lib/api/index.ts|BACKEND|BACKEND|NO
392|lib/api/mt5-client.ts|BACKEND|BACKEND|NO
393|lib/api/mt5-transform.ts|BACKEND|BACKEND|NO
394|lib/api-client.test.example.ts|TEST|TEST|NO
395|lib/api-client.ts|FRONTEND|FRONTEND|NO
396|lib/auth/auth-options.ts|BACKEND|BACKEND|NO
397|lib/auth/errors.ts|BACKEND|BACKEND|NO
398|lib/auth/permissions.ts|BACKEND|BACKEND|NO
399|lib/auth/session.ts|BACKEND|BACKEND|NO
400|lib/auth/session-tracker.ts|BACKEND|BACKEND|NO
401|lib/auth/two-factor.ts|BACKEND|BACKEND|NO
402|lib/cache/cache-manager.ts|BACKEND|BACKEND|NO
403|lib/candle-data-helpers.ts|BACKEND|BACKEND|NO
404|lib/constants/business-rules.ts|BACKEND|BACKEND|NO
405|lib/cron/check-expiring-subscriptions.ts|BACKEND|BACKEND|NO
406|lib/cron/downgrade-expired-subscriptions.ts|BACKEND|BACKEND|NO
407|lib/cron/monthly-distribution.ts|BACKEND|BACKEND|NO
408|lib/csrf.ts|BACKEND|BACKEND|NO
409|lib/db/prisma.ts|BACKEND|BACKEND|NO
410|lib/db/seed.ts|BACKEND|BACKEND|NO
411|lib/disbursement/constants.ts|BACKEND|BACKEND|NO
412|lib/disbursement/cron/disbursement-processor.ts|BACKEND|BACKEND|NO
413|lib/disbursement/providers/base-provider.ts|BACKEND|BACKEND|NO
414|lib/disbursement/providers/mock-provider.ts|BACKEND|BACKEND|NO
415|lib/disbursement/providers/provider-factory.ts|BACKEND|BACKEND|NO
416|lib/disbursement/providers/rise/amount-converter.ts|BACKEND|BACKEND|NO
417|lib/disbursement/providers/rise/rise-provider.ts|BACKEND|BACKEND|NO
418|lib/disbursement/providers/rise/siwe-auth.ts|BACKEND|BACKEND|NO
419|lib/disbursement/providers/rise/webhook-verifier.ts|BACKEND|BACKEND|NO
420|lib/disbursement/services/batch-manager.ts|BACKEND|BACKEND|NO
421|lib/disbursement/services/commission-aggregator.ts|BACKEND|BACKEND|NO
422|lib/disbursement/services/payment-orchestrator.ts|BACKEND|BACKEND|NO
423|lib/disbursement/services/payout-calculator.ts|BACKEND|BACKEND|NO
424|lib/disbursement/services/retry-handler.ts|BACKEND|BACKEND|NO
425|lib/disbursement/services/transaction-logger.ts|BACKEND|BACKEND|NO
426|lib/disbursement/services/transaction-service.ts|BACKEND|BACKEND|NO
427|lib/disbursement/webhook/event-processor.ts|BACKEND|BACKEND|NO
428|lib/dlocal/constants.ts|BACKEND|BACKEND|NO
429|lib/dlocal/currency-converter.service.ts|BACKEND|BACKEND|NO
430|lib/dlocal/dlocal-payment.service.ts|BACKEND|BACKEND|NO
431|lib/dlocal/payment-methods.service.ts|BACKEND|BACKEND|NO
432|lib/dlocal/three-day-validator.service.ts|BACKEND|BACKEND|NO
433|lib/email/email.ts|BACKEND|BACKEND|NO
434|lib/email/subscription-emails.ts|BACKEND|BACKEND|NO
435|lib/email/templates/affiliate/code-distributed.tsx|FRONTEND|BACKEND|YES
436|lib/email/templates/affiliate/code-used.tsx|FRONTEND|BACKEND|YES
437|lib/email/templates/affiliate/monthly-report.tsx|FRONTEND|BACKEND|YES
438|lib/email/templates/affiliate/payment-processed.tsx|FRONTEND|BACKEND|YES
439|lib/email/templates/affiliate/welcome.tsx|FRONTEND|BACKEND|YES
440|lib/errors/api-error.ts|BACKEND|BACKEND|NO
441|lib/errors/error-handler.ts|BACKEND|BACKEND|NO
442|lib/errors/error-logger.ts|BACKEND|BACKEND|NO
443|lib/fraud/fraud-detection.service.ts|BACKEND|BACKEND|NO
444|lib/geo/detect-country.ts|BACKEND|BACKEND|NO
445|lib/hooks/useAffiliateConfig.ts|FRONTEND|FRONTEND|NO
446|lib/jobs/alert-checker.ts|BACKEND|BACKEND|NO
447|lib/jobs/queue.ts|BACKEND|BACKEND|NO
448|lib/logger.ts|BACKEND|BACKEND|NO
449|lib/monitoring/system-monitor.ts|BACKEND|BACKEND|NO
450|lib/preferences/defaults.ts|BACKEND|BACKEND|NO
451|lib/rate-limit.ts|BACKEND|BACKEND|NO
452|lib/redis/client.ts|BACKEND|BACKEND|NO
453|lib/security/device-detection.ts|BACKEND|BACKEND|NO
454|lib/stripe/stripe.ts|BACKEND|BACKEND|NO
455|lib/stripe/webhook-handlers.ts|BACKEND|BACKEND|NO
456|lib/tier/__tests__/constants.test.ts|TEST|TEST|NO
457|lib/tier/__tests__/validator.test.ts|TEST|TEST|NO
458|lib/tier/constants.ts|BACKEND|BACKEND|NO
459|lib/tier/index.ts|BACKEND|BACKEND|NO
460|lib/tier/validator.ts|BACKEND|BACKEND|NO
461|lib/tier-config.ts|BACKEND|BACKEND|NO
462|lib/tier-helpers.ts|BACKEND|BACKEND|NO
463|lib/tier-validation.ts|BACKEND|BACKEND|NO
464|lib/tokens.ts|BACKEND|BACKEND|NO
465|lib/utils.ts|BACKEND|BACKEND|NO
466|lib/utils/constants.ts|BACKEND|BACKEND|NO
467|lib/utils/formatters.ts|BACKEND|BACKEND|NO
468|lib/utils/helpers.ts|BACKEND|BACKEND|NO
469|lib/validations/alert.ts|BACKEND|BACKEND|NO
470|lib/validations/auth.ts|BACKEND|BACKEND|NO
471|lib/validations/user.ts|BACKEND|BACKEND|NO
472|lib/validations/watchlist.ts|BACKEND|BACKEND|NO
473|lib/websocket/server.ts|BACKEND|BACKEND|NO
474|lib/websocket/use-mt5-websocket.ts|BACKEND|FRONTEND|YES
475|middleware/tier-check.ts|BACKEND|BACKEND|NO
476|mt5-service/.env.example|SHARING|SHARING|NO
477|mt5-service/app/__init__.py|BACKEND|BACKEND|NO
478|mt5-service/app/routes/__init__.py|BACKEND|BACKEND|NO
479|mt5-service/app/routes/admin.py|BACKEND|BACKEND|NO
480|mt5-service/app/routes/indicators.py|BACKEND|BACKEND|NO
481|mt5-service/app/services/__init__.py|BACKEND|BACKEND|NO
482|mt5-service/app/services/health_monitor.py|BACKEND|BACKEND|NO
483|mt5-service/app/services/indicator_reader.py|BACKEND|BACKEND|NO
484|mt5-service/app/services/mt5_connection_pool.py|BACKEND|BACKEND|NO
485|mt5-service/app/services/tier_service.py|BACKEND|BACKEND|NO
486|mt5-service/app/utils/__init__.py|BACKEND|BACKEND|NO
487|mt5-service/app/utils/constants.py|BACKEND|BACKEND|NO
488|mt5-service/app/utils/symbol_resolver.py|BACKEND|BACKEND|NO
489|mt5-service/app/websocket.py|BACKEND|BACKEND|NO
490|mt5-service/config/mt5_terminals.json|BACKEND|BACKEND|NO
491|mt5-service/config/mt5_terminals_test.json|BACKEND|BACKEND|NO
492|mt5-service/Dockerfile|BACKEND|BACKEND|NO
493|mt5-service/requirements.txt|BACKEND|BACKEND|NO
494|mt5-service/requirements-dev.txt|BACKEND|BACKEND|NO
495|mt5-service/run.py|BACKEND|BACKEND|NO
496|mt5-service/tests/conftest.py|BACKEND|BACKEND|NO
497|mt5-service/tests/mock_mt5_server.py|BACKEND|BACKEND|NO
498|mt5-service/tests/test_connection_pool.py|BACKEND|BACKEND|NO
499|mt5-service/tests/test_indicators.py|BACKEND|BACKEND|NO
500|mt5-service/tests/test_mt5_integration.py|BACKEND|BACKEND|NO
501|mt5-service/tests/test_symbol_resolver.py|BACKEND|BACKEND|NO
502|next.config.js|FRONTEND|FRONTEND|NO
503|postcss.config.js|FRONTEND|FRONTEND|NO
504|prisma/migrations/20251227000000_init/migration.sql|BACKEND|BACKEND|NO
505|prisma/schema.prisma|BACKEND|BACKEND|NO
506|prisma/seed.ts|BACKEND|BACKEND|NO
507|public/manifest.json|FRONTEND|FRONTEND|NO
508|scripts/verify-auth-config.js|(none)|SHARING|YES
509|tailwind.config.ts|FRONTEND|FRONTEND|NO
510|tsconfig.json|SHARING|SHARING|NO
511|types/alert.ts|SHARING|SHARING|NO
512|types/api.ts|SHARING|SHARING|NO
513|types/disbursement.ts|SHARING|SHARING|NO
514|types/dlocal.ts|SHARING|SHARING|NO
515|types/index.ts|SHARING|SHARING|NO
516|types/indicator.ts|SHARING|SHARING|NO
517|types/next-auth.d.ts|SHARING|SHARING|NO
518|types/payment.ts|SHARING|SHARING|NO
519|types/prisma-stubs.d.ts|SHARING|SHARING|NO
520|types/tier.ts|SHARING|SHARING|NO
521|types/user.ts|SHARING|SHARING|NO
522|types/watchlist.ts|SHARING|SHARING|NO
523|vercel.json|FRONTEND|FRONTEND|NO
```

---

## Changes Only (Filter: CHANGED=YES)

```
NO.|PATH & FILENAME|ORIGINAL|CORRECTED|REASON
1|__tests__/api/admin.test.ts|BACKEND|FRONTEND|Tests Next.js API routes (Vercel edge functions)
2|__tests__/api/admin-affiliates.test.ts|BACKEND|FRONTEND|Tests Next.js API routes (Vercel edge functions)
3|__tests__/api/admin-reports.test.ts|BACKEND|FRONTEND|Tests Next.js API routes (Vercel edge functions)
4|__tests__/api/affiliate-conversion.test.ts|BACKEND|FRONTEND|Tests Next.js API routes (Vercel edge functions)
5|__tests__/api/affiliate-dashboard.test.ts|BACKEND|FRONTEND|Tests Next.js API routes (Vercel edge functions)
6|__tests__/api/affiliate-registration.test.ts|BACKEND|FRONTEND|Tests Next.js API routes (Vercel edge functions)
7|__tests__/api/alerts.test.ts|BACKEND|FRONTEND|Tests Next.js API routes (Vercel edge functions)
8|__tests__/api/cron/process-pending.test.ts|BACKEND|FRONTEND|Tests Next.js API routes (Vercel edge functions)
9|__tests__/api/cron-jobs.test.ts|BACKEND|FRONTEND|Tests Next.js API routes (Vercel edge functions)
10|__tests__/api/disbursement/affiliates.test.ts|BACKEND|FRONTEND|Tests Next.js API routes (Vercel edge functions)
11|__tests__/api/disbursement/audit.test.ts|BACKEND|FRONTEND|Tests Next.js API routes (Vercel edge functions)
12|__tests__/api/disbursement/batches.test.ts|BACKEND|FRONTEND|Tests Next.js API routes (Vercel edge functions)
13|__tests__/api/disbursement/execute.test.ts|BACKEND|FRONTEND|Tests Next.js API routes (Vercel edge functions)
14|__tests__/api/disbursement/health.test.ts|BACKEND|FRONTEND|Tests Next.js API routes (Vercel edge functions)
15|__tests__/api/disbursement/pay.test.ts|BACKEND|FRONTEND|Tests Next.js API routes (Vercel edge functions)
16|__tests__/api/disbursement/reports.test.ts|BACKEND|FRONTEND|Tests Next.js API routes (Vercel edge functions)
17|__tests__/api/notifications.test.ts|BACKEND|FRONTEND|Tests Next.js API routes (Vercel edge functions)
18|__tests__/api/tier.test.ts|BACKEND|FRONTEND|Tests Next.js API routes (Vercel edge functions)
19|__tests__/api/user.test.ts|BACKEND|FRONTEND|Tests Next.js API routes (Vercel edge functions)
20|__tests__/api/watchlist.test.ts|BACKEND|FRONTEND|Tests Next.js API routes (Vercel edge functions)
21|__tests__/api/webhooks/dlocal/route.test.ts|BACKEND|FRONTEND|Tests Next.js API routes (Vercel edge functions)
22|__tests__/api/webhooks/riseworks.test.ts|BACKEND|FRONTEND|Tests Next.js API routes (Vercel edge functions)
48|__tests__/hooks/use-toast.test.ts|TEST|FRONTEND|Hooks are FRONTEND, tests follow
49|__tests__/hooks/use-websocket.test.ts|TEST|FRONTEND|Hooks are FRONTEND, tests follow
57|__tests__/lib/admin/affiliate-management.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
58|__tests__/lib/admin/code-distribution.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
59|__tests__/lib/admin/pnl-calculator.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
60|__tests__/lib/affiliate/code-generator.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
61|__tests__/lib/affiliate/commission-calculator.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
62|__tests__/lib/affiliate/registration.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
65|__tests__/lib/auth/errors.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
66|__tests__/lib/auth/permissions.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
67|__tests__/lib/auth/session.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
68|__tests__/lib/cron/check-expiring-subscriptions.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
69|__tests__/lib/cron/downgrade-expired-subscriptions.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
70|__tests__/lib/cron/monthly-distribution.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
71|__tests__/lib/db/prisma.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
72|__tests__/lib/db/seed.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
73|__tests__/lib/disbursement/constants.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
74|__tests__/lib/disbursement/providers/factory.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
75|__tests__/lib/disbursement/providers/mock.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
76|__tests__/lib/disbursement/providers/rise/webhook.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
77|__tests__/lib/disbursement/services/aggregator.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
78|__tests__/lib/disbursement/services/batch.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
79|__tests__/lib/disbursement/services/orchestrator.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
80|__tests__/lib/dlocal/constants.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
81|__tests__/lib/dlocal/currency-converter.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
82|__tests__/lib/dlocal/dlocal-payment.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
83|__tests__/lib/dlocal/payment-methods.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
84|__tests__/lib/dlocal/three-day-validator.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
85|__tests__/lib/email/email.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
86|__tests__/lib/errors/api-error.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
87|__tests__/lib/errors/error-handler.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
88|__tests__/lib/geo/detect-country.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
89|__tests__/lib/jobs/alert-checker.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
90|__tests__/lib/rate-limit.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
91|__tests__/lib/stripe/stripe.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
92|__tests__/lib/stripe/webhook-handlers.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
93|__tests__/lib/tier-config.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
94|__tests__/lib/tier-helpers.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
95|__tests__/lib/tier-validation.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
96|__tests__/lib/tokens.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
97|__tests__/lib/utils.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
98|__tests__/lib/utils/constants.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
99|__tests__/lib/utils/formatters.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
100|__tests__/lib/utils/helpers.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
101|__tests__/lib/validations/alert.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
102|__tests__/lib/validations/auth.test.ts|TEST|BACKEND|Methodology: __tests__/lib/**/*.test.ts → BACKEND
369|emails/payment-confirmation.tsx|FRONTEND|BACKEND|Server-side email rendering, consistency with emails/index.ts
370|emails/payment-failure.tsx|FRONTEND|BACKEND|Server-side email rendering, consistency with emails/index.ts
371|emails/renewal-reminder.tsx|FRONTEND|BACKEND|Server-side email rendering, consistency with emails/index.ts
372|emails/subscription-expired.tsx|FRONTEND|BACKEND|Server-side email rendering, consistency with emails/index.ts
435|lib/email/templates/affiliate/code-distributed.tsx|FRONTEND|BACKEND|Server-side email templates
436|lib/email/templates/affiliate/code-used.tsx|FRONTEND|BACKEND|Server-side email templates
437|lib/email/templates/affiliate/monthly-report.tsx|FRONTEND|BACKEND|Server-side email templates
438|lib/email/templates/affiliate/payment-processed.tsx|FRONTEND|BACKEND|Server-side email templates
439|lib/email/templates/affiliate/welcome.tsx|FRONTEND|BACKEND|Server-side email templates
474|lib/websocket/use-mt5-websocket.ts|BACKEND|FRONTEND|React hook (use- prefix)
508|scripts/verify-auth-config.js|(none)|SHARING|Build/config script needs categorization
```

---

## Methodology Update Recommendations

The following updates should be made to `frontend-and-backend-categorization-methodology.md`:

1. **Add TEST category** with explicit rules for e2e, integration, and test infrastructure
2. **Clarify API test rule**: Change to "API tests follow their endpoints" (FRONTEND for Next.js API routes)
3. **Add email template rule**: `emails/**/*` → BACKEND (server-side rendering)
4. **Add scripts rule**: `scripts/**/*` → SHARING
5. **Add React hook detection**: Files with `use-*.ts` prefix → FRONTEND regardless of directory
