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

import {
  ASSET_SNIFF_BYTES,
  AssetContentTypeError,
  detectAssetMimeType,
} from './validators';

const BLOB_PATH_PREFIX = 'marketing-resources';

export interface UploadedAssetFile {
  url: string;
  size: number;
}

/**
 * A file name that is safe as the last segment of a Blob pathname: letters,
 * digits, `.`, `_` and `-` only (a path separator, a space, a control
 * character or anything non-ASCII becomes `_`), and no leading dot (no hidden
 * file, no `..` segment). A name that is empty after that is `file`.
 */
export function sanitizeAssetFilename(name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '');
  return safe === '' ? 'file' : safe;
}

/**
 * Upload a single asset file to Vercel Blob under a stable path prefix.
 * `addRandomSuffix` avoids collisions between assets that share a title.
 *
 * Three things keep an uploaded file from running inline in a browser: the
 * name is sanitized (`sanitizeAssetFilename`); the type is read from the
 * file's first bytes (`detectAssetMimeType`), so neither the browser's
 * Content-Type nor the file name decides it and an SVG or HTML page is
 * refused with `AssetContentTypeError` before Blob is called (CODE-12); and
 * that detected type is the one the blob is stored with, not one Blob would
 * guess from the file extension (so an `.html` file cannot be served as
 * `text/html`).
 *
 * `put()` in the installed `@vercel/blob` (2.8.0) has no `contentDisposition`
 * option (the header is on its result, not its input), so this module cannot
 * ask for `attachment`; the blob's `downloadUrl` is the URL that forces one.
 */
export async function uploadAssetFile(file: File): Promise<UploadedAssetFile> {
  const head = new Uint8Array(
    await file.slice(0, ASSET_SNIFF_BYTES).arrayBuffer()
  );
  const contentType = detectAssetMimeType(head);
  if (!contentType) {
    throw new AssetContentTypeError();
  }

  const blob = await put(
    `${BLOB_PATH_PREFIX}/${sanitizeAssetFilename(file.name)}`,
    file,
    {
      access: 'public',
      addRandomSuffix: true,
      contentType,
    }
  );

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
