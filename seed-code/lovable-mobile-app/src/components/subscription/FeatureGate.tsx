import { useNavigate } from 'react-router-dom';
import { Lock, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  useSubscription,
  TierKey,
  FeatureKey,
} from '@/contexts/SubscriptionContext';
import { cn } from '@/lib/utils';

interface FeatureGateProps {
  /** The feature to check access for */
  feature?: FeatureKey;
  /** Minimum tier required (alternative to feature) */
  requiredTier?: TierKey;
  /** Current usage count for limit-based features */
  currentUsage?: number;
  /** Content to show when user has access */
  children: React.ReactNode;
  /** What to show when locked - defaults to upgrade prompt */
  fallback?: React.ReactNode;
  /** If true, shows a subtle lock indicator instead of full block */
  subtle?: boolean;
  /** Custom message for the upgrade prompt */
  upgradeMessage?: string;
}

export const FeatureGate = ({
  feature,
  requiredTier,
  currentUsage,
  children,
  fallback,
  subtle = false,
  upgradeMessage,
}: FeatureGateProps) => {
  const navigate = useNavigate();
  const { hasFeature, canUseFeature, isAtLeastTier, getTierName } =
    useSubscription();

  // Check access based on feature or tier
  let hasAccess = true;

  if (feature) {
    hasAccess =
      currentUsage !== undefined
        ? canUseFeature(feature, currentUsage)
        : hasFeature(feature);
  }

  if (requiredTier) {
    hasAccess = hasAccess && isAtLeastTier(requiredTier);
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  // Custom fallback
  if (fallback) {
    return <>{fallback}</>;
  }

  // Subtle indicator
  if (subtle) {
    return (
      <div className="relative">
        <div className="pointer-events-none opacity-50">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="flex cursor-pointer items-center gap-1 rounded-full bg-muted/80 px-2 py-1 backdrop-blur"
            onClick={() => navigate('/settings/subscription')}
          >
            <Lock className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Upgrade</span>
          </div>
        </div>
      </div>
    );
  }

  // Full upgrade prompt
  const message =
    upgradeMessage ||
    `This feature requires a ${requiredTier || 'higher'} plan`;

  return (
    <Card className="border-dashed border-muted-foreground/30">
      <CardContent className="flex flex-col items-center justify-center px-4 py-8 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Crown className="h-6 w-6 text-primary" />
        </div>
        <h3 className="mb-2 font-semibold text-foreground">Upgrade Required</h3>
        <p className="mb-4 max-w-xs text-sm text-muted-foreground">{message}</p>
        <p className="mb-4 text-xs text-muted-foreground">
          Current plan: <span className="font-medium">{getTierName()}</span>
        </p>
        <Button onClick={() => navigate('/settings/subscription')}>
          View Plans
        </Button>
      </CardContent>
    </Card>
  );
};

interface PremiumBadgeProps {
  tier?: TierKey;
  className?: string;
}

export const PremiumBadge = ({
  tier = 'pro',
  className,
}: PremiumBadgeProps) => {
  const { isAtLeastTier } = useSubscription();

  if (isAtLeastTier(tier)) {
    return null;
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary',
        className
      )}
    >
      <Crown className="h-3 w-3" />
      PRO
    </span>
  );
};

interface UsageLimitIndicatorProps {
  feature: FeatureKey;
  currentUsage: number;
  showUpgrade?: boolean;
}

export const UsageLimitIndicator = ({
  feature,
  currentUsage,
  showUpgrade = true,
}: UsageLimitIndicatorProps) => {
  const navigate = useNavigate();
  const { getLimit, canUseFeature } = useSubscription();

  const limit = getLimit(feature);
  const isUnlimited = limit === -1;
  const canAdd = canUseFeature(feature, currentUsage);
  const isAtLimit = !isUnlimited && currentUsage >= limit;

  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={cn(
          'font-medium',
          isAtLimit ? 'text-destructive' : 'text-muted-foreground'
        )}
      >
        {currentUsage}/{isUnlimited ? '∞' : limit}
      </span>
      {isAtLimit && showUpgrade && (
        <button
          onClick={() => navigate('/settings/subscription')}
          className="text-xs text-primary hover:underline"
        >
          Upgrade for more
        </button>
      )}
    </div>
  );
};
