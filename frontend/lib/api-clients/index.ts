/**
 * Unified API Client Export
 *
 * Multi-Backend Architecture - Simplified (2 backends)
 *
 * This is the main entry point for all API communication.
 * Components should import from this file:
 *
 * ```typescript
 * import { api } from '@/lib/api-clients';
 *
 * // Stack A: User, Auth, Billing, Admin, Affiliate, Payments
 * const user = await api.stackA.getCurrentUser();
 * const subscription = await api.stackA.getSubscription();
 *
 * // Stack B: Watchlist, Alerts, Notifications, Analytics, Market Data (proxied)
 * const watchlist = await api.stackB.getWatchlist();
 * const candles = await api.stackB.getCandles('EURUSD', 'H1');
 * ```
 *
 * IMPORTANT: No Stack C client!
 * - Frontend only needs 2 clients (Stack A and Stack B)
 * - Stack B proxies market data requests to Stack C
 * - Frontend never accesses Stack C directly
 *
 * Benefits:
 * - Simpler architecture (~35% less complexity)
 * - Only 2 environment variables needed
 * - Only 2 CORS configurations
 * - Stack C not exposed to internet (more secure)
 * - Stack B adds caching layer for market data
 */

// ============================================================================
// Client Imports
// ============================================================================

import { StackAClient } from './stack-a-client';
import { StackBClient } from './stack-b-client';

// ============================================================================
// Re-export Types
// ============================================================================

// Base Client
export * from './base-client';

// Stack A Types
export type {
  User,
  UserProfile,
  UpdateProfileRequest,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  RefreshTokenRequest,
  ChangePasswordRequest,
  ResetPasswordRequest,
  Subscription,
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
  Invoice,
  PaymentMethod,
  AdminStats,
  AdminUser,
  UpdateUserRequest,
  Affiliate,
  AffiliateStats,
  Referral,
} from './stack-a-client';

// Stack B Types
export type {
  WatchlistItem,
  CreateWatchlistRequest,
  UpdateWatchlistRequest,
  ReorderWatchlistRequest,
  Alert,
  CreateAlertRequest,
  UpdateAlertRequest,
  AlertHistory,
  Notification,
  NotificationPreferences,
  PushSubscription,
  ConfluenceScore,
  LeaderBoardEntry,
  OHLCBar,
  HorizontalTrendlines,
  DiagonalTrendlines,
  FractalsData,
  IndicatorData,
} from './stack-b-client';

// ============================================================================
// Unified API Client
// ============================================================================

/**
 * Unified API client for all backend communication
 *
 * Only 2 clients needed:
 * - stackA: User, Auth, Billing, Admin, Affiliate, Payments
 * - stackB: Watchlist, Alerts, Notifications, Analytics, Market Data (proxied to Stack C)
 */
export const api = {
  /**
   * Stack A Client (Railway)
   *
   * Handles:
   * - User Management (Part 2)
   * - Authentication (Part 3)
   * - Subscription & Billing (Parts 4-6)
   * - Admin Portal (Parts 12-14)
   * - Affiliate System (Part 17)
   * - Payment Integration (Part 19)
   */
  stackA: new StackAClient(),

  /**
   * Stack B Client (Railway)
   *
   * Handles:
   * - Watchlist Management (Part 10)
   * - Alerts System (Part 11)
   * - Notifications & Real-time (Part 15)
   * - Analytics (Parts 20-21)
   * - Confluence Scores (Part 22)
   * - Leader Board (Part 23)
   * - Market Data Gateway (proxies to Stack C)
   *
   * IMPORTANT: Market data requests (candles, indicators, symbols, timeframes)
   * go through Stack B, which proxies to Stack C. Frontend never accesses Stack C directly.
   */
  stackB: new StackBClient(),

  // No stackC client - Stack B proxies market data requests to Stack C!
};

// ============================================================================
// Convenience Re-exports
// ============================================================================

/**
 * Direct access to Stack A client
 */
export const stackA = api.stackA;

/**
 * Direct access to Stack B client
 */
export const stackB = api.stackB;

// ============================================================================
// Type Exports
// ============================================================================

export type { StackAClient } from './stack-a-client';
export type { StackBClient } from './stack-b-client';

// ============================================================================
// Usage Examples
// ============================================================================

/**
 * @example
 * // Import the unified API client
 * import { api } from '@/lib/api-clients';
 *
 * // Stack A: User management
 * const user = await api.stackA.getCurrentUser();
 * const profile = await api.stackA.getUserProfile();
 *
 * // Stack A: Authentication
 * const authResponse = await api.stackA.login({ email, password });
 *
 * // Stack A: Subscription
 * const subscription = await api.stackA.getSubscription();
 * await api.stackA.updateSubscription({ priceId: 'price_pro' });
 *
 * // Stack A: Admin
 * const stats = await api.stackA.getAdminStats();
 * const users = await api.stackA.getAdminUsers({ page: 1, limit: 20 });
 *
 * // Stack B: Watchlist
 * const watchlist = await api.stackB.getWatchlist();
 * await api.stackB.addToWatchlist({ symbol: 'EURUSD', timeframe: 'H1' });
 *
 * // Stack B: Alerts
 * const alerts = await api.stackB.getAlerts();
 * await api.stackB.createAlert({
 *   symbol: 'EURUSD',
 *   timeframe: 'H1',
 *   condition: 'above',
 *   targetPrice: 1.1000,
 *   notificationChannels: ['email', 'push'],
 * });
 *
 * // Stack B: Market Data (proxied to Stack C)
 * const candles = await api.stackB.getCandles('EURUSD', 'H1', { limit: 1000 });
 * const indicators = await api.stackB.getIndicators('EURUSD', 'H1');
 * const symbols = await api.stackB.getSymbols();
 * const confluenceScores = await api.stackB.getConfluenceScore('EURUSD', 'H1');
 *
 * // Stack B: Leader Board
 * const leaderboard = await api.stackB.getLeaderBoard({ timeframe: 'H1' });
 */
