'use client';

import { useState, useEffect, useCallback } from 'react';

import { FREE_TIER_CONFIG, PRO_TIER_CONFIG } from '@/lib/tier-config';

import { useAuth } from './use-auth';

/**
 * Alert interface
 */
export interface Alert {
  id: string;
  name: string | null;
  symbol: string;
  timeframe: string;
  condition: string;
  alertType: string;
  isActive: boolean;
  lastTriggered: Date | null;
  triggerCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create alert input
 */
export interface CreateAlertInput {
  symbol: string;
  timeframe: string;
  conditionType: 'price_above' | 'price_below' | 'price_equals';
  targetValue: number;
  name?: string;
}

/**
 * Update alert input
 */
export interface UpdateAlertInput {
  id: string;
  isActive?: boolean;
  name?: string;
  targetValue?: number;
}

/**
 * Computed alert status
 */
export type AlertStatus = 'active' | 'paused' | 'triggered';

/**
 * Compute alert status from isActive and lastTriggered
 */
export function computeAlertStatus(alert: Alert): AlertStatus {
  if (alert.lastTriggered && !alert.isActive) {
    return 'triggered';
  }
  if (!alert.isActive) {
    return 'paused';
  }
  return 'active';
}

/**
 * Mutation state
 */
interface MutationState {
  isLoading: boolean;
  error: Error | null;
}

/**
 * useAlerts Hook Return Type
 */
interface UseAlertsReturn {
  alerts: Alert[];
  isLoading: boolean;
  error: Error | null;
  createAlert: {
    mutate: (input: CreateAlertInput) => Promise<Alert | null>;
    isLoading: boolean;
    error: Error | null;
  };
  updateAlert: {
    mutate: (input: UpdateAlertInput) => Promise<Alert | null>;
    isLoading: boolean;
    error: Error | null;
  };
  deleteAlert: {
    mutate: (id: string) => Promise<boolean>;
    isLoading: boolean;
    error: Error | null;
  };
  refetch: () => Promise<void>;
  activeAlerts: Alert[];
  pausedAlerts: Alert[];
  triggeredAlerts: Alert[];
  currentCount: number;
  limit: number;
  canCreate: boolean;
  alertsRemaining: number;
}

/**
 * useAlerts Hook
 *
 * React hook for managing alerts CRUD operations.
 * Includes tier limit checking and status filtering.
 *
 * @param status - Optional status filter
 * @returns Alert data and mutation functions
 */
export function useAlerts(status?: string): UseAlertsReturn {
  const { tier } = useAuth();

  // Alerts state
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Mutation states
  const [createState, setCreateState] = useState<MutationState>({
    isLoading: false,
    error: null,
  });
  const [updateState, setUpdateState] = useState<MutationState>({
    isLoading: false,
    error: null,
  });
  const [deleteState, setDeleteState] = useState<MutationState>({
    isLoading: false,
    error: null,
  });

  // Get alert limit based on tier
  const limit =
    tier === 'PRO' ? PRO_TIER_CONFIG.maxAlerts : FREE_TIER_CONFIG.maxAlerts;

  // Fetch alerts
  const fetchAlerts = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const params = status ? `?status=${status}` : '';
      const response = await fetch(`/api/alerts${params}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch alerts');
      }

      const data = await response.json();
      setAlerts(data.alerts || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  // Fetch on mount and when status changes
  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Create alert
  const createAlertMutate = async (
    input: CreateAlertInput
  ): Promise<Alert | null> => {
    setCreateState({ isLoading: true, error: null });

    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create alert');
      }

      const data = await response.json();
      await fetchAlerts(); // Refetch alerts
      setCreateState({ isLoading: false, error: null });
      return data.alert;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setCreateState({ isLoading: false, error });
      return null;
    }
  };

  // Update alert
  const updateAlertMutate = async (
    input: UpdateAlertInput
  ): Promise<Alert | null> => {
    setUpdateState({ isLoading: true, error: null });

    try {
      const { id, ...data } = input;
      const response = await fetch(`/api/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update alert');
      }

      const responseData = await response.json();
      await fetchAlerts(); // Refetch alerts
      setUpdateState({ isLoading: false, error: null });
      return responseData.alert;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setUpdateState({ isLoading: false, error });
      return null;
    }
  };

  // Delete alert
  const deleteAlertMutate = async (id: string): Promise<boolean> => {
    setDeleteState({ isLoading: true, error: null });

    try {
      const response = await fetch(`/api/alerts/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete alert');
      }

      await fetchAlerts(); // Refetch alerts
      setDeleteState({ isLoading: false, error: null });
      return true;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setDeleteState({ isLoading: false, error });
      return false;
    }
  };

  // Filter by status
  const activeAlerts = alerts.filter(
    (a: Alert) => a.isActive && !a.lastTriggered
  );
  const pausedAlerts = alerts.filter(
    (a: Alert) => !a.isActive && !a.lastTriggered
  );
  const triggeredAlerts = alerts.filter((a: Alert) => a.lastTriggered !== null);

  // Calculate limit usage
  const currentCount = activeAlerts.length;
  const canCreate = currentCount < limit;
  const alertsRemaining = limit - currentCount;

  return {
    alerts,
    isLoading,
    error,
    createAlert: {
      mutate: createAlertMutate,
      isLoading: createState.isLoading,
      error: createState.error,
    },
    updateAlert: {
      mutate: updateAlertMutate,
      isLoading: updateState.isLoading,
      error: updateState.error,
    },
    deleteAlert: {
      mutate: deleteAlertMutate,
      isLoading: deleteState.isLoading,
      error: deleteState.error,
    },
    refetch: fetchAlerts,
    activeAlerts,
    pausedAlerts,
    triggeredAlerts,
    currentCount,
    limit,
    canCreate,
    alertsRemaining,
  };
}

/**
 * useAlert Hook
 *
 * Fetch a single alert by ID
 *
 * @param id - Alert ID
 * @returns Single alert data
 */
export function useAlert(id: string): {
  alert: Alert | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const [alert, setAlert] = useState<Alert | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAlert = useCallback(async (): Promise<void> => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/alerts/${id}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch alert');
      }

      const data = await response.json();
      setAlert(data.alert || null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAlert();
  }, [fetchAlert]);

  return {
    alert,
    isLoading,
    error,
    refetch: fetchAlert,
  };
}

/**
 * useAlertLimits Hook
 *
 * Get current alert usage and limits for the user's tier
 *
 * @returns Alert limit information
 */
export function useAlertLimits(): {
  currentCount: number;
  limit: number;
  canCreate: boolean;
  alertsRemaining: number;
  usagePercent: number;
  isLoading: boolean;
} {
  const { tier } = useAuth();
  const { activeAlerts, isLoading } = useAlerts();

  const limit =
    tier === 'PRO' ? PRO_TIER_CONFIG.maxAlerts : FREE_TIER_CONFIG.maxAlerts;
  const currentCount = activeAlerts.length;
  const canCreate = currentCount < limit;
  const alertsRemaining = limit - currentCount;
  const usagePercent = (currentCount / limit) * 100;

  return {
    currentCount,
    limit,
    canCreate,
    alertsRemaining,
    usagePercent,
    isLoading,
  };
}
