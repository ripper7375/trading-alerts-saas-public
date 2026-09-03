'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { AlertForm, type AlertFormData } from '@/components/alerts/alert-form';
import type { Tier } from '@/lib/tier-config';
import { useLocale } from '@/lib/context/locale-context';

/**
 * Props for EditAlertClient component
 */
interface EditAlertClientProps {
  alertId: string;
  userTier: Tier;
  limit: number;
  initialData: AlertFormData;
}

/**
 * EditAlertClient Component
 *
 * Client-side wrapper around the shared AlertForm in edit mode. Submits
 * changes via PATCH /api/alerts/[id] — only `name` and `targetValue` are
 * ever sent, since that's the entirety of what the real endpoint accepts
 * (symbol/timeframe/conditionType are immutable after creation).
 */
export function EditAlertClient({
  alertId,
  userTier,
  limit,
  initialData,
}: EditAlertClientProps): React.JSX.Element {
  const router = useRouter();
  const { t } = useLocale();

  const handleSubmit = async (data: AlertFormData): Promise<void> => {
    const response = await fetch(`/api/alerts/${alertId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name,
        targetValue: data.targetValue,
      }),
    });

    const body = await response.json();

    if (!response.ok) {
      throw new Error(
        body.error ||
          body.message ||
          t('alerts.error_failed_update', 'Failed to update alert')
      );
    }

    router.push('/alerts');
    router.refresh();
  };

  const handleCancel = (): void => {
    router.push('/alerts');
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* Breadcrumb */}
      <div className="mb-4 text-sm text-muted-foreground">
        {t('breadcrumb.dashboard', 'Dashboard')} &gt;{' '}
        <Link
          href="/alerts"
          className="hover:text-amber-600 dark:hover:text-amber-400"
        >
          {t('alerts.page_title', 'Alerts')}
        </Link>{' '}
        &gt; {t('alerts.edit_alert', 'Edit Alert')}
      </div>

      {/* Page Header */}
      <div className="mb-6">
        <h1 className="mb-2 text-2xl font-extrabold tracking-tight text-foreground">
          {t('alerts.edit_alert', 'Edit Alert')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(
            'alerts.edit_alert_subtitle',
            "Update your alert's target price or name"
          )}
        </p>
      </div>

      <AlertForm
        userTier={userTier}
        currentCount={0}
        limit={limit}
        initialData={initialData}
        isEditing={true}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  );
}
