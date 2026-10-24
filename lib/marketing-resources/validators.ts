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

// The browser-reported File.type is checked against this allowlist so an
// unadvertised file type (or an arbitrary binary) can't slip through on size
// alone. No SVG (CODE-12): an SVG is a document that can carry script, and
// the Blob origin would serve it as `image/svg+xml`. The browser's claim is
// only a first filter; `detectAssetMimeType` decides from the file's bytes.
export const ACCEPTED_ASSET_MIME_TYPES: Record<string, string> = {
  'image/png': 'PNG',
  'image/jpeg': 'JPG',
  'video/mp4': 'MP4',
  'application/pdf': 'PDF',
};

export function isAcceptedAssetMimeType(mimeType: string): boolean {
  return Object.prototype.hasOwnProperty.call(
    ACCEPTED_ASSET_MIME_TYPES,
    mimeType
  );
}

/** How many leading bytes `detectAssetMimeType` needs (the longest signature). */
export const ASSET_SNIFF_BYTES = 16;

// A read past the end of `bytes` is `undefined`, which equals no signature
// byte, so a buffer that is too short never matches.
function startsWith(bytes: Uint8Array, signature: number[], at = 0): boolean {
  return signature.every((value, i) => bytes[at + i] === value);
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
const MP4_FTYP_BOX_TYPE = [0x66, 0x74, 0x79, 0x70]; // "ftyp", at offset 4

/**
 * The allow-listed type a file really is, from its first bytes, or `null`
 * when they match none (an SVG, an HTML page, text, an empty file). The
 * signature must be at the very start: nothing is skipped, so leading
 * whitespace or a byte order mark in front of markup does not help.
 */
export function detectAssetMimeType(bytes: Uint8Array): string | null {
  if (startsWith(bytes, PNG_SIGNATURE)) return 'image/png';
  if (startsWith(bytes, JPEG_SIGNATURE)) return 'image/jpeg';
  if (startsWith(bytes, PDF_SIGNATURE)) return 'application/pdf';
  if (startsWith(bytes, MP4_FTYP_BOX_TYPE, 4)) return 'video/mp4';
  return null;
}

/** An upload whose content is not one of the accepted file types. */
export class AssetContentTypeError extends Error {
  constructor() {
    super(
      `The file content is not one of the accepted types: ${Object.values(ACCEPTED_ASSET_MIME_TYPES).join(', ')}`
    );
    this.name = 'AssetContentTypeError';
  }
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
