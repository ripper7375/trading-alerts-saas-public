'use client';

import { createContext, useContext, useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

/**
 * The documentation page's search box and accordion. The page is a Server
 * Component; what is client state here is the search text and which sections
 * are open. The search box sits with the page's heading and the list below it,
 * so the text lives in a provider that wraps both and renders no markup of its
 * own. Each section's heading and body are built on the server and arrive as
 * nodes; this file decides which sections to show and which are open.
 *
 * @module components/marketing/docs-browser
 */

interface DocsSearchState {
  query: string;
  setQuery: (query: string) => void;
}

const DocsSearchContext = createContext<DocsSearchState | null>(null);

function useDocsSearch(): DocsSearchState {
  const search = useContext(DocsSearchContext);
  if (!search) throw new Error('Docs search parts must sit in DocsSearch');
  return search;
}

export function DocsSearch({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [query, setQuery] = useState('');
  return (
    <DocsSearchContext.Provider value={{ query, setQuery }}>
      {children}
    </DocsSearchContext.Provider>
  );
}

export function DocsSearchInput({
  placeholder,
}: {
  placeholder: string;
}): React.ReactElement {
  const { query, setQuery } = useDocsSearch();
  return (
    <div className="relative mx-auto max-w-md pt-2">
      <Search className="absolute left-3.5 top-5 h-4 w-4 text-slate-400" />
      <Input
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-11 border-slate-200 bg-white pl-10 text-slate-900 focus:border-amber-500/60 dark:border-slate-800 dark:bg-[#090b14] dark:text-slate-200"
      />
    </div>
  );
}

export interface DocsSectionView {
  /** Searched, as is, by the search box. */
  title: string;
  /** Searched, as is, by the search box. */
  summary: string;
  /** The icon, title and summary inside the toggle button (server-built). */
  header: React.ReactNode;
  /** The list shown while the section is open (server-built). */
  body: React.ReactNode;
}

export function DocsSectionList({
  sections,
}: {
  sections: DocsSectionView[];
}): React.ReactElement {
  const { query } = useDocsSearch();
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({
    0: true,
    1: true,
  });

  const toggleSection = (index: number) => {
    setOpenSections((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const needle = query.toLowerCase();
  const filtered = sections.filter(
    (s) =>
      s.title.toLowerCase().includes(needle) ||
      s.summary.toLowerCase().includes(needle)
  );

  return (
    <div className="space-y-4 pt-4">
      {filtered.map((section, idx) => {
        const isOpen = Boolean(openSections[idx]);

        return (
          <Card
            key={idx}
            className="border-slate-200 bg-white shadow-md transition-colors hover:border-slate-300 dark:border-slate-800/80 dark:bg-[#090b14]/90 dark:backdrop-blur-xl dark:hover:border-slate-700"
          >
            <button
              type="button"
              onClick={() => toggleSection(idx)}
              aria-expanded={isOpen}
              className="flex w-full select-none items-center justify-between p-5 text-left"
            >
              {section.header}
              <span className="p-1 text-slate-500 dark:text-slate-400">
                {isOpen ? (
                  <ChevronUp className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-5 w-5" aria-hidden="true" />
                )}
              </span>
            </button>

            {isOpen && (
              <CardContent className="space-y-2 border-t border-slate-200 bg-slate-50/80 px-6 py-4 dark:border-slate-800/80 dark:bg-[#06080e]/60">
                {section.body}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
