/**
 * Stack B API Client
 *
 * Handles communication with Backend Stack B (Railway):
 * - Watchlist Management (Part 10)
 * - Alerts System (Part 11)
 * - Notifications & Real-time (Part 15)
 * - Analytics (Parts 20-21)
 * - Confluence Scores (Part 22)
 * - Leader Board (Part 23)
 * - Market Data Gateway (proxies to Stack C)
 *
 * IMPORTANT: Stack B acts as a proxy/gateway to Stack C for market data.
 * Frontend never accesses Stack C directly - all market data requests go through Stack B.
 *
 * Multi-Backend Architecture - Simplified (2 backends)
 */

import { BaseApiClient } from './base-client';
import type { Timeframe } from '@/types/tier';

// ============================================================================
// Types - Watchlist (Part 10)
// ============================================================================

export interface WatchlistItem {
  id: string;
  userId: string;
  symbol: string;
  timeframe: Timeframe;
  order: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWatchlistRequest {
  symbol: string;
  timeframe: Timeframe;
  notes?: string;
}

export interface UpdateWatchlistRequest {
  notes?: string;
  order?: number;
}

export interface ReorderWatchlistRequest {
  items: Array<{ id: string; order: number }>;
}

// ============================================================================
// Types - Alerts (Part 11)
// ============================================================================

export interface Alert {
  id: string;
  userId: string;
  symbol: string;
  timeframe: Timeframe;
  condition: 'above' | 'below' | 'crosses_above' | 'crosses_below';
  targetPrice: number;
  notificationChannels: Array<'email' | 'push' | 'sms'>;
  isActive: boolean;
  triggeredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAlertRequest {
  symbol: string;
  timeframe: Timeframe;
  condition: 'above' | 'below' | 'crosses_above' | 'crosses_below';
  targetPrice: number;
  notificationChannels: Array<'email' | 'push' | 'sms'>;
}

export interface UpdateAlertRequest {
  condition?: 'above' | 'below' | 'crosses_above' | 'crosses_below';
  targetPrice?: number;
  notificationChannels?: Array<'email' | 'push' | 'sms'>;
  isActive?: boolean;
}

export interface AlertHistory {
  id: string;
  alertId: string;
  triggeredAt: string;
  price: number;
  notificationsSent: Array<'email' | 'push' | 'sms'>;
}

// ============================================================================
// Types - Notifications (Part 15)
// ============================================================================

export interface Notification {
  id: string;
  userId: string;
  type: 'alert' | 'system' | 'affiliate' | 'billing';
  title: string;
  message: string;
  isRead: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
  alertNotifications: boolean;
  systemNotifications: boolean;
  affiliateNotifications: boolean;
  billingNotifications: boolean;
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// ============================================================================
// Types - Confluence & Analytics (Parts 22-23)
// ============================================================================

export interface ConfluenceScore {
  symbol: string;
  timeframe: Timeframe;
  score: number;
  components: {
    horizontalSupport: number;
    horizontalResistance: number;
    diagonalSupport: number;
    diagonalResistance: number;
    fractals: number;
  };
  calculatedAt: string;
}

export interface LeaderBoardEntry {
  rank: number;
  symbol: string;
  timeframe: Timeframe;
  confluenceScore: number;
  volatility: number;
  momentum: number;
  volume: number;
}

// ============================================================================
// Types - Market Data (Proxied from Stack C)
// ============================================================================

export interface OHLCBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface HorizontalTrendlines {
  peak_1: Array<{ time: number; price: number }>;
  peak_2: Array<{ time: number; price: number }>;
  peak_3: Array<{ time: number; price: number }>;
  bottom_1: Array<{ time: number; price: number }>;
  bottom_2: Array<{ time: number; price: number }>;
  bottom_3: Array<{ time: number; price: number }>;
}

export interface DiagonalTrendlines {
  ascending_1: Array<{
    start_time: number;
    end_time: number;
    start_price: number;
    end_price: number;
  }>;
  ascending_2: Array<{
    start_time: number;
    end_time: number;
    start_price: number;
    end_price: number;
  }>;
  ascending_3: Array<{
    start_time: number;
    end_time: number;
    start_price: number;
    end_price: number;
  }>;
  descending_1: Array<{
    start_time: number;
    end_time: number;
    start_price: number;
    end_price: number;
  }>;
  descending_2: Array<{
    start_time: number;
    end_time: number;
    start_price: number;
    end_price: number;
  }>;
  descending_3: Array<{
    start_time: number;
    end_time: number;
    start_price: number;
    end_price: number;
  }>;
}

export interface FractalsData {
  peaks: Array<{ time: number; price: number }>;
  bottoms: Array<{ time: number; price: number }>;
}

export interface IndicatorData {
  ohlc: OHLCBar[];
  horizontal: HorizontalTrendlines;
  diagonal: DiagonalTrendlines;
  fractals: FractalsData;
  metadata: {
    symbol: string;
    timeframe: Timeframe;
    bars_returned: number;
  };
}

// ============================================================================
// Stack B Client Class
// ============================================================================

export class StackBClient extends BaseApiClient {
  constructor() {
    const baseURL = process.env['NEXT_PUBLIC_API_B_URL'] || '/api';
    super(baseURL);
  }

