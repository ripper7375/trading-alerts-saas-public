'use client';

/**
 * Fraud Alert Detail Page
 *
 * Admin page for viewing and acting on a specific fraud alert:
 * - Full alert details
 * - User payment history
 * - Action buttons (review, dismiss, block)
 *
 * @module app/(dashboard)/admin/fraud-alerts/[id]/page
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  MapPin,
  Clock,
  CreditCard,
  Shield,
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

interface FraudAlertDetail {
  id: string;
  severity: SeverityLevel;
  pattern: string;
  description: string;
  userId: string;
  userEmail: string;
  userName: string;
  country: string;
  paymentMethod: string;
  amount: string;
  currency: string;
  createdAt: string;
  status: AlertStatus;
  ipAddress: string;
  userAgent: string;
  paymentAttempts: number;
  previousAlerts: number;
  riskScore: number;
  notes: string[];
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MOCK DATA
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const MOCK_ALERT: FraudAlertDetail = {
  id: '1',
  severity: 'CRITICAL',
  pattern: 'Multiple 3-day plan attempts',
  description:
    'User attempted to purchase 3-day plan 5 times with different payment methods. This violates the one-time purchase rule.',
  userId: 'user_123',
  userEmail: 'suspicious@example.com',
  userName: 'Suspicious User',
  country: 'IN',
  paymentMethod: 'UPI',
  amount: '165.17',
  currency: 'INR',
  createdAt: new Date().toISOString(),
  status: 'PENDING',
  ipAddress: '103.21.45.67',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
  paymentAttempts: 5,
  previousAlerts: 2,
  riskScore: 85,
  notes: [
    'First attempt at 10:00 - UPI - Failed (already used)',
    'Second attempt at 10:02 - Paytm - Failed (already used)',
    'Third attempt at 10:05 - PhonePe - Failed (already used)',
    'Fourth attempt at 10:10 - Net Banking - Failed (already used)',
    'Fifth attempt at 10:15 - Different email - Blocked',
  ],
};

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function FraudAlertDetailPage(): React.ReactElement {
  const params = useParams();
  const [alert, setAlert] = useState<FraudAlertDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch alert details
  useEffect(() => {
    const fetchAlert = async (): Promise<void> => {
      setLoading(true);
      try {
        // In production, replace with actual API call
        await new Promise((resolve) => setTimeout(resolve, 500));
        setAlert(MOCK_ALERT);
      } catch (error) {
        console.error('Failed to fetch fraud alert:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAlert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params['id']]);

  const handleAction = async (action: 'review' | 'dismiss' | 'block'): Promise<void> => {
    setActionLoading(true);
    try {
      // In production, call API
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Update local state
      setAlert((prev) =>
        prev
          ? {
              ...prev,
              status:
                action === 'review'
                  ? 'REVIEWED'
                  : action === 'dismiss'
                    ? 'DISMISSED'
                    : 'BLOCKED',
            }
          : null
      );
    } catch (error) {
      console.error('Action failed:', error);
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

  if (!alert) {
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
              onClick={() => handleAction('dismiss')}
              disabled={actionLoading}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Dismiss
            </Button>
            <Button
              variant="outline"
              onClick={() => handleAction('review')}
              disabled={actionLoading}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark Reviewed
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleAction('block')}
              disabled={actionLoading}
            >
              <Ban className="mr-2 h-4 w-4" />
              Block User
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{alert.description}</p>
            </CardContent>
          </Card>

          {/* Activity log */}
          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {alert.notes.map((note, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <span className="font-medium text-foreground">
                      {index + 1}.
                    </span>
                    {note}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Risk score */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Risk Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div
                  className={`text-4xl font-bold ${
                    alert.riskScore >= 80
                      ? 'text-red-600'
                      : alert.riskScore >= 50
                        ? 'text-orange-600'
                        : 'text-green-600'
                  }`}
                >
                  {alert.riskScore}/100
                </div>
                <p className="text-sm text-muted-foreground">
                  {alert.riskScore >= 80
                    ? 'Very High Risk'
                    : alert.riskScore >= 50
                      ? 'Medium Risk'
                      : 'Low Risk'}
                </p>
              </div>
            </CardContent>
          </Card>

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
                <p className="font-medium">{alert.userEmail}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Name:</span>
                <p className="font-medium">{alert.userName}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Previous Alerts:</span>
                <p className="font-medium">{alert.previousAlerts}</p>
              </div>
            </CardContent>
          </Card>

          {/* Payment info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Amount:</span>
                <p className="font-medium">
                  {alert.currency} {alert.amount}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Method:</span>
                <p className="font-medium">{alert.paymentMethod}</p>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Country:</span>
                <p className="font-medium">{alert.country}</p>
              </div>
            </CardContent>
          </Card>

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
              <div>
                <span className="text-muted-foreground">IP Address:</span>
                <p className="font-mono text-xs">{alert.ipAddress}</p>
              </div>
              <div>
                <span className="text-muted-foreground">User Agent:</span>
                <p className="font-mono text-xs break-all">{alert.userAgent}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
