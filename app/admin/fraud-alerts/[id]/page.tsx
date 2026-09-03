'use client';

/**
 * Fraud Alert Detail Page
 *
 * Admin page for viewing and acting on a specific fraud alert:
 * - Full alert details
 * - Status transition actions (review, dismiss, block)
 *
 * @module app/(dashboard)/admin/fraud-alerts/[id]/page
 */

import { Fragment, useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  MapPin,
  Clock,
  CreditCard,
  Ban,
  CheckCircle,
  XCircle,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FraudPatternBadge } from '@/components/admin/FraudPatternBadge';
import { useLocale } from '@/lib/context/locale-context';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type AlertStatus = 'PENDING' | 'REVIEWED' | 'DISMISSED' | 'BLOCKED';

/**
 * Matches the real GET/PATCH /api/admin/fraud-alerts/[id] response shape
 * (`prisma/non-market-data/schema.prisma`'s `FraudAlert` model) — NOT the
 * mock's invented `riskScore`/`paymentAttempts`/`previousAlerts`/
 * `userAgent` fields, which don't exist anywhere on the real model.
 */
interface FraudAlertDetail {
  id: string;
  severity: SeverityLevel;
  pattern: string;
  description: string;
  userId: string;
  country: string | null;
  paymentMethod: string | null;
  amount: string | null;
  currency: string | null;
  createdAt: string;
  status: AlertStatus;
  ipAddress: string | null;
  resolution: string | null;
  notes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  user: {
    id: string;
    email: string;
    name: string | null;
    tier: string;
  } | null;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function FraudAlertDetailPage(): React.ReactElement {
  const { t } = useLocale();
  const params = useParams();
  const alertId = params['id'] as string;

  const [alert, setAlert] = useState<FraudAlertDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchAlert = useCallback(async (): Promise<void> => {
    setLoading(true);
    setLoadError(null);
    setNotFound(false);
    try {
      const response = await fetch(`/api/admin/fraud-alerts/${alertId}`);
      if (response.status === 404) {
        setNotFound(true);
        return;
      }
      if (response.status === 403) {
        setLoadError(
          t(
            'admin.fraud.error_no_permission_alert',
            'You do not have permission to view this alert.'
          )
        );
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.error ||
            t('admin.fraud.error_fetch_alert', 'Failed to fetch fraud alert')
        );
      }
      const data = await response.json();
      setAlert(data.alert);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : t('admin.fraud.error_fetch_alert', 'Failed to fetch fraud alert')
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertId]);

  useEffect(() => {
    void fetchAlert();
  }, [fetchAlert]);

  const handleAction = async (
    status: 'REVIEWED' | 'DISMISSED' | 'BLOCKED'
  ): Promise<void> => {
    setActionLoading(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/admin/fraud-alerts/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          data.error ||
            t(
              'admin.fraud.error_update_status',
              'Failed to update alert status'
            )
        );
      }
      // Only reflect the transition once the server has confirmed it —
      // no optimistic update (order's own Invariant for this file).
      setAlert(data.alert);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : t(
              'admin.fraud.error_update_status',
              'Failed to update alert status'
            )
      );
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (notFound || (!alert && !loadError)) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="py-12 text-center">
          <h2 className="text-xl font-bold text-foreground">
            {t('admin.fraud.alert_not_found', 'Alert not found')}
          </h2>
          <p className="text-muted-foreground">
            {t(
              'admin.fraud.alert_not_found_desc',
              "The fraud alert you're looking for doesn't exist."
            )}
          </p>
          <Button asChild className="mt-4">
            <Link href="/admin/fraud-alerts">
              {t('admin.fraud.back_to_alerts', 'Back to Alerts')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loadError || !alert) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="py-12 text-center">
          <h2 className="text-xl font-bold text-foreground">
            {t('admin.fraud.failed_to_load_alert', 'Failed to load alert')}
          </h2>
          <p className="text-muted-foreground">{loadError}</p>
          <Button className="mt-4" onClick={() => void fetchAlert()}>
            {t('admin.fraud.try_again', 'Try Again')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const formattedDate = new Date(alert.createdAt).toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/admin/fraud-alerts"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('admin.fraud.back_to_fraud_alerts', 'Back to Fraud Alerts')}
      </Link>

      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
              {t('admin.fraud.fraud_alert_title', 'Fraud Alert')}
            </h1>
            <FraudPatternBadge severity={alert.severity} />
          </div>
          <p className="text-muted-foreground">{alert.pattern}</p>
        </div>

        {/* Action buttons */}
        {alert.status === 'PENDING' && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void handleAction('DISMISSED')}
              disabled={actionLoading}
            >
              <XCircle className="mr-2 h-4 w-4" />
              {t('admin.fraud.dismiss', 'Dismiss')}
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleAction('REVIEWED')}
              disabled={actionLoading}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              {t('admin.fraud.mark_reviewed', 'Mark Reviewed')}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={actionLoading}>
                  <Ban className="mr-2 h-4 w-4" />
                  {t('admin.fraud.block_user', 'Block User')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t('admin.fraud.block_this_user', 'Block this user?')}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t(
                      'admin.fraud.block_user_desc',
                      '{email} will be immediately deactivated ({code}) and unable to log in. This is a real account action, not just an alert status change.'
                    )
                      .split('{code}')
                      .map((part, i) => (
                        <Fragment key={i}>
                          {part.replace(
                            '{email}',
                            alert.user?.email ??
                              t('admin.fraud.this_user', 'This user')
                          )}
                          {i === 0 && (
                            <code className="font-mono">isActive: false</code>
                          )}
                        </Fragment>
                      ))}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {actionError && (
                  <p className="text-sm text-red-500">{actionError}</p>
                )}
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={actionLoading}
                    onClick={() => void handleAction('BLOCKED')}
                    className="hover:bg-destructive/90 bg-destructive text-white"
                  >
                    {actionLoading
                      ? t('admin.fraud.blocking', 'Blocking...')
                      : t('admin.fraud.block_user', 'Block User')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {actionError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">
          {actionError}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main details */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-foreground">
                {t('admin.fraud.description', 'Description')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground">{alert.description}</p>
            </CardContent>
          </Card>

          {/* Admin notes / resolution */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-foreground">
                {t('admin.fraud.admin_notes', 'Admin Notes')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {alert.resolution && (
                <div>
                  <span className="text-muted-foreground">
                    {t('admin.fraud.resolution', 'Resolution:')}
                  </span>
                  <p className="font-medium text-foreground">
                    {alert.resolution}
                  </p>
                </div>
              )}
              {alert.notes ? (
                <p className="text-muted-foreground">{alert.notes}</p>
              ) : (
                <p className="text-muted-foreground">
                  {t('admin.fraud.no_notes_recorded', 'No notes recorded.')}
                </p>
              )}
              {alert.reviewedAt && (
                <p className="text-xs text-muted-foreground">
                  {t('admin.fraud.reviewed_at', 'Reviewed {date}').replace(
                    '{date}',
                    new Date(alert.reviewedAt).toLocaleString('en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  )}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* User info */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <User className="h-5 w-5" />
                {t('admin.fraud.user_details', 'User Details')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">
                  {t('admin.fraud.email_label', 'Email:')}
                </span>
                <p className="font-medium text-foreground">
                  {alert.user?.email ?? t('admin.fraud.unknown', 'Unknown')}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t('admin.fraud.name_label', 'Name:')}
                </span>
                <p className="font-medium text-foreground">
                  {alert.user?.name ?? t('admin.fraud.unknown', 'Unknown')}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t('admin.fraud.tier_label', 'Tier:')}
                </span>
                <p className="font-medium text-foreground">
                  {alert.user?.tier ?? t('admin.fraud.unknown', 'Unknown')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Payment info */}
          {(alert.amount || alert.paymentMethod || alert.country) && (
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <CreditCard className="h-5 w-5" />
                  {t('admin.fraud.payment_details', 'Payment Details')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {alert.amount && (
                  <div>
                    <span className="text-muted-foreground">
                      {t('admin.fraud.amount_label', 'Amount:')}
                    </span>
                    <p className="font-medium text-foreground">
                      {alert.currency ?? ''} {alert.amount}
                    </p>
                  </div>
                )}
                {alert.paymentMethod && (
                  <div>
                    <span className="text-muted-foreground">
                      {t('admin.fraud.method_label', 'Method:')}
                    </span>
                    <p className="font-medium text-foreground">
                      {alert.paymentMethod}
                    </p>
                  </div>
                )}
                {alert.country && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {t('admin.fraud.country_label', 'Country:')}
                    </span>
                    <p className="font-medium text-foreground">
                      {alert.country}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Technical info */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Clock className="h-5 w-5" />
                {t('admin.fraud.technical_details', 'Technical Details')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">
                  {t('admin.fraud.timestamp_label', 'Timestamp:')}
                </span>
                <p className="font-medium text-foreground">{formattedDate}</p>
              </div>
              {alert.ipAddress && (
                <div>
                  <span className="text-muted-foreground">
                    {t('admin.fraud.ip_address_label', 'IP Address:')}
                  </span>
                  <p className="font-mono text-xs text-foreground">
                    {alert.ipAddress}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
