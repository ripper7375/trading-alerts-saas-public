/**
 * Marketing Resources Validators
 *
 * Zod schemas for the admin media-kit CRUD and affiliate-facing read routes.
 *
 * @module lib/marketing-resources/validators
 */

import { z } from 'zod';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SHARED
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const MARKETING_ASSET_CATEGORIES = [
  'BRAND_LOGOS',
  'MASCOTS',
  'AD_BANNERS',
  'SWIPE_COPY',
  'DOCS',
] as const;

export const MARKETING_ASSET_STATUSES = [
  'ACTIVE',
  'DRAFT',
  'ARCHIVED',
] as const;

// 50MB — matches the admin upload form's own stated limit.
export const MAX_ASSET_FILE_BYTES = 50 * 1024 * 1024;

// Matches the admin upload form's own stated support ("Supports PNG, JPG,
// SVG, MP4, PDF up to 50MB") — the browser-reported File.type is checked
// against this allowlist so an unadvertised file type (or an arbitrary
// binary) can't slip through on size alone.
export const ACCEPTED_ASSET_MIME_TYPES: Record<string, string> = {
  'image/png': 'PNG',
  'image/jpeg': 'JPG',
  'image/svg+xml': 'SVG',
  'video/mp4': 'MP4',
  'application/pdf': 'PDF',
};

export function isAcceptedAssetMimeType(mimeType: string): boolean {
  return Object.prototype.hasOwnProperty.call(
    ACCEPTED_ASSET_MIME_TYPES,
    mimeType
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN: LIST QUERY
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const adminAssetListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  category: z.enum(MARKETING_ASSET_CATEGORIES).optional(),
  status: z.enum(MARKETING_ASSET_STATUSES).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type AdminAssetListQuery = z.infer<typeof adminAssetListQuerySchema>;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN: CREATE ASSET (multipart/form-data fields, pre-file-extraction)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const createAssetFieldsSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  category: z.enum(MARKETING_ASSET_CATEGORIES, {
    errorMap: () => ({
      message: `Category must be one of: ${MARKETING_ASSET_CATEGORIES.join(', ')}`,
    }),
  }),
  format: z.string().trim().max(20).optional(),
  resolution: z.string().trim().max(50).optional(),
  copyText: z.string().trim().max(5000).optional(),
});

export type CreateAssetFields = z.infer<typeof createAssetFieldsSchema>;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AFFILIATE: LIST QUERY
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const affiliateAssetListQuerySchema = z.object({
  category: z.enum(MARKETING_ASSET_CATEGORIES).optional(),
});

export type AffiliateAssetListQuery = z.infer<
  typeof affiliateAssetListQuerySchema
>;
