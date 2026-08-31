/**
 * Academy Tutorials Service
 *
 * Prisma-backed business logic for the public Academy domain, shared by the
 * admin CRUD routes and the public listing/detail pages.
 *
 * @module lib/tutorials/service
 */

import { prisma } from '@/lib/db/prisma';
import type { Prisma, TutorialVideo } from '.prisma/non-market-client';

import { extractYouTubeVideoId } from './youtube';
import type {
  AdminTutorialListQuery,
  CreateTutorialFields,
  UpdateTutorialFields,
  TutorialCategory,
} from './validators';
import { TUTORIAL_CATEGORIES } from './validators';

export type { TutorialCategory, TutorialStatus } from './validators';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN: LIST + STATS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface AdminTutorialListResult {
  tutorials: TutorialVideo[];
  total: number;
  page: number;
  limit: number;
  /** Total view count across ALL tutorials regardless of filters. */
  totalViews: number;
  /** Size of the fixed category taxonomy (not "categories in use"). */
  categoryCount: number;
}

export async function listTutorialsForAdmin(
  query: AdminTutorialListQuery
): Promise<AdminTutorialListResult> {
  const { search, category, status, page, limit } = query;

  const where: Prisma.TutorialVideoWhereInput = {
    ...(category && { category }),
    ...(status && { status }),
    ...(search && {
      title: { contains: search, mode: 'insensitive' as const },
    }),
  };

  const [tutorials, total, viewsAggregate] = await Promise.all([
    prisma.tutorialVideo.findMany({
      where,
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.tutorialVideo.count({ where }),
    prisma.tutorialVideo.aggregate({ _sum: { viewCount: true } }),
  ]);

  return {
    tutorials,
    total,
    page,
    limit,
    totalViews: viewsAggregate._sum.viewCount ?? 0,
    categoryCount: TUTORIAL_CATEGORIES.length,
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN: CREATE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface CreateTutorialInput extends CreateTutorialFields {
  createdByUserId: string;
}

/**
 * Create a new published tutorial. `youtubeVideoId` is parsed from
 * `youtubeUrl` here (validators.ts already confirmed the URL parses, via
 * `createTutorialFieldsSchema`'s `.refine()`) so it's derived exactly once,
 * never re-parsed by any render path.
 */
export async function createTutorial(
  input: CreateTutorialInput
): Promise<TutorialVideo> {
  const youtubeVideoId = extractYouTubeVideoId(input.youtubeUrl);
  if (!youtubeVideoId) {
    throw new Error('INVALID_YOUTUBE_URL');
  }

  return prisma.tutorialVideo.create({
    data: {
      title: input.title,
      description: input.description,
      youtubeUrl: input.youtubeUrl,
      youtubeVideoId,
      category: input.category,
      featured: input.featured,
      status: 'ACTIVE',
      createdByUserId: input.createdByUserId,
    },
  });
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN: UPDATE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Update an existing tutorial's fields/status. Re-parses `youtubeVideoId`
 * only when `youtubeUrl` is actually part of the patch (validators.ts's
 * `.refine()` already confirmed it parses if present). Returns `null` if
 * the tutorial doesn't exist.
 */
export async function updateTutorial(
  id: string,
  input: UpdateTutorialFields
): Promise<TutorialVideo | null> {
  const data: Prisma.TutorialVideoUpdateInput = {
    ...(input.title !== undefined && { title: input.title }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.category !== undefined && { category: input.category }),
    ...(input.featured !== undefined && { featured: input.featured }),
    ...(input.status !== undefined && { status: input.status }),
  };

  if (input.youtubeUrl !== undefined) {
    const youtubeVideoId = extractYouTubeVideoId(input.youtubeUrl);
    if (!youtubeVideoId) {
      throw new Error('INVALID_YOUTUBE_URL');
    }
    data.youtubeUrl = input.youtubeUrl;
    data.youtubeVideoId = youtubeVideoId;
  }

  try {
    return await prisma.tutorialVideo.update({ where: { id }, data });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN: DELETE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function deleteTutorial(
  id: string
): Promise<TutorialVideo | null> {
  try {
    return await prisma.tutorialVideo.delete({ where: { id } });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

function isRecordNotFoundError(error: unknown): boolean {
  return (
    error instanceof Object &&
    'code' in error &&
    (error as { code?: string }).code === 'P2025'
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PUBLIC: LIST PUBLISHED
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function listPublishedTutorials(filters: {
  category?: TutorialCategory;
}): Promise<TutorialVideo[]> {
  return prisma.tutorialVideo.findMany({
    where: {
      status: 'ACTIVE',
      ...(filters.category && { category: filters.category }),
    },
    orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
  });
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PUBLIC: DETAIL (+ view-count engagement tracking)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Returns a published tutorial, or `null` if it doesn't exist or isn't
 * published (DRAFT/ARCHIVED tutorials are never reachable from the public
 * site, regardless of a guessed ID). Read-only — safe to call more than
 * once per request (e.g. both `generateMetadata` and the page body), unlike
 * `incrementTutorialViewCount`, which must only ever run once per real view.
 */
export async function getPublishedTutorialById(
  id: string
): Promise<TutorialVideo | null> {
  const tutorial = await prisma.tutorialVideo.findUnique({ where: { id } });

  if (!tutorial || tutorial.status !== 'ACTIVE') {
    return null;
  }

  return tutorial;
}

/**
 * Atomically increments a tutorial's view count. Call exactly once per real
 * page view — from the detail page's own body only, never from
 * `generateMetadata` (which Next.js may invoke independently of the page
 * component for the same request).
 */
export async function incrementTutorialViewCount(id: string): Promise<void> {
  await prisma.tutorialVideo.update({
    where: { id },
    data: { viewCount: { increment: 1 } },
  });
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PUBLIC: RELATED
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function getRelatedTutorials(
  category: TutorialCategory,
  excludeId: string,
  limit = 3
): Promise<TutorialVideo[]> {
  return prisma.tutorialVideo.findMany({
    where: {
      status: 'ACTIVE',
      category,
      id: { not: excludeId },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