  // ==========================================================================
  // WATCHLIST (Part 10)
  // ==========================================================================

  /**
   * Get user's watchlist
   */
  async getWatchlist(params?: {
    sort?: 'createdAt' | 'symbol' | 'timeframe';
  }): Promise<{ watchlist: WatchlistItem[] }> {
    return this.get('/watchlist', params);
  }

  /**
   * Add item to watchlist
   */
  async addToWatchlist(data: CreateWatchlistRequest): Promise<WatchlistItem> {
    return this.post<WatchlistItem>('/watchlist', data);
  }

  /**
   * Update watchlist item
   */
  async updateWatchlistItem(
    id: string,
    data: UpdateWatchlistRequest
  ): Promise<WatchlistItem> {
    return this.patch<WatchlistItem>(`/watchlist/${id}`, data);
  }

  /**
   * Remove item from watchlist
   */
  async removeFromWatchlist(id: string): Promise<{ success: boolean }> {
    return this.delete<{ success: boolean }>(`/watchlist/${id}`);
  }

  /**
   * Reorder watchlist items
   */
  async reorderWatchlist(data: ReorderWatchlistRequest): Promise<{ success: boolean }> {
    return this.post<{ success: boolean }>('/watchlist/reorder', data);
  }

  /**
   * Bulk add to watchlist
   */
  async bulkAddToWatchlist(
    items: CreateWatchlistRequest[]
  ): Promise<{ added: WatchlistItem[]; failed: string[] }> {
    return this.post('/watchlist/bulk', { items });
  }

  // ==========================================================================
  // ALERTS (Part 11)
  // ==========================================================================

