/**
 * The blog's category names. They are the keys posts are filed under and the
 * keys of their translations, so they stay in English here; this module has no
 * `'use client'`, so the server page can read the values it exports.
 *
 * @module components/marketing/blog-categories
 */

export const ALL_CATEGORIES = 'All';

export const BLOG_CATEGORIES = [
  ALL_CATEGORIES,
  'Fractal Models',
  'AI Research',
  'Risk Management',
  'Market Insights',
] as const;
