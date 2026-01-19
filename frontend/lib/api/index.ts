/**
 * Multi-Stack API Client
 *
 * Provides unified access to both Stack A and Stack B microservices
 * following the architecture defined in MULTI-BACKEND-SYNC-STRATEGY.md
 *
 * ✅ Stack A (Railway) - Parts 2-19 - AVAILABLE NOW:
 *   - Database A, Types, Tier System
 *   - Flask MT5 Service (via Stack C → Redis → Workers)
 *   - Watchlist, Alerts, User Management
 *   - E-commerce, Subscription, Admin Dashboard
 *   - Basic Notifications, Utilities
 *   - Affiliate Marketing, dLocal Payments, Riseworks Disbursements
 *
 * ⚠️ Stack B (Railway) - Parts 20-26 - FUTURE DEPLOYMENT:
 *   - Database B, Message Broker
 *   - Market Data Collection (via Redis Queue)
 *   - Confluence Scores, Leader Board
 *   - Surveillance, Advanced Notifications & Real-time
 *
 * Usage:
 * ```typescript
 * import { api } from '@/lib/api';
 *
 * // ✅ Stack A operations (AVAILABLE NOW)
 * const alerts = await api.stackA.getAlerts();
 * const watchlist = await api.stackA.getWatchlist();
 * const user = await api.stackA.getUser();
 *
 * // ⚠️ Stack B operations (FUTURE - Will throw 404 errors)
 * // const leaderboard = await api.stackB.getLeaderBoard('H4'); // Not yet available
 * // const surveillance = await api.stackB.getSurveillance(); // Not yet available
 *
 * // Stack A methods work in production:
 * const [alerts, watchlist, subscription] = await Promise.all([
 *   api.stackA.getAlerts(),
 *   api.stackA.getWatchlist(),
 *   api.stackA.getSubscription()
 * ]);
 * ```
 */

import ApiClient from '../api-client';

/**
 * Stack A Client - Main CRUD operations (Parts 2-19)
 */
export class StackAClient extends ApiClient {
  constructor() {
    super({
      baseURL: process.env['NEXT_PUBLIC_API_A_URL'] || '/api',
      timeout: 30000,
      retry: {
        maxRetries: 3,
        retryDelay: 1000,
        retryOn: [429, 503, 504],
        backoff: 'exponential',
      },
    });
  }

  // ===== Alerts (Part 11) =====
  async getAlerts() {
    return this.get('/alerts');
  }

  async createAlert(data: any) {
    return this.post('/alerts', data);
  }

  async updateAlert(id: string, data: any) {
    return this.put(`/alerts/${id}`, data);
  }

  async deleteAlert(id: string) {
    return this.delete(`/alerts/${id}`);
  }

  // ===== Watchlist (Part 10) =====
  async getWatchlist() {
    return this.get('/watchlist');
  }

  async addToWatchlist(data: any) {
    return this.post('/watchlist', data);
  }

  async removeFromWatchlist(id: string) {
    return this.delete(`/watchlist/${id}`);
  }

  // ===== Dashboard (Part 8) =====
  // Note: Generic dashboard endpoint not yet implemented
  // Use specific endpoints (alerts, watchlist, subscription) instead

  // ===== Charts (Part 9) =====
  async getChartData(symbol: string) {
    return this.get(`/candles/${symbol}`);
  }

  // ===== User Profile =====
  async getUser() {
    return this.get('/user/profile');
  }

  async updateUser(data: any) {
    return this.patch('/user/profile', data);
  }

  // ===== Subscription (Part 4 - Tier System) =====
  async getSubscription() {
    return this.get('/subscription');
  }

  async updateSubscription(data: any) {
    return this.post('/subscription', data);
  }

  // ===== Notifications (Basic - Part 15) =====
  async getNotifications() {
    return this.get('/notifications');
  }

  async markNotificationAsRead(id: string) {
    return this.patch(`/notifications/${id}`, { read: true });
  }

  // ===== Admin Operations (Part 14) =====
  async getAdminStats() {
    return this.get('/admin/analytics');
  }

  async getAffiliates(params?: any) {
    const query = params ? `?${new URLSearchParams(params)}` : '';
    return this.get(`/admin/affiliates${query}`);
  }

