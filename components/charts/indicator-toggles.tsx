'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Lock, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

import {
  BASIC_INDICATORS,
  PRO_ONLY_INDICATORS,
  INDICATOR_METADATA,
  type IndicatorId,
} from '@/lib/tier/constants';
import { canAccessIndicator } from '@/lib/tier/validator';
import { cn } from '@/lib/utils';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface IndicatorTogglesProps {
  selectedIndicators: IndicatorId[];
  onIndicatorToggle: (id: IndicatorId) => void;
  className?: string;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * IndicatorToggles Component
 *
 * Displays checkboxes for toggling chart indicators.
 * Shows lock icons for PRO-only indicators when user is on FREE tier.
 *
 * Features:
 * - Collapsible sections for basic and pro indicators
 * - Lock icons for tier-gated indicators
 * - Upgrade prompt for FREE users
 */
export function IndicatorToggles({
  selectedIndicators,
  onIndicatorToggle,
  className,
}: IndicatorTogglesProps): React.JSX.Element {
  const { data: session } = useSession();
  const userTier = (session?.user?.tier as 'FREE' | 'PRO') || 'FREE';
  const isPro = userTier === 'PRO';

  const [isBasicExpanded, setIsBasicExpanded] = useState(true);
  const [isProExpanded, setIsProExpanded] = useState(true);

  /**
   * Handle indicator toggle click
   */
  const handleToggle = (id: IndicatorId): void => {
    if (canAccessIndicator(userTier, id)) {
      onIndicatorToggle(id);
    }
  };

  /**
   * Render a single indicator toggle
   */
  const renderIndicatorToggle = (id: IndicatorId): React.JSX.Element => {
    const meta = INDICATOR_METADATA[id];
    const isSelected = selectedIndicators.includes(id);
    const hasAccess = canAccessIndicator(userTier, id);

    return (
      <label
        key={id}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer',
          hasAccess && 'hover:bg-gray-50',
          !hasAccess && 'opacity-60 cursor-not-allowed',
          isSelected && hasAccess && 'bg-blue-50'
        )}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => handleToggle(id)}
          disabled={!hasAccess}
          className={cn(
            'w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500',
            !hasAccess && 'cursor-not-allowed'
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-sm font-medium',
                isSelected && hasAccess ? 'text-blue-700' : 'text-gray-700',
                !hasAccess && 'text-gray-400'
              )}
            >
              {meta.label}
            </span>
            {meta.color && hasAccess && (
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: meta.color }}
              />
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">{meta.description}</p>
        </div>
        {!hasAccess && (
          <Lock className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
      </label>
    );
  };

  return (
    <div className={cn('bg-white rounded-lg border border-gray-200', className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">
          Technical Indicators
        </h3>
      </div>

      {/* Basic Indicators Section */}
      <div className="border-b border-gray-100">
        <button
          onClick={() => setIsBasicExpanded(!isBasicExpanded)}
          className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
          aria-expanded={isBasicExpanded}
          aria-controls="basic-indicators-content"
        >
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Basic
          </span>
          {isBasicExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {isBasicExpanded && (
          <div id="basic-indicators-content" className="px-1 pb-2">
            {BASIC_INDICATORS.map((id) => renderIndicatorToggle(id))}
          </div>
        )}
      </div>

      {/* PRO Indicators Section */}
      <div>
        <button
          onClick={() => setIsProExpanded(!isProExpanded)}
          className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
          aria-expanded={isProExpanded}
          aria-controls="pro-indicators-content"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Pro Indicators
            </span>
            {!isPro && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded">
                PRO
              </span>
            )}
          </div>
          {isProExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {isProExpanded && (
          <div id="pro-indicators-content" className="px-1 pb-2">
            {PRO_ONLY_INDICATORS.map((id) => renderIndicatorToggle(id))}

            {/* Upgrade Prompt for FREE users */}
            {!isPro && (
              <div className="mx-3 mt-3 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
                <p className="text-xs text-gray-600 mb-2">
                  Unlock all PRO indicators:
                </p>
                <ul className="text-xs text-gray-500 mb-3 space-y-1">
                  <li>• Keltner Channels (10-band)</li>
                  <li>• TEMA, HRMA, SMMA</li>
                  <li>• Momentum Candles</li>
                  <li>• ZigZag Structure</li>
                </ul>
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center w-full px-3 py-2 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-md hover:from-blue-700 hover:to-purple-700 transition-colors"
                >
                  Upgrade to PRO
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Export for use in parent components
 */
export type { IndicatorTogglesProps };
