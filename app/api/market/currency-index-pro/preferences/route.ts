/**
 * Currency Index PRO Plan (Phase 2) — Preferences API Route
 *
 * GET/PUT /api/market/currency-index-pro/preferences
 *
 * Per-user HRMA/SMMA period + zone-override overrides (spec Sections
 * 3.3/4.1/4.2). Mirrors `app/api/user/preferences/route.ts`'s own shape
 * (zod validation, merge-then-upsert on PUT, defaults-merge on GET)
 * exactly, scoped to `UserCurrencyIndexPreference`'s own fields rather than
 * the generic JSON preferences blob that route owns.
 *
 * PRO-gated like chart/screener -- this whole plan is a PRO feature, so
 * customizing it is too. Same JWT-then-DB-recheck pattern as
 * indicator-statistics' route (`requirePro()` alone would refuse a user who
 * just paid for PRO and still carries a stale FREE claim).
 *
 * @module app/api/market/currency-index-pro/preferences/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth/auth-options';
import { hasPermission } from '@/lib/auth/permissions';
import { prisma } from '@/lib/db/prisma';
import { getUserCurrencyIndexPreference } from '@/lib/currency-index-pro/queries';

export const dynamic = 'force-dynamic';

// Spec Section 1's discrete lookback options (Requirement 1) and Sections
// 3.3/4.1/4.2's slider ranges.
const preferencesSchema = z.object({
  lookbackDays: z
    .union([
      z.literal(5),
      z.literal(10),
      z.literal(20),
      z.literal(30),
      z.literal(60),
    ])
    .optional(),
  useAutoZones: z.boolean().optional(),
  customObPct: z.number().min(0.3).max(2.0).optional(),
  customOsPct: z.number().min(-2.0).max(-0.3).optional(),
  hrmaPeriod: z.number().int().min(10).max(100).optional(),
  smmaPeriod: z.number().int().min(5).max(50).optional(),
  preferredTf: z.enum(['M5', 'M15']).optional(),
});

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(session.user, 'currency_index_pro')) {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tier: true },
    });
    if (dbUser?.tier !== 'PRO') {
      return NextResponse.json(
        { error: 'PRO subscription required' },
        { status: 403 }
      );
    }
  }

  const preferences = await getUserCurrencyIndexPreference(session.user.id);
  return NextResponse.json({ preferences });
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(session.user, 'currency_index_pro')) {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tier: true },
    });
    if (dbUser?.tier !== 'PRO') {
      return NextResponse.json(
        { error: 'PRO subscription required' },
        { status: 403 }
      );
    }
  }

  const body = await request.json();
  const validation = preferencesSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: validation.error.errors },
      { status: 400 }
    );
  }

  const existing = await getUserCurrencyIndexPreference(session.user.id);
  const merged = { ...existing, ...validation.data };

  const updated = await prisma.userCurrencyIndexPreference.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...merged },
    update: merged,
  });

  return NextResponse.json({
    preferences: {
      lookbackDays: updated.lookbackDays,
      useAutoZones: updated.useAutoZones,
      customObPct: updated.customObPct,
      customOsPct: updated.customOsPct,
      hrmaPeriod: updated.hrmaPeriod,
      smmaPeriod: updated.smmaPeriod,
      preferredTf: updated.preferredTf,
    },
    message: 'Preferences updated successfully',
  });
}
