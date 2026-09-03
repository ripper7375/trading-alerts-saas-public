'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { AlertForm, type AlertFormData } from '@/components/alerts/alert-form';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { Tier } from '@/lib/tier-config';
import { useLocale } from '@/lib/context/locale-context';

/**
 * Props for CreateAlertClient component
 */
interface CreateAlertClientProps {
  userTier: Tier;
  limit: number;
  currentCount: number;
  canCreate: boolean;
  availableSymbols: string[];
  availableTimeframes: string[];
}

/**
 * CreateAlertClient Component
 *
 * Client-side wrapper around the shared AlertForm in create mode. Submits
 * via POST /api/alerts. Session 9-4: previously duplicated AlertForm's own
 * fields/validation in a separate hand-rolled form -- consolidated onto the
 * shared component (also used by EditAlertClient), which additionally does
 * live tier-endpoint validation (GET /api/tier/symbols,
 * /api/tier/combinations, /api/tier/check/[symbol]) this page's old form
 * never had.
 */
export function CreateAlertClient({
  userTier,
  limit,
  currentCount,
  canCreate,
  availableSymbols,
}: CreateAlertClientProps): React.JSX.Element {
  const router = useRouter();
  const { t } = useLocale();

  const handleSubmit = async (data: AlertFormData): Promise<void> => {
    const response = await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const body = await response.json();

    if (!response.ok) {
      throw new Error(
        body.error ||
          body.message ||
          t('alerts.error_failed_create', 'Failed to create alert')
      );
    }

    router.push('/alerts');
    router.refresh();
  };

  const handleCancel = (): void => {
    router.push('/alerts');
  };

  const progressPercent = (currentCount / limit) * 100;

  // Render upgrade/limit prompt if at limit
  if (!canCreate) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="border-rose-500/30 bg-rose-50 dark:bg-rose-950/20">
          <CardContent className="p-8 text-center">
            <h2 className="mb-2 text-2xl font-bold text-foreground">
              {t('alerts.limit_reached_title', 'Alert Limit Reached')}
            </h2>
            <p className="mb-6 text-muted-foreground">
              {t(
                'alerts.limit_reached_desc',
                'You have reached your {tier} tier limit of {limit} active alerts. Delete or pause existing alerts to create new ones.'
              )
                .replace('{tier}', userTier)
                .replace('{limit}', String(limit))}
            </p>
            <div className="flex justify-center gap-4">
              {userTier === 'FREE' && (
                <Link href="/pricing">
                  <Button className="bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 hover:from-amber-400 hover:to-amber-500">
                    {t('dashboard.upgrade_to_pro', 'Upgrade to PRO')}
                  </Button>
                </Link>
              )}
              <Link href="/alerts">
                <Button variant="outline">
                  {t('alerts.manage_existing', 'Manage Existing Alerts')}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Alert Limit Progress */}
      <Card
        className={
          progressPercent >= 80
            ? 'border-amber-500/40 bg-amber-500/5'
            : 'border-border'
        }
      >
        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              {t('alerts.alert_usage', 'Alert Usage')}: {currentCount}/{limit}
            </span>
            <span className="text-sm text-muted-foreground">
              {userTier} {t('alerts.tier', 'Tier')}
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </CardContent>
      </Card>

      <AlertForm
        userTier={userTier}
        currentCount={currentCount}
        limit={limit}
        initialData={{ symbol: availableSymbols[0] }}
        isEditing={false}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  );
}
