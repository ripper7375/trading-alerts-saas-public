import { z } from 'zod';

export const profileSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters'),
  email: z.string().email('Invalid email address'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be less than 20 characters')
    .regex(
      /^[a-zA-Z0-9_]+$/,
      'Username can only contain letters, numbers, and underscores'
    )
    .optional()
    .or(z.literal('')),
  company: z.string().max(100).optional().or(z.literal('')),
  jobTitle: z.string().max(100).optional().or(z.literal('')),
  bio: z
    .string()
    .max(500, 'Bio must be less than 500 characters')
    .optional()
    .or(z.literal('')),
  country: z.string().min(1, 'Please select a country'),
  timezone: z.string().min(1, 'Please select a timezone'),
  language: z.string().min(1, 'Please select a language'),
  dateFormat: z.enum(['MDY', 'DMY', 'YMD']),
  timeFormat: z.enum(['12h', '24h']),
  currency: z.string().min(1, 'Please select a currency'),
  profileVisibility: z.enum(['public', 'private', 'connections']),
  showStats: z.boolean(),
  showEmail: z.boolean(),
  socialTwitter: z
    .string()
    .url('Must be a valid URL')
    .optional()
    .or(z.literal('')),
  socialLinkedIn: z
    .string()
    .url('Must be a valid URL')
    .optional()
    .or(z.literal('')),
  socialWebsite: z
    .string()
    .url('Must be a valid URL')
    .optional()
    .or(z.literal('')),
  photoUrl: z.string().optional(),
});

export type ProfileSchemaType = z.infer<typeof profileSchema>;
