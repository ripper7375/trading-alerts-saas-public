import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth/auth-options';
import { withSessionBump } from '@/lib/auth/session-version';
import { prisma } from '@/lib/db/prisma';
import { shouldUseOperationServiceForUserProfile } from '@/lib/operation-service/flags';
import {
  forwardRequestToOperationService,
  OperationServiceError,
} from '@/lib/operation-service/write-routes';

/**
 * Profile API Route
 *
 * GET: Get user profile
 * PATCH: Update profile (name, email, avatar)
 *
 * Security:
 * - Requires authentication
 * - Email change triggers verification email
 * - Avatar validation (max 5MB, JPG/PNG/GIF)
 */

// Validation schema for profile updates
const profileUpdateSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50)
    .optional(),
  email: z.string().email('Invalid email address').optional(),
  avatarUrl: z.string().url('Invalid avatar URL').optional().nullable(),
});

/**
 * GET /api/user/profile
 * Get the authenticated user's profile
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (shouldUseOperationServiceForUserProfile()) {
      const { status: opStatus, body } = await forwardRequestToOperationService(
        request,
        '/user/profile'
      );
      return NextResponse.json(body, { status: opStatus });
    }

    // Fetch user profile
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        tier: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        ...user,
        emailVerified: !!user.emailVerified,
      },
    });
  } catch (error) {
    if (error instanceof OperationServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    console.error('[GET /api/user/profile] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user/profile
 * Update the authenticated user's profile
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (shouldUseOperationServiceForUserProfile()) {
      const { status: opStatus, body: opBody } =
        await forwardRequestToOperationService(request, '/user/profile');
      return NextResponse.json(opBody, { status: opStatus });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = profileUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { name, email, avatarUrl } = validation.data;

    // Check if email is being changed
    if (email && email !== session.user.email) {
      // Check if email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: 'Email already in use' },
          { status: 409 }
        );
      }

      // In production, send verification email to new address
      // For now, we'll update directly (not recommended for production)
      console.log(
        `[Profile] Email change requested: ${session.user.email} -> ${email}`
      );
    }

    // Build update data
    const updateData: {
      name?: string;
      email?: string;
      image?: string | null;
    } = {};

    if (name !== undefined) {
      updateData.name = name;
    }

    if (email !== undefined) {
      updateData.email = email;
    }

    if (avatarUrl !== undefined) {
      updateData.image = avatarUrl;
    }

    // Update user profile
    const profileSelect = {
      id: true,
      name: true,
      email: true,
      image: true,
      tier: true,
      role: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
    } as const;
    const userId = session.user.id;
    // CODE-02B: a new e-mail address ends every session of the account (the page always sends the
    // e-mail field, changed or not, so only an address that differs counts). The change, the new
    // session version and the deleted refresh tokens commit together.
    const emailChanged = Boolean(email) && email !== session.user.email;
    const updatedUser = emailChanged
      ? await withSessionBump(userId, (tx) =>
          tx.user.update({
            where: { id: userId },
            data: updateData,
            select: profileSelect,
          })
        )
      : await prisma.user.update({
          where: { id: userId },
          data: updateData,
          select: profileSelect,
        });

    return NextResponse.json({
      user: {
        ...updatedUser,
        emailVerified: !!updatedUser.emailVerified,
      },
      message: 'Profile updated successfully',
    });
  } catch (error) {
    if (error instanceof OperationServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    console.error('[PATCH /api/user/profile] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
