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
        setError(body.error ?? 'Retry failed');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={isRetrying}
            className="border-gray-600 text-gray-200 hover:bg-gray-700"
          >
            {isRetrying ? 'Retrying…' : `Retry ${failedCount} Failed Events`}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retry all failed events?</AlertDialogTitle>
            <AlertDialogDescription>
              Resets all {failedCount} FAILED outbox events back to PENDING with
              a fresh attempt budget. money-service&apos;s publisher cron picks
              them up on its next poll.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleRetry()}>
              Retry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error && <span className="text-sm text-red-400">{error}</span>}
    </div>
  );
}
