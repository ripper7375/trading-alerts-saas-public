'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, Search, TrendingUp, TrendingDown } from 'lucide-react';
import {
  ALL_SYMBOLS,
  FREE_SYMBOLS,
  SYMBOL_CATEGORIES,
  type UserTier,
  type Symbol,
} from '@/lib/chart-data';
import { cn } from '@/lib/utils';

interface SymbolSelectorProps {
  userTier: UserTier;
  selectedSymbol: string;
  onSymbolChange: (symbol: string) => void;
  onUpgradeClick: (itemType: 'symbol' | 'timeframe', itemName: string) => void;
}

export function SymbolSelector({
  userTier,
  selectedSymbol,
  onSymbolChange,
  onUpgradeClick,
}: SymbolSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedSymbolData = ALL_SYMBOLS.find((s) => s.code === selectedSymbol);

  const filteredSymbols = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return ALL_SYMBOLS.filter(
      (symbol) =>
        symbol.code.toLowerCase().includes(query) ||
        symbol.name.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const groupedSymbols = useMemo(() => {
    const groups: Record<string, Symbol[]> = {
      Forex: [],
      Crypto: [],
      Indices: [],
      Commodities: [],
    };

    filteredSymbols.forEach((symbol) => {
      groups[symbol.category].push(symbol);
    });

    return groups;
  }, [filteredSymbols]);

  const handleSymbolSelect = (symbolCode: string) => {
    if (userTier === 'FREE' && !FREE_SYMBOLS.includes(symbolCode)) {
      const symbol = ALL_SYMBOLS.find((s) => s.code === symbolCode);
      onUpgradeClick('symbol', symbol?.name || symbolCode);
      return;
    }
    onSymbolChange(symbolCode);
    setIsOpen(false);
    setSearchQuery('');
  };

  const isSymbolLocked = (symbolCode: string) => {
    return userTier === 'FREE' && !FREE_SYMBOLS.includes(symbolCode);
  };

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 border-2 rounded-lg px-4 py-2 cursor-pointer transition-colors',
          isOpen
            ? 'border-blue-600 bg-blue-50'
            : 'border-gray-300 hover:border-blue-600'
        )}
      >
        <div className="flex items-center gap-2 flex-1">
          <span className="text-lg font-bold text-gray-900">
            {selectedSymbolData?.code || selectedSymbol}
          </span>
          <span className="text-sm text-gray-600 hidden sm:inline">
            {selectedSymbolData?.name}
          </span>
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-gray-500 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute top-full mt-2 w-[95vw] sm:w-96 bg-white rounded-xl shadow-2xl border-2 border-gray-200 max-h-96 overflow-auto z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Search Bar */}
            <div className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 p-3 z-10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="🔍 Search symbols..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>

            {/* Symbol Groups */}
            <div className="py-2">
              {Object.entries(groupedSymbols).map(([category, symbols]) => {
                if (symbols.length === 0) return null;

                const categoryInfo =
                  SYMBOL_CATEGORIES[category as keyof typeof SYMBOL_CATEGORIES];

                return (
                  <div key={category}>
                    {/* Group Heading */}
                    <div className="px-4 py-2 bg-gray-100">
                      <h3 className="text-sm font-semibold text-gray-700 uppercase">
                        {categoryInfo.icon} {categoryInfo.label}
                      </h3>
                    </div>

                    {/* Symbol Items */}
                    {symbols.map((symbol) => {
                      const isLocked = isSymbolLocked(symbol.code);
                      const isSelected = symbol.code === selectedSymbol;

                      return (
                        <button
                          key={symbol.code}
                          onClick={() => handleSymbolSelect(symbol.code)}
                          disabled={isLocked}
                          className={cn(
                            'w-full flex items-center justify-between px-4 py-3 transition-colors text-left',
                            isSelected &&
                              'bg-blue-100 border-l-4 border-blue-600',
                            !isSelected && !isLocked && 'hover:bg-blue-50',
                            isLocked &&
                              'opacity-50 cursor-not-allowed hover:bg-gray-50'
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-base font-semibold text-gray-900">
                                {symbol.code}
                              </span>
                              {isLocked && (
                                <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap">
                                  🔒 PRO
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 truncate">
                              {symbol.name}
                            </div>
                          </div>

                          <div className="flex flex-col items-end ml-2 shrink-0">
                            <div className="text-sm font-medium text-gray-700 hidden sm:block">
                              {symbol.price}
                            </div>
                            <div
                              className={cn(
                                'text-xs flex items-center gap-0.5',
                                symbol.isPositive
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              )}
                            >
                              {symbol.isPositive ? (
                                <TrendingUp className="w-3 h-3" />
                              ) : (
                                <TrendingDown className="w-3 h-3" />
                              )}
                              <span className="hidden sm:inline">
                                {symbol.change}
                              </span>
                              <span>({symbol.changePercent})</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
