/**
 * Marketing Resources Service
 *
 * Prisma-backed business logic for the affiliate media-kit domain, shared by
 * the admin CRUD routes and the affiliate-facing read/engagement routes.
 *
 * @module lib/marketing-resources/service
 */

import { prisma } from '@/lib/db/prisma';
import type { Prisma, MarketingAsset } from '.prisma/non-market-client';

import type { AdminAssetListQuery, CreateAssetFields } from './validators';
import { MARKETING_ASSET_CATEGORIES } from './validators';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN: LIST + STATS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface AdminAssetListResult {
  assets: MarketingAsset[];
  total: number;
  page: number;
  limit: number;
  /** Total download/copy count across ALL assets regardless of filters. */
  totalDownloads: number;
  /** Size of the fixed category taxonomy (not "categories in use"). */
  categoryCount: number;
}

export async function listAssetsForAdmin(
  query: AdminAssetListQuery
): Promise<AdminAssetListResult> {
  const { search, category, status, page, limit } = query;

  const where: Prisma.MarketingAssetWhereInput = {
    ...(category && { category }),
    ...(status && { status }),
    ...(search && {
      title: { contains: search, mode: 'insensitive' as const },
    }),
  };

  const [assets, total, downloadAggregate] = await Promise.all([
    prisma.marketingAsset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.marketingAsset.count({ where }),
    prisma.marketingAsset.aggregate({ _sum: { downloadCount: true } }),
  ]);

  return {
    assets,
    total,
    page,
    limit,
    totalDownloads: downloadAggregate._sum.downloadCount ?? 0,
    categoryCount: MARKETING_ASSET_CATEGORIES.length,
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN: CREATE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface CreateAssetInput extends CreateAssetFields {
  fileUrl?: string;
  fileSize?: number;
  createdByUserId: string;
}

/**
 * Create a new published media-kit asset. SWIPE_COPY assets carry
 * `copyText` and no file; every other category carries `fileUrl`/`fileSize`
 * from an already-uploaded file (see `lib/marketing-resources/storage.ts`).
 */
export async function createAsset(
  input: CreateAssetInput
): Promise<MarketingAsset> {
  const isSwipeCopy = input.category === 'SWIPE_COPY';

  if (isSwipeCopy && !input.copyText) {
    throw new Error('COPY_TEXT_REQUIRED');
  }

  if (!isSwipeCopy && !input.fileUrl) {
    throw new Error('FILE_REQUIRED');
  }

  return prisma.marketingAsset.create({
    data: {
      title: input.title,
      category: input.category,
      format: input.format || (isSwipeCopy ? 'TXT' : 'FILE'),
      resolution: input.resolution || (isSwipeCopy ? 'Text Copy' : 'N/A'),
      fileUrl: isSwipeCopy ? null : (input.fileUrl ?? null),
      fileSize: isSwipeCopy ? null : (input.fileSize ?? null),
      copyText: isSwipeCopy ? (input.copyText ?? null) : null,
      status: 'ACTIVE',
      createdByUserId: input.createdByUserId,
    },
  });
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN: DELETE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function deleteAsset(id: string): Promise<MarketingAsset | null> {
  try {
    return await prisma.marketingAsset.delete({ where: { id } });
  } catch (error) {
    if (
      error instanceof Object &&
      'code' in error &&
      (error as { code?: string }).code === 'P2025'
    ) {
      return null;
    }
    throw error;
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AFFILIATE: LIST PUBLISHED
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function listPublishedAssets(filters: {
  category?: (typeof MARKETING_ASSET_CATEGORIES)[number];
}): Promise<MarketingAsset[]> {
  return prisma.marketingAsset.findMany({
    where: {
      status: 'ACTIVE',
      ...(filters.category && { category: filters.category }),
    },
    orderBy: { createdAt: 'desc' },
  });
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AFFILIATE: ENGAGEMENT (download / copy tracking)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Atomically increments an ACTIVE asset's download counter and returns the
 * updated row, or `null` if the asset doesn't exist or isn't published.
 * Used both for real file downloads (redirect route) and swipe-copy
 * "copy to clipboard" actions — both count as partner engagement.
 */
export async function recordAssetEngagement(
  id: string
): Promise<MarketingAsset | null> {
  const asset = await prisma.marketingAsset.findUnique({ where: { id } });

  if (!asset || asset.status !== 'ACTIVE') {
    return null;
  }

  return prisma.marketingAsset.update({
    where: { id },
    data: { downloadCount: { increment: 1 } },
  });
}
