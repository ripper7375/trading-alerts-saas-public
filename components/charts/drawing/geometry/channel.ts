/**
 * Equidistant / parallel channel geometry.
 *
 * Session 4B-1 (F9): hoisted into `@trading-alerts/types`. This file is a
 * thin re-export so every existing `../geometry/channel` import keeps
 * working unchanged. Never fork this math back into this tree — edit
 * `packages/types/src/geometry/channel.ts` instead.
 *
 * @module components/charts/drawing/geometry/channel
 */

export { channelLevels } from '@trading-alerts/types/geometry';
export type { ChannelLevels } from '@trading-alerts/types/geometry';
