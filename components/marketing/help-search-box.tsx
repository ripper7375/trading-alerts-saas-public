'use client';

import { useState } from 'react';

import { Input } from '@/components/ui/input';

/**
 * The Help Centre's search box: the one interactive piece of an otherwise
 * server-rendered page. (The page has always held the text in state without
 * filtering the questions by it; moving it here keeps that exactly as it was.)
 */
export function HelpSearchBox({
  placeholder,
}: {
  placeholder: string;
}): React.ReactElement {
  const [search, setSearch] = useState('');
  return (
    <Input
      placeholder={placeholder}
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      className="h-11 border-slate-200 bg-white pl-10 text-slate-900 focus:border-amber-500/60 dark:border-slate-800 dark:bg-[#090b14] dark:text-slate-200"
    />
  );
}
