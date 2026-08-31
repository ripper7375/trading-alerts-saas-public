/**
 * Admin Academy Tutorials API Route
 *
 * GET: List tutorials (search/category/status filters, pagination,
 *      aggregate stats for the admin dashboard cards).
 * POST: Publish a new tutorial from a YouTube URL — JSON body, no file
 *      upload (unlike the Marketing Resources media-kit feature).
 *
 * @module app/api/admin/tutorials/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import {
  adminTutorialListQuerySchema,
  createTutorialFieldsSchema,
} from '@/lib/tutorials/validators';
import { listTutorialsForAdmin, createTutorial } from '@/lib/tutorials/service';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET - List Tutorials
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const validation = adminTutorialListQuerySchema.safeParse(searchParams);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const result = await listTutorialsForAdmin(validation.data);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('[Admin Tutorials] List error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tutorials' },
      { status: 500 }
    );
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST - Publish Tutorial
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * POST /api/admin/tutorials
 *
 * JSON body: title, description, youtubeUrl, category (required), featured
 * (optional, defaults false).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAdmin();

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = createTutorialFieldsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid tutorial data', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const tutorial = await createTutorial({
      ...validation.data,
      createdByUserId: session.user.id,
    });

    return NextResponse.json({ tutorial }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('[Admin Tutorials] Create error:', error);
    return NextResponse.json(
      { error: 'Failed to publish tutorial' },
      { status: 500 }
    );
  }
}
