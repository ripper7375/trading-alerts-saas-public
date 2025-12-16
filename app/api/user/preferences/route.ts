import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import {
  DEFAULT_PREFERENCES,
  mergePreferences,
  type UserPreferences,
} from '@/lib/preferences/defaults';

/**
 * Preferences API Route
 *
 * GET: Get user preferences
 * PUT: Update preferences (theme, language, timezone, etc.)
 *
 * Security:
 * - Requires authentication
 * - Validates preference values
 */

// Validation schema for preferences updates
const preferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  colorScheme: z.enum(['blue', 'purple', 'green', 'orange']).optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
  dateFormat: z.enum(['MDY', 'DMY', 'YMD']).optional(),
  timeFormat: z.enum(['12h', '24h']).optional(),
  currency: z.string().optional(),
  profileVisibility: z.enum(['public', 'private', 'connections']).optional(),
  showStats: z.boolean().optional(),
  showEmail: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  chartUpColor: z.string().optional(),
  chartDownColor: z.string().optional(),
  gridOpacity: z.number().min(0).max(100).optional(),
});

/**
 * GET /api/user/preferences
 * Get the authenticated user's preferences
 */
export async function GET(): Promise<NextResponse> {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch user preferences
    const userPreferences = await prisma.userPreferences.findUnique({
      where: { userId: session.user.id },
    });

    // Merge with defaults
    const storedPrefs = (userPreferences?.preferences as Partial<UserPreferences>) || {};
    const preferences = mergePreferences(DEFAULT_PREFERENCES, storedPrefs);

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('[GET /api/user/preferences] Error:', error);

    // Return defaults if there's an error (e.g., table doesn't exist yet)
    return NextResponse.json({ preferences: DEFAULT_PREFERENCES });
  }
}

/**
 * PUT /api/user/preferences
 * Update the authenticated user's preferences
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = preferencesSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const newPreferences = validation.data;

    // Get existing preferences
    const existingPrefs = await prisma.userPreferences.findUnique({
      where: { userId: session.user.id },
    });

    // Merge new preferences with existing
    const existingData = (existingPrefs?.preferences as Partial<UserPreferences>) || {};
    const mergedPreferences = {
      ...existingData,
      ...newPreferences,
    };

    // Upsert preferences
    const updated = await prisma.userPreferences.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        preferences: mergedPreferences,
      },
      update: {
        preferences: mergedPreferences,
      },
    });

    // Return full preferences merged with defaults
    const fullPreferences = mergePreferences(
      DEFAULT_PREFERENCES,
      updated.preferences as Partial<UserPreferences>
    );

    return NextResponse.json({
      preferences: fullPreferences,
      message: 'Preferences updated successfully',
    });
  } catch (error) {
    console.error('[PUT /api/user/preferences] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}
