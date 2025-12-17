/**
 * Central type definitions for Trading Alerts SaaS V7
 *
 * This file exports all types used across the application.
 * Import from this file rather than individual type files.
 *
 * @example
 * import { User, Alert, Tier } from '@/types';
 */

// Re-export all types
export * from './user';
export * from './tier';
export * from './alert';
export * from './indicator';
export * from './api';

// ADD THESE LINES:
// Type aliases for authentication system compatibility
export type { Tier as UserTier } from './tier';
export type UserRole = 'USER' | 'ADMIN';

// Re-export Prisma types
export type {
  User,
  Alert,
  Subscription,
  Watchlist,
  WatchlistItem,
} from '@prisma/client';
