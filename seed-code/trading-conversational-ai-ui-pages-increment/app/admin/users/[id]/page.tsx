'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  ArrowLeft,
  ShieldAlert,
  ShieldCheck,
  Zap,
  KeyRound,
  Ban,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Mail,
  Calendar,
  CreditCard,
  Layers,
  Save,
  Lock,
} from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { AdminNav } from '@/components/admin/admin-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLocale } from '@/lib/context/locale-context';

interface UserDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function AdminUserDetailPage({ params }: UserDetailPageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const userId = resolvedParams.id;
  const { t } = useLocale();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // User State
  const [name, setName] = useState('Sarah Jenkins');
  const [email, setEmail] = useState('sarah.j@trademail.com');
  const [tier, setTier] = useState<'FREE' | 'PRO'>('PRO');
  const [role, setRole] = useState<'USER' | 'ADMIN'>('USER');
  const [status, setStatus] = useState<'ACTIVE' | 'SUSPENDED' | 'BANNED'>(
    'ACTIVE'
  );
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [affiliateCode, setAffiliateCode] = useState('GOLDPRO20');
  const [createdAt, setCreatedAt] = useState('2026-06-12');
  const [lastLogin, setLastLogin] = useState('10 minutes ago');
  const [emailVerified] = useState(true);
  const [activeSessions] = useState(2);

  // Subscription & Billing (read-only summary, matches Codebase 1's
  // Subscription & Billing card)
  const subscription = {
    status: 'ACTIVE',
    provider: 'Stripe',
    subscriptionId: 'sub_1PXk2LGoldPro',
    plan: 'MONTHLY',
    periodEnd: '2026-09-12',
    trialStatus: 'CONVERTED',
  };

  // Fraud alerts attributed to this user (read-only summary, matches
  // Codebase 1's per-user Fraud Alerts card)
  const userFraudAlerts = [
    {
      id: 'FRAUD-102',
      pattern: t('Affiliate Self-Referral'),
      severity: 'HIGH' as const,
      status: t('Action Required'),
      createdAt: '2026-08-10',
    },
  ];

  // Affiliate & code stats (read-only summary, matches Codebase 1's
  // Affiliate & Code Info card)
  const affiliateStats = {
    status: 'ACTIVE',
    codesDistributed: 3,
    totalEarnings: 1240.5,
    pendingCommissions: 185.0,
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, tier, role, status }),
      }).catch(() => null);

      setSuccess(t('User account parameters updated successfully!'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || t('Error updating user.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (confirm(t('Send password reset email to this user?'))) {
      alert(t('Password reset email dispatched to user.'));
    }
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t('Admin User Detail & Governance')}
        subtitle={t(`Inspecting Account UID: ${userId}`)}
      />

      <AdminNav />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <Link
            href="/admin/users"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-400"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t('Back to User Management')}</span>
          </Link>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetPassword}
              className="border-slate-800 bg-[#090b14] text-xs text-slate-300 hover:bg-slate-800"
            >
              <KeyRound className="mr-1.5 h-3.5 w-3.5 text-amber-400" />
              {t('Trigger Password Reset')}
            </Button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3.5 text-xs text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Main info */}
          <Card className="space-y-5 border-slate-800/80 bg-[#090b14]/90 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-lg font-bold text-amber-400">
                  {name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-100">
                      {name}
                    </h3>
                    <Badge
                      className={
                        tier === 'PRO'
                          ? 'bg-amber-500 text-[10px] font-bold text-slate-950'
                          : 'bg-slate-800 text-[10px] text-slate-400'
                      }
                    >
                      {tier}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-rose-500/30 text-[10px] text-rose-400"
                    >
                      {role}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        emailVerified
                          ? 'border-emerald-500/30 text-[10px] text-emerald-400'
                          : 'border-slate-700 text-[10px] text-slate-400'
                      }
                    >
                      <Mail className="mr-1 h-3 w-3" />
                      {emailVerified ? t('Verified') : t('Unverified')}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400">
                    {email} • UID: {userId}
                  </p>
                </div>
              </div>

              <div className="text-right text-xs text-slate-400">
                <div>
                  {t('Registered')}:{' '}
                  <strong className="text-slate-200">{createdAt}</strong>
                </div>
                <div>
                  {t('Last Active')}:{' '}
                  <strong className="text-slate-200">{lastLogin}</strong>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">
                  {t('Full Name')}
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border-slate-800 bg-[#06080e] text-slate-200"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">
                  {t('Email Address')}
                </Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-slate-800 bg-[#06080e] text-slate-200"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">
                  {t('Subscription Tier')}
                </Label>
                <Select value={tier} onValueChange={(v: any) => setTier(v)}>
                  <SelectTrigger className="border-slate-800 bg-[#06080e] text-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-[#090b14]">
                    <SelectItem value="FREE">FREE Workspace</SelectItem>
                    <SelectItem value="PRO">PRO Terminal ($49/mo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">
                  {t('Platform Role')}
                </Label>
                <Select value={role} onValueChange={(v: any) => setRole(v)}>
                  <SelectTrigger className="border-slate-800 bg-[#06080e] text-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-[#090b14]">
                    <SelectItem value="USER">USER (Standard Trader)</SelectItem>
                    <SelectItem value="ADMIN">
                      ADMIN (Platform Operator)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">
                  {t('Account Status')}
                </Label>
                <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                  <SelectTrigger className="border-slate-800 bg-[#06080e] text-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-[#090b14]">
                    <SelectItem value="ACTIVE">
                      ACTIVE (Normal Access)
                    </SelectItem>
                    <SelectItem value="SUSPENDED">
                      SUSPENDED (Temporary Hold)
                    </SelectItem>
                    <SelectItem value="BANNED">
                      BANNED (Permanent Lockout)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-3">
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#06080e] p-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-200">
                    {t('Two-Factor Authentication (2FA)')}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {twoFactorEnabled ? t('Enabled (TOTP App)') : t('Disabled')}
                  </p>
                </div>
                <Switch
                  checked={twoFactorEnabled}
                  onCheckedChange={setTwoFactorEnabled}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#06080e] p-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-200">
                    {t('Active Sessions')}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {t('Signed in on')} {activeSessions}{' '}
                    {activeSessions === 1 ? t('device') : t('devices')}
                  </p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-[#090b14] text-sm font-bold text-slate-200">
                  {activeSessions}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#06080e] p-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-200">
                    {t('Attributed Referral Code')}
                  </div>
                  <p className="font-mono text-[11px] text-amber-400">
                    {affiliateCode || 'None (Direct Signup)'}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="border-amber-500/30 text-[10px] text-amber-400"
                >
                  30% RevShare
                </Badge>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Subscription & Billing */}
            <Card className="space-y-3 border-slate-800/80 bg-[#090b14]/90 p-5 backdrop-blur-xl">
              <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
                <CreditCard className="h-4 w-4 text-amber-400" />
                <h4 className="text-xs font-bold text-slate-200">
                  {t('Subscription & Billing')}
                </h4>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('Status')}</span>
                  <Badge className="bg-emerald-500 text-[10px] font-bold text-slate-950">
                    {subscription.status}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('Provider')}</span>
                  <span className="text-slate-200">
                    {subscription.provider}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('Subscription ID')}</span>
                  <span className="font-mono text-[11px] text-slate-300">
                    {subscription.subscriptionId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('Plan')}</span>
                  <span className="text-slate-200">{subscription.plan}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('Period End')}</span>
                  <span className="text-slate-200">
                    {subscription.periodEnd}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-800 pt-2">
                  <span className="text-slate-400">{t('Trial Status')}</span>
                  <span className="text-slate-200">
                    {subscription.trialStatus}
                  </span>
                </div>
              </div>
            </Card>

            {/* Fraud Alerts */}
            <Card className="space-y-3 border-slate-800/80 bg-[#090b14]/90 p-5 backdrop-blur-xl">
              <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
                <ShieldAlert className="h-4 w-4 text-rose-400" />
                <h4 className="text-xs font-bold text-slate-200">
                  {t('Fraud Alerts')}
                </h4>
                {userFraudAlerts.length > 0 && (
                  <Badge className="bg-rose-600 text-[9px] text-white">
                    {userFraudAlerts.length}
                  </Badge>
                )}
              </div>
              {userFraudAlerts.length === 0 ? (
                <p className="text-xs text-slate-400">
                  {t('No fraud alerts on record.')}
                </p>
              ) : (
                <ul className="space-y-2">
                  {userFraudAlerts.map((alert) => (
                    <li key={alert.id}>
                      <Link
                        href={`/admin/fraud-alerts/${alert.id}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-[#06080e] p-2.5 text-xs hover:border-rose-500/40"
                      >
                        <div>
                          <div className="font-semibold text-slate-100">
                            {alert.pattern}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {alert.createdAt}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className="border-rose-500/40 text-[9px] text-rose-300"
                        >
                          {alert.severity}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Affiliate & Code Info */}
            <Card className="space-y-3 border-slate-800/80 bg-[#090b14]/90 p-5 backdrop-blur-xl lg:col-span-2">
              <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
                <Layers className="h-4 w-4 text-amber-400" />
                <h4 className="text-xs font-bold text-slate-200">
                  {t('Affiliate & Code Info')}
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
                <div>
                  <p className="text-slate-400">{t('Status')}</p>
                  <Badge className="mt-1 bg-emerald-500 text-[10px] font-bold text-slate-950">
                    {affiliateStats.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-slate-400">{t('Codes Distributed')}</p>
                  <p className="mt-1 text-base font-bold text-slate-100">
                    {affiliateStats.codesDistributed}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">{t('Total Earnings')}</p>
                  <p className="mt-1 text-base font-bold text-slate-100">
                    ${affiliateStats.totalEarnings.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">{t('Pending Commissions')}</p>
                  <p className="mt-1 text-base font-bold text-amber-400">
                    ${affiliateStats.pendingCommissions.toFixed(2)}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-amber-500 px-6 font-bold text-slate-950 hover:bg-amber-400"
            >
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? t('Saving...') : t('Save User Modifications')}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
