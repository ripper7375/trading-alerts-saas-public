'use client';

/**
 * IndicatorSettingsModal — global lookback/OB-OS/HRMA/SMMA settings (spec
 * Sections 1/3.3/4.1/4.2), persisted via `/preferences`.
 *
 * Unlike the per-currency HRMA/SMMA detail modal's SESSION-LOCAL what-if
 * sliders, this modal edits the user's REAL saved defaults -- every value
 * here is lifted state owned by the cockpit (`useCurrencyIndexPreferences`)
 * and reaches the main chart's corridor immediately (spec's own "0ms
 * server roundtrip" requirement), while persistence to `/preferences` is
 * debounced in the hook itself so dragging a slider doesn't fire a request
 * per pixel.
 *
 * @module components/currency-index-pro/chart/indicator-settings-modal
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import type { CurrencyIndexPreferences } from '../hooks/use-currency-index-preferences';

interface IndicatorSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preferences: CurrencyIndexPreferences;
  onChange: (next: Partial<CurrencyIndexPreferences>) => void;
}

// Spec Section 1's discrete lookback options -- a segmented button group,
// not a slider, since these are 5 specific values, not a continuous range.
const LOOKBACK_OPTIONS = [5, 10, 20, 30, 60] as const;

export function IndicatorSettingsModal({
  open,
  onOpenChange,
  preferences,
  onChange,
}: IndicatorSettingsModalProps): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Currency Index Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Corridor lookback period
            </span>
            <div className="flex gap-1 rounded-md border border-border p-0.5">
              {LOOKBACK_OPTIONS.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => onChange({ lookbackDays: days })}
                  aria-pressed={preferences.lookbackDays === days}
                  className={`flex-1 rounded px-2 py-1 text-xs font-semibold transition-colors ${
                    preferences.lookbackDays === days
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Auto zones</div>
              <div className="text-xs text-muted-foreground">
                Use the system-computed daily corridor
              </div>
            </div>
            <Switch
              checked={preferences.useAutoZones}
              onCheckedChange={(checked) => onChange({ useAutoZones: checked })}
            />
          </div>

          {!preferences.useAutoZones && (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-muted-foreground">
                    Overbought override
                  </span>
                  <span className="font-mono tabular-nums">
                    +{(preferences.customObPct ?? 0.78).toFixed(2)}%
                  </span>
                </div>
                <Slider
                  value={[preferences.customObPct ?? 0.78]}
                  min={0.3}
                  max={2.0}
                  step={0.05}
                  onValueChange={(val) =>
                    onChange({ customObPct: val[0] ?? preferences.customObPct })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-muted-foreground">
                    Oversold override
                  </span>
                  <span className="font-mono tabular-nums">
                    {(preferences.customOsPct ?? -0.78).toFixed(2)}%
                  </span>
                </div>
                <Slider
                  value={[preferences.customOsPct ?? -0.78]}
                  min={-2.0}
                  max={-0.3}
                  step={0.05}
                  onValueChange={(val) =>
                    onChange({ customOsPct: val[0] ?? preferences.customOsPct })
                  }
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">
                HRMA period
              </span>
              <span className="font-mono tabular-nums">
                {preferences.hrmaPeriod}
              </span>
            </div>
            <Slider
              value={[preferences.hrmaPeriod]}
              min={10}
              max={100}
              step={1}
              onValueChange={(val) =>
                onChange({ hrmaPeriod: val[0] ?? preferences.hrmaPeriod })
              }
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">
                SMMA period
              </span>
              <span className="font-mono tabular-nums">
                {preferences.smmaPeriod}
              </span>
            </div>
            <Slider
              value={[preferences.smmaPeriod]}
              min={5}
              max={50}
              step={1}
              onValueChange={(val) =>
                onChange({ smmaPeriod: val[0] ?? preferences.smmaPeriod })
              }
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
