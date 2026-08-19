import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Stripe product/price configuration
export const SUBSCRIPTION_TIERS = {
  free: {
    product_id: null,
    price_id: null,
    name: 'Free',
    level: 0,
    limits: {
      watchlistItems: 5,
      alerts: 3,
      realtimeUpdates: false,
      advancedAlerts: false,
      technicalIndicators: false,
      aiInsights: false,
      portfolioAnalytics: false,
      apiAccess: false,
    },
  },
  basic: {
    product_id: 'prod_TkpwryMzXgNwt0',
    price_id: 'price_1SnKGE55Obu9Ws2ALJ7EVUrm',
    name: 'Basic',
    level: 1,
    limits: {
      watchlistItems: 25,
      alerts: 10,
      realtimeUpdates: true,
      advancedAlerts: false,
      technicalIndicators: false,
      aiInsights: false,
      portfolioAnalytics: false,
      apiAccess: false,
    },
  },
  pro: {
    product_id: 'prod_TasWRnvzBDJyRO',
    price_id: 'price_1Sdgl355Obu9Ws2AJSDpYobS',
    name: 'Pro',
    level: 2,
    limits: {
      watchlistItems: -1, // unlimited
      alerts: -1,
      realtimeUpdates: true,
      advancedAlerts: true,
      technicalIndicators: true,
      aiInsights: false,
      portfolioAnalytics: false,
      apiAccess: false,
    },
  },
  enterprise: {
    product_id: 'prod_TkpwnCgV0ufGIO',
    price_id: 'price_1SnKGa55Obu9Ws2Agjud74qj',
    name: 'Enterprise',
    level: 3,
    limits: {
      watchlistItems: -1,
      alerts: -1,
      realtimeUpdates: true,
      advancedAlerts: true,
      technicalIndicators: true,
      aiInsights: true,
      portfolioAnalytics: true,
      apiAccess: true,
    },
  },
} as const;

export type TierKey = keyof typeof SUBSCRIPTION_TIERS;
export type FeatureKey = keyof typeof SUBSCRIPTION_TIERS.free.limits;

interface SubscriptionState {
  isLoading: boolean;
  isSubscribed: boolean;
  currentTier: TierKey;
  productId: string | null;
  subscriptionEnd: string | null;
}

interface SubscriptionContextType extends SubscriptionState {
  checkSubscription: () => Promise<void>;
  hasFeature: (feature: FeatureKey) => boolean;
  getLimit: (feature: FeatureKey) => number;
  canUseFeature: (feature: FeatureKey, currentUsage?: number) => boolean;
  getTierName: () => string;
  isAtLeastTier: (tier: TierKey) => boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(
  undefined
);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, session } = useAuth();
  const [state, setState] = useState<SubscriptionState>({
    isLoading: true,
    isSubscribed: false,
    currentTier: 'free',
    productId: null,
    subscriptionEnd: null,
  });

  const getTierFromProductId = (productId: string | null): TierKey => {
    if (!productId) return 'free';

    for (const [key, tier] of Object.entries(SUBSCRIPTION_TIERS)) {
      if (tier.product_id === productId) {
        return key as TierKey;
      }
    }
    return 'free';
  };

  const checkSubscription = useCallback(async () => {
    if (!session?.access_token) {
      setState({
        isLoading: false,
        isSubscribed: false,
        currentTier: 'free',
        productId: null,
        subscriptionEnd: null,
      });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const { data, error } = await supabase.functions.invoke(
        'check-subscription',
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (error) throw error;

      const tier = getTierFromProductId(data.product_id);

      setState({
        isLoading: false,
        isSubscribed: data.subscribed,
        currentTier: tier,
        productId: data.product_id,
        subscriptionEnd: data.subscription_end,
      });
    } catch (error) {
      console.error('Error checking subscription:', error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
      }));
    }
  }, [session?.access_token]);

  // Check subscription on mount and when user changes
  useEffect(() => {
    if (user) {
      checkSubscription();
    } else {
      setState({
        isLoading: false,
        isSubscribed: false,
        currentTier: 'free',
        productId: null,
        subscriptionEnd: null,
      });
    }
  }, [user, checkSubscription]);

  // Periodically refresh subscription status (every 5 minutes)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(checkSubscription, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, checkSubscription]);

  const hasFeature = useCallback(
    (feature: FeatureKey): boolean => {
      const limits = SUBSCRIPTION_TIERS[state.currentTier].limits;
      const value = limits[feature];

      // Boolean features
      if (typeof value === 'boolean') {
        return value;
      }

      // Numeric features - return true if limit is positive or unlimited (-1)
      return value > 0 || value === -1;
    },
    [state.currentTier]
  );

  const getLimit = useCallback(
    (feature: FeatureKey): number => {
      const limits = SUBSCRIPTION_TIERS[state.currentTier].limits;
      const value = limits[feature];

      if (typeof value === 'boolean') {
        return value ? -1 : 0;
      }

      return value;
    },
    [state.currentTier]
  );

  const canUseFeature = useCallback(
    (feature: FeatureKey, currentUsage?: number): boolean => {
      const limit = getLimit(feature);

      // Unlimited
      if (limit === -1) return true;

      // No access
      if (limit === 0) return false;

      // Check against current usage
      if (currentUsage !== undefined) {
        return currentUsage < limit;
      }

      return true;
    },
    [getLimit]
  );

  const getTierName = useCallback((): string => {
    return SUBSCRIPTION_TIERS[state.currentTier].name;
  }, [state.currentTier]);

  const isAtLeastTier = useCallback(
    (tier: TierKey): boolean => {
      const requiredLevel = SUBSCRIPTION_TIERS[tier].level;
      const currentLevel = SUBSCRIPTION_TIERS[state.currentTier].level;
      return currentLevel >= requiredLevel;
    },
    [state.currentTier]
  );

  return (
    <SubscriptionContext.Provider
      value={{
        ...state,
        checkSubscription,
        hasFeature,
        getLimit,
        canUseFeature,
        getTierName,
        isAtLeastTier,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error(
      'useSubscription must be used within a SubscriptionProvider'
    );
  }
  return context;
};
