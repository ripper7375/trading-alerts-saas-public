/**
 * User Validation Schemas
 *
 * Zod schemas for user profile and preferences.
 */

import { z } from 'zod';

/**
 * Email validation schema
 */
const emailSchema = z
  .string()
  .email('Invalid email format')
  .min(5, 'Email is required')
  .max(254, 'Email must not exceed 254 characters')
  .toLowerCase()
  .trim();

/**
 * Update profile schema
 */
export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters')
    .trim()
    .optional(),
  email: emailSchema.optional(),
  image: z
    .string()
    .url('Invalid image URL')
    .max(500, 'Image URL must not exceed 500 characters')
    .optional()
    .nullable(),
  bio: z
    .string()
    .max(500, 'Bio must not exceed 500 characters')
    .optional()
    .nullable(),
  timezone: z
    .string()
    .max(50, 'Timezone must not exceed 50 characters')
    .optional(),
  locale: z.string().max(10, 'Locale must not exceed 10 characters').optional(),
});

/**
 * Notification preferences schema
 */
export const notificationPreferencesSchema = z.object({
  emailAlerts: z.boolean().optional(),
  emailNewsletter: z.boolean().optional(),
  emailMarketing: z.boolean().optional(),
  pushAlerts: z.boolean().optional(),
  pushPriceUpdates: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
});

/**
 * Display preferences schema
 */
export const displayPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  compactMode: z.boolean().optional(),
  showPriceChange: z.boolean().optional(),
  defaultTimeframe: z
    .enum(['M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'D1'])
    .optional(),
  chartType: z.enum(['candlestick', 'line', 'bar']).optional(),
});

/**
 * Privacy preferences schema
 */
export const privacyPreferencesSchema = z.object({
  profilePublic: z.boolean().optional(),
  showActivity: z.boolean().optional(),
  allowAnalytics: z.boolean().optional(),
});

/**
 * Update preferences schema (combines all preference types)
 */
export const updatePreferencesSchema = z.object({
  notifications: notificationPreferencesSchema.optional(),
  display: displayPreferencesSchema.optional(),
  privacy: privacyPreferencesSchema.optional(),
});

/**
 * Delete account schema
 */
export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required to delete account'),
  confirmText: z.string().refine((val) => val === 'DELETE', {
    message: 'Please type DELETE to confirm',
  }),
  reason: z
    .string()
    .max(500, 'Reason must not exceed 500 characters')
    .optional(),
});

/**
 * Request account deletion schema (for scheduled deletion)
 */
export const requestAccountDeletionSchema = z.object({
  reason: z
    .string()
    .max(500, 'Reason must not exceed 500 characters')
    .optional(),
});

/**
 * Cancel account deletion schema
 */
export const cancelAccountDeletionSchema = z.object({
  token: z.string().min(1, 'Cancellation token is required'),
});

/**
 * Export user data schema
 */
export const exportUserDataSchema = z.object({
  format: z.enum(['json', 'csv']).optional().default('json'),
  includeAlerts: z.boolean().optional().default(true),
  includeWatchlists: z.boolean().optional().default(true),
  includeNotifications: z.boolean().optional().default(true),
  includeActivity: z.boolean().optional().default(false),
});

/**
 * Get user profile schema (for public profiles)
 */
export const getUserProfileSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

/**
 * Default preferences values
 */
export const DEFAULT_PREFERENCES = {
  notifications: {
    emailAlerts: true,
    emailNewsletter: false,
    emailMarketing: false,
    pushAlerts: true,
    pushPriceUpdates: false,
    soundEnabled: true,
  },
  display: {
    theme: 'system' as const,
    compactMode: false,
    showPriceChange: true,
    defaultTimeframe: 'H1' as const,
    chartType: 'candlestick' as const,
  },
  privacy: {
    profilePublic: false,
    showActivity: false,
    allowAnalytics: true,
  },
} as const;

// Type exports
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type NotificationPreferences = z.infer<
  typeof notificationPreferencesSchema
>;
export type DisplayPreferences = z.infer<typeof displayPreferencesSchema>;
export type PrivacyPreferences = z.infer<typeof privacyPreferencesSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
export type RequestAccountDeletionInput = z.infer<
  typeof requestAccountDeletionSchema
>;
export type CancelAccountDeletionInput = z.infer<
  typeof cancelAccountDeletionSchema
>;
export type ExportUserDataInput = z.infer<typeof exportUserDataSchema>;
export type GetUserProfileInput = z.infer<typeof getUserProfileSchema>;
