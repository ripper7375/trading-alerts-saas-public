/**
 * Integration Test: API Client Workflow
 *
 * Tests realistic user workflows using the corrected API Client
 *
 * Updated: 2025-01-19
 * Covers: StackAClient methods with corrected endpoints after Part 20 deletion
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock fetch globally
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('Integration: API Client User Workflows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Workflow 1: New User Dashboard Load', () => {
    it('should load all dashboard data in parallel using corrected endpoints', async () => {
      // Mock all API responses
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        tier: 'PRO',
      };

      const mockAlerts = [
        { id: '1', symbol: 'XAUUSD', condition: '>', targetPrice: 2050, active: true },
      ];

      const mockSubscription = {
        id: 'sub-123',
        tier: 'PRO',
        status: 'active',
      };

      const mockNotifications = [
        { id: '1', type: 'alert', message: 'Price alert triggered', read: false },
      ];

      // Setup mocks
      (global.fetch as jest.MockedFunction<typeof fetch>)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockUser,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockAlerts,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockSubscription,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockNotifications,
        } as Response);

      // Execute workflow
      const { api } = await import('@/lib/api');

      const [user, alerts, subscription, notifications] = await Promise.all([
        api.stackA.getUser(), // CORRECTED: /user/profile
        api.stackA.getAlerts(),
        api.stackA.getSubscription(),
        api.stackA.getNotifications(),
      ]);

      // Verify corrected endpoints were called
      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        '/api/user/profile', // ✅ CORRECTED (was /user)
        expect.objectContaining({ method: 'GET' })
      );

      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        '/api/alerts',
        expect.objectContaining({ method: 'GET' })
      );

      expect(global.fetch).toHaveBeenNthCalledWith(
        3,
        '/api/subscription',
        expect.objectContaining({ method: 'GET' })
      );

      expect(global.fetch).toHaveBeenNthCalledWith(
        4,
        '/api/notifications',
        expect.objectContaining({ method: 'GET' })
      );

      // Verify data
      expect(user).toEqual(mockUser);
      expect(alerts).toEqual(mockAlerts);
      expect(subscription).toEqual(mockSubscription);
      expect(notifications).toEqual(mockNotifications);
    });
  });

  describe('Workflow 2: Alert Creation and Management', () => {
    it('should create, update, and delete alert using Stack A', async () => {
      const newAlert = {
        symbol: 'XAUUSD',
        condition: '>',
        targetPrice: 2050,
        active: true,
      };

      const createdAlert = { id: 'alert-123', ...newAlert };
      const updatedAlert = { ...createdAlert, active: false };

      // Setup mocks
      (global.fetch as jest.MockedFunction<typeof fetch>)
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => createdAlert,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => updatedAlert,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        } as Response);

      // Execute workflow
      const { api } = await import('@/lib/api');

      // 1. Create alert
      const created = await api.stackA.createAlert(newAlert);
      expect(created).toEqual(createdAlert);

      // 2. Update alert
      const updated = await api.stackA.updateAlert(created.id, { active: false });
      expect(updated.active).toBe(false);

      // 3. Delete alert
      await api.stackA.deleteAlert(created.id);

      // Verify all calls
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Workflow 3: User Profile and Settings Update', () => {
    it('should update user profile and preferences using corrected endpoints', async () => {
      const updatedProfile = { name: 'Updated Name' };
      const updatedSettings = { theme: 'dark', notifications: true };

      // Setup mocks
      (global.fetch as jest.MockedFunction<typeof fetch>)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: 'user-123', ...updatedProfile }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => updatedSettings,
        } as Response);

      // Execute workflow
      const { api } = await import('@/lib/api');

      // 1. Update profile
      const profile = await api.stackA.updateUser(updatedProfile);

      // 2. Update settings
      const settings = await api.stackA.updateSettings(updatedSettings);

      // Verify corrected endpoints
      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        '/api/user/profile', // ✅ CORRECTED (was /user)
        expect.objectContaining({ method: 'PATCH' })
      );

      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        '/api/user/preferences', // ✅ CORRECTED (was /settings)
        expect.objectContaining({ method: 'PATCH' })
      );

      expect(profile.name).toBe('Updated Name');
      expect(settings.theme).toBe('dark');
    });
  });

  describe('Workflow 4: Chart Data Fetching', () => {
    it('should fetch chart data using corrected candles endpoint', async () => {
      const symbol = 'XAUUSD';
      const mockCandles = [
        { time: '2024-01-15T10:00:00Z', open: 2050, high: 2055, low: 2048, close: 2053, volume: 1000 },
        { time: '2024-01-15T11:00:00Z', open: 2053, high: 2058, low: 2051, close: 2056, volume: 1200 },
      ];

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockCandles,
      } as Response);

      // Execute workflow
      const { api } = await import('@/lib/api');
      const candles = await api.stackA.getChartData(symbol);

      // Verify corrected endpoint
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/candles/${symbol}`, // ✅ CORRECTED (was /charts/[symbol]/[timeframe])
        expect.objectContaining({ method: 'GET' })
      );

      expect(candles).toEqual(mockCandles);
      expect(candles).toHaveLength(2);
    });
  });

  describe('Workflow 5: Admin Operations', () => {
    it('should fetch admin analytics using corrected endpoint', async () => {
      const mockAnalytics = {
        totalUsers: 150,
        activeSubscriptions: 75,
        revenue: 5000,
        newUsersThisMonth: 25,
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockAnalytics,
      } as Response);

      // Execute workflow
      const { api } = await import('@/lib/api');
      const analytics = await api.stackA.getAdminStats();

      // Verify corrected endpoint
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/analytics', // ✅ CORRECTED (was /admin/stats)
        expect.objectContaining({ method: 'GET' })
      );

      expect(analytics).toEqual(mockAnalytics);
    });
  });

  describe('Workflow 6: Payment and Billing', () => {
    it('should create payment and fetch invoice history using corrected endpoints', async () => {
      const paymentData = {
        amount: 29.99,
        currency: 'USD',
        method: 'card',
      };

      const mockPayment = { id: 'pay-123', ...paymentData, status: 'pending' };
      const mockInvoices = [
        { id: 'inv-1', amount: 29.99, status: 'paid', date: '2024-01-15' },
      ];

      // Setup mocks
      (global.fetch as jest.MockedFunction<typeof fetch>)
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => mockPayment,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockInvoices,
        } as Response);

      // Execute workflow
      const { api } = await import('@/lib/api');

      // 1. Create payment
      const payment = await api.stackA.createPayment(paymentData);

      // 2. Fetch invoice history
      const invoices = await api.stackA.getBillingHistory();

      // Verify corrected endpoints
      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        '/api/payments/dlocal/create', // ✅ CORRECTED (was /payments)
        expect.objectContaining({ method: 'POST' })
      );

      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        '/api/invoices', // ✅ CORRECTED (was /billing/history)
        expect.objectContaining({ method: 'GET' })
      );

      expect(payment).toEqual(mockPayment);
      expect(invoices).toEqual(mockInvoices);
    });
  });

  describe('Workflow 7: Notification Management', () => {
    it('should fetch and mark notifications as read', async () => {
      const mockNotifications = [
        { id: 'notif-1', type: 'alert', message: 'Price alert', read: false },
        { id: 'notif-2', type: 'system', message: 'Welcome', read: false },
      ];

      // Setup mocks
      (global.fetch as jest.MockedFunction<typeof fetch>)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockNotifications,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: 'notif-1', read: true }),
        } as Response);

      // Execute workflow
      const { api } = await import('@/lib/api');

      // 1. Fetch notifications
      const notifications = await api.stackA.getNotifications();
      expect(notifications).toHaveLength(2);

      // 2. Mark first as read
      const updated = await api.stackA.markNotificationAsRead('notif-1');
      expect(updated.read).toBe(true);

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Workflow 8: Stack B Future Features (Should Fail)', () => {
    it('should throw 404 errors for Stack B endpoints (not deployed yet)', async () => {
      // Mock 404 response for Stack B endpoints
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Stack B not deployed' }),
      } as Response);

      const { api } = await import('@/lib/api');

      // All Stack B methods should throw errors
      await expect(api.stackB.getLeaderBoard('H4')).rejects.toThrow();
      await expect(api.stackB.getConfluenceScores('XAUUSD')).rejects.toThrow();
      await expect(api.stackB.getSurveillance()).rejects.toThrow();
      await expect(api.stackB.getAdvancedNotifications({ limit: 10 })).rejects.toThrow();

      // Verify all failed with 404
      expect(global.fetch).toHaveBeenCalledTimes(4);
    });
  });
});
