import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth/auth-options';
import {
  getLoginContext,
  recordLoginAttempt,
  sendNewDeviceAlert,
} from '@/lib/security/device-detection';

/**
 * Track Login API Route
 *
 * POST: Record a login attempt after successful authentication
 *
 * This endpoint is called client-side after NextAuth redirects to the dashboard.
 * It records the login in history and sends new device alerts if needed.
 */

const trackLoginSchema = z.object({
  provider: z.string().default('credentials'),
});

/**
 * POST /api/auth/track-login
 * Record a successful login
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    let provider = 'credentials';
    try {
      const body = await request.json();
      const validation = trackLoginSchema.safeParse(body);
      if (validation.success) {
        provider = validation.data.provider;
      }
    } catch {
      // Body is optional, use defaults
    }

    // Get login context (device, location, IP)
    const context = await getLoginContext();

    // Record the login attempt
    const { isNewDevice } = await recordLoginAttempt(
      session.user.id,
      'SUCCESS',
      provider,
      context
    );

    // If this is a new device, send an alert
    if (isNewDevice) {
      await sendNewDeviceAlert(session.user.id, context);
    }

    return NextResponse.json({
      success: true,
      isNewDevice,
      deviceType: context.device.deviceType,
      location: `${context.location.city}, ${context.location.country}`,
    });
  } catch (error) {
    console.error('[POST /api/auth/track-login] Error:', error);
    return NextResponse.json(
      { error: 'Failed to track login' },
      { status: 500 }
    );
  }
}