  /**
   * Get user's alerts
   */
  async getAlerts(params?: {
    symbol?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ alerts: Alert[]; pagination: unknown }> {
    return this.get('/alerts', params);
  }

  /**
   * Create alert
   */
  async createAlert(data: CreateAlertRequest): Promise<Alert> {
    return this.post<Alert>('/alerts', data);
  }

  /**
   * Update alert
   */
  async updateAlert(id: string, data: UpdateAlertRequest): Promise<Alert> {
    return this.patch<Alert>(`/alerts/${id}`, data);
  }

  /**
   * Delete alert
   */
  async deleteAlert(id: string): Promise<{ success: boolean }> {
    return this.delete<{ success: boolean }>(`/alerts/${id}`);
  }

  /**
   * Get alert history
   */
  async getAlertHistory(
    alertId: string,
    params?: { page?: number; limit?: number }
  ): Promise<{ history: AlertHistory[]; pagination: unknown }> {
    return this.get(`/alerts/${alertId}/history`, params);
  }

  // ==========================================================================
  // NOTIFICATIONS (Part 15)
  // ==========================================================================

  /**
   * Get notifications
   */
  async getNotifications(params?: {
    type?: string;
    isRead?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ notifications: Notification[]; pagination: unknown }> {
    return this.get('/notifications', params);
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(id: string): Promise<Notification> {
    return this.patch<Notification>(`/notifications/${id}/read`);
  }

  /**
   * Mark all notifications as read
   */
  async markAllNotificationsAsRead(): Promise<{ success: boolean }> {
    return this.post<{ success: boolean }>('/notifications/mark-all-read');
  }

  /**
   * Delete notification
   */
  async deleteNotification(id: string): Promise<{ success: boolean }> {
    return this.delete<{ success: boolean }>(`/notifications/${id}`);
  }

  /**
   * Get notification preferences
   */
  async getNotificationPreferences(): Promise<NotificationPreferences> {
    return this.get<NotificationPreferences>('/notifications/preferences');
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(
    data: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    return this.patch<NotificationPreferences>('/notifications/preferences', data);
  }

  /**
   * Subscribe to push notifications
   */
  async subscribeToPushNotifications(
    subscription: PushSubscription
  ): Promise<{ success: boolean }> {
    return this.post<{ success: boolean }>('/notifications/push/subscribe', subscription);
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribeFromPushNotifications(): Promise<{ success: boolean }> {
    return this.post<{ success: boolean }>('/notifications/push/unsubscribe');
  }

  // ==========================================================================
  // CONFLUENCE & LEADER BOARD (Parts 22-23)
  // ==========================================================================

  /**
   * Get confluence scores for a symbol
   */
  async getConfluenceScore(
    symbol: string,
    timeframe?: Timeframe
  ): Promise<ConfluenceScore[]> {
    const endpoint = timeframe
      ? `/confluence/${symbol}/${timeframe}`
      : `/confluence/${symbol}`;
    return this.get<ConfluenceScore[]>(endpoint);
  }

  /**
   * Get leader board
   */
  async getLeaderBoard(params?: {
    timeframe?: Timeframe;
    metric?: 'confluence' | 'volatility' | 'momentum' | 'volume';
    limit?: number;
  }): Promise<{ leaderboard: LeaderBoardEntry[] }> {
    return this.get('/leaderboard', params);
  }

  /**
   * Get leader board for specific timeframe
   */
  async getLeaderBoardByTimeframe(
    timeframe: Timeframe,
    params?: {
      metric?: 'confluence' | 'volatility' | 'momentum' | 'volume';
      limit?: number;
    }
  ): Promise<{ leaderboard: LeaderBoardEntry[] }> {
    return this.get(`/leaderboard/${timeframe}`, params);
  }

  // ==========================================================================
  // MARKET DATA (Proxied from Stack C)
  // ==========================================================================
  // IMPORTANT: These methods call Stack B, which proxies to Stack C.
  // Frontend never accesses Stack C directly for security and simplicity.
  // ==========================================================================

  /**
   * Get candles (OHLC data) - Proxied from Stack C
   *
   * Stack B will:
   * 1. Validate user's tier access to symbol/timeframe
   * 2. Check cache (Redis) for recent data
   * 3. If not cached, fetch from Stack C
   * 4. Cache result for 1 minute
   * 5. Return to frontend
   */
  async getCandles(
    symbol: string,
    timeframe: Timeframe,
    params?: {
      startTime?: number;
      endTime?: number;
      limit?: number;
    }
  ): Promise<OHLCBar[]> {
    return this.get<OHLCBar[]>(`/candles/${symbol}/${timeframe}`, params);
  }

  /**
   * Get indicators (trendlines + fractals) - Proxied from Stack C
   *
   * Stack B will:
   * 1. Validate tier access
   * 2. Fetch from Stack C
   * 3. Add confluence scores (from Parts 22-23)
   * 4. Cache result
   * 5. Return enriched data
   */
  async getIndicators(
    symbol: string,
    timeframe: Timeframe,
    params?: {
      bars?: number;
    }
  ): Promise<IndicatorData> {
    return this.get<IndicatorData>(`/indicators/${symbol}/${timeframe}`, params);
  }

  /**
   * Get available symbols - Proxied from Stack C
   *
   * Stack B will:
   * 1. Fetch from Stack C
   * 2. Filter by user's tier
   * 3. Cache result
   * 4. Return filtered symbols
   */
  async getSymbols(): Promise<{ symbols: string[] }> {
    return this.get<{ symbols: string[] }>('/symbols');
  }

  /**
   * Get available timeframes - Proxied from Stack C
   *
   * Stack B will:
   * 1. Fetch from Stack C
   * 2. Filter by user's tier
   * 3. Cache result
   * 4. Return filtered timeframes
   */
  async getTimeframes(): Promise<{ timeframes: Timeframe[] }> {
    return this.get<{ timeframes: Timeframe[] }>('/timeframes');
  }

  /**
   * Get market data health status - Proxied from Stack C
   */
  async getMarketDataHealth(): Promise<{
    status: 'ok' | 'degraded' | 'error';
    message?: string;
  }> {
    return this.get('/market-data/health');
  }
}
