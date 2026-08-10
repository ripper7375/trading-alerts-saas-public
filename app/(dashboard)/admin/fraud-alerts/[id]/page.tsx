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

import { useState, useEffect, useCallback } from 'react';
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

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FraudPatternBadge } from '@/components/admin/FraudPatternBadge';

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
        setLoadError('You do not have permission to view this alert.');
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to fetch fraud alert');
      }
      const data = await response.json();
      setAlert(data.alert);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'Failed to fetch fraud alert'
      );
    } finally {
      setLoading(false);
    }
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
        throw new Error(data.error || 'Failed to update alert status');
      }
      // Only reflect the transition once the server has confirmed it —
      // no optimistic update (order's own Invariant for this file).
      setAlert(data.alert);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Failed to update alert status'
      );
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
          <p className="text-muted-foreground">Loading alert...</p>
        </div>
      </div>
    );
  }

  if (notFound || (!alert && !loadError)) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-bold">Alert not found</h2>
            <p className="text-muted-foreground">
              The fraud alert you&apos;re looking for doesn&apos;t exist.
            </p>
            <Button asChild className="mt-4">
              <Link href="/admin/fraud-alerts">Back to Alerts</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loadError || !alert) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-bold">Failed to load alert</h2>
            <p className="text-muted-foreground">{loadError}</p>
            <Button className="mt-4" onClick={() => void fetchAlert()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formattedDate = new Date(alert.createdAt).toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

  return (
    <div className="container mx-auto py-8">
      {/* Back link */}
      <Link
        href="/admin/fraud-alerts"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Fraud Alerts
      </Link>

      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <h1 className="text-3xl font-bold">Fraud Alert</h1>
            <FraudPatternBadge severity={alert.severity} />
          </div>
          <p className="text-muted-foreground">{alert.pattern}</p>
        </div>

        {/* Action buttons */}
        {alert.status === 'PENDING' && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleAction('DISMISSED')}
              disabled={actionLoading}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Dismiss
            </Button>
            <Button
              variant="outline"
              onClick={() => handleAction('REVIEWED')}
              disabled={actionLoading}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark Reviewed
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleAction('BLOCKED')}
              disabled={actionLoading}
            >
              <Ban className="mr-2 h-4 w-4" />
              Block User
            </Button>
          </div>
        )}
      </div>

      {actionError && (
        <div className="border-destructive/50 bg-destructive/10 mb-6 rounded-lg border p-4 text-sm text-destructive">
          {actionError}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main details */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{alert.description}</p>
            </CardContent>
          </Card>

          {/* Admin notes / resolution */}
          <Card>
            <CardHeader>
              <CardTitle>Admin Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {alert.resolution && (
                <div>
                  <span className="text-muted-foreground">Resolution:</span>
                  <p className="font-medium">{alert.resolution}</p>
                </div>
              )}
              {alert.notes ? (
                <p className="text-muted-foreground">{alert.notes}</p>
              ) : (
                <p className="text-muted-foreground">No notes recorded.</p>
              )}
              {alert.reviewedAt && (
                <p className="text-xs text-muted-foreground">
                  Reviewed{' '}
                  {new Date(alert.reviewedAt).toLocaleString('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* User info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                User Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Email:</span>
                <p className="font-medium">{alert.user?.email ?? 'Unknown'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Name:</span>
                <p className="font-medium">{alert.user?.name ?? 'Unknown'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Tier:</span>
                <p className="font-medium">{alert.user?.tier ?? 'Unknown'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Payment info */}
          {(alert.amount || alert.paymentMethod || alert.country) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {alert.amount && (
                  <div>
                    <span className="text-muted-foreground">Amount:</span>
                    <p className="font-medium">
                      {alert.currency ?? ''} {alert.amount}
                    </p>
                  </div>
                )}
                {alert.paymentMethod && (
                  <div>
                    <span className="text-muted-foreground">Method:</span>
                    <p className="font-medium">{alert.paymentMethod}</p>
                  </div>
                )}
                {alert.country && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Country:</span>
                    <p className="font-medium">{alert.country}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Technical info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Technical Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Timestamp:</span>
                <p className="font-medium">{formattedDate}</p>
              </div>
              {alert.ipAddress && (
                <div>
                  <span className="text-muted-foreground">IP Address:</span>
                  <p className="font-mono text-xs">{alert.ipAddress}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
