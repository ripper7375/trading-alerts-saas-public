import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Lock,
  Mail,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Zap,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/lib/types';
import { toast } from 'sonner';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, switchRole } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      login(email || 'trader@davintrade.com');
      toast.success('Welcome back to DavinTrade!');
      navigate('/terminal');
    }, 700);
  };

  const handleQuickDemoLogin = (role: UserRole) => {
    switchRole(role);
    toast.success(`Switched session to ${role} role`);
    navigate('/terminal');
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-5">
        {/* Brand Header */}
        <div className="space-y-1.5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 font-black text-slate-950 shadow-lg shadow-amber-500/20">
            <TrendingUp className="h-6 w-6 stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Sign In to DavinTrade
          </h1>
          <p className="text-xs text-muted-foreground">
            Access your sub-500ms fractal trading alerts & AI analyst
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-border/80 bg-card shadow-2xl">
          <CardContent className="p-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="trader@example.com"
                    className="pl-10 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-[11px] font-bold text-amber-500 hover:underline"
                  >
                    Forgot?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 text-xs"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="h-11 w-full bg-amber-500 text-xs font-bold text-slate-950 shadow-md shadow-amber-500/20 hover:bg-amber-400"
              >
                <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>

            <div className="mt-4 border-t border-border/60 pt-4 text-center text-xs text-muted-foreground">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-bold text-amber-500 hover:underline"
              >
                Create Account
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* 1-Tap Role Preview Switcher for Testing */}
        <div className="space-y-2 rounded-2xl border border-border/80 bg-card/60 p-3.5 text-center">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            ⚡ Quick 1-Tap Role Preview
          </span>
          <div className="grid grid-cols-5 gap-1.5">
            {[
              { id: 'NL', label: 'Guest' },
              { id: 'FT', label: 'Free' },
              { id: 'PT', label: 'Pro' },
              { id: 'AF', label: 'Aff+Free' },
              { id: 'AP', label: 'Aff+Pro' },
            ].map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleQuickDemoLogin(r.id as UserRole)}
                className="rounded-lg border border-border/60 bg-muted/40 px-1 py-1.5 font-mono text-[10px] font-bold transition-colors hover:border-amber-500 hover:text-amber-500"
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
