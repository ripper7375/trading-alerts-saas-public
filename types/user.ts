import type {
  User as PrismaUser,
  Alert,
  Watchlist,
  Subscription,
} from '@prisma/client';
import type { Tier } from './tier';

/**
 * User type (extends Prisma User)
 *
 * Note: This is a re-export with additional type safety
 */
export type User = PrismaUser;

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
