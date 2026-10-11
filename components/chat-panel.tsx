'use client';

/**
 * AI Analyst Chat Panel
 *
 * Implements Proposed Design:
 * - Component 1: Header with model selector dropdown (Gemini 3.6 Flash default, Claude Sonnet 5, GPT 5.6 Terra, GLM-5.2, Kimi K3, DeepSeek V4 Flash).
 * - Component 2: Footer token quota bar "✦ Monthly Token Quota" (42,500 / 500,000) with purple progress bar.
 * - Component 3: Footer interactive chat input "Ask Gemini..." with CornerDownLeft button.
 * - Center: Clean AI Copilot coming soon empty state.
 *
 * @module components/chat-panel
 */

import { useEffect, useState } from 'react';
import {
  Bot,
  ChevronLeft,
  CornerDownLeft,
  LineChart,
  Lock,
  Sparkles,
  Zap,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLocale } from '@/lib/context/locale-context';
import { PRO_TIER_CONFIG, type Tier } from '@/lib/tier-config';

export const ANALYST_MODELS = [
  {
    id: 'gemini-3-6-flash',
    name: 'Gemini 3.6 Flash',
    isDefault: true,
    proOnly: false,
  },
  { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', proOnly: true },
  { id: 'gpt-5-6-terra', name: 'GPT 5.6 Terra', proOnly: true },
  { id: 'glm-5-2', name: 'GLM-5.2', proOnly: true },
  { id: 'kimi-k3', name: 'Kimi K3', proOnly: true },
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', proOnly: true },
];

export interface ChatPanelProps {
  tier: Tier;
  onCollapsePanel?: () => void;
  onOpenUpgradeModal?: () => void;
  symbol?: string;
  timeframe?: string;
  pendingPrompt?: string | null;
  onClearPendingPrompt?: () => void;
}

export default function ChatPanel({
  tier,
  onCollapsePanel,
  onOpenUpgradeModal,
  pendingPrompt,
  onClearPendingPrompt,
}: ChatPanelProps): React.JSX.Element {
  const { t, language } = useLocale();
  const [selectedModel, setSelectedModel] = useState('gemini-3-6-flash');
  const [tokensUsed] = useState(42500);
  const [input, setInput] = useState('');

  useEffect(() => {
    if (pendingPrompt) {
      setInput(pendingPrompt);
      onClearPendingPrompt?.();
    }
  }, [pendingPrompt, onClearPendingPrompt]);

  const monthlyQuota = PRO_TIER_CONFIG.aiMonthlyTokenQuota ?? 500000;
  const activeModelObj =
    ANALYST_MODELS.find((m) => m.id === selectedModel) ?? ANALYST_MODELS[0];

  const handleModelChange = (modelId: string) => {
    const targetModel = ANALYST_MODELS.find((m) => m.id === modelId);
    if (tier === 'FREE' && targetModel?.proOnly) {
      if (onOpenUpgradeModal) onOpenUpgradeModal();
      return;
    }
    setSelectedModel(modelId);
  };

  const handleSendMessage = () => {
    if (!input.trim()) return;
    setInput('');
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden border-r border-border bg-card">
      {/* Component 1: AI Analyst Header with Model Selector Dropdown */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Bot className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold text-foreground">
            {t('AI Analyst')}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Select value={selectedModel} onValueChange={handleModelChange}>
            <SelectTrigger
              className="h-7 w-[160px] border-border bg-background text-xs font-semibold text-foreground focus:ring-amber-500/30"
              aria-label="Select model"
            >
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent className="border-border bg-popover">
              {ANALYST_MODELS.map((model) => (
                <SelectItem
                  key={model.id}
                  value={model.id}
                  className="text-xs focus:bg-accent focus:text-accent-foreground"
                >
                  <div className="flex w-full items-center justify-between gap-1.5">
                    <span>{model.name}</span>
                    {tier === 'FREE' && model.proOnly && (
                      <Badge
                        variant="outline"
                        className="ml-1.5 h-3.5 border-amber-500/40 bg-amber-500/10 px-1 font-mono text-[8px] text-amber-600 dark:text-amber-400"
                      >
                        PRO
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {onCollapsePanel && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onCollapsePanel}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              title={t('Collapse panel')}
              aria-label={t('Collapse panel')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Center: Clean Empty State Illustration */}
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Bot className="h-6 w-6" />
        </div>
        <p className="text-sm font-bold text-foreground">
          {t('AI Copilot Coming Soon')}
        </p>
        <p className="max-w-[220px] text-xs leading-relaxed text-muted-foreground">
          {t(
            'AI Copilot backend connects in a future phase — chart and line alerts are already active on the panel to the right.'
          )}
        </p>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
          <LineChart className="h-3.5 w-3.5" />
          <span>{t('Real-time XAUUSD chart is live')}</span>
        </div>
        {tier === 'FREE' && onOpenUpgradeModal && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenUpgradeModal}
            className="mt-3 h-7 border-amber-500/40 bg-amber-500/10 text-[11px] font-bold text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
          >
            {t('Get priority access on PRO')}
          </Button>
        )}
      </div>

      {/* Component 2: Monthly Token Quota Bar */}
      <div className="border-border/70 bg-muted/20 shrink-0 border-t px-3.5 py-2 text-[11px]">
        <div className="mb-1.5 flex items-center justify-between font-medium">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Zap className="h-3 w-3 text-purple-500 dark:text-purple-400" />
            <span className="font-semibold text-foreground">
              ✦ {t('Monthly Token Quota')}
            </span>
          </span>
          <span className="font-mono text-[10px] font-bold text-foreground">
            {tokensUsed.toLocaleString(language)} /{' '}
            {tier === 'PRO'
              ? monthlyQuota.toLocaleString(language)
              : (50000).toLocaleString(language)}
          </span>
        </div>
        <Progress
          value={(tokensUsed / (tier === 'PRO' ? monthlyQuota : 50000)) * 100}
          className="bg-muted/60 h-1.5 [&>[data-slot=progress-indicator]]:bg-purple-500 dark:[&>[data-slot=progress-indicator]]:bg-purple-400"
        />
      </div>

      {/* Component 3: Chat Input / Footer */}
      <div className="shrink-0 border-t border-border bg-card p-3">
        {tier === 'PRO' ? (
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={`${t('Ask')} ${activeModelObj?.name.split(' ')[0] ?? 'AI'}...`}
              className="min-h-[58px] w-full resize-none rounded-xl border border-input bg-background py-2.5 pl-3.5 pr-12 text-xs text-foreground placeholder:text-xs placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              rows={2}
            />
            <div className="absolute bottom-2.5 right-2.5">
              <Button
                size="icon"
                disabled={!input.trim()}
                className="shadow-xs h-7 w-7 rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-30"
                onClick={handleSendMessage}
                title="Press Enter to send"
                aria-label="Send prompt"
              >
                <CornerDownLeft className="h-3.5 w-3.5 stroke-[2.5]" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 sm:flex-row">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <div className="text-xs font-bold text-foreground">
                  Read-Only (FREE Tier)
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Upgrade to PRO to interact with the AI Analyst.
                </div>
              </div>
            </div>
            {onOpenUpgradeModal && (
              <Button
                size="sm"
                onClick={onOpenUpgradeModal}
                className="h-6 shrink-0 bg-amber-500 text-[10px] font-bold text-slate-950 hover:bg-amber-400"
              >
                <Sparkles className="mr-1 h-3 w-3 fill-black" />
                {t('Upgrade to PRO')}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
