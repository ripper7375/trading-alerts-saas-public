/**
 * Admin Marketing Resources API Route
 *
 * GET: List media-kit assets (search/category/status filters, pagination,
 *      aggregate stats for the admin dashboard cards).
 * POST: Publish a new asset — a real file upload (Vercel Blob) for every
 *      category except SWIPE_COPY, which carries plain text instead.
 *
 * @module app/api/admin/resources/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import {
  adminAssetListQuerySchema,
  createAssetFieldsSchema,
  MAX_ASSET_FILE_BYTES,
  ACCEPTED_ASSET_MIME_TYPES,
  isAcceptedAssetMimeType,
} from '@/lib/marketing-resources/validators';
import {
  listAssetsForAdmin,
  createAsset,
} from '@/lib/marketing-resources/service';
import { uploadAssetFile } from '@/lib/marketing-resources/storage';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET - List Assets
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const validation = adminAssetListQuerySchema.safeParse(searchParams);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const result = await listAssetsForAdmin(validation.data);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('[Admin Resources] List error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch marketing assets' },
      { status: 500 }
    );
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST - Publish Asset
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * POST /api/admin/resources
 *
 * multipart/form-data body:
 * - title, category (required)
 * - format, resolution (optional display strings)
 * - copyText (required when category === SWIPE_COPY)
 * - file (required for every other category, max 50MB, one of
 *   ACCEPTED_ASSET_MIME_TYPES: PNG/JPG/SVG/MP4/PDF)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAdmin();

    const formData = await request.formData();
    const fields = Object.fromEntries(
      ['title', 'category', 'format', 'resolution', 'copyText'].map((key) => [
        key,
        formData.get(key)?.toString() ?? undefined,
      ])
    );

    const validation = createAssetFieldsSchema.safeParse(fields);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid asset data', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;
    const isSwipeCopy = data.category === 'SWIPE_COPY';

    let fileUrl: string | undefined;
    let fileSize: number | undefined;

    if (isSwipeCopy) {
      if (!data.copyText) {
        return NextResponse.json(
          { error: 'copyText is required for SWIPE_COPY assets' },
          { status: 400 }
        );
      }
    } else {
      const file = formData.get('file');
      if (!(file instanceof File) || file.size === 0) {
        return NextResponse.json(
          { error: 'A file is required for this asset category' },
          { status: 400 }
        );
      }
      if (!isAcceptedAssetMimeType(file.type)) {
        return NextResponse.json(
          {
            error: `Unsupported file type "${file.type || 'unknown'}". Accepted types: ${Object.values(ACCEPTED_ASSET_MIME_TYPES).join(', ')}`,
          },
          { status: 400 }
        );
      }
      if (file.size > MAX_ASSET_FILE_BYTES) {
        return NextResponse.json(
          { error: 'File exceeds the 50MB limit' },
          { status: 400 }
        );
      }

      const uploaded = await uploadAssetFile(file);
      fileUrl = uploaded.url;
      fileSize = uploaded.size;
    }

    const asset = await createAsset({
      ...data,
      fileUrl,
      fileSize,
      createdByUserId: session.user.id,
    });

    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('[Admin Resources] Create error:', error);
    return NextResponse.json(
      { error: 'Failed to publish marketing asset' },
      { status: 500 }
    );
  }
}
