/**
 * Marketing Resources File Storage
 *
 * Thin wrapper around Vercel Blob for admin-uploaded media-kit files (brand
 * logos, mascots, ad banners, guideline docs). SWIPE_COPY assets never call
 * this module — their content is plain text stored directly on the model.
 *
 * Requires `BLOB_READ_WRITE_TOKEN` (provisioned via the Vercel dashboard's
 * Blob store for this project) — see `.env.example`.
 *
 * @module lib/marketing-resources/storage
 */

import { put, del } from '@vercel/blob';

const BLOB_PATH_PREFIX = 'marketing-resources';

export interface UploadedAssetFile {
  url: string;
  size: number;
}

/**
 * Upload a single asset file to Vercel Blob under a stable path prefix.
 * `addRandomSuffix` avoids collisions between assets that share a title.
 */
export async function uploadAssetFile(file: File): Promise<UploadedAssetFile> {
  const blob = await put(`${BLOB_PATH_PREFIX}/${file.name}`, file, {
    access: 'public',
    addRandomSuffix: true,
  });

  return { url: blob.url, size: file.size };
}

/**
 * Best-effort delete of a previously uploaded asset file. Only attempts
 * deletion for URLs this module's own prefix produced — external/seeded
 * URLs (e.g. the static `/public` brand assets) are left untouched.
 */
export async function deleteAssetFile(fileUrl: string): Promise<void> {
  if (!fileUrl.includes(`/${BLOB_PATH_PREFIX}/`)) {
    return;
  }

  try {
    await del(fileUrl);
  } catch (error) {
    // Non-fatal: the DB row is still the source of truth for what's
    // "published"; an orphaned blob costs storage, not correctness.
    console.error(
      '[marketing-resources/storage] Failed to delete blob:',
      error
    );
  }
}
