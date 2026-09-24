'use client';

/**
 * "View as user" action for the admin user list and user detail page.
 * Starts a read-only view (POST /api/admin/users/view-as), then does a full
 * page load into /settings/billing so the settings layout reads the new
 * cookie on the server.
 *
 * @module components/admin/user-view-as/view-as-user-button
 */

import React, { useState } from 'react';
import { Eye, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useLocale } from '@/lib/context/locale-context';

interface ViewAsUserButtonProps {
  userId: string;
  /** Admin accounts can't be viewed; the button is disabled for them. */
  role: string;
  size?: 'sm' | 'default';
}

export default function ViewAsUserButton({
  userId,
  role,
  size = 'sm',
}: ViewAsUserButtonProps): React.ReactElement {
  const { t } = useLocale();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = role === 'ADMIN';
  const failedText = t(
    'admin.user_view_as.start_failed',
    'Could not start the view'
  );

  const handleStart = async (): Promise<void> => {
    setStarting(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/users/view-as', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        redirectTo?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || failedText);
      }
      // Full navigation on purpose: the settings layout must read the new cookie.
      window.location.assign(data.redirectTo || '/settings/billing');
    } catch (err) {
      setError(err instanceof Error ? err.message : failedText);
      setStarting(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size={size}
        onClick={() => void handleStart()}
        disabled={starting || isAdmin}
        title={
          isAdmin
            ? t(
                'admin.user_view_as.admin_not_viewable',
                'Admin accounts cannot be viewed'
              )
            : t(
                'admin.user_view_as.button_title',
                "See this user's Billing and Security pages, read-only"
              )
        }
      >
        {starting ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Eye className="mr-1.5 h-3.5 w-3.5" />
        )}
        {t('admin.user_view_as.button', 'View as user')}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </span>
  );
}
