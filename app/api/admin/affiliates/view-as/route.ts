/**
 * Admin "view as affiliate" API (read-only affiliate dashboard access)
 *
 * GET    — search affiliates to pick from (name, email or promo code)
 * POST   — start viewing one affiliate's dashboard: sets the view-as cookie
 * DELETE — stop viewing: clears the cookie
 *
 * The cookie only changes what the affiliate dashboard READS for an admin;
 * see lib/affiliate/view-as.ts for why every write stays refused.
 *
 * Reads Prisma directly rather than the money-service admin list proxy: that
 * list has no name/email/code search, and this picker needs one.
 *
 * @module app/api/admin/affiliates/view-as/route
 */

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  VIEW_AS_COOKIE_NAME,
  VIEW_AS_MAX_AGE_SECONDS,
  encodeViewAsCookie,
  loadViewAsTarget,
  viewAsCookieOptions,
} from '@/lib/affiliate/view-as';
import { AuthError } from '@/lib/auth/errors';
import { requireAdmin } from '@/lib/auth/session';
import { csrfErrorResponse, validateOrigin } from '@/lib/csrf';
import { prisma } from '@/lib/db/prisma';

const AFFILIATE_STATUSES = [
  'ACTIVE',
  'PENDING_VERIFICATION',
  'SUSPENDED',
  'INACTIVE',
] as const;

const searchSchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(AFFILIATE_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(5).max(50).default(20),
});

const startSchema = z.object({
  profileId: z.string().min(1).max(64),
});

function authErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }
  return null;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET — search affiliates
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();

    const validation = searchSchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }
    const { search, status, page, limit } = validation.data;

    // AffiliateProfile carries no relation to User or a searchable code, so a
    // search term is matched three ways: the profile's own name, the owning
    // user's email, and any of the affiliate's promo codes.
    const or: Array<Record<string, unknown>> = [];
    if (search) {
      const [users, codes] = await Promise.all([
        prisma.user.findMany({
          where: { email: { contains: search, mode: 'insensitive' } },
          select: { id: true },
          take: 200,
        }),
        prisma.affiliateCode.findMany({
          where: { code: { contains: search, mode: 'insensitive' } },
          select: { affiliateProfileId: true },
          take: 200,
        }),
      ]);
      or.push({ fullName: { contains: search, mode: 'insensitive' } });
      if (users.length > 0) {
        or.push({ userId: { in: users.map((u) => u.id) } });
      }
      if (codes.length > 0) {
        or.push({ id: { in: codes.map((c) => c.affiliateProfileId) } });
      }
    }

    const where = {
      ...(status ? { status } : {}),
      ...(or.length > 0 ? { OR: or } : {}),
    };

    const [profiles, total] = await Promise.all([
      prisma.affiliateProfile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          userId: true,
          fullName: true,
          country: true,
          status: true,
          createdAt: true,
          totalEarnings: true,
          pendingCommissions: true,
          totalCodesUsed: true,
        },
      }),
      prisma.affiliateProfile.count({ where }),
    ]);

    const profileIds = profiles.map((p) => p.id);
    const [owners, activeCodes] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: profiles.map((p) => p.userId) } },
        select: { id: true, email: true },
      }),
      prisma.affiliateCode.findMany({
        where: { affiliateProfileId: { in: profileIds }, status: 'ACTIVE' },
        orderBy: { distributedAt: 'desc' },
        select: { affiliateProfileId: true, code: true },
      }),
    ]);

    const emailByUserId = new Map(owners.map((u) => [u.id, u.email]));
    const codeByProfileId = new Map<string, string>();
    for (const c of activeCodes) {
      if (!codeByProfileId.has(c.affiliateProfileId)) {
        codeByProfileId.set(c.affiliateProfileId, c.code);
      }
    }

    return NextResponse.json({
      affiliates: profiles.map((p) => ({
        profileId: p.id,
        fullName: p.fullName,
        email: emailByUserId.get(p.userId) ?? null,
        country: p.country,
        status: p.status,
        createdAt: p.createdAt,
        totalEarnings: Number(p.totalEarnings ?? 0),
        pendingCommissions: Number(p.pendingCommissions ?? 0),
        totalCodesUsed: p.totalCodesUsed,
        activeCode: codeByProfileId.get(p.id) ?? null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('[admin-view-as] search failed:', error);
    return NextResponse.json(
      { error: 'Failed to search affiliates' },
      { status: 500 }
    );
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST — start viewing an affiliate
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await validateOrigin())) {
    return csrfErrorResponse() as NextResponse;
  }

  try {
    const session = await requireAdmin();

    const body = await request.json().catch(() => null);
    const validation = startSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'profileId is required' },
        { status: 400 }
      );
    }

    const loaded = await loadViewAsTarget(validation.data.profileId);
    if (!loaded) {
      return NextResponse.json(
        { error: 'Affiliate not found' },
        { status: 404 }
      );
    }

    const cookieStore = await cookies();
    cookieStore.set(
      VIEW_AS_COOKIE_NAME,
      encodeViewAsCookie(session.user.id, loaded.target.profileId),
      viewAsCookieOptions(VIEW_AS_MAX_AGE_SECONDS)
    );

    // No general admin audit table exists; this line is the record.
    console.info(
      `[admin-view-as] start admin=${session.user.id} affiliateProfile=${loaded.target.profileId}`
    );

    return NextResponse.json({
      target: loaded.target,
      redirectTo: '/affiliate/dashboard',
    });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('[admin-view-as] start failed:', error);
    return NextResponse.json(
      { error: 'Failed to start viewing affiliate' },
      { status: 500 }
    );
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DELETE — stop viewing
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function DELETE(): Promise<NextResponse> {
  if (!(await validateOrigin())) {
    return csrfErrorResponse() as NextResponse;
  }

  try {
    const session = await requireAdmin();

    // Set, not delete: a __Secure- cookie is only cleared by a Set-Cookie
    // that also carries Secure (same reason as token-logout/route.ts).
    const cookieStore = await cookies();
    cookieStore.set(VIEW_AS_COOKIE_NAME, '', viewAsCookieOptions(0));

    console.info(`[admin-view-as] stop admin=${session.user.id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('[admin-view-as] stop failed:', error);
    return NextResponse.json(
      { error: 'Failed to stop viewing affiliate' },
      { status: 500 }
    );
  }
}
