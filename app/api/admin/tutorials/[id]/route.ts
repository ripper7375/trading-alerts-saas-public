/**
 * Admin Academy Tutorial Detail API Route
 *
 * PATCH: Edit an existing tutorial's fields/status (e.g. toggle
 *      ACTIVE/ARCHIVED, fix a typo, swap the URL).
 * DELETE: Remove a tutorial.
 *
 * @module app/api/admin/tutorials/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { updateTutorialFieldsSchema } from '@/lib/tutorials/validators';
import { updateTutorial, deleteTutorial } from '@/lib/tutorials/service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PATCH - Update Tutorial
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    await requireAdmin();

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = updateTutorialFieldsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid tutorial data', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { id } = await params;

    let tutorial;
    try {
      tutorial = await updateTutorial(id, validation.data);
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_YOUTUBE_URL') {
        return NextResponse.json(
          { error: 'Must be a valid YouTube video URL' },
          { status: 400 }
        );
      }
      throw error;
    }

    if (!tutorial) {
      return NextResponse.json(
        { error: 'Tutorial not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ tutorial });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('[Admin Tutorials] Update error:', error);
    return NextResponse.json(
      { error: 'Failed to update tutorial' },
      { status: 500 }
    );
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DELETE - Remove Tutorial
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    await requireAdmin();

    const { id } = await params;
    const deleted = await deleteTutorial(id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Tutorial not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, id: deleted.id });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('[Admin Tutorials] Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete tutorial' },
      { status: 500 }
    );
  }
}
