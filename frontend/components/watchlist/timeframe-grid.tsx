'use client';

/**
 * Timeframe Grid Component
 *
 * Grid of selectable timeframe buttons with tier-based filtering.
 * Shows all 9 timeframes but locks PRO-only options for FREE users.
 *
 * @module components/watchlist/timeframe-grid
 */

import { Lock } from 'lucide-react';
import Link from 'next/link';
import { useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FREE_TIMEFRAMES, PRO_TIMEFRAMES, type Tier } from '@/lib/tier-config';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface TimeframeGridProps {
  /** User's subscription tier */
  userTier: Tier;
  /** Currently selected timeframe */
  selectedTimeframe: string;
  /** Callback when timeframe selection changes */
  onTimeframeChange: (timeframe: string) => void;
  /** Whether to show upgrade dialog on locked click */
  showUpgradePrompt?: boolean;
  /** Whether the grid is disabled */
  disabled?: boolean;
}

interface TimeframeInfo {
  id: string;
  name: string;
  tier: Tier;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TIMEFRAME DATA
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const TIMEFRAME_INFO: TimeframeInfo[] = [
  { id: 'M5', name: '5 Minutes', tier: 'PRO' },
  { id: 'M15', name: '15 Minutes', tier: 'PRO' },
  { id: 'M30', name: '30 Minutes', tier: 'PRO' },
  { id: 'H1', name: '1 Hour', tier: 'FREE' },
  { id: 'H2', name: '2 Hours', tier: 'PRO' },
  { id: 'H4', name: '4 Hours', tier: 'FREE' },
  { id: 'H8', name: '8 Hours', tier: 'PRO' },
  { id: 'H12', name: '12 Hours', tier: 'PRO' },
  { id: 'D1', name: '1 Day', tier: 'FREE' },
];

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Timeframe Grid Component
 *
 * Displays a grid of timeframe selection buttons with tier filtering.
 * PRO-only timeframes are locked for FREE tier users with visual indicators.
 */
export function TimeframeGrid({
  userTier,
  selectedTimeframe,
  onTimeframeChange,
  showUpgradePrompt: _showUpgradePrompt = true,
  disabled = false,
}: TimeframeGridProps): React.JSX.Element {
  const availableTimeframes =
    userTier === 'PRO' ? PRO_TIMEFRAMES : FREE_TIMEFRAMES;

  const handleTimeframeClick = useCallback(
    (timeframe: string, isLocked: boolean) => {
      if (disabled) return;

      if (!isLocked) {
        onTimeframeChange(timeframe);
      }
      // If locked and showUpgradePrompt is true, the dialog will be triggered by state
    },
    [disabled, onTimeframeChange]
  );

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {TIMEFRAME_INFO.map((timeframe) => {
          const isLocked = !(availableTimeframes as readonly string[]).includes(
            timeframe.id
          );
          const isSelected = selectedTimeframe === timeframe.id;

          return (
            <button
              key={timeframe.id}
              type="button"
              onClick={() => handleTimeframeClick(timeframe.id, isLocked)}
              disabled={disabled || isLocked}
              className={`
                border-2 rounded-lg px-4 py-3 text-center transition-all
                ${
                  isSelected
                    ? 'bg-blue-50 border-blue-600 text-blue-600 font-semibold'
                    : 'border-gray-300 hover:border-blue-600'
                }
                ${isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <div className="flex items-center justify-center gap-2">
                {isLocked && <Lock className="h-3 w-3" />}
                <span className="font-semibold">{timeframe.id}</span>
              </div>
              <div className="text-xs mt-1 text-gray-600">{timeframe.name}</div>
              {timeframe.tier === 'PRO' && (
                <Badge
                  variant="secondary"
                  className="bg-purple-100 text-purple-700 text-xs mt-1"
                >
                  PRO
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Tier Info for FREE users */}
      {userTier === 'FREE' && (
        <p className="text-xs text-gray-500 mt-2">
          FREE tier: H1, H4, D1 only.{' '}
          <Link href="/pricing" className="text-blue-600 hover:underline">
            Upgrade to PRO
          </Link>{' '}
          for all 9 timeframes.
        </p>
      )}
    </div>
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UPGRADE DIALOG COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface UpgradeDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback to close the dialog */
  onClose: () => void;
  /** The locked timeframe that was clicked */
  lockedTimeframe?: string;
}

/**
 * Upgrade Dialog Component
 *
 * Shows when a FREE user tries to select a PRO-only timeframe.
 */
export function TimeframeUpgradeDialog({
  open,
  onClose,
  lockedTimeframe,
}: UpgradeDialogProps): React.JSX.Element {
  const timeframeInfo = TIMEFRAME_INFO.find((t) => t.id === lockedTimeframe);
  const { regularPrice } = useAffiliateConfig();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-purple-600" />
            PRO Timeframe Required
          </DialogTitle>
          <DialogDescription>
            {timeframeInfo ? (
              <>
                The <strong>{timeframeInfo.id}</strong> ({timeframeInfo.name})
                timeframe is only available to PRO subscribers.
              </>
            ) : (
              'This timeframe is only available to PRO subscribers.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h4 className="font-semibold text-purple-900 mb-2">
              PRO Tier Benefits
            </h4>
            <ul className="text-sm text-purple-800 space-y-1">
              <li>
                • All 9 timeframes (M5, M15, M30, H1, H2, H4, H8, H12, D1)
              </li>
              <li>• All 15 trading symbols</li>
              <li>• 50 watchlist items (vs 5 for FREE)</li>
              <li>• 20 price alerts (vs 5 for FREE)</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Maybe Later
            </Button>
            <Button
              asChild
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              <Link href="/pricing">Upgrade to PRO - ${regularPrice}/mo</Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TimeframeGrid;
