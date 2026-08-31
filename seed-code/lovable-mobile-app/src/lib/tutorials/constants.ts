/**
 * Academy tutorials constants + mock catalog (mobile reference)
 *
 * Mirrors lib/tutorials/validators.ts's TUTORIAL_CATEGORIES and the
 * monolith's CATEGORY_LABELS maps used on both academy pages. This app has
 * no admin console or backend for tutorials (public/marketing content
 * only), so the catalog is a static mock list -- matches the "Zero Mock
 * Data" principle stated on the real admin page's own doc comment being a
 * non-issue here, since these are public reference rows, not fake user data.
 */

import type { Tutorial, TutorialCategory } from '@/types/tutorial';

export const TUTORIAL_CATEGORIES: readonly TutorialCategory[] = [
  'GETTING_STARTED',
  'PLATFORM_WALKTHROUGH',
  'TRADING_STRATEGIES',
  'RISK_MANAGEMENT',
  'MARKET_ANALYSIS',
];

export const CATEGORY_LABELS: Record<TutorialCategory, string> = {
  GETTING_STARTED: 'Getting Started',
  PLATFORM_WALKTHROUGH: 'Platform Walkthrough',
  TRADING_STRATEGIES: 'Trading Strategies',
  RISK_MANAGEMENT: 'Risk Management',
  MARKET_ANALYSIS: 'Market Analysis',
};

export const MOCK_TUTORIALS: Tutorial[] = [
  {
    id: 't1',
    title: 'Welcome to DavinTrade: Your First 5 Minutes',
    description:
      'A quick tour of the dashboard, watchlist, and alerts so you know exactly where everything lives before you place your first trade.',
    youtubeVideoId: 'dQw4w9WgXcQ',
    category: 'GETTING_STARTED',
    featured: true,
    viewCount: 4210,
  },
  {
    id: 't2',
    title: 'AI Pattern Recognition Walkthrough',
    description:
      'See how DavinTrade’s AI flags fractal breakout patterns in real time, and how to turn a flagged pattern into an alert.',
    youtubeVideoId: 'jNQXAC9IVRw',
    category: 'PLATFORM_WALKTHROUGH',
    featured: false,
    viewCount: 2875,
  },
  {
    id: 't3',
    title: '3 Fractal Breakout Strategies for Beginners',
    description:
      'Three beginner-friendly breakout setups explained step by step, with real chart examples from the DavinTrade fractal engine.',
    youtubeVideoId: '9bZkp7q19f0',
    category: 'TRADING_STRATEGIES',
    featured: false,
    viewCount: 1932,
  },
  {
    id: 't4',
    title: 'Position Sizing & Stop-Loss Fundamentals',
    description:
      'Why most losing streaks are a position-sizing problem, not a strategy problem -- and how to set stops that actually protect you.',
    youtubeVideoId: 'M7lc1UVf-VE',
    category: 'RISK_MANAGEMENT',
    featured: false,
    viewCount: 1504,
  },
  {
    id: 't5',
    title: 'Reading Market Structure Like a Pro',
    description:
      'Higher highs, higher lows, and everything in between -- a practical framework for reading trend structure before you enter a trade.',
    youtubeVideoId: 'dQw4w9WgXcQ',
    category: 'MARKET_ANALYSIS',
    featured: false,
    viewCount: 987,
  },
  {
    id: 't6',
    title: 'Setting Up Your First Alert Rule',
    description:
      'A hands-on walkthrough of the alert-rule wizard, from picking a symbol and timeframe to choosing how you get notified.',
    youtubeVideoId: 'jNQXAC9IVRw',
    category: 'GETTING_STARTED',
    featured: false,
    viewCount: 3102,
  },
];

export function getTutorialById(id: string): Tutorial | undefined {
  return MOCK_TUTORIALS.find((t) => t.id === id);
}

export function getRelatedTutorials(
  category: TutorialCategory,
  excludeId: string,
  limit = 3
): Tutorial[] {
  return MOCK_TUTORIALS.filter(
    (t) => t.category === category && t.id !== excludeId
  ).slice(0, limit);
}
