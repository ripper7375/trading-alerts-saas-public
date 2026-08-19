import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { Tier, Symbol, Timeframe } from '@/lib/types';
import {
  TIER_CONFIGS,
  TierConfig,
  FREE_ALLOWED_SYMBOLS,
  FREE_ALLOWED_TIMEFRAMES,
} from '@/lib/tier-config';
import { useAuth } from './AuthContext';

interface SubscriptionContextType {
  tier: Tier;
  isPro: boolean;
  config: TierConfig;
  canAccessSymbol: (symbol: Symbol) => boolean;
  canAccessTimeframe: (tf: Timeframe) => boolean;
  maxAlerts: number;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(
  undefined
);

export const SubscriptionProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { tier, isPro } = useAuth();

  const config = useMemo(() => TIER_CONFIGS[tier] || TIER_CONFIGS.FREE, [tier]);

  const canAccessSymbol = (symbol: Symbol): boolean => {
    if (isPro) return true;
    return FREE_ALLOWED_SYMBOLS.includes(symbol);
  };

  const canAccessTimeframe = (tf: Timeframe): boolean => {
    if (isPro) return true;
    return FREE_ALLOWED_TIMEFRAMES.includes(tf);
  };

  return (
    <SubscriptionContext.Provider
      value={{
        tier,
        isPro,
        config,
        canAccessSymbol,
        canAccessTimeframe,
        maxAlerts: config.maxActiveAlerts,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error(
      'useSubscription must be used within a SubscriptionProvider'
    );
  }
  return context;
};
