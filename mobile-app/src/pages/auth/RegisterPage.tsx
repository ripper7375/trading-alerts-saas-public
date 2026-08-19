import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  Lock,
  Mail,
  User,
  ArrowRight,
  TrendingUp,
  Tag,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [refCode, setRefCode] = useState(searchParams.get('ref') || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      register(name, email);
      toast.success('Registration successful! Welcome to DavinTrade.');
      navigate('/welcome');
    }, 800);
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
            Create Your Account
          </h1>
          <p className="text-xs text-muted-foreground">
            Start monitoring MT5 fractal alerts in under 60 seconds
          </p>
        </div>

        {/* Register Card */}
        <Card className="border-border/80 bg-card shadow-2xl">
          <CardContent className="p-5">
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Morgan"
                    className="pl-10 text-xs"
                    required
                  />
                </div>
              </div>

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
                    placeholder="alex@example.com"
                    className="pl-10 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="pl-10 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Referral / Promo Code (Optional)
                </label>
                <div className="relative">
                  <Tag className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    value={refCode}
                    onChange={(e) => setRefCode(e.target.value.toUpperCase())}
                    placeholder="e.g. DAVIN_VIP"
                    className="pl-10 font-mono text-xs uppercase"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="mt-2 h-11 w-full bg-amber-500 text-xs font-bold text-slate-950 shadow-md shadow-amber-500/20 hover:bg-amber-400"
              >
                <span>
                  {loading ? 'Creating Account...' : 'Get Started Free'}
                </span>
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>

            <div className="mt-4 border-t border-border/60 pt-4 text-center text-xs text-muted-foreground">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-bold text-amber-500 hover:underline"
              >
                Sign In
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
