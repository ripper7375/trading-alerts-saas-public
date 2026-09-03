import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { prisma } from '@/lib/db/prisma';
import { formatDate } from '@/lib/utils';
import { getServerLanguage } from '@/lib/i18n/server-locale';
import { getDictionary } from '@/lib/i18n/get-dictionary';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface AdminUserDetailPageProps {
  params: Promise<{ id: string }>;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function badge(label: string, className: string): React.ReactElement {
  return <Badge className={`${className} text-xs text-white`}>{label}</Badge>;
}

const SUBSCRIPTION_STATUS_CLASS: Record<string, string> = {
  ACTIVE: 'bg-emerald-600',
  TRIALING: 'bg-blue-600',
  PAST_DUE: 'bg-yellow-600',
  UNPAID: 'bg-red-600',
  CANCELED: 'bg-gray-600',
  INACTIVE: 'bg-gray-600',
};

const TRIAL_STATUS_CLASS: Record<string, string> = {
  NOT_STARTED: 'bg-gray-600',
  ACTIVE: 'bg-blue-600',
  EXPIRED: 'bg-gray-600',
  CONVERTED: 'bg-emerald-600',
  CANCELLED: 'bg-red-600',
};

const AFFILIATE_STATUS_CLASS: Record<string, string> = {
  PENDING_VERIFICATION: 'bg-yellow-600',
  ACTIVE: 'bg-emerald-600',
  SUSPENDED: 'bg-red-600',
  INACTIVE: 'bg-gray-600',
};

const FRAUD_SEVERITY_CLASS: Record<string, string> = {
  LOW: 'bg-gray-600',
  MEDIUM: 'bg-yellow-600',
  HIGH: 'bg-orange-600',
  CRITICAL: 'bg-red-600',
};

const FRAUD_STATUS_CLASS: Record<string, string> = {
  PENDING: 'bg-yellow-600',
  REVIEWED: 'bg-blue-600',
  DISMISSED: 'bg-gray-600',
  BLOCKED: 'bg-red-600',
};

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN USER DETAIL PAGE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Admin User Detail Page — Server Component (Session 6-6, A1-17/A2-10)
 *
 * Five sections per Davin's explicit scope: Profile & Account, Subscription
 * & Billing, Security & 2FA, Fraud Alerts, Affiliate & Code Info. Reads
 * Prisma directly (mirrors the `alerts/[id]/edit` server-component
 * precedent) rather than through an API route — `Subscription`/
 * `UserSession`/`FraudAlert`/`AffiliateProfile` are all plain scalar FKs on
 * `User` (no declared Prisma relation), so each is queried separately.
 * "Last login" mirrors `GET /api/admin/users`'s own established heuristic
 * (most recent NextAuth `Session.expires`) rather than inventing a new
 * source. Admin role is already gated by `app/(dashboard)/admin/layout.tsx`.
 */
export default async function AdminUserDetailPage({
  params,
}: AdminUserDetailPageProps): Promise<React.ReactElement> {
  const { id } = await params;
  const dict = getDictionary(await getServerLanguage());
  const dt = (key: string, fallback: string): string => dict[key] ?? fallback;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      tier: true,
      isActive: true,
      isAffiliate: true,
      emailVerified: true,
      trialStatus: true,
      trialStartDate: true,
      trialEndDate: true,
      twoFactorEnabled: true,
      twoFactorVerifiedAt: true,
      createdAt: true,
      sessions: {
        select: { expires: true },
        orderBy: { expires: 'desc' },
        take: 1,
      },
    },
  });

  if (!user) {
    notFound();
  }

  const [subscription, activeSessionCount, fraudAlerts, affiliateProfile] =
    await Promise.all([
      prisma.subscription.findUnique({ where: { userId: id } }),
      prisma.userSession.count({ where: { userId: id, isActive: true } }),
      prisma.fraudAlert.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.affiliateProfile.findUnique({
        where: { userId: id },
        include: { _count: { select: { affiliateCodes: true } } },
      }),
    ]);

  const lastLoginAt = user.sessions[0]?.expires ?? null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/users"
          className="hover:text-primary/80 text-sm text-primary transition-colors"
        >
          {dt('admin.users.back_to_users', '← Back to Users')}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">
          {user.name || dt('admin.users.no_name', 'No name')}
        </h1>
        <p className="mt-1 text-muted-foreground">{user.email}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 1. Profile & Account Status */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">
              {dt(
                'admin.users.profile_account_status',
                'Profile & Account Status'
              )}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {dt(
                'admin.users.registration_role_info',
                'Registration and role information'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {dt('admin.users.email', 'Email')}
              </span>
              <span className="text-foreground">{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {dt('admin.users.name', 'Name')}
              </span>
              <span className="text-foreground">{user.name || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {dt('admin.users.role', 'Role')}
              </span>
              <span className="text-foreground">{user.role}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {dt('admin.users.tier', 'Tier')}
              </span>
              {badge(
                user.tier,
                user.tier === 'PRO' ? 'bg-primary' : 'bg-muted'
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {dt('admin.users.email_verified', 'Email Verified')}
              </span>
              {user.emailVerified
                ? badge(
                    dt('admin.users.verified', 'Verified'),
                    'bg-emerald-600'
                  )
                : badge(
                    dt('admin.users.unverified', 'Unverified'),
                    'bg-red-600'
                  )}
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {dt('admin.users.account_status', 'Account Status')}
              </span>
              {user.isActive
                ? badge(dt('admin.users.active', 'Active'), 'bg-emerald-600')
                : badge(dt('admin.users.inactive', 'Inactive'), 'bg-red-600')}
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {dt('admin.users.registered', 'Registered')}
              </span>
              <span className="text-foreground">
                {formatDate(user.createdAt)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 2. Subscription & Billing Info */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">
              {dt('admin.users.subscription_billing', 'Subscription & Billing')}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {dt(
                'admin.users.subscription_billing_desc',
                'Tier, provider, and trial status'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {subscription ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {dt('admin.users.status', 'Status')}
                  </span>
                  {badge(
                    subscription.status,
                    SUBSCRIPTION_STATUS_CLASS[subscription.status] ?? 'bg-muted'
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {dt('admin.users.provider', 'Provider')}
                  </span>
                  <span className="text-foreground">
                    {subscription.stripeSubscriptionId
                      ? 'Stripe'
                      : subscription.dLocalPaymentId
                        ? 'dLocal'
                        : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {dt('admin.users.subscription_id', 'Subscription ID')}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {subscription.stripeSubscriptionId ||
                      subscription.dLocalPaymentId ||
                      '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {dt('admin.users.plan', 'Plan')}
                  </span>
                  <span className="text-foreground">
                    {subscription.planType || 'MONTHLY'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {dt('admin.users.period_end', 'Period End')}
                  </span>
                  <span className="text-foreground">
                    {subscription.expiresAt
                      ? formatDate(subscription.expiresAt)
                      : subscription.stripeCurrentPeriodEnd
                        ? formatDate(subscription.stripeCurrentPeriodEnd)
                        : '—'}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">
                {dt(
                  'admin.users.no_subscription',
                  'No subscription on record.'
                )}
              </p>
            )}
            <div className="flex justify-between border-t border-border pt-3">
              <span className="text-muted-foreground">
                {dt('admin.users.trial_status', 'Trial Status')}
              </span>
              {badge(
                user.trialStatus,
                TRIAL_STATUS_CLASS[user.trialStatus] ?? 'bg-muted'
              )}
            </div>
            {user.trialEndDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {dt('admin.users.trial_ends', 'Trial Ends')}
                </span>
                <span className="text-foreground">
                  {formatDate(user.trialEndDate)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. Security & 2FA Info */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">
              {dt('admin.users.security_2fa', 'Security & 2FA')}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {dt(
                'admin.users.security_2fa_desc',
                'Two-factor status and session activity'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {dt('admin.users.2fa_status', '2FA Status')}
              </span>
              {user.twoFactorEnabled
                ? badge(dt('admin.users.enabled', 'Enabled'), 'bg-emerald-600')
                : badge(dt('admin.users.disabled', 'Disabled'), 'bg-muted')}
            </div>
            {user.twoFactorVerifiedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {dt('admin.users.2fa_enabled_on', '2FA Enabled On')}
                </span>
                <span className="text-foreground">
                  {formatDate(user.twoFactorVerifiedAt)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {dt('admin.users.active_sessions', 'Active Sessions')}
              </span>
              <span className="text-foreground">{activeSessionCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {dt('admin.users.last_login_est', 'Last Login (est.)')}
              </span>
              <span className="text-foreground">
                {lastLoginAt
                  ? formatDate(lastLoginAt)
                  : dt('admin.users.never', 'Never')}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 4. Fraud & Security Risk Flags */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              {dt('admin.users.fraud_alerts_title', 'Fraud Alerts')}
              {fraudAlerts.length > 0 && (
                <Badge className="bg-red-600 text-xs text-white hover:bg-red-600">
                  {fraudAlerts.length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {dt(
                'admin.users.fraud_alerts_desc',
                'Most recent 10 fraud detection flags for this user'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {fraudAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {dt(
                  'admin.users.no_fraud_alerts',
                  'No fraud alerts on record.'
                )}
              </p>
            ) : (
              <ul className="space-y-3">
                {fraudAlerts.map((alert) => (
                  <li
                    key={alert.id}
                    className="border-border/50 flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
                  >
                    <div>
                      <Link
                        href={`/admin/fraud-alerts/${alert.id}`}
                        className="text-sm font-medium text-foreground hover:text-primary"
                      >
                        {alert.pattern}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(alert.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 gap-2">
                      {badge(
                        alert.severity,
                        FRAUD_SEVERITY_CLASS[alert.severity] ?? 'bg-muted'
                      )}
                      {badge(
                        alert.status,
                        FRAUD_STATUS_CLASS[alert.status] ?? 'bg-muted'
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 5. Affiliate & Code Info */}
        <Card className="border-border bg-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-foreground">
              {dt('admin.users.affiliate_code_info', 'Affiliate & Code Info')}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {dt(
                'admin.users.affiliate_code_info_desc',
                'Affiliate standing and referral code activity'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!user.isAffiliate || !affiliateProfile ? (
              <p className="text-sm text-muted-foreground">
                {user.isAffiliate
                  ? dt(
                      'admin.users.marked_affiliate_no_profile',
                      'Marked as an affiliate but no affiliate profile exists.'
                    )
                  : dt('admin.users.not_an_affiliate', 'Not an affiliate.')}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {dt('admin.users.status', 'Status')}
                  </p>
                  <div className="mt-1">
                    {badge(
                      affiliateProfile.status,
                      AFFILIATE_STATUS_CLASS[affiliateProfile.status] ??
                        'bg-muted'
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {dt('admin.users.codes_distributed', 'Codes Distributed')}
                  </p>
                  <p className="mt-1 text-lg font-bold text-foreground">
                    {affiliateProfile._count.affiliateCodes}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {dt('admin.users.total_earnings', 'Total Earnings')}
                  </p>
                  <p className="mt-1 text-lg font-bold text-foreground">
                    ${affiliateProfile.totalEarnings.toString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {dt(
                      'admin.users.pending_commissions',
                      'Pending Commissions'
                    )}
                  </p>
                  <p className="mt-1 text-lg font-bold text-yellow-600 dark:text-yellow-400">
                    ${affiliateProfile.pendingCommissions.toString()}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
