/**
 * DavinTrade Academy tutorial types (mobile reference)
 *
 * Mirrors the monolith's TutorialCategory enum + TutorialVideo model shape
 * (prisma/non-market-data/schema.prisma) closely enough for UI purposes.
 */

export type TutorialCategory =
  | 'GETTING_STARTED'
  | 'PLATFORM_WALKTHROUGH'
  | 'TRADING_STRATEGIES'
  | 'RISK_MANAGEMENT'
  | 'MARKET_ANALYSIS';

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  youtubeVideoId: string;
  category: TutorialCategory;
  featured: boolean;
  viewCount: number;
}
