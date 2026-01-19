/**
 * Example React Hook demonstrating Enhanced API Client usage
 *
 * ⚠️ IMPORTANT: Updated 2025-01-19 after Part 20 deletion
 *
 * This hook shows how to use the API Client features:
 * ✅ Multi-stack routing (Stack A - AVAILABLE NOW)
 * ⚠️ Stack B features (FUTURE - not deployed yet):
 *   - WebSocket for real-time notifications
 *   - Server-Sent Events (SSE)
 *   - Leaderboard, Confluence, Surveillance endpoints
 * ✅ Request timeout (works now with Stack A)
 * ✅ Request cancellation (works now with Stack A)
 * ✅ Retry logic (works now - automatic for 429, 503, 504)
 *
 * Usage in components:
 * ```typescript
 * const {
 *   alerts,
 *   notifications,
 *   isLoading,
 *   error
 * } = useApiClientExample();
 * ```
 */

import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';

export interface Alert {
  id: string;
  symbol: string;
  condition: string;
  targetPrice: number;
  active: boolean;
}

export interface Leaderboard {
  timeframe: string;
  leaders: Array<{ symbol: string; score: number }>;
}

export interface Notification {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export function useApiClientExample() {
  // State
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);
  // ⚠️ Uncomment when Stack B is deployed:
  // const unsubscribeNotificationsRef = useRef<(() => void) | null>(null);
  // const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    loadData();

    // ⚠️ WebSocket and SSE features commented out (Stack B not deployed)
    // setupRealTimeNotifications();
    // setupServerSentEvents();

