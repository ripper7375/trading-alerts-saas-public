'use client';

import React from 'react';
import { useSupportChat } from '@/components/chat-widget/chat-context';
import { Headphones, MessageSquare, Sparkles } from 'lucide-react';
import { useLocale } from '@/lib/context/locale-context';

export function FloatingChatTrigger() {
  const { isOpen, toggleChat } = useSupportChat();
  const { t } = useLocale();

  if (isOpen) return null;

  return (
    <button
      onClick={toggleChat}
      className="fixed right-5 bottom-5 z-40 flex items-center space-x-2.5 rounded-full border border-amber-300/40 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 px-5 py-3 text-sm font-extrabold text-slate-950 shadow-2xl shadow-amber-500/40 transition-all duration-300 hover:scale-105 hover:shadow-amber-500/60 active:scale-95"
      aria-label={t('Open Support Centre Chat')}
    >
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-950/20">
        <Headphones className="h-4 w-4 text-slate-950" />
      </div>
      <span className="text-xs tracking-wide uppercase">
        {t('Support Centre')}
      </span>
      <span className="flex h-2 w-2 animate-ping rounded-full bg-slate-950" />
    </button>
  );
}
