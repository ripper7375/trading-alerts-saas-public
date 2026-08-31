/**
 * Academy Tutorials Validators
 *
 * Zod schemas for the admin CRUD routes and the public listing/detail reads.
 *
 * @module lib/tutorials/validators
 */

import { z } from 'zod';

import { extractYouTubeVideoId } from './youtube';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SHARED
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const TUTORIAL_CATEGORIES = [
  'GETTING_STARTED',
  'PLATFORM_WALKTHROUGH',
  'TRADING_STRATEGIES',
  'RISK_MANAGEMENT',
  'MARKET_ANALYSIS',
] as const;

export const TUTORIAL_STATUSES = ['ACTIVE', 'DRAFT', 'ARCHIVED'] as const;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN: LIST QUERY
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const adminTutorialListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  category: z.enum(TUTORIAL_CATEGORIES).optional(),
  status: z.enum(TUTORIAL_STATUSES).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type AdminTutorialListQuery = z.infer<
  typeof adminTutorialListQuerySchema
>;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN: CREATE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const createTutorialFieldsSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().min(1, 'Description is required').max(2000),
  youtubeUrl: z
    .string()
    .trim()
    .url('Must be a valid URL')
    .refine((url) => extractYouTubeVideoId(url) !== null, {
      message:
        'Must be a valid YouTube video URL (watch, youtu.be, embed, or shorts link)',
    }),
  category: z.enum(TUTORIAL_CATEGORIES, {
    errorMap: () => ({
      message: `Category must be one of: ${TUTORIAL_CATEGORIES.join(', ')}`,
    }),
  }),
  featured: z.boolean().default(false),
});

export type CreateTutorialFields = z.infer<typeof createTutorialFieldsSchema>;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN: UPDATE (PATCH) — distinct from create: partial, and carries `status`
// (create always forces ACTIVE, matching the marketing-resources precedent)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const updateTutorialFieldsSchema = createTutorialFieldsSchema
  .partial()
  .extend({
    status: z.enum(TUTORIAL_STATUSES).optional(),
  });

export type UpdateTutorialFields = z.infer<typeof updateTutorialFieldsSchema>;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PUBLIC: LIST QUERY
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const publicTutorialListQuerySchema = z.object({
  category: z.enum(TUTORIAL_CATEGORIES).optional(),
});

export type PublicTutorialListQuery = z.infer<
  typeof publicTutorialListQuerySchema
>;
