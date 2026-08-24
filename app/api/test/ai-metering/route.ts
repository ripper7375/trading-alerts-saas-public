/**
 * Dummy tier-gated AI metering route (Session 11-3, Decision 3).
 *
 * Throwaway proof that the tier gate + Redis token-quota enforcement work
 * end-to-end before Stack D's real AI routes exist (Phase 12) -- delete this
 * route when Phase 12 builds the real ones.
 *
 * POST /api/test/ai-metering
 * Body: { tokensUsed: number }
 *
 * FREE tier             -> 403 { error: 'Forbidden', reason: 'TIER_PRO_REQUIRED' }
 * PRO, under quota       -> 200 { success: true, remainingTokens }
 * PRO, at/over quota     -> 429 { error: 'Monthly AI token quota exceeded' }
 *
 * @module app/api/test/ai-metering/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import { trackAiTokenUsage } from '@/lib/rate-limit';
import { canAccessAiAnalyst, TIER_CONFIGS, type Tier } from '@/lib/tier-config';

interface ApiResponse {
  success?: boolean;
  error?: string;
  reason?: string;
  remainingTokens?: number;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const tier = (session.user.tier as Tier) || 'FREE';

  if (!canAccessAiAnalyst(tier)) {
    return NextResponse.json(
      { success: false, error: 'Forbidden', reason: 'TIER_PRO_REQUIRED' },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const tokensUsed = typeof body?.tokensUsed === 'number' ? body.tokensUsed : 0;
  const monthlyQuota = TIER_CONFIGS[tier].aiMonthlyTokenQuota;

  const result = await trackAiTokenUsage(
    session.user.id,
    tokensUsed,
    monthlyQuota
  );

  if (!result.allowed) {
    return NextResponse.json(
      { success: false, error: 'Monthly AI token quota exceeded' },
      { status: 429 }
    );
  }

  return NextResponse.json(
    { success: true, remainingTokens: result.remaining },
    { status: 200 }
  );
}
