/**
 * Login Tracking Hook
 *
 * Tracks login activity after successful authentication.
 * Records device and location information, and triggers security alerts
 * for new device logins.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

interface LoginTrackingResult {
  success: boolean;
  isNewDevice?: boolean;
  deviceType?: string;
  location?: string;
}

/**
 * Hook to track login activity after authentication
 *
 * Automatically calls the track-login API when a user session is detected.
 * Only tracks once per session to avoid duplicate entries.
 *
 * @param provider - The authentication provider used (e.g., 'credentials', 'google')
 * @returns void
 */
export function useLoginTracking(provider: string = 'credentials'): void {
  const { data: session, status } = useSession();
  const hasTracked = useRef(false);

  useEffect(() => {
    // Only track when authenticated and not already tracked
    if (status !== 'authenticated' || !session?.user?.id || hasTracked.current) {
      return;
    }

    // Check if this is a fresh login (within last 30 seconds)
    // This prevents tracking on page refreshes
    const loginTrackedKey = `login_tracked_${session.user.id}`;
    const lastTracked = sessionStorage.getItem(loginTrackedKey);

    if (lastTracked) {
      const lastTrackedTime = parseInt(lastTracked, 10);
      const thirtySecondsAgo = Date.now() - 30000;

      // If tracked in the last 30 seconds, skip
      if (lastTrackedTime > thirtySecondsAgo) {
        hasTracked.current = true;
        return;
      }
    }

    // Track the login
    const trackLogin = async (): Promise<void> => {
      try {
        const response = await fetch('/api/auth/track-login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ provider }),
        });

        if (response.ok) {
          const result: LoginTrackingResult = await response.json();
          console.log('[LoginTracking] Login tracked:', result);

          // Store tracking timestamp
          sessionStorage.setItem(loginTrackedKey, Date.now().toString());
        } else {
          console.error('[LoginTracking] Failed to track login');
        }
      } catch (error) {
        console.error('[LoginTracking] Error tracking login:', error);
      }
    };

    hasTracked.current = true;
    trackLogin();
  }, [status, session, provider]);
}

/**
 * Track login manually (for use outside of React components)
 */
export async function trackLogin(provider: string = 'credentials'): Promise<LoginTrackingResult | null> {
  try {
    const response = await fetch('/api/auth/track-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ provider }),
    });

    if (response.ok) {
      return await response.json();
    }

    return null;
  } catch (error) {
    console.error('[trackLogin] Error:', error);
    return null;
  }
}
