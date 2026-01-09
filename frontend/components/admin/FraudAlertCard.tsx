'use client';

/**
 * Fraud Alert Card Component
 *
 * Displays a fraud alert with:
 * - Severity badge
 * - User information
 * - Pattern details
 * - Timestamp
 * - Action buttons
 *
 * @module components/admin/FraudAlertCard
 */

import { AlertTriangle, User, Clock, ChevronRight, MapPin } from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FraudPatternBadge } from './FraudPatternBadge';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface FraudAlert {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  pattern: string;
  description: string;
  userId: string;
  userEmail: string;
  country: string | null;
  paymentMethod: string | null;
  amount: string | null;
  currency: string | null;
  createdAt: string;
  status: 'PENDING' | 'REVIEWED' | 'DISMISSED' | 'BLOCKED';
}

interface FraudAlertCardProps {
  alert: FraudAlert;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function FraudAlertCard({
  alert,
}: FraudAlertCardProps): React.ReactElement {
  const formattedDate = new Date(alert.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left side: Alert info */}
          <div className="flex-1 space-y-3">
            {/* Header with severity and pattern */}
            <div className="flex flex-wrap items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <FraudPatternBadge severity={alert.severity} />
              <span className="text-sm font-medium text-muted-foreground">
                {alert.pattern}
              </span>
            </div>

            {/* Description */}
            <p className="text-sm text-foreground">{alert.description}</p>

            {/* User and payment info */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {alert.userEmail}
              </span>
              {alert.country && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {alert.country}
                </span>
              )}
              {(alert.currency || alert.amount || alert.paymentMethod) && (
                <span>
                  {alert.currency && alert.amount
                    ? `${alert.currency} ${alert.amount}`
                    : alert.amount || ''}
                  {alert.paymentMethod ? ` via ${alert.paymentMethod}` : ''}
                </span>
              )}
            </div>

            {/* Timestamp and status */}
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formattedDate}
              </span>
              <span
                className={`text-xs font-medium ${
                  alert.status === 'PENDING'
                    ? 'text-orange-600'
                    : alert.status === 'BLOCKED'
                      ? 'text-red-600'
                      : alert.status === 'DISMISSED'
                        ? 'text-gray-600'
                        : 'text-green-600'
                }`}
              >
                {alert.status}
              </span>
            </div>
          </div>

          {/* Right side: Action */}
          <Link href={`/admin/fraud-alerts/${alert.id}`}>
            <Button variant="ghost" size="sm">
              View
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
