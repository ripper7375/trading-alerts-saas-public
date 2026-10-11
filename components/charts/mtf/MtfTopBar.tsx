'use client';

/**
 * MtfTopBar — Unified top toolbar above the dual stacked MTF charts.
 *
 * Implements Proposed Design components:
 * - Component 7: Unified horizontal drawing toolbar (relocated from vertical chart strips)
 * - Component 8: Chart display mode toggles (Bar vs Candlestick)
 * - Component 9: M5 Overlay toggle button (relocated from chart divider)
 *
 * @module components/charts/mtf/MtfTopBar
 */

import {
  MousePointer2,
  Minus,
  TrendingUp,
  Spline,
  MoveDiagonal,
  Ruler,
  Type,
  Trash2,
  BarChart2,
  CandlestickChart,
  EyeOff,
} from 'lucide-react';
import type { ComponentType } from 'react';

import type { DrawingType } from '@/components/charts/drawing/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MtfToggle } from './MtfToggle';

export interface MtfTopBarProps {
  activeTool: DrawingType | null;
  onSelectTool: (tool: DrawingType | null) => void;
  onDeleteSelected?: () => void;
  priceMode: 'CANDLE' | 'BAR' | 'HIDE';
  onPriceModeChange: (mode: 'CANDLE' | 'BAR' | 'HIDE') => void;
  isPro: boolean;
  mtfEnabled: boolean;
  mtfLoading?: boolean;
  onToggleMtf: (enabled: boolean) => void;
}

interface ToolItem {
  id: DrawingType | null;
  icon: ComponentType<{ className?: string }>;
  label: string;
}

const TOOLS: ToolItem[] = [
  { id: null, icon: MousePointer2, label: 'Select / Cursor' },
  { id: 'HLINE', icon: Minus, label: 'Horizontal Line' },
  { id: 'TRENDLINE', icon: TrendingUp, label: 'Trendline' },
  { id: 'CHANNEL', icon: Spline, label: 'Parallel Channel' },
  { id: 'FIB_RETRACE', icon: Ruler, label: 'Fib Retracement' },
  { id: 'FIB_EXT', icon: MoveDiagonal, label: 'Fib Extension' },
  { id: 'TEXT', icon: Type, label: 'Text Note' },
];

export function MtfTopBar({
  activeTool,
  onSelectTool,
  onDeleteSelected,
  priceMode,
  onPriceModeChange,
  isPro,
  mtfEnabled,
  mtfLoading = false,
  onToggleMtf,
}: MtfTopBarProps): React.JSX.Element {
  return (
    <div className="border-border/80 bg-card/60 backdrop-blur-xs z-10 flex h-10 shrink-0 items-center justify-between border-b px-2.5">
      {/* Component 7: Unified Horizontal Drawing Toolbar */}
      <div className="border-border/70 bg-background/90 shadow-xs flex items-center gap-0.5 rounded-lg border p-0.5">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          return (
            <Button
              key={tool.id ?? 'select'}
              variant="ghost"
              size="icon"
              className={cn(
                'hover:bg-muted/60 h-7 w-7 rounded-md text-muted-foreground transition-all hover:text-foreground',
                isActive &&
                  'shadow-xs border border-[#2962FF] bg-[#2962FF]/20 font-bold text-[#2962FF] dark:text-blue-400'
              )}
              onClick={() => onSelectTool(tool.id)}
              title={tool.label}
              aria-label={tool.label}
            >
              <Icon className="h-3.5 w-3.5" />
            </Button>
          );
        })}
        {onDeleteSelected && (
          <>
            <div className="bg-border/60 mx-0.5 h-4 w-px" />
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-destructive/15 h-7 w-7 rounded-md text-muted-foreground transition-all hover:text-destructive"
              onClick={onDeleteSelected}
              title="Delete selected mark"
              aria-label="Delete selected mark"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>

      {/* Right controls: Component 8 (View Mode) + Component 9 (M5 Overlay) */}
      <div className="flex items-center gap-2">
        {/* Component 8: Price Display Mode (Bar vs Candle) */}
        <div className="border-border/70 bg-background/90 shadow-xs flex items-center rounded-lg border p-0.5">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'hover:bg-muted/60 h-7 w-7 rounded-md text-muted-foreground transition-all hover:text-foreground',
              priceMode === 'BAR' &&
                'shadow-xs border border-[#2962FF] bg-[#2962FF]/20 font-bold text-[#2962FF] dark:text-blue-400'
            )}
            onClick={() => onPriceModeChange('BAR')}
            title="Price Bar Mode"
            aria-label="Price Bar Mode"
          >
            <BarChart2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'hover:bg-muted/60 h-7 w-7 rounded-md text-muted-foreground transition-all hover:text-foreground',
              priceMode === 'CANDLE' &&
                'shadow-xs border border-[#2962FF] bg-[#2962FF]/20 font-bold text-[#2962FF] dark:text-blue-400'
            )}
            onClick={() => onPriceModeChange('CANDLE')}
            title="Price Candle Mode"
            aria-label="Price Candle Mode"
          >
            <CandlestickChart className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'hover:bg-muted/60 h-7 w-7 rounded-md text-muted-foreground transition-all hover:text-foreground',
              priceMode === 'HIDE' &&
                'shadow-xs border border-[#2962FF] bg-[#2962FF]/20 font-bold text-[#2962FF] dark:text-blue-400'
            )}
            onClick={() => onPriceModeChange('HIDE')}
            title="Hide Price Mode"
            aria-label="Hide Price Mode"
          >
            <EyeOff className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Component 9: M5 Overlay Button */}
        <MtfToggle
          isPro={isPro}
          enabled={mtfEnabled}
          isLoading={mtfLoading}
          onToggle={onToggleMtf}
        />
      </div>
    </div>
  );
}
