import type { Tier } from './tier';
import type { Alert } from './alert';

/**
 * User type
 */
export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  password: string | null;
  tier: Tier;
  role: string;
  stripeCustomerId: string | null;
  stripePriceId: string | null;
  subscriptionId: string | null;
  isActive: boolean;
  emailVerified: Date | null;
  hasUsedStripeTrial: boolean;
  hasUsedThreeDayPlan: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Two-Factor Authentication (TOTP)
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
  twoFactorBackupCodes: string | null;
  twoFactorVerifiedAt: Date | null;
}

/**
 * Watchlist type
 */
export interface Watchlist {
  id: string;
  userId: string;
  name: string;
  order: number;
  createdAt: Date;
}

/**
 * Subscription type
 */
export interface Subscription {
  id: string;
  userId: string;
  stripeSubscriptionId: string | null;
  status: string;
  plan: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Public user profile (safe for client-side)
 *
 * Excludes sensitive fields like password hash
 */
export interface PublicUserProfile {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  tier: Tier;
  createdAt: Date;
}

/**
 * User session data (from NextAuth)
 */
export interface UserSession {
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    tier: Tier;
  };
  expires: string;
}

/**
 * User preferences
 */
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: {
    email: boolean;
    push: boolean;
    alerts: boolean;
  };
  defaultTimeframe: string;
  defaultSymbol: string;
  language: string;
}

/**
 * User statistics
 */
export interface UserStats {
  totalAlerts: number;
  activeAlerts: number;
  triggeredAlerts: number;
  totalWatchlists: number;
  joinedDate: Date;
  lastLogin: Date | null;
}

/**
 * User with relationships
 */
export interface UserWithRelations extends User {
  alerts?: Alert[];
  watchlists?: Watchlist[];
  subscription?: Subscription | null;
}

/**
 * User update request
 */
export interface UpdateUserRequest {
  name?: string;
  image?: string;
  preferences?: Partial<UserPreferences>;
}
