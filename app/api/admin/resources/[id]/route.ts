/**
 * Admin Marketing Resource Detail API Route
 *
 * DELETE: Remove a media-kit asset (and its underlying Blob file, if any).
 *
 * @module app/api/admin/resources/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { deleteAsset } from '@/lib/marketing-resources/service';
import { deleteAssetFile } from '@/lib/marketing-resources/storage';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    await requireAdmin();

    const { id } = await params;
    const deleted = await deleteAsset(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    if (deleted.fileUrl) {
      await deleteAssetFile(deleted.fileUrl);
    }

    return NextResponse.json({ success: true, id: deleted.id });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('[Admin Resources] Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete marketing asset' },
      { status: 500 }
    );
  }
}
