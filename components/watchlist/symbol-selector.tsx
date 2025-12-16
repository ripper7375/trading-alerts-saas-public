'use client';

/**
 * Symbol Selector Component
 *
 * Dropdown component for selecting trading symbols.
 * Shows tier-appropriate options with lock icons on PRO-only symbols.
 *
 * @module components/watchlist/symbol-selector
 */

import { Lock, Search } from 'lucide-react';
import { useState, useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FREE_SYMBOLS, PRO_SYMBOLS, type Tier } from '@/lib/tier-config';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface SymbolSelectorProps {
  /** User's subscription tier */
  userTier: Tier;
  /** Currently selected symbol */
  selectedSymbol: string;
  /** Callback when symbol selection changes */
  onSymbolChange: (symbol: string) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
}

interface SymbolInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: Tier;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SYMBOL DATA
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SYMBOL_INFO: Record<string, { name: string; description: string; icon: string }> = {
  BTCUSD: { name: 'BTCUSD', description: 'Bitcoin', icon: '₿' },
  EURUSD: { name: 'EURUSD', description: 'Euro / US Dollar', icon: '€' },
  USDJPY: { name: 'USDJPY', description: 'US Dollar / Japanese Yen', icon: '¥' },
  US30: { name: 'US30', description: 'Dow Jones', icon: '📈' },
  XAUUSD: { name: 'XAUUSD', description: 'Gold', icon: '🥇' },
  AUDJPY: { name: 'AUDJPY', description: 'Australian Dollar / Yen', icon: '🦘' },
  AUDUSD: { name: 'AUDUSD', description: 'Australian Dollar / USD', icon: '🇦🇺' },
  ETHUSD: { name: 'ETHUSD', description: 'Ethereum', icon: '⟠' },
  GBPJPY: { name: 'GBPJPY', description: 'British Pound / Yen', icon: '£' },
  GBPUSD: { name: 'GBPUSD', description: 'British Pound / USD', icon: '💷' },
  NDX100: { name: 'NDX100', description: 'Nasdaq 100', icon: '📊' },
  NZDUSD: { name: 'NZDUSD', description: 'New Zealand Dollar / USD', icon: '🥝' },
  USDCAD: { name: 'USDCAD', description: 'USD / Canadian Dollar', icon: '🍁' },
  USDCHF: { name: 'USDCHF', description: 'USD / Swiss Franc', icon: '🇨🇭' },
  XAGUSD: { name: 'XAGUSD', description: 'Silver', icon: '🥈' },
};

/**
 * Get all symbols with their tier information
 */
function getAllSymbols(): SymbolInfo[] {
  return PRO_SYMBOLS.map((symbol) => ({
    id: symbol,
    name: SYMBOL_INFO[symbol]?.name || symbol,
    description: SYMBOL_INFO[symbol]?.description || symbol,
    icon: SYMBOL_INFO[symbol]?.icon || '📊',
    tier: FREE_SYMBOLS.includes(symbol as (typeof FREE_SYMBOLS)[number]) ? 'FREE' : 'PRO',
  }));
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Symbol Selector Component
 *
 * A dropdown component for selecting trading symbols with tier filtering.
 * Shows all symbols but locks PRO-only symbols for FREE tier users.
 */
export function SymbolSelector({
  userTier,
  selectedSymbol,
  onSymbolChange,
  disabled = false,
}: SymbolSelectorProps): React.JSX.Element {
  const [searchQuery, setSearchQuery] = useState('');

  const availableSymbols = userTier === 'PRO' ? PRO_SYMBOLS : FREE_SYMBOLS;
  const allSymbols = useMemo(() => getAllSymbols(), []);

  // Filter symbols based on search query
  const filteredSymbols = useMemo(() => {
    if (!searchQuery) return allSymbols;

    const query = searchQuery.toLowerCase();
    return allSymbols.filter(
      (symbol) =>
        symbol.id.toLowerCase().includes(query) ||
        symbol.description.toLowerCase().includes(query)
    );
  }, [allSymbols, searchQuery]);

  return (
    <Select
      value={selectedSymbol}
      onValueChange={onSymbolChange}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a symbol">
          {selectedSymbol && (
            <div className="flex items-center gap-2">
              <span>{SYMBOL_INFO[selectedSymbol]?.icon}</span>
              <span>{selectedSymbol}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {/* Search Input */}
        <div className="px-2 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search symbols..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              className="pl-8"
              onClick={(e: React.MouseEvent<HTMLInputElement>) => e.stopPropagation()}
            />
          </div>
        </div>

        {/* Symbol List */}
        {filteredSymbols.length > 0 ? (
          filteredSymbols.map((symbol) => {
            const isLocked = !(availableSymbols as readonly string[]).includes(symbol.id);

            return (
              <SelectItem
                key={symbol.id}
                value={symbol.id}
                disabled={isLocked}
                className="py-3"
              >
                <div className="flex items-center gap-2 w-full">
                  <span className="text-lg">{symbol.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{symbol.name}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {symbol.description}
                    </div>
                  </div>
                  {isLocked && <Lock className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                  {symbol.tier === 'PRO' && (
                    <Badge
                      variant="secondary"
                      className="bg-purple-100 text-purple-700 text-xs flex-shrink-0"
                    >
                      PRO
                    </Badge>
                  )}
                </div>
              </SelectItem>
            );
          })
        ) : (
          <div className="py-4 text-center text-sm text-gray-500">
            No symbols found
          </div>
        )}
      </SelectContent>
    </Select>
  );
}

export default SymbolSelector;