    // Cleanup on unmount
    return () => {
      // Cancel any pending requests
      abortControllerRef.current?.abort();

      // ⚠️ Uncomment when Stack B is deployed:
      // unsubscribeNotificationsRef.current?.();
      // eventSourceRef.current?.close();
      // api.disconnectAll();
    };
  }, []);

  /**
   * Load initial data from Stack A only
   *
   * ⚠️ Stack B endpoints (leaderboard, advanced notifications) commented out
   * until Stack B is deployed. Will throw 404 errors if uncommented.
   */
  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Create AbortController for request cancellation
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // ✅ Parallel requests to Stack A (WORKS NOW)
      const [alertsData, notificationsData] = await Promise.all([
        // Stack A - Alerts with timeout ✅
        api.stackA.get<Alert[]>('/alerts', {
          timeout: 10000, // 10 second timeout
          signal: controller.signal,
        }),

        // Stack A - Basic Notifications ✅
        api.stackA.getNotifications(),
      ]);

      setAlerts(alertsData);
      setNotifications(notificationsData as Notification[]);

      // ⚠️ Stack B - Leaderboard (FUTURE - Stack B not deployed)
      // const leaderboardData = await api.stackB.getLeaderBoard('H4');
      // setLeaderboard(leaderboardData);

      // ⚠️ Stack B - Advanced Notifications (FUTURE - Stack B not deployed)
      // const advancedNotifications = await api.stackB.getAdvancedNotifications({ limit: 10 });
      // setNotifications(advancedNotifications);

    } catch (err: any) {
      setError(err.message || 'Failed to load data');
      console.error('Load data error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Setup real-time notifications via WebSocket
   *
   * ⚠️ FUTURE: Commented out until Stack B deployment
   * This will fail with WebSocket connection error if uncommented
   */
  /* Uncomment when Stack B is deployed
  const setupRealTimeNotifications = () => {
    const unsubscribe = api.stackB.subscribeToNotifications(
      (notification: Notification) => {
        console.log('New real-time notification:', notification);

        // Add to notifications list
        setNotifications((prev) => [notification, ...prev]);
      },
      {
        reconnect: true, // Auto-reconnect on connection loss
        onError: (error) => {
          console.error('WebSocket error:', error);
        },
        onClose: (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
        },
      }
    );

    unsubscribeNotificationsRef.current = unsubscribe;
  };
  */

  /**
   * Setup Server-Sent Events (SSE) for live updates
   *
   * ⚠️ FUTURE: Commented out until Stack B deployment
   * This will fail with connection error if uncommented
   */
  /* Uncomment when Stack B is deployed
  const setupServerSentEvents = () => {
    const eventSource = api.stackB.createNotificationsStream();

    eventSource.onmessage = (event) => {
      console.log('SSE event received:', event.data);
      try {
        const notification = JSON.parse(event.data);
        setNotifications((prev) => [notification, ...prev]);
      } catch (err) {
        console.error('Failed to parse SSE data:', err);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      // EventSource will auto-reconnect
    };

    eventSourceRef.current = eventSource;
  };
  */

  /**
   * Create new alert (Stack A)
   */
  const createAlert = async (alertData: Omit<Alert, 'id'>) => {
    try {
      const newAlert = await api.stackA.createAlert(alertData);
      setAlerts((prev) => [newAlert, ...prev]);
      return newAlert;
    } catch (err: any) {
      console.error('Create alert error:', err);
      throw err;
    }
  };

  /**
   * Delete alert (Stack A)
   */
  const deleteAlert = async (id: string) => {
    try {
      await api.stackA.deleteAlert(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      console.error('Delete alert error:', err);
      throw err;
    }
  };

  /**
   * Refresh leaderboard (Stack B)
   *
   * ⚠️ FUTURE: Will throw 404 error until Stack B is deployed
   */
  const refreshLeaderboard = async (timeframe: string = 'H4') => {
    try {
      // ⚠️ This will throw 404 - Stack B not deployed yet
      const data = await api.stackB.getLeaderBoard(timeframe);
      setLeaderboard(data);
    } catch (err: any) {
      console.error('Refresh leaderboard error (expected - Stack B not deployed):', err);
      throw err;
    }
  };

  /**
   * Subscribe to live leaderboard updates via WebSocket
   *
   * ⚠️ FUTURE: WebSocket will fail until Stack B is deployed
   */
  const subscribeToLiveLeaderboard = (timeframe: string = 'H4') => {
    // ⚠️ This will fail - Stack B WebSocket not available yet
    return api.stackB.subscribeToLeaderBoard(
      timeframe,
      (data: Leaderboard) => {
        console.log('Live leaderboard update:', data);
        setLeaderboard(data);
      },
      { reconnect: true }
    );
  };

  /**
   * Example: Request with custom retry config
   */
  const fetchWithCustomRetry = async () => {
    try {
      const data = await api.stackB.get('/some-endpoint', {
        timeout: 5000,
        retry: {
          maxRetries: 5, // Override default (3)
          retryDelay: 2000, // 2 second base delay
          backoff: 'linear', // Linear backoff instead of exponential
          retryOn: [429, 500, 502, 503, 504], // Custom retry status codes
        },
      });
      return data;
    } catch (err: any) {
      console.error('Fetch with retry error:', err);
      throw err;
    }
  };

  /**
   * Example: Cancellable request
   */
  const fetchCancellable = async () => {
    const controller = new AbortController();

    // Start request
    const promise = api.stackA.get('/slow-endpoint', {
      signal: controller.signal,
      timeout: 30000,
    });

    // Cancel after 5 seconds if needed
    setTimeout(() => {
      controller.abort();
      console.log('Request cancelled');
    }, 5000);

    try {
      const data = await promise;
      return data;
    } catch (err: any) {
      if (err.message.includes('cancelled')) {
        console.log('Request was cancelled successfully');
      }
      throw err;
    }
  };

  return {
    // Data
    alerts,
    leaderboard,
    notifications,

    // Loading state
    isLoading,
    error,

    // Actions
    createAlert,
    deleteAlert,
    refreshLeaderboard,
    subscribeToLiveLeaderboard,
    loadData,

    // Examples
    fetchWithCustomRetry,
    fetchCancellable,

    // Config
    config: api.getConfig(),
  };
}

/**
 * Example: Simple hook for real-time notifications only
 *
 * ⚠️ FUTURE: Commented out until Stack B WebSocket is deployed
 * This hook will fail with WebSocket connection error if uncommented
 */
export function useRealTimeNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    // ⚠️ Uncomment when Stack B is deployed
    /*
    // Subscribe to real-time notifications
    const unsubscribe = api.stackB.subscribeToNotifications(
      (notification) => {
        setNotifications((prev) => [notification, ...prev.slice(0, 49)]); // Keep last 50
      },
      {
        reconnect: true,
        onError: (error) => console.error('Notification error:', error),
      }
    );

    // Cleanup
    return () => {
      unsubscribe();
    };
    */
  }, []);

  return { notifications };
}

/**
 * Example: Hook for Stack B leaderboard with live updates
 *
 * ⚠️ FUTURE: Will throw 404 errors until Stack B is deployed
 * Both REST endpoint and WebSocket will fail
 */
export function useLiveLeaderboard(timeframe: string = 'H4') {
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // ⚠️ Uncomment when Stack B is deployed
    /*
    // Initial load
    const loadInitial = async () => {
      try {
        const data = await api.stackB.getLeaderBoard(timeframe);
        setLeaderboard(data);
      } catch (err) {
        console.error('Failed to load leaderboard:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitial();

    // Subscribe to live updates
    const unsubscribe = api.stackB.subscribeToLeaderBoard(
      timeframe,
      (data) => {
        setLeaderboard(data);
      },
      { reconnect: true }
    );

    return () => {
      unsubscribe();
    };
    */
  }, [timeframe]);

  return { leaderboard, isLoading };
}
