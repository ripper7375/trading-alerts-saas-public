/**
 * Stack A API Client
 *
 * Handles communication with Backend Stack A (Railway):
 * - User Management (Part 2)
 * - Authentication (Part 3)
 * - Subscription & Billing (Parts 4-6)
 * - Admin Portal (Parts 12-14)
 * - Affiliate System (Part 17)
 * - Payment Integration (Part 19)
 * - Market Data Gateway (proxies to Stack C - MT5 Python API)
 *
 * IMPORTANT: Both Stack A and Stack B can access Stack C for market data.
 * Stack A fetches from Stack C, caches in Redis, and adds analytics.
 *
 * Multi-Backend Architecture - Simplified (2 backends)
 */

import { BaseApiClient } from './base-client';
import type { Timeframe } from '@/types/tier';

// ============================================================================
// Types - User & Profile
// ============================================================================

export interface User {
  id: string;
  email: string;
  name: string;
  tier: 'Free' | 'Pro' | 'Premium';
  status: 'active' | 'suspended' | 'deleted';
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  userId: string;
  displayName?: string;
  avatar?: string;
  timezone?: string;
  language?: string;
  preferences: Record<string, unknown>;
}

export interface UpdateProfileRequest {
  displayName?: string;
  avatar?: string;
  timezone?: string;
  language?: string;
  preferences?: Record<string, unknown>;
}

// ============================================================================
// Types - Authentication
// ============================================================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

// ============================================================================
// Types - Subscription & Billing
// ============================================================================

export interface Subscription {
  id: string;
  userId: string;
  tier: 'Free' | 'Pro' | 'Premium';
  status: 'active' | 'past_due' | 'canceled' | 'incomplete';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
}

export interface CreateSubscriptionRequest {
  priceId: string;
  paymentMethodId: string;
}

export interface UpdateSubscriptionRequest {
  priceId: string;
}

export interface Invoice {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  invoiceUrl?: string;
  pdfUrl?: string;
  createdAt: string;
}

export interface PaymentMethod {
  id: string;
  type: 'card';
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  isDefault: boolean;
}

// ============================================================================
// Types - Admin
// ============================================================================

export interface AdminStats {
  totalUsers: number;
  activeSubscriptions: number;
  monthlyRevenue: number;
  newUsersThisMonth: number;
}

export interface AdminUser extends User {
  subscriptions: Subscription[];
  invoices: Invoice[];
}

export interface UpdateUserRequest {
  tier?: 'Free' | 'Pro' | 'Premium';
  status?: 'active' | 'suspended' | 'deleted';
}

// ============================================================================
// Types - Affiliate
// ============================================================================

export interface Affiliate {
  id: string;
  userId: string;
  code: string;
  commissionRate: number;
  totalEarnings: number;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface AffiliateStats {
  totalReferrals: number;
  activeReferrals: number;
  totalEarnings: number;
  pendingEarnings: number;
}

export interface Referral {
  id: string;
  affiliateId: string;
  referredUserId: string;
  status: 'pending' | 'active' | 'inactive';
  earnings: number;
  createdAt: string;
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
// Stack A Client Class
// ============================================================================

export class StackAClient extends BaseApiClient {
  constructor() {
    const baseURL = process.env['NEXT_PUBLIC_API_A_URL'] || '/api';
    super(baseURL);
  }

  // ==========================================================================
  // USER & PROFILE MANAGEMENT (Part 2)
  // ==========================================================================

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User> {
    return this.get<User>('/users/me');
  }

  /**
   * Get user profile
   */
  async getUserProfile(): Promise<UserProfile> {
    return this.get<UserProfile>('/users/me/profile');
  }

  /**
   * Update user profile
   */
  async updateUserProfile(data: UpdateProfileRequest): Promise<UserProfile> {
    return this.patch<UserProfile>('/users/me/profile', data);
  }

  /**
   * Delete user account
   */
  async deleteAccount(): Promise<{ success: boolean }> {
    return this.delete<{ success: boolean }>('/users/me');
  }

  // ==========================================================================
  // AUTHENTICATION (Part 3)
  // ==========================================================================

  /**
   * Login
   */
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    return this.post<AuthResponse>('/auth/login', credentials);
  }

  /**
   * Register
   */
  async register(data: RegisterRequest): Promise<AuthResponse> {
    return this.post<AuthResponse>('/auth/register', data);
  }

  /**
   * Logout
   */
  async logout(): Promise<{ success: boolean }> {
    return this.post<{ success: boolean }>('/auth/logout');
  }

  /**
   * Refresh access token
   */
  async refreshToken(data: RefreshTokenRequest): Promise<AuthResponse> {
    return this.post<AuthResponse>('/auth/refresh', data);
  }