  // ===== E-commerce & Billing (Part 12) =====
  async getBillingHistory() {
    return this.get('/invoices');
  }

  async createPayment(data: any) {
    return this.post('/payments/dlocal/create', data);
  }

  // ===== Settings (Part 13) =====
  async getSettings() {
    return this.get('/user/preferences');
  }

  async updateSettings(data: any) {
    return this.patch('/user/preferences', data);
  }
}

/**
 * Stack B Client - Analytics & Real-time (Parts 20-26)
 *
 * ⚠️ IMPORTANT: Stack B is NOT YET DEPLOYED
 *
 * This client is prepared for future Stack B deployment (Parts 20-26).
 * All methods below will throw errors until Stack B microservices are deployed.
 *
 * Stack B includes:
 * - Part 21: Market Data Collection (Redis Job Queue)
 * - Part 22: Confluence Scores
 * - Part 23: Leader Board
 * - Part 24: Surveillance
 * - Part 26: Advanced Notifications & Real-time
 *
 * Current Status: FUTURE - Endpoints not available yet
 */
export class StackBClient extends ApiClient {
  constructor() {
    super({
      baseURL: process.env['NEXT_PUBLIC_API_B_URL'] || process.env['NEXT_PUBLIC_API_A_URL'] || '/api',
      timeout: 30000,
      retry: {
        maxRetries: 3,
        retryDelay: 1000,
        retryOn: [429, 503, 504],
        backoff: 'exponential',
      },
    });
  }

  // ===== Market Data Broker (Part 21) =====
  /**
   * ⚠️ FUTURE: Stack B not deployed yet
   * @throws {ApiError} 404 - Endpoint not available until Stack B deployment
   */
  async getMarketData(symbol: string) {
    return this.get(`/market-data/${symbol}`);
  }

  /**
   * ⚠️ FUTURE: Stack B not deployed yet
   * @throws {ApiError} 404 - Endpoint not available until Stack B deployment
   */
  async getOHLCV(symbol: string, timeframe: string, params?: any) {
    const query = params ? `?${new URLSearchParams(params)}` : '';
    return this.get(`/market-data/${symbol}/${timeframe}${query}`);
  }

  // ===== Confluence Scores (Part 22) =====
  /**
   * ⚠️ FUTURE: Stack B not deployed yet
   * Part 20 (confluence endpoints) was deleted and will be reimplemented in Stack B
   * @throws {ApiError} 404 - Endpoint not available until Stack B deployment
   */
  async getConfluenceScores(symbol: string) {
    return this.get(`/confluence/${symbol}`);
  }

  /**
   * ⚠️ FUTURE: Stack B not deployed yet
   * Part 20 (confluence endpoints) was deleted and will be reimplemented in Stack B
   * @throws {ApiError} 404 - Endpoint not available until Stack B deployment
   */
  async getConfluenceHistory(symbol: string, timeframe: string) {
    return this.get(`/confluence/${symbol}/${timeframe}/history`);
  }

  // ===== Leader Board (Part 23) =====
  /**
   * ⚠️ FUTURE: Stack B not deployed yet
   * @throws {ApiError} 404 - Endpoint not available until Stack B deployment
   */
  async getLeaderBoard(timeframe: string) {
    return this.get(`/leaderboard/${timeframe}`);
  }

  /**
   * ⚠️ FUTURE: Stack B not deployed yet
   * @throws {ApiError} 404 - Endpoint not available until Stack B deployment
   */
  async getTopSymbols(limit: number = 10) {
    return this.get(`/leaderboard/symbols?limit=${limit}`);
  }

  /**
   * ⚠️ FUTURE: Stack B not deployed yet
   * @throws {ApiError} 404 - Endpoint not available until Stack B deployment
   */
  async getTopTimeframes(limit: number = 10) {
    return this.get(`/leaderboard/timeframes?limit=${limit}`);
  }

  // ===== Surveillance (Part 24) =====
  /**
   * ⚠️ FUTURE: Stack B not deployed yet
   * @throws {ApiError} 404 - Endpoint not available until Stack B deployment
   */
  async getSurveillance() {
    return this.get('/surveillance');
  }

  /**
   * ⚠️ FUTURE: Stack B not deployed yet
   * @throws {ApiError} 404 - Endpoint not available until Stack B deployment
   */
  async getSymbolsSurveillance() {
    return this.get('/surveillance/symbols');
  }

