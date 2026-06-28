/**
 * Tier usage helpers — compute "used / limit" for drawings and alerts so the UI
 * can surface tier gating. Pure; reuses the existing tier config.
 *
 * @module components/charts/drawing/tierUsage
 */

import { DRAWING_LIMITS } from '@/lib/drawing/schema';
import { getAlertLimit } from '@/lib/tier-validation';

export type Tier = 'FREE' | 'PRO';

export interface Usage {
  count: number;
  limit: number;
  atLimit: boolean;
  label: string;
}

function usage(count: number, limit: number): Usage {
  return {
    count,
    limit,
    atLimit: count >= limit,
    label: `${count} / ${limit}`,
  };
}

export function alertUsage(tier: Tier, count: number): Usage {
  return usage(count, getAlertLimit(tier));
}

export function drawingUsage(tier: Tier, count: number): Usage {
  const limit = DRAWING_LIMITS[tier] ?? DRAWING_LIMITS.FREE;
  return usage(count, limit);
}