  /**
   * Change password
   */
  async changePassword(data: ChangePasswordRequest): Promise<{ success: boolean }> {
    return this.post<{ success: boolean }>('/auth/change-password', data);
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<{ success: boolean }> {
    return this.post<{ success: boolean }>('/auth/forgot-password', { email });
  }

  /**
   * Reset password with token
   */
  async resetPassword(data: ResetPasswordRequest): Promise<{ success: boolean }> {
    return this.post<{ success: boolean }>('/auth/reset-password', data);
  }

  // ==========================================================================
  // SUBSCRIPTION & BILLING (Parts 4-6)
  // ==========================================================================

  /**
   * Get current subscription
   */
  async getSubscription(): Promise<Subscription | null> {
    return this.get<Subscription | null>('/subscriptions/me');
  }

  /**
   * Create subscription
   */
  async createSubscription(data: CreateSubscriptionRequest): Promise<Subscription> {
    return this.post<Subscription>('/subscriptions', data);
  }

  /**
   * Update subscription (upgrade/downgrade)
   */
  async updateSubscription(data: UpdateSubscriptionRequest): Promise<Subscription> {
    return this.patch<Subscription>('/subscriptions/me', data);
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(): Promise<Subscription> {
    return this.post<Subscription>('/subscriptions/me/cancel');
  }

  /**
   * Reactivate canceled subscription
   */
  async reactivateSubscription(): Promise<Subscription> {
    return this.post<Subscription>('/subscriptions/me/reactivate');
  }

  /**
   * Get invoices
   */
  async getInvoices(params?: {
    page?: number;
    limit?: number;
  }): Promise<{ invoices: Invoice[]; pagination: unknown }> {
    return this.get('/invoices', params);
  }

  /**
   * Get payment methods
   */
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    return this.get<PaymentMethod[]>('/payment-methods');
  }

  /**
   * Add payment method
   */
  async addPaymentMethod(paymentMethodId: string): Promise<PaymentMethod> {
    return this.post<PaymentMethod>('/payment-methods', { paymentMethodId });
  }

  /**
   * Delete payment method
   */
  async deletePaymentMethod(id: string): Promise<{ success: boolean }> {
    return this.delete<{ success: boolean }>(`/payment-methods/${id}`);
  }

  /**
   * Set default payment method
   */
  async setDefaultPaymentMethod(id: string): Promise<PaymentMethod> {
    return this.post<PaymentMethod>(`/payment-methods/${id}/set-default`);
  }

  // ==========================================================================
  // ADMIN (Parts 12-14)
  // ==========================================================================

  /**
   * Get admin dashboard stats
   */
  async getAdminStats(): Promise<AdminStats> {
    return this.get<AdminStats>('/admin/stats');
  }

  /**
   * Get all users (admin)
   */
  async getAdminUsers(params?: {
    page?: number;
    limit?: number;
    tier?: string;
    status?: string;
    search?: string;
  }): Promise<{ users: AdminUser[]; pagination: unknown }> {
    return this.get('/admin/users', params);
  }

  /**
   * Get user by ID (admin)
   */
  async getAdminUser(userId: string): Promise<AdminUser> {
    return this.get<AdminUser>(`/admin/users/${userId}`);
  }

  /**
   * Update user (admin)
   */
  async updateAdminUser(userId: string, data: UpdateUserRequest): Promise<AdminUser> {
    return this.patch<AdminUser>(`/admin/users/${userId}`, data);
  }

  /**
   * Delete user (admin)
   */
  async deleteAdminUser(userId: string): Promise<{ success: boolean }> {
    return this.delete<{ success: boolean }>(`/admin/users/${userId}`);
  }

  // ==========================================================================
  // AFFILIATE (Part 17)
  // ==========================================================================

  /**
   * Get affiliate account
   */
  async getAffiliate(): Promise<Affiliate | null> {
    return this.get<Affiliate | null>('/affiliates/me');
  }

  /**
   * Create affiliate account
   */
  async createAffiliate(): Promise<Affiliate> {
    return this.post<Affiliate>('/affiliates');
  }

  /**
   * Get affiliate stats
   */
  async getAffiliateStats(): Promise<AffiliateStats> {
    return this.get<AffiliateStats>('/affiliates/me/stats');
  }

  /**
   * Get affiliate referrals
   */
  async getAffiliateReferrals(params?: {
    page?: number;
    limit?: number;
  }): Promise<{ referrals: Referral[]; pagination: unknown }> {
    return this.get('/affiliates/me/referrals', params);
  }

  /**
   * Request payout
   */
  async requestPayout(amount: number): Promise<{ success: boolean }> {
    return this.post<{ success: boolean }>('/affiliates/me/payouts', { amount });
  }

  // ==========================================================================
  // PAYMENTS (Part 19)
  // ==========================================================================

  /**
   * Create payment intent (for one-time payments)
   */
  async createPaymentIntent(params: {
    amount: number;
    currency: string;
    description?: string;
  }): Promise<{ clientSecret: string; paymentIntentId: string }> {
    return this.post('/payments/intents', params);
  }

  /**
   * Confirm payment
   */
  async confirmPayment(paymentIntentId: string): Promise<{ success: boolean }> {
    return this.post<{ success: boolean }>(
      `/payments/intents/${paymentIntentId}/confirm`
    );
  }

  // ==========================================================================
  // MARKET DATA (Proxied from Stack C)
  // ==========================================================================
  // IMPORTANT: Both Stack A and Stack B can access Stack C for market data.
  // Stack A fetches from Stack C (MT5 Python API), caches in Redis, and
  // adds analytics before returning to frontend.
  // ==========================================================================

  /**
   * Get candles (OHLC data) - Proxied from Stack C
   *
   * Stack A will:
   * 1. Validate user's tier access to symbol/timeframe
   * 2. Check cache (Redis) for recent data
   * 3. If not cached, fetch from Stack C (MT5 Python API)
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
   * Stack A will:
   * 1. Validate tier access
   * 2. Fetch from Stack C (MT5 Python API)
   * 3. Add analytics and processing
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
   * Stack A will:
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
   * Stack A will:
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
