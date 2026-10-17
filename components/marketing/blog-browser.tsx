'use client';

import { createContext, Fragment, useContext, useState } from 'react';

import { ALL_CATEGORIES } from './blog-categories';

/**
 * The blog's category filter. The page is a Server Component; only the chosen
 * category is client state. The pills and the post grid sit in different parts
 * of the page, so the state lives in a provider that wraps both and renders no
 * markup of its own. The post cards themselves are built on the server and
 * arrive here as nodes; this file only decides which of them to show.
 *
 * @module components/marketing/blog-browser
 */

interface BlogFilterState {
  category: string;
  setCategory: (category: string) => void;
}

const BlogFilterContext = createContext<BlogFilterState | null>(null);

function useBlogFilter(): BlogFilterState {
  const filter = useContext(BlogFilterContext);
  if (!filter) throw new Error('Blog filter parts must sit in BlogFilter');
  return filter;
}

export function BlogFilter({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [category, setCategory] = useState(ALL_CATEGORIES);
  return (
    <BlogFilterContext.Provider value={{ category, setCategory }}>
      {children}
    </BlogFilterContext.Provider>
  );
}

export interface BlogCategoryView {
  /** The untranslated name posts are filed under (and `All`). */
  id: string;
  /** Its name in the visitor's language. */
  label: string;
}

export function BlogCategoryPills({
  categories,
}: {
  categories: BlogCategoryView[];
}): React.ReactElement {
  const { category, setCategory } = useBlogFilter();
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => setCategory(cat.id)}
          className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
            category === cat.id
              ? 'bg-amber-500 font-bold text-slate-950 shadow-md shadow-amber-500/20'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
          }`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}

export interface BlogPostView {
  id: number;
  /** The untranslated category the post is filed under. */
  category: string;
  /** The finished card, rendered on the server. */
  card: React.ReactNode;
}

export function BlogPostGrid({
  posts,
}: {
  posts: BlogPostView[];
}): React.ReactElement {
  const { category } = useBlogFilter();
  const shown =
    category === ALL_CATEGORIES
      ? posts
      : posts.filter((post) => post.category === category);
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {shown.map((post) => (
        <Fragment key={post.id}>{post.card}</Fragment>
      ))}
    </div>
  );
}
