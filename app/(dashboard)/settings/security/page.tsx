'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';
import { ToastContainer } from '@/components/ui/toast-container';
import {
  Shield,
  History,
  Bell,
  RefreshCw,
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  MapPin,
  Check,
  X,
  AlertTriangle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

/**
 * Security Settings Page
 *
 * Features:
 * - Login history with device/location info
 * - Security alert preferences (new device, password change)
 */

interface LoginHistoryItem {
  id: string;
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED';
  provider: string;
  device: string;
  browser: string;
  os: string;
  location: string;
  ipAddress: string;
  isNewDevice: boolean;
  createdAt: string;
}

interface SecurityPreferences {
  newDeviceAlerts: boolean;
  passwordChangeAlerts: boolean;
}

/**
 * Get icon component based on device type
 */
function getDeviceIcon(device: string): React.ComponentType<{ className?: string }> {
  const deviceLower = device.toLowerCase();
  if (deviceLower.includes('mobile') || deviceLower.includes('phone')) {
    return Smartphone;
  }
  if (deviceLower.includes('tablet') || deviceLower.includes('ipad')) {
    return Tablet;
  }
  if (deviceLower.includes('desktop') || deviceLower.includes('pc')) {
    return Monitor;
  }
  return Laptop;
}

/**
 * Format relative time
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Get status badge color
 */
function getStatusColor(status: string): string {
  switch (status) {
    case 'SUCCESS':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'FAILED':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'BLOCKED':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  }
}

export default function SecuritySettingsPage(): React.ReactElement {
  useSession();
  const { toasts, removeToast, success, error: showError } = useToast();

  // Login history state
  const [loginHistory, setLoginHistory] = useState<LoginHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Security preferences state
  const [preferences, setPreferences] = useState<SecurityPreferences>({
    newDeviceAlerts: true,
    passwordChangeAlerts: true,
  });
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(true);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  // Fetch login history
  const fetchLoginHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const response = await fetch('/api/user/login-history?limit=20');
      if (response.ok) {
        const data = await response.json();
        setLoginHistory(data.history || []);
      } else {
        setHistoryError('Failed to load login history');
      }
    } catch (error) {
      console.error('Error fetching login history:', error);
      setHistoryError('Failed to load login history');
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Fetch security preferences
  const fetchPreferences = useCallback(async () => {
    setIsLoadingPrefs(true);
    try {
      const response = await fetch('/api/user/preferences');
      if (response.ok) {
        const data = await response.json();
        setPreferences({
          newDeviceAlerts: data.preferences?.newDeviceAlerts ?? true,
          passwordChangeAlerts: data.preferences?.passwordChangeAlerts ?? true,
        });
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setIsLoadingPrefs(false);
    }
  }, []);

  // Fetch data on mount
  useEffect(() => {
    fetchLoginHistory();
    fetchPreferences();
  }, [fetchLoginHistory, fetchPreferences]);

  // Update preference
  const updatePreference = async (
    key: keyof SecurityPreferences,
    value: boolean
  ): Promise<void> => {
    setIsSavingPrefs(true);
    const previousValue = preferences[key];

    // Optimistic update
    setPreferences((prev) => ({ ...prev, [key]: value }));

    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });

      if (!response.ok) {
        throw new Error('Failed to update preference');
      }

      success('Preference Updated', `Security alert setting has been ${value ? 'enabled' : 'disabled'}.`);
    } catch (error) {
      // Rollback on error
      setPreferences((prev) => ({ ...prev, [key]: previousValue }));
      showError('Update Failed', 'Could not update preference. Please try again.');
      console.error('Error updating preference:', error);
    } finally {
      setIsSavingPrefs(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Security Settings
      </h2>

      {/* Security Alerts Section */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Security Alerts
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Receive email notifications when important security events occur.
        </p>

        {isLoadingPrefs ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-2 animate-pulse" />
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-64 animate-pulse" />
                    </div>
                    <div className="w-10 h-5 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {/* New Device Alerts */}
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-gray-500" />
                  <div>
                    <Label
                      htmlFor="newDeviceAlerts"
                      className="font-semibold text-gray-900 dark:text-white cursor-pointer"
                    >
                      New Device Login Alerts
                    </Label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Get notified when your account is accessed from a new device
                    </p>
                  </div>
                </div>
                <Switch
                  id="newDeviceAlerts"
                  checked={preferences.newDeviceAlerts}
                  onCheckedChange={(checked) =>
                    updatePreference('newDeviceAlerts', checked)
                  }
                  disabled={isSavingPrefs}
                />
              </CardContent>
            </Card>

            {/* Password Change Alerts */}
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-gray-500" />
                  <div>
                    <Label
                      htmlFor="passwordChangeAlerts"
                      className="font-semibold text-gray-900 dark:text-white cursor-pointer"
                    >
                      Password Change Alerts
                    </Label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Get notified when your password is changed
                    </p>
                  </div>
                </div>
                <Switch
                  id="passwordChangeAlerts"
                  checked={preferences.passwordChangeAlerts}
                  onCheckedChange={(checked) =>
                    updatePreference('passwordChangeAlerts', checked)
                  }
                  disabled={isSavingPrefs}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      <Separator className="my-8" />

      {/* Login History Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <History className="w-5 h-5" />
              Login History
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Recent login activity on your account
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchLoginHistory}
            disabled={isLoadingHistory}
          >
            <RefreshCw
              className={`w-4 h-4 mr-1 ${isLoadingHistory ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>

        {historyError && (
          <Card className="mb-4 border-red-200 dark:border-red-900">
            <CardContent className="p-4 flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <span>{historyError}</span>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {isLoadingHistory ? (
            // Loading skeleton
            <>
              {[1, 2, 3, 4, 5].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-2 animate-pulse" />
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          ) : loginHistory.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  No login history available yet
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Your login activity will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            loginHistory.map((entry) => {
              const Icon = getDeviceIcon(entry.device);
              return (
                <Card key={entry.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Device Icon */}
                      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {entry.browser} on {entry.os}
                          </span>
                          <Badge className={getStatusColor(entry.status)}>
                            {entry.status === 'SUCCESS' && <Check className="w-3 h-3 mr-1" />}
                            {entry.status === 'FAILED' && <X className="w-3 h-3 mr-1" />}
                            {entry.status === 'BLOCKED' && <AlertTriangle className="w-3 h-3 mr-1" />}
                            {entry.status}
                          </Badge>
                          {entry.isNewDevice && (
                            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                              New Device
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {entry.location}
                          </span>
                          <span>{entry.ipAddress}</span>
                        </div>

                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-gray-500">
                          <span>{formatRelativeTime(entry.createdAt)}</span>
                          <span>via {entry.provider}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {loginHistory.length > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-4 text-center">
            Showing last {loginHistory.length} login attempts
          </p>
        )}
      </section>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