  /**
   * ⚠️ FUTURE: Stack B not deployed yet
   * @throws {ApiError} 404 - Endpoint not available until Stack B deployment
   */
  async getTimeframesSurveillance() {
    return this.get('/surveillance/timeframes');
  }

  // ===== Advance Notifications & Real-time (Part 26) =====
  /**
   * ⚠️ FUTURE: Stack B not deployed yet
   * @throws {ApiError} 404 - Endpoint not available until Stack B deployment
   */
  async getAdvancedNotifications(params?: any) {
    const query = params ? `?${new URLSearchParams(params)}` : '';
    return this.get(`/notifications/advanced${query}`);
  }

  /**
   * Subscribe to real-time notifications via WebSocket
   *
   * ⚠️ FUTURE: Stack B not deployed yet
   * @throws {Error} WebSocket connection will fail until Stack B deployment
   */
  subscribeToNotifications(
    onMessage: (notification: any) => void,
    options?: {
      onError?: (error: Event) => void;
      onClose?: (event: CloseEvent) => void;
      reconnect?: boolean;
    }
  ): () => void {
    return this.subscribe('/notifications/ws', onMessage, {
      reconnect: true,
      ...options,
    });
  }

  /**
   * Subscribe to real-time market data updates via WebSocket
   *
   * ⚠️ FUTURE: Stack B not deployed yet
   * @throws {Error} WebSocket connection will fail until Stack B deployment
   */
  subscribeToMarketData(
    symbol: string,
    onMessage: (data: any) => void,
    options?: {
      onError?: (error: Event) => void;
      onClose?: (event: CloseEvent) => void;
      reconnect?: boolean;
    }
  ): () => void {
    return this.subscribe(`/market-data/${symbol}/ws`, onMessage, {
      reconnect: true,
      ...options,
    });
  }

  /**
   * Subscribe to leaderboard updates via WebSocket
   *
   * ⚠️ FUTURE: Stack B not deployed yet
   * @throws {Error} WebSocket connection will fail until Stack B deployment
   */
  subscribeToLeaderBoard(
    timeframe: string,
    onMessage: (data: any) => void,
    options?: {
      onError?: (error: Event) => void;
      onClose?: (event: CloseEvent) => void;
      reconnect?: boolean;
    }
  ): () => void {
    return this.subscribe(`/leaderboard/${timeframe}/ws`, onMessage, {
      reconnect: true,
      ...options,
    });
  }

  /**
   * Create Server-Sent Events (SSE) connection for live updates
   *
   * ⚠️ FUTURE: Stack B not deployed yet
   * @throws {Error} SSE connection will fail until Stack B deployment
   */
  createNotificationsStream(): EventSource {
    return this.createEventSource('/notifications/stream');
  }

  // ===== Job Queue Status (Part 21 - Message Broker) =====
  /**
   * ⚠️ FUTURE: Stack B not deployed yet
   * @throws {ApiError} 404 - Endpoint not available until Stack B deployment
   */
  async getQueueStatus() {
    return this.get('/queue/status');
  }

  /**
   * ⚠️ FUTURE: Stack B not deployed yet
   * @throws {ApiError} 404 - Endpoint not available until Stack B deployment
   */
  async getQueueJobs(status: 'waiting' | 'active' | 'completed' | 'failed') {
    return this.get(`/queue/jobs?status=${status}`);
  }
}

/**
 * Unified API interface
 */
export class MultiStackAPI {
  public stackA: StackAClient;
  public stackB: StackBClient;

  constructor() {
    this.stackA = new StackAClient();
    this.stackB = new StackBClient();
  }

  /**
   * Disconnect all WebSocket connections
   */
  disconnectAll(): void {
    this.stackA.disconnectAll();
    this.stackB.disconnectAll();
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      stackA: {
        baseURL: this.stackA.getBaseURL(),
        isExternal: this.stackA.isExternalAPI(),
      },
      stackB: {
        baseURL: this.stackB.getBaseURL(),
        isExternal: this.stackB.isExternalAPI(),
      },
    };
  }
}

// Export singleton instance
export const api = new MultiStackAPI();

// Export default
export default api;
