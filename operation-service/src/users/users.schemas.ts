import { z } from 'zod';

/**
 * User profile/preferences/password/session/account-deletion Zod schemas —
 * mirror the 14 monolith `app/api/user/*` routes' own inline
 * `z.object({...})` schemas verbatim (field names, constraints, error
 * messages). Session 4B-11.
 *
 * 2FA request bodies are NOT duplicated here — `UsersController` delegates
 * directly to the existing `TwoFactorService`/`TwoFactorController`'s own
 * class-validator DTOs (`../auth/dto/two-factor-*.dto.ts`), which already
 * validate identically to `lib/auth/two-factor.ts`'s callers.
 *
 * @module users/users.schemas
 */

export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50)
    .optional(),
  email: z.string().email('Invalid email address').optional(),
  avatarUrl: z.string().url('Invalid avatar URL').optional().nullable(),
});

export const updatePreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  colorScheme: z.enum(['blue', 'purple', 'green', 'orange']).optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
  dateFormat: z.enum(['MDY', 'DMY', 'YMD']).optional(),
  timeFormat: z.enum(['12h', '24h']).optional(),
  currency: z.string().optional(),
  profileVisibility: z.enum(['public', 'private', 'connections']).optional(),
  showStats: z.boolean().optional(),
  showEmail: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  newDeviceAlerts: z.boolean().optional(),
  passwordChangeAlerts: z.boolean().optional(),
  chartUpColor: z.string().optional(),
  chartDownColor: z.string().optional(),
  gridOpacity: z.number().min(0).max(100).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const deletionConfirmSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export const deletionCancelSchema = z.object({
  token: z.string().optional(),
});

/** Default preferences — mirrors `lib/preferences/defaults.ts` verbatim. */
export interface UserPreferencesShape {
  theme: 'light' | 'dark' | 'system';
  colorScheme: 'blue' | 'purple' | 'green' | 'orange';
  language: string;
  timezone: string;
  dateFormat: 'MDY' | 'DMY' | 'YMD';
  timeFormat: '12h' | '24h';
  currency: string;
  profileVisibility: 'public' | 'private' | 'connections';
  showStats: boolean;
  showEmail: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  newDeviceAlerts: boolean;
  passwordChangeAlerts: boolean;
  chartUpColor: string;
  chartDownColor: string;
  gridOpacity: number;
}

export const DEFAULT_PREFERENCES: UserPreferencesShape = {
  theme: 'system',
  colorScheme: 'blue',
  language: 'en-US',
  timezone: 'America/New_York',
  dateFormat: 'MDY',
  timeFormat: '12h',
  currency: 'USD',
  profileVisibility: 'private',
  showStats: false,
  showEmail: false,
  emailNotifications: true,
  pushNotifications: true,
  newDeviceAlerts: true,
  passwordChangeAlerts: true,
  chartUpColor: '#22c55e',
  chartDownColor: '#ef4444',
  gridOpacity: 50,
};

export function mergePreferences(
  defaults: UserPreferencesShape,
  custom: Partial<UserPreferencesShape>
): UserPreferencesShape {
  return { ...defaults, ...custom };
}

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type DeletionConfirmInput = z.infer<typeof deletionConfirmSchema>;
export type DeletionCancelInput = z.infer<typeof deletionCancelSchema>;
