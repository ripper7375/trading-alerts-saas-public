'use client';

import { useLoginTracking } from '@/hooks/use-login-tracking';

/**
 * Login Tracker Component
 *
 * Client-side component that tracks login activity.
 * Renders nothing visually, just handles login tracking side effects.
 *
 * Place this component in the dashboard layout to track logins
 * when users first arrive after authentication.
 */

interface LoginTrackerProps {
  provider?: string;
}

export function LoginTracker({ provider = 'credentials' }: LoginTrackerProps): null {
  useLoginTracking(provider);
  return null;
}
