/**
 * Affiliate Resources API Route
 *
 * GET /api/affiliate/dashboard/resources
 * Returns the calling affiliate's active referral codes (with discount %)
 * alongside every published (ACTIVE) media-kit asset — brand logos,
 * mascots, ad banners, swipe copy, and guideline docs.
 *
 * @module app/api/affiliate/dashboard/resources/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAffiliate, getAffiliateProfile } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { affiliateAssetListQuerySchema } from '@/lib/marketing-resources/validators';
import { listPublishedAssets } from '@/lib/marketing-resources/service';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAffiliate();

    const profile = await getAffiliateProfile();
    if (!profile) {
      return NextResponse.json(
        {
          error: 'Profile not found',
          message: 'Affiliate profile not found',
          code: 'PROFILE_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const validation = affiliateAssetListQuerySchema.safeParse(searchParams);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const [codes, assets] = await Promise.all([
      prisma.affiliateCode.findMany({
        where: { affiliateProfileId: profile.id, status: 'ACTIVE' },
        orderBy: { distributedAt: 'desc' },
        select: {
          id: true,
          code: true,
          discountPercent: true,
          expiresAt: true,
        },
      }),
      listPublishedAssets({ category: validation.data.category }),
    ]);

    return NextResponse.json({
      codes,
      assets: assets.map((asset) => ({
        id: asset.id,
        title: asset.title,
        category: asset.category,
        format: asset.format,
        resolution: asset.resolution,
        fileUrl: asset.fileUrl,
        fileSize: asset.fileSize,
        copyText: asset.copyText,
        downloadCount: asset.downloadCount,
        updatedAt: asset.updatedAt,
      })),
    });
  } catch (error) {
    console.error('[Affiliate Resources] Error:', error);

    if (error instanceof Error) {
      if (error.message.includes('AFFILIATE_REQUIRED')) {
        return NextResponse.json(
          {
            error: 'Forbidden',
            message: 'Affiliate access required',
            code: 'AFFILIATE_REQUIRED',
          },
          { status: 403 }
        );
      }
      if (
        error.message.includes('UNAUTHORIZED') ||
        error.message === 'Unauthorized'
      ) {
        return NextResponse.json(
          {
            error: 'Unauthorized',
            message: 'Authentication required',
            code: 'UNAUTHORIZED',
          },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch resources',
        message: 'Unable to retrieve media kit',
        code: 'RESOURCES_ERROR',
      },
      { status: 500 }
    );
  }
}
