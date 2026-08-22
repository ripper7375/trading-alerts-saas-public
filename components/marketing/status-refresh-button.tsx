'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/lib/context/locale-context';

/**
 * Re-runs the server component's getSystemStatus() call via router.refresh()
 * -- a real telemetry reload (force-dynamic page, no cache), not a fake
 * timed spinner over static copy.
 */
export function StatusRefreshButton() {
  const { t } = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRefresh}
      disabled={isPending}
      className="self-start border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-[#0a0d16] dark:text-slate-300 dark:hover:bg-slate-800"
    >
      <RefreshCw
        className={`mr-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`}
      />
      {t('Refresh Status')}
    </Button>
  );
}
