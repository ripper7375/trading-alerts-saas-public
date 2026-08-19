import React, { ReactNode } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface FeatureGateProps {
  featureName: string;
  description?: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureGate({
  featureName,
  description = 'Upgrade to DavinTrade PRO to unlock this feature with unlimited alerts & AI Analyst.',
  children,
  fallback,
}: FeatureGateProps) {
  const { isPro } = useAuth();
  const navigate = useNavigate();

  if (isPro) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="relative rounded-3xl border border-amber-500/30 bg-amber-500/5 p-6 text-center shadow-lg">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
        <Lock className="h-6 w-6" />
      </div>
      <h4 className="mb-1 text-sm font-bold text-foreground">
        {featureName} is a PRO Feature
      </h4>
      <p className="mx-auto mb-4 max-w-xs text-xs text-muted-foreground">
        {description}
      </p>
      <Button
        onClick={() => navigate('/pricing')}
        className="gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 font-extrabold text-slate-950 shadow-md shadow-amber-500/25 hover:from-amber-400 hover:to-amber-500"
      >
        <Sparkles className="h-4 w-4 fill-slate-950" />
        <span>Upgrade to PRO ($29/mo)</span>
      </Button>
    </div>
  );
}
