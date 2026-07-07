'use client';

/**
 * MtfToggle — PRO-gated switch for multi-timeframe visualization (V8).
 *
 * PRO: toggles the M5 channel overlay on the current chart.
 * FREE: shows a locked control that routes to /pricing.
 *
 * @module components/charts/mtf/MtfToggle
 */

import { Layers, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { JSX } from 'react';

interface MtfToggleProps {
  isPro: boolean;
  enabled: boolean;
  isLoading?: boolean;
  onToggle: (enabled: boolean) => void;
}

export function MtfToggle({
  isPro,
  enabled,
  isLoading = false,
  onToggle,
}: MtfToggleProps): JSX.Element {
  const router = useRouter();

  if (!isPro) {
    return (
      <button
        type="button"
        onClick={() => router.push('/pricing')}
        title="Multi-timeframe visualization is a PRO feature — upgrade to unlock"
        className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
      >
        <Lock className="h-3.5 w-3.5" />
        M5 Overlay
        <span className="rounded bg-blue-600 px-1 text-[10px] font-bold text-white">
          PRO
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onToggle(!enabled)}
      disabled={isLoading}
      title={
        enabled
          ? 'Hide the M5 equal-distance channel overlay'
          : 'Overlay the M5 equal-distance channel on this chart'
      }
      className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
        enabled
          ? 'border-blue-600 bg-blue-50 text-blue-700'
          : 'border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600'
      } ${isLoading ? 'opacity-60' : ''}`}
    >
      <Layers className="h-3.5 w-3.5" />
      M5 Overlay
      {isLoading && <span className="text-xs">…</span>}
    </button>
  );
}
