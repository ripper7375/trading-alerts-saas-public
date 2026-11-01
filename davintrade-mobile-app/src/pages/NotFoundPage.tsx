import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Home, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { isPro } = useAuth();

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20">
        <Compass
          className="h-10 w-10 animate-spin"
          style={{ animationDuration: '10s' }}
        />
      </div>
      <h1 className="mb-2 text-2xl font-black tracking-tight text-foreground">
        404 — Page Not Found
      </h1>
      <p className="mb-8 max-w-xs text-xs leading-relaxed text-muted-foreground">
        The trading chart, alert rule, or page you are looking for has moved or
        does not exist.
      </p>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <Button
          onClick={() => navigate(isPro ? '/terminal' : '/free')}
          className="gap-2 bg-amber-500 font-bold text-slate-950 hover:bg-amber-400"
        >
          <TrendingUp className="h-4 w-4" />
          <span>Open Trading Terminal</span>
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate('/')}
          className="gap-2"
        >
          <Home className="h-4 w-4" />
          <span>Back to Home</span>
        </Button>
      </div>
    </div>
  );
}
