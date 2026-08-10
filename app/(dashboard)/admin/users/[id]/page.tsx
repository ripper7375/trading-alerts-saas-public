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
  ACTIVE: 'bg-green-600',
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
  CONVERTED: 'bg-green-600',
  CANCELLED: 'bg-red-600',
};

const AFFILIATE_STATUS_CLASS: Record<string, string> = {
  PENDING_VERIFICATION: 'bg-yellow-600',
  ACTIVE: 'bg-green-600',
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
          className="text-sm text-blue-400 transition-colors hover:text-blue-300"
        >
          ← Back to Users
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
          {user.name || 'No name'}
        </h1>
        <p className="mt-1 text-gray-400">{user.email}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 1. Profile & Account Status */}
        <Card className="border-gray-700 bg-gray-800">
          <CardHeader>
            <CardTitle className="text-white">
              Profile &amp; Account Status
            </CardTitle>
            <CardDescription className="text-gray-400">
              Registration and role information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Email</span>
              <span className="text-white">{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Name</span>
              <span className="text-white">{user.name || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Role</span>
              <span className="text-white">{user.role}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Tier</span>
              {badge(
                user.tier,
                user.tier === 'PRO' ? 'bg-blue-600' : 'bg-gray-600'
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Email Verified</span>
              {user.emailVerified
                ? badge('Verified', 'bg-green-600')
                : badge('Unverified', 'bg-red-600')}
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Account Status</span>
              {user.isActive
                ? badge('Active', 'bg-green-600')
                : badge('Inactive', 'bg-red-600')}
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Registered</span>
              <span className="text-white">{formatDate(user.createdAt)}</span>
            </div>
          </CardContent>
        </Card>

        {/* 2. Subscription & Billing Info */}
        <Card className="border-gray-700 bg-gray-800">
          <CardHeader>
            <CardTitle className="text-white">
              Subscription &amp; Billing
            </CardTitle>
            <CardDescription className="text-gray-400">
              Tier, provider, and trial status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {subscription ? (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-400">Status</span>
                  {badge(
                    subscription.status,
                    SUBSCRIPTION_STATUS_CLASS[subscription.status] ??
                      'bg-gray-600'
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Provider</span>
                  <span className="text-white">
                    {subscription.stripeSubscriptionId
                      ? 'Stripe'
                      : subscription.dLocalPaymentId
                        ? 'dLocal'
                        : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Subscription ID</span>
                  <span className="font-mono text-xs text-gray-300">
                    {subscription.stripeSubscriptionId ||
                      subscription.dLocalPaymentId ||
                      '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Plan</span>
                  <span className="text-white">
                    {subscription.planType || 'MONTHLY'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Period End</span>
                  <span className="text-white">
                    {subscription.expiresAt
                      ? formatDate(subscription.expiresAt)
                      : subscription.stripeCurrentPeriodEnd
                        ? formatDate(subscription.stripeCurrentPeriodEnd)
                        : '—'}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-gray-400">No subscription on record.</p>
            )}
            <div className="flex justify-between border-t border-gray-700 pt-3">
              <span className="text-gray-400">Trial Status</span>
              {badge(
                user.trialStatus,
                TRIAL_STATUS_CLASS[user.trialStatus] ?? 'bg-gray-600'
              )}
            </div>
            {user.trialEndDate && (
              <div className="flex justify-between">
                <span className="text-gray-400">Trial Ends</span>
                <span className="text-white">
                  {formatDate(user.trialEndDate)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. Security & 2FA Info */}
        <Card className="border-gray-700 bg-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Security &amp; 2FA</CardTitle>
            <CardDescription className="text-gray-400">
              Two-factor status and session activity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">2FA Status</span>
              {user.twoFactorEnabled
                ? badge('Enabled', 'bg-green-600')
                : badge('Disabled', 'bg-gray-600')}
            </div>
            {user.twoFactorVerifiedAt && (
              <div className="flex justify-between">
                <span className="text-gray-400">2FA Enabled On</span>
                <span className="text-white">
                  {formatDate(user.twoFactorVerifiedAt)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Active Sessions</span>
              <span className="text-white">{activeSessionCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Last Login (est.)</span>
              <span className="text-white">
                {lastLoginAt ? formatDate(lastLoginAt) : 'Never'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 4. Fraud & Security Risk Flags */}
        <Card className="border-gray-700 bg-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              Fraud Alerts
              {fraudAlerts.length > 0 && (
                <Badge className="bg-red-600 text-xs">
                  {fraudAlerts.length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-gray-400">
              Most recent 10 fraud detection flags for this user
            </CardDescription>
          </CardHeader>
          <CardContent>
            {fraudAlerts.length === 0 ? (
              <p className="text-sm text-gray-400">
                No fraud alerts on record.
              </p>
            ) : (
              <ul className="space-y-3">
                {fraudAlerts.map((alert) => (
                  <li
                    key={alert.id}
                    className="flex items-start justify-between gap-3 border-b border-gray-700/50 pb-3 last:border-0 last:pb-0"
                  >
                    <div>
                      <Link
                        href={`/admin/fraud-alerts/${alert.id}`}
                        className="text-sm font-medium text-white hover:text-blue-300"
                      >
                        {alert.pattern}
                      </Link>
                      <p className="text-xs text-gray-400">
                        {formatDate(alert.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 gap-2">
                      {badge(
                        alert.severity,
                        FRAUD_SEVERITY_CLASS[alert.severity] ?? 'bg-gray-600'
                      )}
                      {badge(
                        alert.status,
                        FRAUD_STATUS_CLASS[alert.status] ?? 'bg-gray-600'
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 5. Affiliate & Code Info */}
        <Card className="border-gray-700 bg-gray-800 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-white">
              Affiliate &amp; Code Info
            </CardTitle>
            <CardDescription className="text-gray-400">
              Affiliate standing and referral code activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!user.isAffiliate || !affiliateProfile ? (
              <p className="text-sm text-gray-400">
                {user.isAffiliate
                  ? 'Marked as an affiliate but no affiliate profile exists.'
                  : 'Not an affiliate.'}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-gray-400">Status</p>
                  <div className="mt-1">
                    {badge(
                      affiliateProfile.status,
                      AFFILIATE_STATUS_CLASS[affiliateProfile.status] ??
                        'bg-gray-600'
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Codes Distributed</p>
                  <p className="mt-1 text-lg font-bold text-white">
                    {affiliateProfile._count.affiliateCodes}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Total Earnings</p>
                  <p className="mt-1 text-lg font-bold text-white">
                    ${affiliateProfile.totalEarnings.toString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Pending Commissions</p>
                  <p className="mt-1 text-lg font-bold text-yellow-400">
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
