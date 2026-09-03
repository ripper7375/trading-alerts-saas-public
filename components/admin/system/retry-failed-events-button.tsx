'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
import { Button } from '@/components/ui/button';
import { useLocale } from '@/lib/context/locale-context';

/**
 * Retry Failed Events Button (Session 6-11, B2-16)
 *
 * Client island inside the server-rendered /admin/system/outbox page.
 * Resets every FAILED OutboxEvent back to PENDING, then refreshes the
 * server component so the real, post-retry counts render -- no optimistic
 * or fabricated numbers.
 */
export function RetryFailedEventsButton({
  failedCount,
}: {
  failedCount: number;
}): React.ReactElement | null {
  const { t } = useLocale();
  const router = useRouter();
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (failedCount === 0) return null;

  const handleRetry = async (): Promise<void> => {
    setIsRetrying(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/system/outbox/retry', {
        method: 'POST',
      });
      if (!response.ok) {
        const body = await response.json();
        setError(body.error ?? t('admin.system.retry_failed', 'Retry failed'));
        return;
      }
      router.refresh();
    } catch {
      setError(t('admin.system.network_error', 'Network error'));
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={isRetrying}>
            {isRetrying
              ? t('admin.system.retrying', 'Retrying…')
              : t(
                  'admin.system.retry_n_failed_events',
                  'Retry {count} Failed Events'
                ).replace('{count}', String(failedCount))}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(
                'admin.system.retry_all_failed_confirm',
                'Retry all failed events?'
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'admin.system.retry_all_failed_desc',
                "Resets all {count} FAILED outbox events back to PENDING with a fresh attempt budget. money-service's publisher cron picks them up on its next poll."
              ).replace('{count}', String(failedCount))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleRetry()}>
              {t('admin.system.retry', 'Retry')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error && (
        <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
      )}
    </div>
  );
}
