/**
 * Multi-Stack API Client
 *
 * Provides unified access to both Stack A and Stack B microservices
 * following the architecture defined in MULTI-BACKEND-SYNC-STRATEGY.md
 *
 * Stack A (Railway) - Parts 2-19:
 *   - Database A, Types, Tier System
 *   - Flask MT5 Service, OHLCV data API
 *   - Dashboard, Charts, Watchlist, Alerts
 *   - E-commerce, Settings, Admin Dashboard
 *   - Basic Notifications, Utilities
 *   - Affiliate Marketing, dLocal Payments, Riseworks Disbursements
 *
 * Stack B (Railway) - Parts 20-26:
 *   - Database B, Message Broker
 *   - Market Data Collection (via Redis Queue)
 *   - Confluence Scores, Leader Board
 *   - Surveillance, Advance Notifications & Real-time
 *
 * Usage:
 * ```typescript
 * import { api } from '@/lib/api';
 *
 * // Stack A operations
 * const alerts = await api.stackA.getAlerts();
 * const watchlist = await api.stackA.getWatchlist();
 *
 * // Stack B operations
 * const leaderboard = await api.stackB.getLeaderBoard('H4');
 * const surveillance = await api.stackB.getSurveillance();
 *
 * // Real-time notifications (Stack B)
 * api.stackB.subscribeToNotifications((notification) => {
 *   console.log('New notification:', notification);
 * });
 *
 * // Parallel requests to both stacks
 * const [alerts, leaderboard] = await Promise.all([
 *   api.stackA.getAlerts(),
 *   api.stackB.getLeaderBoard('H4')
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
  async getDashboard() {
    return this.get('/dashboard');
  }

  // ===== Charts (Part 9) =====
  async getChartData(symbol: string, timeframe: string) {
    return this.get(`/charts/${symbol}/${timeframe}`);
  }

  // ===== User Profile =====
  async getUser() {
    return this.get('/user');
  }

  async updateUser(data: any) {
    return this.patch('/user', data);
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
    return this.get('/admin/stats');
  }

  async getAffiliates(params?: any) {
    const query = params ? `?${new URLSearchParams(params)}` : '';
    return this.get(`/admin/affiliates${query}`);
  }

  // ===== E-commerce & Billing (Part 12) =====
  async getBillingHistory() {
    return this.get('/billing/history');
  }

  async createPayment(data: any) {
    return this.post('/payments', data);
  }

  // ===== Settings (Part 13) =====
  async getSettings() {
    return this.get('/settings');
  }

  async updateSettings(data: any) {
    return this.patch('/settings', data);
  }
}

/**
 * Stack B Client - Analytics & Real-time (Parts 20-26)
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
  async getMarketData(symbol: string) {
    return this.get(`/market-data/${symbol}`);
  }

  async getOHLCV(symbol: string, timeframe: string, params?: any) {
    const query = params ? `?${new URLSearchParams(params)}` : '';
    return this.get(`/market-data/${symbol}/${timeframe}${query}`);
  }

  // ===== Confluence Scores (Part 22) =====
  async getConfluenceScores(symbol: string) {
    return this.get(`/confluence/${symbol}`);
  }

  async getConfluenceHistory(symbol: string, timeframe: string) {
    return this.get(`/confluence/${symbol}/${timeframe}/history`);
  }

  // ===== Leader Board (Part 23) =====
  async getLeaderBoard(timeframe: string) {
    return this.get(`/leaderboard/${timeframe}`);
  }

  async getTopSymbols(limit: number = 10) {
    return this.get(`/leaderboard/symbols?limit=${limit}`);
  }

  async getTopTimeframes(limit: number = 10) {
    return this.get(`/leaderboard/timeframes?limit=${limit}`);
  }

  // ===== Surveillance (Part 24) =====
  async getSurveillance() {
    return this.get('/surveillance');
  }

  async getSymbolsSurveillance() {
    return this.get('/surveillance/symbols');
  }

  async getTimeframesSurveillance() {
    return this.get('/surveillance/timeframes');
  }

  // ===== Advance Notifications & Real-time (Part 26) =====
  async getAdvancedNotifications(params?: any) {
    const query = params ? `?${new URLSearchParams(params)}` : '';
    return this.get(`/notifications/advanced${query}`);
  }

  /**
   * Subscribe to real-time notifications via WebSocket
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
   */
  createNotificationsStream(): EventSource {
    return this.createEventSource('/notifications/stream');
  }

  // ===== Job Queue Status (Part 21 - Message Broker) =====
  async getQueueStatus() {
    return this.get('/queue/status');
  }

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

// Export individual clients for direct access
export { StackAClient, StackBClient };

// Export default
export default api;
